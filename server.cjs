const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { PrismaClient, Prisma } = require('@prisma/client');

// Production Environment Detection and Security Configuration
const isProduction = process.env.NODE_ENV === 'production' || 
                    process.env.WEBSITE_SITE_NAME || 
                    (process.env.APPSETTING_WEBSITE_SITE_NAME && process.env.APPSETTING_WEBSITE_SITE_NAME !== '');

// Set NODE_ENV to production if we're in an Azure environment but it's not set
if (isProduction && !process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
}

console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'} (Production: ${isProduction})`);

// Production-safe error logging utility
const safeErrorLog = (message, errorInfo = {}) => {
    if (process.env.NODE_ENV === 'production') {
        // In production, sanitize error information to prevent path leakage
        const sanitizedInfo = {};
        Object.keys(errorInfo).forEach(key => {
            if (key === 'stack') {
                // Don't log stack traces in production
                sanitizedInfo[key] = '[REDACTED IN PRODUCTION]';
            } else if (typeof errorInfo[key] === 'string') {
                // Remove file paths from any string values
                sanitizedInfo[key] = errorInfo[key]
                    .replace(/\/[^:\s]*\/[^:\s]*\//g, '.../')
                    .replace(/C:\\[^:\s]*\\[^:\s]*\\/g, '...\\')
                    .replace(/\/Users\/[^\/]*\/[^:\s]*\//g, '.../')
                    .replace(/\/opt\/[^:\s]*\//g, '.../');
            } else {
                sanitizedInfo[key] = errorInfo[key];
            }
        });
        console.error(message, sanitizedInfo);
    } else {
        // In development, log everything
        console.error(message, errorInfo);
    }
};

// Enhanced security-hardened email validation function
const validateEmailServer = (email) => {
    // Input length protection (125 character limit)
    if (!email || email.length > 125) {
        return { valid: false, reason: 'Invalid email length' };
    }
    
    // Normalize and sanitize
    const normalizedEmail = email.trim().toLowerCase();
    
    // Injection attack protection
    if (normalizedEmail.match(/[\x00-\x1f\x7f-\x9f]/) || 
        normalizedEmail.includes('\n') || 
        normalizedEmail.includes('\r') ||
        normalizedEmail.includes('\t')) {
        return { valid: false, reason: 'Invalid characters detected' };
    }
    
    // Enhanced regex pattern (security-hardened)
    const secureEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!secureEmailRegex.test(normalizedEmail)) {
        return { valid: false, reason: 'Invalid email format' };
    }
    
    // Additional domain validation
    const domain = normalizedEmail.split('@')[1];
    if (domain.length > 253 || domain.startsWith('-') || domain.endsWith('-')) {
        return { valid: false, reason: 'Invalid domain format' };
    }
    
    return { valid: true, email: normalizedEmail };
};

// Military call sign generator for company names
const generateMilitaryCallSign = async () => {
    const militaryTerms = [
        // Brand-aligned terms
        'GUARDIAN', 'SHIELD', 'DRAGON',
        // Animals
        'HAWK', 'EAGLE', 'VIPER', 'WOLF', 'BEAR', 'LION', 'TIGER', 'SHARK', 
        'RAVEN', 'FALCON', 'COBRA', 'LYNX', 'PANTHER', 'JAGUAR',
        // Weather/Elements
        'STORM', 'THUNDER', 'LIGHTNING', 'FROST', 'BLAZE', 'STEEL', 'FLAME', 
        'ICE', 'WIND', 'RAIN', 'SNOW', 'CYCLONE',
        // Military Terms
        'GHOST', 'SHADOW', 'PHANTOM', 'ALPHA', 'BRAVO', 'DELTA', 'ECHO', 
        'FOXTROT', 'ROMEO', 'SIERRA', 'TANGO', 'VICTOR',
        // Action Words
        'STRIKE', 'GUARD', 'SWORD', 'LANCE', 'BOLT', 'ARROW', 'SPEAR', 
        'TITAN', 'NOVA', 'NEXUS', 'APEX', 'FORGE'
    ];
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
        // Generate random call sign
        const randomTerm = militaryTerms[Math.floor(Math.random() * militaryTerms.length)];
        const randomNumber = Math.floor(Math.random() * 90) + 10; // 10-99
        const callSign = `${randomTerm}-${randomNumber}`;
        
        // Check if call sign already exists in database
        try {
            const existingCompany = await prisma.$queryRaw`
                SELECT COMPANY_ID FROM GUARDIAN.COMPANY 
                WHERE NAME = ${callSign}
            `;
            
            if (existingCompany.length === 0) {
                console.log(`✅ Generated unique military call sign: ${callSign}`);
                return callSign;
            }
            
            console.log(`⚠️ Call sign ${callSign} already exists, generating new one...`);
            attempts++;
        } catch (error) {
            console.error('❌ Error checking call sign uniqueness:', error);
            attempts++;
        }
    }
    
    // Fallback: use timestamp-based call sign if all attempts fail
    const fallbackCallSign = `GUARDIAN-${Date.now().toString().slice(-4)}`;
    console.log(`⚠️ Using fallback call sign: ${fallbackCallSign}`);
    return fallbackCallSign;
};

// ========== REGISTRATION CLEANUP FUNCTIONS ==========

/**
 * Comprehensive cleanup of incomplete registration data
 * Removes stale unverified users and related data to prevent conflicts
 * @param {string} email - Email address to clean up
 * @param {number} timeoutMinutes - Age threshold for cleanup (default: 30 minutes)
 * @returns {Promise<Object>} Cleanup results with counts and details
 */
const cleanupIncompleteRegistrations = async (email, timeoutMinutes = 30) => {
    try {
        console.log(`🧹 [CLEANUP] Starting comprehensive cleanup for email: ${email} (timeout: ${timeoutMinutes} minutes)`);
        
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            throw new Error(`Invalid email format: ${email}`);
        }
        const normalizedEmail = emailValidation.email;
        
        const cleanupResults = {
            email: normalizedEmail,
            timeoutMinutes,
            startTime: new Date().toISOString(),
            totalCleaned: 0,
            details: {
                staleUnverifiedUsers: 0,
                expiredTokens: 0,
                orphanedCompanies: 0,
                orphanedRoles: 0,
                errors: []
            }
        };

        // Step 1: Identify stale unverified users (older than timeout)
        console.log(`🔍 [CLEANUP] Step 1: Identifying stale unverified users for ${normalizedEmail}...`);
        const staleUsers = await prisma.$queryRaw`
            SELECT 
                u.USER_ID, 
                u.EMAIL, 
                u.CREATE_DATE, 
                u.EMAIL_VALIDATED, 
                u.EMAIL_VALIDATION_TOKEN_EXPIRY,
                u.COMPANY_ID,
                DATEDIFF(MINUTE, u.CREATE_DATE, GETDATE()) as AGE_MINUTES
            FROM GUARDIAN.USERS u
            WHERE LOWER(TRIM(u.EMAIL)) = LOWER(TRIM(${normalizedEmail}))
                AND u.EMAIL_VALIDATED = 0
                AND u.CREATE_DATE < DATEADD(MINUTE, -${timeoutMinutes}, GETDATE())
            ORDER BY u.CREATE_DATE DESC
        `;

        if (staleUsers.length === 0) {
            console.log(`✅ [CLEANUP] No stale unverified users found for ${normalizedEmail}`);
            cleanupResults.endTime = new Date().toISOString();
            return cleanupResults;
        }

        console.log(`🔍 [CLEANUP] Found ${staleUsers.length} stale unverified users to clean up:`);
        staleUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. User ID: ${user.USER_ID}, Age: ${user.AGE_MINUTES} minutes, Company ID: ${user.COMPANY_ID || 'None'}`);
        });

        // Step 2: Clean up expired verification tokens (15 minutes)
        console.log(`🧹 [CLEANUP] Step 2: Cleaning up expired verification tokens...`);
        try {
            const expiredTokenCleanup = await prisma.$executeRaw`
                UPDATE GUARDIAN.USERS 
                SET EMAIL_VALIDATION_TOKEN = NULL, 
                    EMAIL_VALIDATION_TOKEN_EXPIRY = NULL,
                    UPDATE_DATE = GETDATE()
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
                    AND EMAIL_VALIDATED = 0
                    AND EMAIL_VALIDATION_TOKEN_EXPIRY < GETDATE()
            `;
            cleanupResults.details.expiredTokens = expiredTokenCleanup;
            console.log(`✅ [CLEANUP] Cleaned up ${expiredTokenCleanup} expired verification tokens`);
        } catch (error) {
            console.error(`❌ [CLEANUP] Error cleaning expired tokens:`, error);
            cleanupResults.details.errors.push(`Expired tokens cleanup: ${error.message}`);
        }

        // Step 3: Remove user role assignments for stale users
        console.log(`🧹 [CLEANUP] Step 3: Removing user role assignments...`);
        for (const user of staleUsers) {
            try {
                const roleCleanup = await prisma.$executeRaw`
                    DELETE FROM GUARDIAN.USER_ROLES 
                    WHERE USER_ID = ${user.USER_ID}
                `;
                console.log(`✅ [CLEANUP] Removed ${roleCleanup} role assignments for user ${user.USER_ID}`);
                cleanupResults.details.orphanedRoles += roleCleanup;
            } catch (error) {
                console.error(`❌ [CLEANUP] Error removing roles for user ${user.USER_ID}:`, error);
                cleanupResults.details.errors.push(`Role cleanup for user ${user.USER_ID}: ${error.message}`);
            }
        }

        // Step 4: Handle orphaned companies (companies created during incomplete registration)
        console.log(`🧹 [CLEANUP] Step 4: Cleaning up orphaned companies...`);
        for (const user of staleUsers) {
            if (user.COMPANY_ID) {
                try {
                    // Check if this company has any other active users
                    const activeUsersInCompany = await prisma.$queryRaw`
                        SELECT COUNT(*) as USER_COUNT
                        FROM GUARDIAN.USERS 
                        WHERE COMPANY_ID = ${user.COMPANY_ID}
                            AND (EMAIL_VALIDATED = 1 OR USER_ID != ${user.USER_ID})
                    `;

                    if (activeUsersInCompany[0].USER_COUNT === 0) {
                        // Company has no other active users, safe to delete
                        const companyCleanup = await prisma.$executeRaw`
                            DELETE FROM GUARDIAN.COMPANY 
                            WHERE COMPANY_ID = ${user.COMPANY_ID}
                        `;
                        console.log(`✅ [CLEANUP] Removed orphaned company ${user.COMPANY_ID} (${companyCleanup} records)`);
                        cleanupResults.details.orphanedCompanies += companyCleanup;
                    } else {
                        console.log(`ℹ️ [CLEANUP] Keeping company ${user.COMPANY_ID} (has ${activeUsersInCompany[0].USER_COUNT} other active users)`);
                    }
                } catch (error) {
                    console.error(`❌ [CLEANUP] Error handling company ${user.COMPANY_ID}:`, error);
                    cleanupResults.details.errors.push(`Company cleanup for ${user.COMPANY_ID}: ${error.message}`);
                }
            }
        }

        // Step 5: Remove stale unverified users (final step)
        console.log(`🧹 [CLEANUP] Step 5: Removing ${staleUsers.length} stale unverified users...`);
        try {
            const userCleanup = await prisma.$executeRaw`
                DELETE FROM GUARDIAN.USERS 
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
                    AND EMAIL_VALIDATED = 0
                    AND CREATE_DATE < DATEADD(MINUTE, -${timeoutMinutes}, GETDATE())
            `;
            cleanupResults.details.staleUnverifiedUsers = userCleanup;
            cleanupResults.totalCleaned = userCleanup;
            console.log(`✅ [CLEANUP] Successfully removed ${userCleanup} stale unverified users`);
        } catch (error) {
            console.error(`❌ [CLEANUP] Error removing stale users:`, error);
            cleanupResults.details.errors.push(`User cleanup: ${error.message}`);
        }

        cleanupResults.endTime = new Date().toISOString();
        const duration = Math.round((new Date(cleanupResults.endTime) - new Date(cleanupResults.startTime)) / 1000);
        
        console.log(`✅ [CLEANUP] Comprehensive cleanup completed for ${normalizedEmail}:`);
        console.log(`   - Duration: ${duration} seconds`);
        console.log(`   - Stale users removed: ${cleanupResults.details.staleUnverifiedUsers}`);
        console.log(`   - Expired tokens cleaned: ${cleanupResults.details.expiredTokens}`);
        console.log(`   - Orphaned companies removed: ${cleanupResults.details.orphanedCompanies}`);
        console.log(`   - Role assignments removed: ${cleanupResults.details.orphanedRoles}`);
        console.log(`   - Errors encountered: ${cleanupResults.details.errors.length}`);

        return cleanupResults;

    } catch (error) {
        console.error(`❌ [CLEANUP] Comprehensive cleanup failed for ${email}:`, error);
        throw new Error(`Cleanup failed: ${error.message}`);
    }
};

/**
 * Periodic maintenance cleanup - removes very old incomplete registrations
 * Should be called periodically to maintain database health
 * @param {number} daysOld - Remove incomplete registrations older than this many days
 * @returns {Promise<Object>} Cleanup summary
 */
const performPeriodicCleanup = async (daysOld = 7) => {
    try {
        console.log(`🔄 [PERIODIC] Starting periodic cleanup of registrations older than ${daysOld} days...`);
        
        const cleanupSummary = {
            startTime: new Date().toISOString(),
            daysOld,
            totalUsersRemoved: 0,
            totalCompaniesRemoved: 0,
            totalRolesRemoved: 0,
            errors: []
        };

        // Find very old unverified users
        const oldUnverifiedUsers = await prisma.$queryRaw`
            SELECT 
                u.USER_ID, 
                u.EMAIL, 
                u.COMPANY_ID,
                DATEDIFF(DAY, u.CREATE_DATE, GETDATE()) as AGE_DAYS
            FROM GUARDIAN.USERS u
            WHERE u.EMAIL_VALIDATED = 0
                AND u.CREATE_DATE < DATEADD(DAY, -${daysOld}, GETDATE())
            ORDER BY u.CREATE_DATE ASC
        `;

        if (oldUnverifiedUsers.length === 0) {
            console.log(`✅ [PERIODIC] No old unverified users found (older than ${daysOld} days)`);
            cleanupSummary.endTime = new Date().toISOString();
            return cleanupSummary;
        }

        console.log(`🔍 [PERIODIC] Found ${oldUnverifiedUsers.length} old unverified users to clean up`);

        // Clean up in batches to avoid overwhelming the database
        const batchSize = 10;
        for (let i = 0; i < oldUnverifiedUsers.length; i += batchSize) {
            const batch = oldUnverifiedUsers.slice(i, i + batchSize);
            console.log(`🧹 [PERIODIC] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(oldUnverifiedUsers.length/batchSize)} (${batch.length} users)...`);

            for (const user of batch) {
                try {
                    // Remove role assignments
                    const roleCleanup = await prisma.$executeRaw`
                        DELETE FROM GUARDIAN.USER_ROLES WHERE USER_ID = ${user.USER_ID}
                    `;
                    cleanupSummary.totalRolesRemoved += roleCleanup;

                    // Handle orphaned companies
                    if (user.COMPANY_ID) {
                        const activeUsersInCompany = await prisma.$queryRaw`
                            SELECT COUNT(*) as USER_COUNT
                            FROM GUARDIAN.USERS 
                            WHERE COMPANY_ID = ${user.COMPANY_ID} AND USER_ID != ${user.USER_ID}
                        `;

                        if (activeUsersInCompany[0].USER_COUNT === 0) {
                            const companyCleanup = await prisma.$executeRaw`
                                DELETE FROM GUARDIAN.COMPANY WHERE COMPANY_ID = ${user.COMPANY_ID}
                            `;
                            cleanupSummary.totalCompaniesRemoved += companyCleanup;
                        }
                    }

                    // Remove user
                    const userCleanup = await prisma.$executeRaw`
                        DELETE FROM GUARDIAN.USERS WHERE USER_ID = ${user.USER_ID}
                    `;
                    cleanupSummary.totalUsersRemoved += userCleanup;

                    console.log(`✅ [PERIODIC] Cleaned up user ${user.USER_ID} (${user.EMAIL}, ${user.AGE_DAYS} days old)`);

                } catch (error) {
                    console.error(`❌ [PERIODIC] Error cleaning user ${user.USER_ID}:`, error);
                    cleanupSummary.errors.push(`User ${user.USER_ID}: ${error.message}`);
                }
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        cleanupSummary.endTime = new Date().toISOString();
        const duration = Math.round((new Date(cleanupSummary.endTime) - new Date(cleanupSummary.startTime)) / 1000);

        console.log(`✅ [PERIODIC] Periodic cleanup completed in ${duration} seconds:`);
        console.log(`   - Users removed: ${cleanupSummary.totalUsersRemoved}`);
        console.log(`   - Companies removed: ${cleanupSummary.totalCompaniesRemoved}`);
        console.log(`   - Role assignments removed: ${cleanupSummary.totalRolesRemoved}`);
        console.log(`   - Errors: ${cleanupSummary.errors.length}`);

        return cleanupSummary;

    } catch (error) {
        console.error(`❌ [PERIODIC] Periodic cleanup failed:`, error);
        throw new Error(`Periodic cleanup failed: ${error.message}`);
    }
};

// ========== END REGISTRATION CLEANUP FUNCTIONS ==========

// Email service using Resend
let sendVerificationEmail, sendInviteEmail;

try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.SMTP_PASSWORD); // Resend API key
    const FROM_EMAIL = process.env.EMAIL_FROM || 'support@shieldlytics.com';

    sendVerificationEmail = async (email, verificationCode) => {
        try {
            console.log(`📧 Sending verification email to: ${email}`);
            
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: [email],
                subject: 'Verify Your Guardian Account',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
                        </div>
                        
                        <h2 style="color: #333; text-align: center;">Verify Your Email Address</h2>
                        
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Thank you for registering with Guardian. Please use the following verification code to complete your registration:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="display: inline-block; background-color: #f5f5f5; padding: 15px 25px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #333;">
                                ${verificationCode}
                            </div>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.
                        </p>
                        
                        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #999; font-size: 12px;">
                                © 2024 Guardian. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            });

            if (error) {
                console.error('❌ Resend error:', error);
                return false;
            }

            console.log('✅ Verification email sent successfully:', data?.id);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return false;
        }
    };

    sendInviteEmail = async (email, token, role) => {
        try {
            console.log(`📧 Sending invite email to: ${email}`);
            
            // Create invite acceptance URL
            const inviteUrl = `${process.env.FRONTEND_URL || 'https://guardian-mvp-dtgph0bcd4ctdbhb.eastus2-01.azurewebsites.net'}/invite/accept?token=${token}`;
            
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: [email],
                subject: 'You\'re Invited to Join Guardian',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
                        </div>
                        
                        <h2 style="color: #333; text-align: center;">You're Invited to Join Guardian</h2>
                        
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            Hello,
                        </p>
                        
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">
                            You have been invited to join Guardian as a <strong>${role}</strong>. Guardian is a comprehensive request management system designed to streamline your organization's workflow.
                        </p>
                        
                        <div style="background-color: #e0f2f1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0D9488;">
                            <h3 style="margin: 0 0 10px 0; color: #0D9488;">Getting Started</h3>
                            <p style="margin: 5px 0; color: #333;">Click the button below to accept your invitation and create your account:</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${inviteUrl}" style="display: inline-block; background-color: #0D9488; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                Accept Invitation
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            If the button doesn't work, you can copy and paste this link into your browser:
                        </p>
                        
                        <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px; color: #666; margin: 15px 0;">
                            ${inviteUrl}
                        </div>
                        
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            This invitation will expire in 7 days. If you didn't expect this invitation or have any questions, please contact your administrator.
                        </p>
                        
                        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #999; font-size: 12px;">
                                © 2024 Guardian. All rights reserved.
                            </p>
                        </div>
                    </div>
                `
            });
            
            if (error) {
                console.error('❌ Resend error:', error);
                return false;
            }
            
            console.log('✅ Invite email sent successfully:', data?.id);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return false;
        }
    };

    sendAssignmentEmail = async (email, userName, requestName, trackingId, assignedBy) => {
        try {
            console.log(`📧 Sending assignment email to: ${email}`);
            
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: [email],
                subject: `New Request Assignment - ${requestName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
                        </div>
                        
                        <h2 style="color: #333; text-align: center;">New Request Assignment</h2>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px; color: #333;">
                                Hello ${userName},
                            </p>
                            <p style="margin: 15px 0 0 0; font-size: 16px; color: #333;">
                                You have been assigned to a new request:
                            </p>
                        </div>

                        <div style="background-color: #e0f2f1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0D9488;">
                            <h3 style="margin: 0 0 10px 0; color: #0D9488;">Request Details</h3>
                            <p style="margin: 5px 0; color: #333;"><strong>Request Name:</strong> ${requestName}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>Tracking ID:</strong> ${trackingId}</p>
                            <p style="margin: 5px 0; color: #333;"><strong>Assigned By:</strong> ${assignedBy}</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <p style="margin: 0; color: #666; font-size: 14px;">
                                Please log in to your Guardian account to view and work on this request.
                            </p>
                        </div>

                        <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="margin: 0; color: #999; font-size: 12px;">
                                This is an automated message from Guardian. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `
            });

            if (error) {
                console.error('❌ Resend error:', error);
                return false;
            }

            console.log(`✅ Assignment email sent successfully to ${email}:`, data?.id);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return false;
        }
    };

    sendTaskAssignmentEmail = async (email, userName, requestName, trackingId, taskDescription, taskId, assignedBy) => {
        try {
            console.log(`📧 Sending task assignment email to: ${email}`);
            
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: [email],
                subject: `New Task Assignment - ${requestName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #0D9488; margin: 0;">Guardian</h1>
                        </div>
                        
                        <h2 style="color: #333; text-align: center;">New Task Assignment</h2>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px; color: #333;">
                                Hello ${userName},
                            </p>
                            <p style="margin: 15px 0 0 0; font-size: 16px; color: #333;">
                                You have been assigned a new task by ${assignedBy}.
                            </p>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1976d2;">
                            <h3 style="margin: 0 0 15px 0; color: #1976d2; font-size: 18px;">Task Details</h3>
                            <p style="margin: 0 0 10px 0; color: #333;"><strong>Task ID:</strong> ${taskId}</p>
                            <p style="margin: 0 0 10px 0; color: #333;"><strong>Request:</strong> ${requestName} (${trackingId})</p>
                            <p style="margin: 0 0 10px 0; color: #333;"><strong>Description:</strong> ${taskDescription}</p>
                            <p style="margin: 0; color: #333;"><strong>Assigned by:</strong> ${assignedBy}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <p style="margin: 0; color: #666; font-size: 14px;">
                                Please log in to your Guardian account to view and work on this task.
                            </p>
                        </div>
                        
                        <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="margin: 0; color: #999; font-size: 12px;">
                                This is an automated message from Guardian. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                `
            });

            if (error) {
                console.error('❌ Resend error:', error);
                return false;
            }

            console.log(`✅ Task assignment email sent successfully to ${email}:`, data?.id);
            return true;
        } catch (error) {
            console.error('❌ Task email sending failed:', error);
            return false;
        }
    };

    console.log('✅ Email service initialized with Resend');
} catch (error) {
    console.log('⚠️ Resend not available, using fallback mode:', error.message);
    sendVerificationEmail = async (email, code) => {
        console.log(`📧 [FALLBACK] Would send verification email to ${email} with code: ${code}`);
        return false; // Return false to indicate email not sent
    };
    sendInviteEmail = async (email, token, role) => {
        console.log(`📧 [FALLBACK] Would send invite email to ${email} with token: ${token} (role: ${role})`);
        console.log(`⚠️ Email service not available - invite record created but email not sent`);
        return false; // Return false to indicate email not sent
    };
    sendAssignmentEmail = async (email, userName, requestName, trackingId, assignedBy) => {
        console.log(`📧 [FALLBACK] Would send assignment email to ${email} for request: ${requestName} (${trackingId})`);
        return false; // Return false to indicate email not sent
    };
    sendTaskAssignmentEmail = async (email, userName, requestName, trackingId, taskDescription, taskId, assignedBy) => {
        console.log(`📧 [FALLBACK] Would send task assignment email to ${email} for task: ${taskDescription} (${taskId})`);
        return false; // Return false to indicate email not sent
    };
}

console.log('=== GUARDIAN SIMPLE SERVER STARTING ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${process.env.PORT || 3000}`);
console.log(`Process PID: ${process.pid}`);
console.log(`Current working directory: ${process.cwd()}`);

const app = express();
const PORT = process.env.PORT || 3000;

console.log('📦 Creating Prisma client...');
// Initialize Prisma with timeout
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'guardian-jwt-secret-key';
console.log('🔑 JWT configured');

// Test database connection with timeout
console.log('🔌 Testing database connection...');
const connectWithTimeout = () => {
  return Promise.race([
    prisma.$connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout after 10 seconds')), 10000)
    )
  ]);
};

connectWithTimeout()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.log('⚠️ Continuing without database connection...');
  });

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// === STATIC FILE SERVING ===
// In development mode, static files are served by Vite dev server (port 5175)
// This backend server (port 3001) only handles API endpoints
console.log('🔧 Development mode: Static files served by Vite on port 5175');

// === API ROUTES ===

// Basic health check (no database required)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        server: 'Guardian MVP Simple Server', 
        port: PORT,
        nodeVersion: process.version,
        uptime: process.uptime()
    });
});

// Error email rate limiting (in-memory store)
const errorEmailRateLimit = new Map();
const ERROR_EMAIL_LIMIT_PER_MINUTE = 3; // Max 3 error emails per minute
const ERROR_EMAIL_RESET_TIME = 60 * 1000; // 1 minute

// Send error email endpoint
app.post('/api/send-error-email', async (req, res) => {
    try {
        const { to, subject, errorDetails, htmlBody } = req.body;
        
        // Environment detection - only send emails in production
        const isProduction = process.env.NODE_ENV === 'production' || 
                           process.env.AZURE_CLIENT_ID || 
                           req.get('host')?.includes('azurewebsites.net');

        console.log('📧 Error email request received:', {
            errorType: errorDetails?.errorType || 'unknown',
            mainError: errorDetails?.mainError || 'Unknown error',
            pageName: errorDetails?.pageName || 'Unknown page',
            url: errorDetails?.url,
            userId: errorDetails?.userId,
            isProduction,
            timestamp: errorDetails?.timestamp || new Date().toISOString()
        });

        // Rate limiting for error emails to prevent spam
        const rateLimitKey = `error-email-${to || 'unknown'}`;
        const now = Date.now();
        const rateLimitData = errorEmailRateLimit.get(rateLimitKey);

        if (rateLimitData) {
            // Reset counter if time window has passed
            if (now - rateLimitData.firstRequest > ERROR_EMAIL_RESET_TIME) {
                errorEmailRateLimit.set(rateLimitKey, { count: 1, firstRequest: now });
            } else if (rateLimitData.count >= ERROR_EMAIL_LIMIT_PER_MINUTE) {
                console.log('🚫 Error email rate limited:', {
                    email: to,
                    attempts: rateLimitData.count,
                    timeWindow: ERROR_EMAIL_RESET_TIME / 1000
                });
                
                return res.json({
                    success: true,
                    message: 'Error logged (rate limited)',
                    rateLimited: true
                });
            } else {
                rateLimitData.count++;
            }
        } else {
            errorEmailRateLimit.set(rateLimitKey, { count: 1, firstRequest: now });
        }

        // Always log the error for debugging
        safeErrorLog('🚨 Application Error Captured:', {
            type: errorDetails?.errorType?.toUpperCase() || 'UNKNOWN',
            message: errorDetails?.mainError || 'Unknown error',
            page: errorDetails?.pageName,
            function: errorDetails?.functionName,
            line: errorDetails?.lineNumber,
            file: errorDetails?.fileName,
            url: errorDetails?.url,
            userId: errorDetails?.userId,
            email: errorDetails?.email,
            userAgent: errorDetails?.userAgent?.substring(0, 100) + '...',
            stackTrace: errorDetails?.stackTrace?.substring(0, 500) + '...',
            timestamp: errorDetails?.timestamp || new Date().toISOString(),
            // API-specific details if available
            apiEndpoint: errorDetails?.apiEndpoint,
            apiMethod: errorDetails?.apiMethod,
            apiStatusCode: errorDetails?.apiStatusCode,
            componentStack: errorDetails?.componentStack?.substring(0, 200) + '...'
        });

        // Only send actual emails in production environment
        if (!isProduction) {
            console.log('📧 Development mode - Error email NOT sent (logged only)');
            return res.json({ 
                success: true, 
                message: 'Error logged (development mode - email not sent)',
                environment: 'development'
            });
        }

        // Validate required fields for email sending
        if (!to || !subject || !htmlBody) {
            console.error('❌ Missing required fields for error email:', { to: !!to, subject: !!subject, htmlBody: !!htmlBody });
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'to, subject, and htmlBody are required'
            });
        }

        // Send email via Resend API in production
        try {
            const emailResult = await resend.emails.send({
                from: FROM_EMAIL,
                to: [to],
                subject: subject,
                html: htmlBody,
                headers: {
                    'X-Guardian-Error-Type': errorDetails?.errorType || 'unknown',
                    'X-Guardian-Page': errorDetails?.pageName || 'unknown',
                    'X-Guardian-User-ID': errorDetails?.userId || 'anonymous'
                }
            });

            console.log('✅ Error email sent successfully:', {
                emailId: emailResult.data?.id,
                to: to,
                subject: subject.substring(0, 50) + '...',
                errorType: errorDetails?.errorType,
                page: errorDetails?.pageName
            });

            res.json({
                success: true,
                message: 'Error email sent successfully',
                emailId: emailResult.data?.id,
                environment: 'production'
            });

        } catch (emailError) {
            console.error('❌ Failed to send error email via Resend:', {
                error: emailError.message,
                code: emailError.code,
                to: to,
                subject: subject.substring(0, 50) + '...'
            });

            // Don't fail the request if email sending fails - error is still logged
            res.json({
                success: true,
                message: 'Error logged (email sending failed)',
                emailError: emailError.message,
                environment: 'production'
            });
        }
        
    } catch (err) {
        // Only log stack traces in development to prevent file path leakage
        const isProduction = process.env.NODE_ENV === 'production';
        
        safeErrorLog('❌ Error in send-error-email endpoint:', {
            error: err.message,
            stack: err.stack?.substring(0, 500) + '...'
        });
        
        res.status(500).json({ 
            error: 'Failed to process error email',
            message: err.message 
        });
    }
});

// Basic test endpoint
app.get('/api/test', (req, res) => {
    res.json({success: true, message: 'API is working!', timestamp: new Date().toISOString()});
});

// Asset verification debug endpoint
app.get('/api/debug/assets', async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        console.log('🔍 Asset verification requested');
        
        // Check for critical files and directories
        const assetsDir = path.join(__dirname, 'assets');
        const indexFile = path.join(__dirname, 'index.html');
        
        const verification = {
            timestamp: new Date().toISOString(),
            deployment_directory: __dirname,
            checks: {
                index_html: fs.existsSync(indexFile),
                assets_directory: fs.existsSync(assetsDir),
                assets_contents: [],
                total_files: 0
            }
        };
        
        // List assets directory contents if it exists
        if (verification.checks.assets_directory) {
            try {
                const assetFiles = fs.readdirSync(assetsDir);
                verification.checks.assets_contents = assetFiles.map(file => {
                    const filePath = path.join(assetsDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        type: path.extname(file),
                        modified: stats.mtime
                    };
                });
                verification.checks.total_files = assetFiles.length;
            } catch (err) {
                verification.checks.assets_error = err.message;
            }
        }
        
        // Check for common asset patterns
        if (verification.checks.assets_directory) {
            const hasJS = verification.checks.assets_contents.some(f => f.name.includes('index-') && f.name.endsWith('.js'));
            const hasCSS = verification.checks.assets_contents.some(f => f.name.includes('index-') && f.name.endsWith('.css'));
            
            verification.checks.critical_assets = {
                main_js_found: hasJS,
                main_css_found: hasCSS,
                total_js_files: verification.checks.assets_contents.filter(f => f.name.endsWith('.js')).length,
                total_css_files: verification.checks.assets_contents.filter(f => f.name.endsWith('.css')).length
            };
        }
        
        console.log('📊 Asset verification:', verification);
        res.json(verification);
        
    } catch (error) {
        console.error('❌ Asset verification failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Asset verification failed',
            error: error.message
        });
    }
});

// Deployment info debug endpoint
app.get('/api/debug/deployment', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        console.log('🔍 Deployment info requested');
        
        const deploymentInfo = {
            timestamp: new Date().toISOString(),
            server_info: {
                working_directory: __dirname,
                node_version: process.version,
                platform: process.platform,
                uptime: process.uptime(),
                memory_usage: process.memoryUsage(),
                environment: process.env.NODE_ENV || 'development'
            },
            static_serving: {
                enabled: true,
                method: 'express_static_with_spa_fallback',
                directory: '.',
                notes: 'Express serves static files with SPA fallback route'
            },
            files_check: {
                server_cjs: fs.existsSync(path.join(__dirname, 'server.cjs')),
                index_html: fs.existsSync(path.join(__dirname, 'index.html')),
                package_json: fs.existsSync(path.join(__dirname, 'package.json')),
                assets_dir: fs.existsSync(path.join(__dirname, 'assets'))
            }
        };
        
        console.log('📊 Deployment info:', deploymentInfo);
        res.json(deploymentInfo);
        
    } catch (error) {
        console.error('❌ Deployment info failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Deployment info failed',
            error: error.message
        });
    }
});

// Asset serving test endpoint - serves a specific asset through Node.js
app.get('/api/debug/serve-asset/:filename', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const filename = req.params.filename;
        const assetPath = path.join(__dirname, 'assets', filename);
        
        console.log(`🔍 Testing asset serving for: ${filename}`);
        console.log(`🔍 Full path: ${assetPath}`);
        
        if (!fs.existsSync(assetPath)) {
            console.log(`❌ Asset not found: ${assetPath}`);
            return res.status(404).json({
                status: 'not_found',
                filename,
                path: assetPath,
                message: 'Asset file not found'
            });
        }
        
        // Set proper content type
        if (filename.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filename.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        
        console.log(`✅ Serving asset through Node.js: ${filename}`);
        res.sendFile(assetPath);
        
    } catch (error) {
        console.error('❌ Asset serving failed:', error);
        res.status(500).json({
            status: 'error',
            filename: req.params.filename,
            message: 'Asset serving failed',
            error: error.message
        });
    }
});

app.get('/api/debug/endpoints', (req, res) => {
    res.json({
        success: true,
        message: 'Development server running latest code with all endpoints',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        endpoints: [
            '/api/me', '/api/users', '/api/users/company/:companyId', '/api/invites', 
            '/api/contact-groups', '/api/contact-groups/:id', '/api/contact-groups/:id/members',
            '/api/roles', '/api/requests', '/api/requests/:id', '/api/forms', '/api/forms-groups', '/api/fields', '/api/field-types',
            '/api/custom-templates', '/api/custom-templates/:id',
            '/api/login', '/api/register', '/api/verify-email', '/api/complete-registration',
            '/api/validate-email', '/api/send-verification-email', 
            '/api/request-password-reset', '/api/verify-reset-code', '/api/reset-password'
        ]
    });
});

// Middleware to get authenticated user's company ID
const getAuthenticatedUserCompany = async (req, res, next) => {
    try {
        console.log(`🔍 [AUTH] Processing request for: ${req.method} ${req.path}`);
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error(`❌ [AUTH] No valid auth header found for ${req.path}:`, authHeader ? authHeader.substring(0, 20) + '...' : 'null');
            return res.status(401).json({ error: 'No valid authentication token provided' });
        }

        const token = authHeader.substring(7);
        console.log(`🔍 Attempting to verify JWT token (length: ${token.length}, first 20 chars: ${token.substring(0, 20)}...)`);
        
        // Add additional token validation before JWT verification
        if (token.length < 10) {
            console.error('❌ Token too short:', token.length);
            return res.status(401).json({ error: 'Invalid token format' });
        }
        
        // Check if token looks like a proper JWT (has 3 parts separated by dots)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            console.error('❌ Token does not have 3 parts:', tokenParts.length);
            return res.status(401).json({ error: 'Invalid token structure' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        console.log('✅ JWT token verified successfully for user:', decoded.id);
        
        // Validate that userId exists and is valid in the token
        if (!decoded.id || decoded.id === undefined || decoded.id === null) {
            console.error('❌ JWT token contains invalid or missing userId:', decoded.id);
            return res.status(401).json({ error: 'Invalid token: missing user identification' });
        }
        
        // Get user's company ID and roles from database using raw SQL
        const users = await prisma.$queryRaw`
            SELECT u.USER_ID, u.COMPANY_ID, u.EMAIL,
                   STRING_AGG(ur.ROLE_ID, ',') as ROLE_IDS
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID AND ur.STATUS = 'P'
            WHERE u.USER_ID = ${decoded.id}
            GROUP BY u.USER_ID, u.COMPANY_ID, u.EMAIL
        `;
        const user = users.length > 0 ? users[0] : null;

        if (!user) {
            console.error('❌ User not found in database for userId:', decoded.id);
            return res.status(401).json({ error: 'User not found' });
        }

        console.log(`✅ Authentication successful for user ${user.USER_ID} in company ${user.COMPANY_ID}`);
        req.user = user;
        req.userId = user.USER_ID;
        req.companyId = user.COMPANY_ID;
        req.userRoleIds = user.ROLE_IDS ? user.ROLE_IDS.split(',').map(id => parseInt(id)) : [];
        next();
    } catch (error) {
        safeErrorLog('❌ Authentication error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n')[0] // Just first line of stack trace
        });
        // Enhanced error handling with specific error types
        if (error.name === 'TokenExpiredError') {
            console.error('❌ JWT token expired at:', error.expiredAt);
            return res.status(401).json({ 
                error: 'Authentication token has expired',
                errorType: 'TOKEN_EXPIRED',
                expiredAt: error.expiredAt 
            });
        } else if (error.name === 'JsonWebTokenError') {
            console.error('❌ JWT token malformed:', error.message);
            return res.status(401).json({ 
                error: 'Invalid authentication token format',
                errorType: 'TOKEN_MALFORMED'
            });
        } else if (error.name === 'NotBeforeError') {
            console.error('❌ JWT token not active yet:', error.date);
            return res.status(401).json({ 
                error: 'Authentication token not yet active',
                errorType: 'TOKEN_NOT_ACTIVE'
            });
        } else {
            return res.status(401).json({ 
                error: 'Invalid authentication token',
                errorType: 'TOKEN_INVALID'
            });
        }
    }
};

// Debug authentication endpoint 
app.get('/api/debug/auth-test', getAuthenticatedUserCompany, (req, res) => {
    console.log('🔍 [DEBUG] Auth test endpoint reached successfully');
    res.json({
        success: true,
        userId: req.userId,
        companyId: req.companyId,
        userRoleIds: req.userRoleIds,
        message: 'Authentication successful'
    });
});

// Debug endpoint to check user authentication and roles
app.get('/api/debug/user', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('🔍 Debug user endpoint called');
        
        // Get user's roles
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME as ROLE_NAME
            FROM GUARDIAN.USER_ROLES ur 
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(6);
        
        res.json({
            userId: req.userId,
            companyId: req.companyId,
            roles: userRoles,
            roleIds: roleIds,
            isAdmin: isAdmin,
            canAccessGlobalForms: isAdmin
        });
    } catch (error) {
        console.error('Debug user endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint without authentication to check server status
app.get('/api/debug/status', (req, res) => {
    console.log('🔍 Debug status endpoint called');
    res.json({
        server: 'running',
        timestamp: new Date().toISOString(),
        headers: req.headers.authorization ? 'has auth header' : 'no auth header'
    });
});

// ========== REGISTRATION CLEANUP ENDPOINTS ==========

/**
 * Endpoint for manual cleanup of incomplete registrations
 * Usage: POST /api/cleanup/incomplete-registrations
 * Body: { "email": "user@example.com", "timeoutMinutes": 30 }
 */
app.post('/api/cleanup/incomplete-registrations', async (req, res) => {
    try {
        const { email, timeoutMinutes = 30 } = req.body;
        
        if (!email) {
            return res.status(400).json({
                error: 'Email is required',
                usage: 'POST /api/cleanup/incomplete-registrations with body: { "email": "user@example.com", "timeoutMinutes": 30 }'
            });
        }

        console.log(`🧹 [API] Manual cleanup request for email: ${email} (timeout: ${timeoutMinutes} minutes)`);
        
        const cleanupResults = await cleanupIncompleteRegistrations(email, timeoutMinutes);
        
        res.json({
            success: true,
            message: `Cleanup completed for ${email}`,
            results: cleanupResults
        });

    } catch (error) {
        console.error(`❌ [API] Manual cleanup failed:`, error);
        res.status(500).json({
            error: 'Cleanup failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Endpoint for periodic cleanup of old incomplete registrations
 * Usage: POST /api/cleanup/periodic
 * Body: { "daysOld": 7 }
 */
app.post('/api/cleanup/periodic', async (req, res) => {
    try {
        const { daysOld = 7 } = req.body;
        
        console.log(`🔄 [API] Periodic cleanup request for registrations older than ${daysOld} days`);
        
        const cleanupSummary = await performPeriodicCleanup(daysOld);
        
        res.json({
            success: true,
            message: `Periodic cleanup completed - removed ${cleanupSummary.totalUsersRemoved} old registrations`,
            summary: cleanupSummary
        });

    } catch (error) {
        console.error(`❌ [API] Periodic cleanup failed:`, error);
        res.status(500).json({
            error: 'Periodic cleanup failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Endpoint to get cleanup statistics without performing cleanup
 * Usage: GET /api/cleanup/stats?daysOld=7
 */
app.get('/api/cleanup/stats', async (req, res) => {
    try {
        const { daysOld = 7 } = req.query;
        
        console.log(`📊 [API] Cleanup statistics request for registrations older than ${daysOld} days`);
        
        // Get statistics without performing cleanup
        const stats = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as TOTAL_UNVERIFIED_USERS,
                COUNT(CASE WHEN CREATE_DATE < DATEADD(DAY, -${daysOld}, GETDATE()) THEN 1 END) as OLD_UNVERIFIED_USERS,
                COUNT(CASE WHEN CREATE_DATE < DATEADD(MINUTE, -30, GETDATE()) THEN 1 END) as STALE_UNVERIFIED_USERS,
                COUNT(CASE WHEN EMAIL_VALIDATION_TOKEN_EXPIRY < GETDATE() THEN 1 END) as EXPIRED_TOKENS
            FROM GUARDIAN.USERS 
            WHERE EMAIL_VALIDATED = 0
        `;
        
        const statistics = stats[0];
        
        res.json({
            success: true,
            message: `Cleanup statistics for registrations older than ${daysOld} days`,
            statistics: {
                totalUnverifiedUsers: Number(statistics.TOTAL_UNVERIFIED_USERS || 0),
                oldUnverifiedUsers: Number(statistics.OLD_UNVERIFIED_USERS || 0),
                staleUnverifiedUsers: Number(statistics.STALE_UNVERIFIED_USERS || 0),
                expiredTokens: Number(statistics.EXPIRED_TOKENS || 0),
                daysOldThreshold: Number(daysOld)
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [API] Cleanup statistics failed:`, error);
        res.status(500).json({
            error: 'Failed to get cleanup statistics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ========== END REGISTRATION CLEANUP ENDPOINTS ==========

// === NOTIFICATION ENDPOINTS ===

// Get user notifications
app.get('/api/notifications', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 50, offset = 0, unreadOnly = false } = req.query;

        console.log(`🔔 Fetching notifications for user ${userId} (Company: ${req.companyId})`);

        let whereClause = `WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}`;
        if (unreadOnly === 'true') {
            whereClause += ` AND IS_READ = 0`;
        }

        // Build the complete SQL query as a string
        let sqlQuery = `
            SELECT 
                NOTIFICATION_ID,
                TYPE,
                TITLE,
                MESSAGE,
                RELATED_ID,
                IS_READ,
                CREATED_DATE
            FROM GUARDIAN.NOTIFICATIONS
            ${whereClause}
            ORDER BY CREATED_DATE DESC
            OFFSET ${parseInt(offset)} ROWS
            FETCH NEXT ${parseInt(limit)} ROWS ONLY
        `;

        const notifications = await prisma.$queryRawUnsafe(sqlQuery);

        console.log(`✅ Found ${notifications.length} notifications`);

        res.json({
            success: true,
            data: notifications,
            count: notifications.length
        });

    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({
            error: 'Failed to fetch notifications',
            message: error.message
        });
    }
});

// Get notification count (unread)
app.get('/api/notifications/count', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = req.userId;

        console.log(`🔢 Getting notification count for user ${userId}`);

        const result = await prisma.$queryRaw`
            SELECT COUNT(*) as unread_count
            FROM GUARDIAN.NOTIFICATIONS
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId} AND IS_READ = 0
        `;

        const unreadCount = parseInt(result[0].unread_count) || 0;

        console.log(`✅ User has ${unreadCount} unread notifications`);

        res.json({
            success: true,
            unreadCount: unreadCount
        });

    } catch (error) {
        console.error('❌ Error getting notification count:', error);
        res.status(500).json({
            error: 'Failed to get notification count',
            message: error.message
        });
    }
});

// Mark notification as read
app.put('/api/notifications/:notificationId/read', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.notificationId);
        const userId = req.userId;

        console.log(`📖 Marking notification ${notificationId} as read for user ${userId}`);

        if (!notificationId || isNaN(notificationId)) {
            return res.status(400).json({
                error: 'Valid notification ID is required'
            });
        }

        // Verify notification belongs to user
        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTIFICATIONS
            SET IS_READ = 1, READ_DATE = GETDATE()
            WHERE NOTIFICATION_ID = ${notificationId} 
            AND USER_ID = ${userId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        if (result === 0) {
            return res.status(404).json({
                error: 'Notification not found or access denied'
            });
        }

        console.log(`✅ Notification ${notificationId} marked as read`);

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        res.status(500).json({
            error: 'Failed to mark notification as read',
            message: error.message
        });
    }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = req.userId;

        console.log(`📖 Marking all notifications as read for user ${userId}`);

        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTIFICATIONS
            SET IS_READ = 1, READ_DATE = GETDATE()
            WHERE USER_ID = ${userId} 
            AND COMPANY_ID = ${req.companyId}
            AND IS_READ = 0
        `;

        console.log(`✅ Marked ${result} notifications as read`);

        res.json({
            success: true,
            message: `Marked ${result} notifications as read`,
            updatedCount: result
        });

    } catch (error) {
        console.error('❌ Error marking all notifications as read:', error);
        res.status(500).json({
            error: 'Failed to mark notifications as read',
            message: error.message
        });
    }
});

// Real database authentication
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log(`🔐 Login attempt for: ${email}`);

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for login: ${email}`);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Query the database using raw SQL for GUARDIAN schema with normalized email
        const users = await prisma.$queryRaw`
            SELECT USER_ID, EMAIL, FIRST_NAME, LAST_NAME, PASSWORD_HASH, STATUS, COMPANY_ID, ACCOUNT_CREATOR_INVITE_COMPLETED
            FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
        `;

        console.log(`🔍 Login database query result for ${email}:`, users.length > 0 ? users[0] : 'NO USERS FOUND');

        if (users.length === 0) {
            console.log(`❌ User not found: ${email}`);
            // Let's also check if any user exists with similar email (for debugging)
            const debugUsers = await prisma.$queryRaw`
                SELECT TOP 5 USER_ID, EMAIL, STATUS FROM GUARDIAN.USERS 
                WHERE EMAIL LIKE ${'%' + email.split('@')[0] + '%'}
            `;
            console.log(`🔧 Debug - Similar email users:`, debugUsers);
            
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const user = users[0];

        // Check if user is active
        if (user.STATUS !== 'A') {
            console.log(`❌ User not active: ${email}`);
            return res.status(401).json({
                error: 'Account is not active. Please contact support.'
            });
        }

        // Verify password
        if (!user.PASSWORD_HASH) {
            console.log(`❌ No password hash for user: ${email}`);
            return res.status(401).json({
                error: 'Password not set for this account. Please use password reset.'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.PASSWORD_HASH);
        if (!isPasswordValid) {
            console.log(`❌ Invalid password for user: ${email}`);
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Get user roles with role names
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME, r.DISPLAY_NAME, r.DESCRIPTION
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${user.USER_ID}
        `;
        
        const roleIds = userRoles.map(ur => ur.ROLE_ID);
        const roleNames = userRoles.map(ur => ur.NAME);
        const roles = userRoles.map(ur => ({
            id: ur.ROLE_ID,
            name: ur.NAME,
            displayName: ur.DISPLAY_NAME,
            description: ur.DESCRIPTION
        }));

        // Generate JWT token with complete user data
        const token = jwt.sign(
            {
                id: user.USER_ID,
                userId: user.USER_ID,
                email: user.EMAIL,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                companyId: user.COMPANY_ID,
                roles: roleIds,
                roleNames: roleNames
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Login successful for: ${email} (User ID: ${user.USER_ID}, Company: ${user.COMPANY_ID})`);

        res.json({
            success: true,
            token: token,
            user: {
                id: user.USER_ID,
                userId: user.USER_ID,
                email: user.EMAIL,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                companyId: user.COMPANY_ID,
                company: user.COMPANY_ID,
                roles: roles,
                roleIds: roleIds,
                roleNames: roleNames,
                role: roleNames.length > 0 ? roleNames[0] : 'user',
                isAdmin: roleNames.includes('Admin') || roleNames.includes('Administrator'),
                accountCreatorInviteCompleted: user.ACCOUNT_CREATOR_INVITE_COMPLETED || false
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            error: 'Server error during login',
            message: error.message
        });
    }
});

// Get assigned requests for current user
app.get('/api/requests/assigned/me', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const startTime = Date.now();
        console.log(`📋 Fetching assigned requests for user ID: ${req.userId} (Company: ${req.companyId})`);

        // Get requests assigned to the current user
        const assignedRequests = await prisma.$queryRaw`
            SELECT 
                r.REQUEST_ID,
                r.REQUEST_NAME,
                r.REQUEST_DESCRIPTION,
                r.STATUS,
                r.SUBMITTED_DATE,
                r.TRACKINGID,
                r.CREATE_DATE,
                r.UPDATE_DATE,
                r.COMPANY_ID,
                r.REQUESTOR_ID,
                r.ASSIGNED_ID,
                r.PRIORITY_LEVEL,
                ru.FIRST_NAME as REQUESTOR_FIRST_NAME,
                ru.LAST_NAME as REQUESTOR_LAST_NAME,
                ru.EMAIL as REQUESTOR_EMAIL,
                au.FIRST_NAME as ASSIGNED_FIRST_NAME,
                au.LAST_NAME as ASSIGNED_LAST_NAME,
                au.EMAIL as ASSIGNED_EMAIL
            FROM GUARDIAN.REQUESTS r
            LEFT JOIN GUARDIAN.USERS ru ON r.REQUESTOR_ID = ru.USER_ID
            LEFT JOIN GUARDIAN.USERS au ON r.ASSIGNED_ID = au.USER_ID
            WHERE (r.ASSIGNED_ID = ${req.userId} OR r.ANALYST_ID = ${req.userId} OR r.INVESTIGATOR_ID = ${req.userId})
                AND r.COMPANY_ID = ${req.companyId}
            ORDER BY r.CREATE_DATE DESC
        `;

        // Format the requests for frontend
        const formattedRequests = assignedRequests.map(req => ({
            REQUEST_ID: req.REQUEST_ID,
            REQUEST_NAME: req.REQUEST_NAME,
            REQUEST_DESCRIPTION: req.REQUEST_DESCRIPTION,
            STATUS: req.STATUS,
            SUBMITTED_DATE: req.SUBMITTED_DATE,
            TRACKINGID: req.TRACKINGID,
            CREATE_DATE: req.CREATE_DATE,
            UPDATE_DATE: req.UPDATE_DATE,
            COMPANY_ID: req.COMPANY_ID,
            REQUESTOR_ID: req.REQUESTOR_ID,
            ASSIGNED_ID: req.ASSIGNED_ID,
            requestorName: req.REQUESTOR_FIRST_NAME ? 
                `${req.REQUESTOR_FIRST_NAME} ${req.REQUESTOR_LAST_NAME}` : 
                'Unknown',
            assignedName: req.ASSIGNED_FIRST_NAME ? 
                `${req.ASSIGNED_FIRST_NAME} ${req.ASSIGNED_LAST_NAME}` : 
                null,
            requestor: req.REQUESTOR_FIRST_NAME ? {
                FIRST_NAME: req.REQUESTOR_FIRST_NAME,
                LAST_NAME: req.REQUESTOR_LAST_NAME,
                EMAIL: req.REQUESTOR_EMAIL
            } : null,
            assigned: req.ASSIGNED_FIRST_NAME ? {
                FIRST_NAME: req.ASSIGNED_FIRST_NAME,
                LAST_NAME: req.ASSIGNED_LAST_NAME,
                EMAIL: req.ASSIGNED_EMAIL
            } : null
        }));

        const endTime = Date.now();
        console.log(`✅ Retrieved ${formattedRequests.length} assigned requests in ${endTime - startTime}ms`);
        
        res.json(formattedRequests);
    } catch (error) {
        console.error('❌ Error fetching assigned requests:', error);
        res.status(500).json({ 
            error: 'Failed to fetch assigned requests',
            message: error.message 
        });
    }
});

// Start working on a request (change status from P to A)
app.post('/api/requests/:id/start', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`🚀 Starting work on request ${requestId} by user ${req.userId}`);

        // Update request status to 'A' (Active/In Progress)
        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET STATUS = 'A', UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
            WHERE REQUEST_ID = ${requestId} 
                AND COMPANY_ID = ${req.companyId}
                AND ASSIGNED_ID = ${req.userId}
        `;

        // Create milestone for request start
        try {
            await createStatusChangeMilestone(requestId, 'P', 'A', req.userId, req.companyId);
            console.log(`🏁 Request start milestone created for request ${requestId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create request start milestone (continuing):', milestoneError);
        }

        console.log(`✅ Request ${requestId} started successfully`);
        res.json({ success: true, message: 'Request started successfully' });
    } catch (error) {
        console.error(`❌ Error starting request ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Failed to start request',
            message: error.message 
        });
    }
});

// Complete a request (change status from A to C)
app.post('/api/requests/:id/complete', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { completionNotes } = req.body;
        console.log(`✅ Completing request ${requestId} by user ${req.userId}`);

        // Update request status to 'D' (Complete)
        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET STATUS = 'D', UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
            WHERE REQUEST_ID = ${requestId} 
                AND COMPANY_ID = ${req.companyId}
                AND ASSIGNED_ID = ${req.userId}
        `;

        // Add completion notes if provided
        if (completionNotes) {
            console.log(`📝 Adding completion notes for request ${requestId}`);
            // You might want to add a progress entry or notes table for this
        }

        // Create milestone for request completion
        try {
            await createStatusChangeMilestone(requestId, 'A', 'D', req.userId, req.companyId);
            console.log(`🏁 Request completion milestone created for request ${requestId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create request completion milestone (continuing):', milestoneError);
        }

        console.log(`✅ Request ${requestId} completed successfully`);
        res.json({ success: true, message: 'Request completed successfully' });
    } catch (error) {
        console.error(`❌ Error completing request ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Failed to complete request',
            message: error.message 
        });
    }
});

// Cancel a request (change status to 'X')
app.post('/api/requests/:id/cancel', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { cancellationReason } = req.body;
        console.log(`❌ Cancelling request ${requestId} by user ${req.userId}`);

        // Update request status to 'X' (Cancelled) with proper cancellation tracking
        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET STATUS = 'X', 
                UPDATE_DATE = GETDATE(), 
                UPDATE_USER_ID = ${req.userId},
                CANCELLATION_REASON = ${cancellationReason || null},
                CANCELLED_DATE = GETDATE(),
                CANCELLED_BY = ${req.userId}
            WHERE REQUEST_ID = ${requestId} 
                AND COMPANY_ID = ${req.companyId}
                AND (ASSIGNED_ID = ${req.userId} OR REQUESTOR_ID = ${req.userId})
        `;

        console.log(`📝 Request ${requestId} cancelled with proper tracking in database`);

        // Create milestone for request cancellation
        try {
            await createStatusChangeMilestone(requestId, 'A', 'X', req.userId, req.companyId);
            console.log(`🏁 Request cancellation milestone created for request ${requestId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create request cancellation milestone (continuing):', milestoneError);
        }

        // Create notifications for request cancellation
        try {
            // Get request details and current user info for notifications
            const requestDetails = await prisma.$queryRaw`
                SELECT r.REQUEST_NAME, r.REQUEST_DESCRIPTION, r.TRACKINGID, r.REQUESTOR_ID, r.ASSIGNED_ID
                FROM GUARDIAN.REQUESTS r
                WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${req.companyId}
            `;

            if (requestDetails.length > 0) {
                const request = requestDetails[0];
                
                // Get cancelling user's name
                const cancellingUserDetails = await prisma.$queryRaw`
                    SELECT FIRST_NAME, LAST_NAME FROM GUARDIAN.USERS WHERE USER_ID = ${req.userId}
                `;
                const cancellingUserName = cancellingUserDetails.length > 0 
                    ? `${cancellingUserDetails[0].FIRST_NAME} ${cancellingUserDetails[0].LAST_NAME}`
                    : 'Unknown User';

                const baseMessage = `Request "${request.REQUEST_NAME}" (ID: ${request.TRACKINGID}) has been cancelled by ${cancellingUserName}`;
                const fullMessage = cancellationReason 
                    ? `${baseMessage}. Reason: ${cancellationReason}`
                    : baseMessage;

                // Notify original requestor if different from cancelling user
                if (request.REQUESTOR_ID && request.REQUESTOR_ID !== req.userId) {
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${request.REQUESTOR_ID},
                            'request_cancelled',
                            'Request Cancelled',
                            ${fullMessage},
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                    console.log(`🔔 Cancellation notification created for requestor ${request.REQUESTOR_ID}`);
                }

                // Notify assigned user if different from cancelling user and requestor
                if (request.ASSIGNED_ID && request.ASSIGNED_ID !== req.userId && request.ASSIGNED_ID !== request.REQUESTOR_ID) {
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${request.ASSIGNED_ID},
                            'request_cancelled',
                            'Request Cancelled',
                            ${fullMessage},
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                    console.log(`🔔 Cancellation notification created for assigned user ${request.ASSIGNED_ID}`);
                }
            }
        } catch (notificationError) {
            console.error('⚠️ Failed to create cancellation notifications (continuing):', notificationError);
        }

        console.log(`❌ Request ${requestId} cancelled successfully`);
        res.json({ success: true, message: 'Request cancelled successfully' });
    } catch (error) {
        console.error(`❌ Error cancelling request ${req.params.id}:`, error);
        res.status(500).json({ 
            error: 'Failed to cancel request',
            message: error.message 
        });
    }
});

// Create new request endpoint
app.post('/api/requests', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📝 Creating new request for company: ${req.companyId}`, req.body);

        const {
            REQUEST_NAME,
            name,
            requestName,
            REQUEST_DESCRIPTION,
            description,
            ABBREVIATION,
            abbreviation,
            templateType,
            FORM_ID,
            templateId,
            REQUESTOR_ID,
            requestorId,
            ASSIGNED_ID,
            assignedId,
            STATUS,
            status,
            PRIORITY_LEVEL,
            priorityLevel,
            formFieldValues
        } = req.body;

        // Use the request name from any of the possible field names
        const finalRequestName = REQUEST_NAME || name || requestName;
        const finalDescription = REQUEST_DESCRIPTION || description || '';
        const finalAbbreviation = ABBREVIATION || abbreviation || templateType?.substring(0, 5)?.toUpperCase() || finalRequestName?.substring(0, 5)?.toUpperCase() || 'REQ';
        const finalStatus = STATUS || status || 'P'; // P = Pending
        const finalAssignedId = ASSIGNED_ID || assignedId || null;
        const finalPriorityLevel = PRIORITY_LEVEL || priorityLevel || 'Standard'; // Default to Standard priority
        
        // Validate priority level
        const validPriorityLevels = ['Low', 'Standard', 'High'];
        if (!validPriorityLevels.includes(finalPriorityLevel)) {
            return res.status(400).json({
                error: 'Invalid priority level',
                details: 'PRIORITY_LEVEL must be one of: Low, Standard, High'
            });
        }

        // Validation
        if (!finalRequestName || finalRequestName.trim() === '') {
            return res.status(400).json({
                error: 'Request name is required',
                details: 'REQUEST_NAME, name, or requestName field must be provided and non-empty'
            });
        }

        // TRACKINGID is now auto-generated by the database as a computed column
        // No longer need to generate it manually

        // Create the request with company-based data isolation using raw SQL
        const currentDate = new Date();
        
        console.log('🔍 DEBUG - REQUEST CREATION PARAMETERS:', {
            finalRequestName: finalRequestName.trim(),
            finalDescription: finalDescription.trim() || null,
            finalAbbreviation,
            finalStatus: finalStatus,
            STATUS_IN_BODY: STATUS,
            status_IN_BODY: status,
            FINAL_STATUS_BEING_INSERTED: finalStatus,
            currentDate,
            userId: req.userId,
            companyId: req.companyId,
            templateId: templateId || null,
            finalAssignedId,
            finalPriorityLevel
        });
        
        console.log('🔍 DEBUG - STATUS VALUE TRACE:');
        console.log('  - STATUS from body:', STATUS);
        console.log('  - status from body:', status);
        console.log('  - Final computed status:', finalStatus);
        console.log('  - Expected: Should be "P" for new requests');
        
        // Get user's active workspace for request assignment
        const userWorkspace = await prisma.$queryRaw`
            SELECT ACTIVE_WORKSPACE_ID FROM GUARDIAN.USERS 
            WHERE USER_ID = ${req.userId}
        `;
        
        const activeWorkspaceId = userWorkspace[0]?.ACTIVE_WORKSPACE_ID;
        console.log(`🏢 Assigning request to workspace: ${activeWorkspaceId || 'None'}`);

        // Insert and get ID in a single query to ensure same connection/transaction
        let insertedId;
        try {
            // Use a single query that inserts and returns the ID (with workspace)
            const insertResult = await prisma.$queryRaw`
                DECLARE @InsertedId INT;
                
                INSERT INTO GUARDIAN.REQUESTS (
                    REQUEST_NAME, REQUEST_DESCRIPTION, ABBREVIATION, STATUS, SUBMITTED_DATE,
                    REQUESTOR_ID, ASSIGNED_ID, CREATE_DATE, UPDATE_DATE, CREATE_USER_ID,
                    UPDATE_USER_ID, COMPANY_ID, EXTERNAL_USER, FORM_ID, PRIORITY_LEVEL, WORKSPACE_ID
                )
                VALUES (
                    ${finalRequestName.trim()},
                    ${finalDescription.trim() || null},
                    ${finalAbbreviation},
                    ${finalStatus},
                    ${currentDate},
                    ${req.userId},
                    ${finalAssignedId},
                    ${currentDate},
                    ${currentDate},
                    ${req.userId},
                    ${req.userId},
                    ${req.companyId},
                    ${null},
                    ${templateId || null},
                    ${finalPriorityLevel},
                    ${activeWorkspaceId}
                );
                
                SET @InsertedId = SCOPE_IDENTITY();
                SELECT @InsertedId AS REQUEST_ID;
            `;
            
            insertedId = insertResult[0]?.REQUEST_ID;
            console.log('✅ INSERT completed successfully, ID:', insertedId);
        } catch (insertError) {
            console.log('❌ INSERT failed:', insertError.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to insert request',
                error: insertError.message
            });
        }
        
        console.log('🔍 SCOPE_IDENTITY result:', insertedId);
        
        if (!insertedId) {
            console.log('❌ No SCOPE_IDENTITY found, request may not have been inserted');
            return res.status(500).json({
                success: false,
                message: 'Failed to create request - no ID returned'
            });
        }
        
        // Now get the complete request record
        const newRequestResults = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUEST_NAME, REQUEST_DESCRIPTION, ABBREVIATION, STATUS, 
                   SUBMITTED_DATE, REQUESTOR_ID, ASSIGNED_ID, CREATE_DATE, UPDATE_DATE, 
                   CREATE_USER_ID, UPDATE_USER_ID, TRACKINGID, COMPANY_ID, EXTERNAL_USER, FORM_ID, PRIORITY_LEVEL
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${insertedId} AND COMPANY_ID = ${req.companyId}
        `;
        
        const newRequest = newRequestResults[0];
        
        console.log('🔍 DEBUG - INSERTED REQUEST STATUS CHECK:');
        console.log('  - Request ID:', newRequest?.REQUEST_ID);
        console.log('  - Status in database:', newRequest?.STATUS);
        console.log('  - Expected status: P');
        console.log('  - Status matches expected:', newRequest?.STATUS === 'P');
        
        if (newRequest?.STATUS !== 'P') {
            console.log('❌ CRITICAL: Request created with wrong status!');
            console.log('  - Database returned status:', newRequest?.STATUS);
            console.log('  - This indicates either:');
            console.log('    1. Database trigger/default is overriding our value');
            console.log('    2. Some middleware/process is auto-starting requests');
            console.log('    3. The INSERT statement is using wrong status value');
        }
        
        if (!newRequest) {
            console.log('❌ Request not found after insert, company ID mismatch?');
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve created request'
            });
        }

        console.log(`✅ Request created successfully:`, {
            REQUEST_ID: newRequest.REQUEST_ID,
            REQUEST_NAME: newRequest.REQUEST_NAME,
            TRACKING_ID: newRequest.TRACKINGID,
            COMPANY_ID: newRequest.COMPANY_ID
        });

        // Save form field values if provided
        if (formFieldValues && templateId) {
            try {
                console.log(`📝 Saving form field values for request ${insertedId}`, formFieldValues);
                
                // Create form instance
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${insertedId}, ${templateId}, ${req.userId}, ${req.companyId}, GETDATE(), ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                
                // Get the new instance ID
                const instanceResult = await prisma.$queryRaw`
                    SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                    WHERE REQUEST_ID = ${insertedId} AND FORM_ID = ${templateId} AND COMPANY_ID = ${req.companyId}
                    ORDER BY CREATE_DATE DESC
                `;
                
                if (instanceResult.length > 0) {
                    const formInstanceId = instanceResult[0].FORM_INSTANCE_ID;
                    console.log(`📋 Created form instance with ID: ${formInstanceId}`);
                    
                    // Save field values
                    for (const [fieldKey, fieldValue] of Object.entries(formFieldValues)) {
                        if (fieldValue && fieldValue.toString().trim() !== '') {
                            // Convert field ID to integer if it's a string
                            const fieldId = parseInt(fieldKey) || fieldKey;
                            
                            await prisma.$executeRaw`
                                INSERT INTO GUARDIAN.FORMS_INSTANCE_VALUES (
                                    FORM_INSTANCE_ID, FIELD_ID, VALUE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                                ) VALUES (
                                    ${formInstanceId}, ${fieldId}, ${fieldValue.toString()}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                                )
                            `;
                            console.log(`💾 Saved field ${fieldKey}: ${fieldValue}`);
                        }
                    }
                    
                    console.log(`✅ Saved ${Object.keys(formFieldValues).length} form field values`);
                } else {
                    console.log('❌ Could not retrieve form instance ID');
                }
            } catch (formError) {
                console.error('⚠️ Error saving form field values (continuing with request creation):', formError);
                // Don't fail the entire request creation if form data saving fails
            }
        }

        // Create milestone for request creation
        try {
            await createSystemMilestone(
                insertedId,
                'system',
                'Request Created',
                `Request "${finalRequestName}" was submitted`,
                req.userId,
                req.companyId,
                JSON.stringify({
                    requestType: templateType || 'standard',
                    hasFormData: !!formFieldValues,
                    fieldCount: formFieldValues ? Object.keys(formFieldValues).length : 0,
                    assigned: !!finalAssignedId
                })
            );
            console.log(`🏁 Request creation milestone created for request ${insertedId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create request creation milestone (continuing):', milestoneError);
        }

        // Return the created request
        res.status(201).json({
            success: true,
            message: 'Request created successfully',
            data: {
                REQUEST_ID: newRequest.REQUEST_ID,
                REQUEST_NAME: newRequest.REQUEST_NAME,
                REQUEST_DESCRIPTION: newRequest.REQUEST_DESCRIPTION,
                ABBREVIATION: newRequest.ABBREVIATION,
                STATUS: newRequest.STATUS,
                SUBMITTED_DATE: newRequest.SUBMITTED_DATE,
                REQUESTOR_ID: newRequest.REQUESTOR_ID,
                ASSIGNED_ID: newRequest.ASSIGNED_ID,
                TRACKINGID: newRequest.TRACKINGID,
                COMPANY_ID: newRequest.COMPANY_ID,
                FORM_ID: newRequest.FORM_ID,
                PRIORITY_LEVEL: newRequest.PRIORITY_LEVEL,
                CREATE_DATE: newRequest.CREATE_DATE,
                UPDATE_DATE: newRequest.UPDATE_DATE
            }
        });

    } catch (error) {
        console.error('❌ Error creating request:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating request',
            error: error.message
        });
    }
});

// Real requests endpoint with database query (workspace-filtered)
app.get('/api/requests', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const startTime = Date.now();
        console.log(`📋 Fetching requests for company ID: ${req.companyId}`);

        // Get user's active workspace
        const userWorkspace = await prisma.$queryRaw`
            SELECT ACTIVE_WORKSPACE_ID FROM GUARDIAN.USERS 
            WHERE USER_ID = ${req.userId}
        `;
        
        const activeWorkspaceId = userWorkspace[0]?.ACTIVE_WORKSPACE_ID;
        
        console.log(`🏢 User ${req.userId} active workspace: ${activeWorkspaceId || 'None'}`);

        // OPTIMIZED: Single query with proper JOINs, timeout handling, and workspace filtering
        const requests = await Promise.race([
            prisma.$queryRaw`
                SELECT 
                    r.REQUEST_ID,
                    r.REQUEST_NAME,
                    r.REQUEST_DESCRIPTION,
                    r.EXTERNAL_USER,
                    r.SUBMITTED_DATE,
                    r.REQUESTOR_ID,
                    r.ASSIGNED_ID,
                    r.STATUS,
                    r.CREATE_DATE,
                    r.UPDATE_DATE,
                    r.CREATE_USER_ID,
                    r.UPDATE_USER_ID,
                    r.TRACKINGID,
                    r.ABBREVIATION,
                    r.COMPANY_ID,
                    r.FORM_ID,
                    r.PRIORITY_LEVEL,
                    r.RESULTS_DESCRIPTION,
                    r.WORKSPACE_ID,
                    requestor.FIRST_NAME as REQUESTOR_FIRST_NAME,
                    requestor.LAST_NAME as REQUESTOR_LAST_NAME,
                    requestor.EMAIL as REQUESTOR_EMAIL,
                    assigned.FIRST_NAME as ASSIGNED_FIRST_NAME,
                    assigned.LAST_NAME as ASSIGNED_LAST_NAME,
                    assigned.EMAIL as ASSIGNED_EMAIL,
                    creator.FIRST_NAME as CREATOR_FIRST_NAME,
                    creator.LAST_NAME as CREATOR_LAST_NAME,
                    creator.EMAIL as CREATOR_EMAIL,
                    w.WORKSPACE_NAME
                FROM GUARDIAN.REQUESTS r
                LEFT JOIN GUARDIAN.USERS requestor ON r.REQUESTOR_ID = requestor.USER_ID AND requestor.COMPANY_ID = ${req.companyId}
                LEFT JOIN GUARDIAN.USERS assigned ON r.ASSIGNED_ID = assigned.USER_ID AND assigned.COMPANY_ID = ${req.companyId}
                LEFT JOIN GUARDIAN.USERS creator ON r.CREATE_USER_ID = creator.USER_ID AND creator.COMPANY_ID = ${req.companyId}
                LEFT JOIN GUARDIAN.WORKSPACES w ON r.WORKSPACE_ID = w.WORKSPACE_ID
                WHERE r.COMPANY_ID = ${req.companyId}
                  AND (r.WORKSPACE_ID = ${activeWorkspaceId || null} OR r.WORKSPACE_ID IS NULL)
                ORDER BY r.CREATE_DATE DESC
            `,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout after 8 seconds')), 8000)
            )
        ]);

        const queryTime = Date.now() - startTime;
        console.log(`✅ Found ${requests.length} requests in database (query took ${queryTime}ms)`);
        
        if (queryTime > 2000) {
            console.warn(`⚠️ Slow query detected: ${queryTime}ms for company ${req.companyId}`);
        }

        // Format the data to match frontend expectations exactly
        const formattedRequests = requests.map(req => ({
            REQUEST_ID: req.REQUEST_ID,
            REQUEST_NAME: req.REQUEST_NAME || 'Untitled Request',
            STATUS: req.STATUS,
            FORM_ID: req.FORM_ID,
            REQUESTOR_ID: req.REQUESTOR_ID,
            ASSIGNED_ID: req.ASSIGNED_ID,
            SUBMITTED_DATE: req.SUBMITTED_DATE ? new Date(req.SUBMITTED_DATE).toISOString() : null,
            CREATE_DATE: req.CREATE_DATE ? new Date(req.CREATE_DATE).toISOString() : null,
            UPDATE_DATE: req.UPDATE_DATE ? new Date(req.UPDATE_DATE).toISOString() : null,
            CREATE_USER_ID: req.CREATE_USER_ID,
            UPDATE_USER_ID: req.UPDATE_USER_ID,
            TRACKINGID: req.TRACKINGID || `REQ-${req.REQUEST_ID}`,
            EXTERNAL_USER: req.EXTERNAL_USER,
            RESULTS_DESCRIPTION: req.RESULTS_DESCRIPTION,
            
            requestor: req.REQUESTOR_FIRST_NAME ? {
                FIRST_NAME: req.REQUESTOR_FIRST_NAME,
                LAST_NAME: req.REQUESTOR_LAST_NAME,
                EMAIL: req.REQUESTOR_EMAIL || ''
            } : null,
            
            assigned: req.ASSIGNED_FIRST_NAME ? {
                FIRST_NAME: req.ASSIGNED_FIRST_NAME,
                LAST_NAME: req.ASSIGNED_LAST_NAME,
                EMAIL: req.ASSIGNED_EMAIL || ''
            } : null,
            
            requestorName: req.REQUESTOR_FIRST_NAME ? 
                `${req.REQUESTOR_FIRST_NAME} ${req.REQUESTOR_LAST_NAME}` : 
                'Unknown',
            assignedName: req.ASSIGNED_FIRST_NAME ? 
                `${req.ASSIGNED_FIRST_NAME} ${req.ASSIGNED_LAST_NAME}` : 
                null
        }));

        console.log(`📤 Sending ${formattedRequests.length} formatted requests to frontend`);
        res.json(formattedRequests);

    } catch (error) {
        console.error('❌ Error fetching requests:', error);
        
        // Handle different types of errors
        if (error.message.includes('timeout')) {
            console.error('⏱️ Database query timeout - possible performance issue');
            res.status(408).json({
                error: 'Request timeout',
                message: 'Database query took too long. Please try again or contact support if this persists.'
            });
        } else if (error.message.includes('connection')) {
            console.error('🔌 Database connection error');
            res.status(503).json({
                error: 'Database connection error',
                message: 'Unable to connect to database. Please try again later.'
            });
        } else {
            res.status(500).json({
                error: 'Failed to fetch requests',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// Get single request by ID
app.get('/api/requests/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`📋 Fetching request ${requestId} for company ${req.companyId}`);
        
        if (isNaN(requestId)) {
            return res.status(400).json({
                error: 'Invalid request ID',
                message: 'Request ID must be a valid number'
            });
        }

        // Query single request with all details and proper company filtering
        const requests = await prisma.$queryRaw`
            SELECT 
                r.REQUEST_ID,
                r.REQUEST_NAME,
                r.REQUEST_DESCRIPTION,
                r.STATUS,
                r.SUBMITTED_DATE,
                r.REQUESTOR_ID,
                r.ASSIGNED_ID,
                r.CREATE_DATE,
                r.UPDATE_DATE,
                r.CREATE_USER_ID,
                r.UPDATE_USER_ID,
                r.TRACKINGID,
                r.COMPANY_ID,
                r.EXTERNAL_USER,
                r.FORM_ID,
                r.PRIORITY_LEVEL,
                r.ABBREVIATION,
                r.WORKSPACE_ID,
                requestor.FIRST_NAME as REQUESTOR_FIRST_NAME,
                requestor.LAST_NAME as REQUESTOR_LAST_NAME,
                requestor.EMAIL as REQUESTOR_EMAIL,
                assigned.FIRST_NAME as ASSIGNED_FIRST_NAME,
                assigned.LAST_NAME as ASSIGNED_LAST_NAME,
                assigned.EMAIL as ASSIGNED_EMAIL,
                creator.FIRST_NAME as CREATOR_FIRST_NAME,
                creator.LAST_NAME as CREATOR_LAST_NAME,
                creator.EMAIL as CREATOR_EMAIL,
                w.WORKSPACE_NAME
            FROM GUARDIAN.REQUESTS r
            LEFT JOIN GUARDIAN.USERS requestor ON r.REQUESTOR_ID = requestor.USER_ID AND requestor.COMPANY_ID = ${req.companyId}
            LEFT JOIN GUARDIAN.USERS assigned ON r.ASSIGNED_ID = assigned.USER_ID AND assigned.COMPANY_ID = ${req.companyId}
            LEFT JOIN GUARDIAN.USERS creator ON r.CREATE_USER_ID = creator.USER_ID AND creator.COMPANY_ID = ${req.companyId}
            LEFT JOIN GUARDIAN.WORKSPACES w ON r.WORKSPACE_ID = w.WORKSPACE_ID
            WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!requests.length) {
            console.log(`❌ Request ${requestId} not found or not accessible for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Request not found',
                message: 'Request does not exist or you do not have permission to access it'
            });
        }

        const request = requests[0];
        
        // Format the response similar to the main requests endpoint
        const formattedRequest = {
            REQUEST_ID: request.REQUEST_ID,
            REQUEST_NAME: request.REQUEST_NAME,
            REQUEST_DESCRIPTION: request.REQUEST_DESCRIPTION,
            STATUS: request.STATUS,
            SUBMITTED_DATE: request.SUBMITTED_DATE,
            REQUESTOR_ID: request.REQUESTOR_ID,
            ASSIGNED_ID: request.ASSIGNED_ID,
            CREATE_DATE: request.CREATE_DATE,
            UPDATE_DATE: request.UPDATE_DATE,
            CREATE_USER_ID: request.CREATE_USER_ID,
            UPDATE_USER_ID: request.UPDATE_USER_ID,
            TRACKINGID: request.TRACKINGID,
            COMPANY_ID: request.COMPANY_ID,
            EXTERNAL_USER: request.EXTERNAL_USER,
            FORM_ID: request.FORM_ID,
            PRIORITY_LEVEL: request.PRIORITY_LEVEL,
            ABBREVIATION: request.ABBREVIATION,
            WORKSPACE_ID: request.WORKSPACE_ID,
            WORKSPACE_NAME: request.WORKSPACE_NAME,
            REQUESTOR_FIRST_NAME: request.REQUESTOR_FIRST_NAME,
            REQUESTOR_LAST_NAME: request.REQUESTOR_LAST_NAME,
            REQUESTOR_EMAIL: request.REQUESTOR_EMAIL,
            ASSIGNED_FIRST_NAME: request.ASSIGNED_FIRST_NAME,
            ASSIGNED_LAST_NAME: request.ASSIGNED_LAST_NAME,
            ASSIGNED_EMAIL: request.ASSIGNED_EMAIL,
            CREATOR_FIRST_NAME: request.CREATOR_FIRST_NAME,
            CREATOR_LAST_NAME: request.CREATOR_LAST_NAME,
            CREATOR_EMAIL: request.CREATOR_EMAIL
        };

        console.log(`✅ Found request: ${request.REQUEST_NAME} (ID: ${request.REQUEST_ID})`);
        res.json(formattedRequest);

    } catch (error) {
        console.error(`❌ Error fetching request ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to fetch request',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get current authenticated user information
app.get('/api/me', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`👤 Fetching current user info for user ID: ${req.userId} (Company: ${req.companyId})`);
        
        // Get complete user information from database
        const userInfo = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.COMPANY_ID,
                u.STATUS,
                u.CREATE_DATE
            FROM GUARDIAN.USERS u
            WHERE u.USER_ID = ${req.userId} AND u.COMPANY_ID = ${req.companyId}
        `;

        if (userInfo.length === 0) {
            console.error(`❌ User not found: ${req.userId}`);
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const user = userInfo[0];

        // Get user roles
        const userRoles = await prisma.$queryRaw`
            SELECT 
                ur.ROLE_ID,
                r.NAME as ROLE_NAME,
                r.DISPLAY_NAME,
                r.DESCRIPTION
            FROM GUARDIAN.USER_ROLES ur
            INNER JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const roles = userRoles.map(role => ({
            id: role.ROLE_ID,
            name: role.ROLE_NAME,
            displayName: role.DISPLAY_NAME,
            description: role.DESCRIPTION
        }));

        const roleIds = userRoles.map(role => role.ROLE_ID);
        const roleNames = userRoles.map(role => role.ROLE_NAME);

        // Format response to match frontend expectations
        const responseData = {
            id: user.USER_ID,
            userId: user.USER_ID,
            email: user.EMAIL,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            companyId: user.COMPANY_ID,
            roles: roles,
            roleIds: roleIds,
            roleNames: roleNames,
            status: user.STATUS,
            createDate: user.CREATE_DATE
        };

        console.log(`✅ Successfully fetched user info for ${user.EMAIL}`);
        
        res.json({
            success: true,
            user: responseData
        });

    } catch (error) {
        console.error('❌ Error fetching current user info:', error);
        res.status(500).json({
            error: 'Failed to fetch user information',
            message: error.message
        });
    }
});

// Get current user's complete account information
app.get('/api/users/account-info', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📋 Fetching complete account info for user ${req.userId} in company ${req.companyId}`);
        
        const accountInfo = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL_VALIDATED,
                u.STATUS,
                u.CREATE_DATE,
                u.COMPANY_ID,
                c.NAME as COMPANY_NAME,
                ci.WORKSPACE_NAME,
                STRING_AGG(r.DISPLAY_NAME, ', ') as ROLE_NAMES
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.COMPANY c ON u.COMPANY_ID = c.COMPANY_ID
            LEFT JOIN GUARDIAN.COMPANY_INFO ci ON u.USER_ID = ci.USER_ID AND u.COMPANY_ID = ci.COMPANY_ID
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID AND ur.STATUS IN ('A', 'P')
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID AND r.STATUS IN ('A', 'P')
            WHERE u.USER_ID = ${req.userId} AND u.COMPANY_ID = ${req.companyId}
            GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.EMAIL_VALIDATED, 
                     u.STATUS, u.CREATE_DATE, u.COMPANY_ID, c.NAME, ci.WORKSPACE_NAME
        `;
        
        if (!accountInfo || accountInfo.length === 0) {
            console.error(`❌ Account info not found for user ${req.userId}`);
            return res.status(404).json({ error: 'Account information not found' });
        }
        
        const account = accountInfo[0];
        console.log(`✅ Account info retrieved:`, {
            userId: account.USER_ID,
            email: account.EMAIL,
            emailValidated: account.EMAIL_VALIDATED,
            status: account.STATUS,
            companyName: account.COMPANY_NAME
        });
        
        // Helper function to convert status codes to display names
        const getStatusDisplay = (status) => {
            switch (status) {
                case 'A': return 'Active';
                case 'P': return 'Pending';
                case 'I': return 'Inactive';
                case 'D': return 'Disabled';
                case 'X': return 'Expired';
                case 'C': return 'Cancelled';
                case 'U': return 'Used';
                case 'S': return 'Suspended';
                case 'L': return 'Locked';
                case 'V': return 'Verified';
                default: return 'Unknown';
            }
        };
        
        // Format the response
        const response = {
            userId: account.USER_ID,
            email: account.EMAIL,
            firstName: account.FIRST_NAME,
            lastName: account.LAST_NAME,
            fullName: `${account.FIRST_NAME || ''} ${account.LAST_NAME || ''}`.trim(),
            emailValidated: Boolean(account.EMAIL_VALIDATED),
            status: account.STATUS,
            statusDisplay: getStatusDisplay(account.STATUS),
            companyId: account.COMPANY_ID,
            companyName: account.COMPANY_NAME || 'Unknown Company',
            workspaceName: account.WORKSPACE_NAME,
            roles: account.ROLE_NAMES || 'User',
            createDate: account.CREATE_DATE
        };
        
        res.json(response);
        
    } catch (error) {
        console.error(`❌ Error fetching account info for user ${req.userId}:`, error);
        safeErrorLog('Error in /api/users/account-info:', { 
            error: error.message, 
            userId: req.userId, 
            companyId: req.companyId 
        });
        res.status(500).json({ error: 'Failed to retrieve account information' });
    }
});

// Get all users (for backward compatibility)
app.get('/api/users', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(` [DEBUG] Fetching users for company ID: ${req.companyId}`);
        console.log(` [DEBUG] Request user info:`, {
            userId: req.userId,
            companyId: req.companyId,
            userRoleIds: req.userRoleIds
        });

        if (req.companyId === null || req.companyId === undefined) {
            console.warn(`⚠️ [DEBUG] No company ID found for user ${req.userId}, returning empty list`);
            return res.json([]);
        }

        // First, let's see ALL users in the database to understand the data
        const allUsers = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                u.CREATE_DATE
            FROM GUARDIAN.USERS u
            ORDER BY u.COMPANY_ID, u.LAST_NAME, u.FIRST_NAME
        `;
        console.log(` [DEBUG] Total users in database: ${allUsers.length}`);
        console.log(` [DEBUG] All users by company:`, allUsers.map(u => `${u.FIRST_NAME} ${u.LAST_NAME} (Company: ${u.COMPANY_ID}, Status: ${u.STATUS})`));

        // Now get users filtered by company
        let users = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                u.CREATE_DATE
            FROM GUARDIAN.USERS u
            WHERE u.STATUS = 'A' AND u.COMPANY_ID = ${req.companyId}
            ORDER BY u.LAST_NAME, u.FIRST_NAME
        `;

        console.log(` [DEBUG] Found ${users.length} users for company ${req.companyId}`);
        
        // If no users found for the company, let's check if there are any active users at all
        if (users.length === 0) {
            const activeUsers = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM GUARDIAN.USERS WHERE STATUS = 'A'
            `;
            console.log(`⚠️ [DEBUG] No users found for company ${req.companyId}, but ${activeUsers[0].count} active users exist in database`);
            
            // For debugging purposes, let's temporarily return all active users
            // This helps identify if the issue is with company filtering
            const fallbackUsers = await prisma.$queryRaw`
                SELECT 
                    u.USER_ID,
                    u.EMAIL,
                    u.FIRST_NAME,
                    u.LAST_NAME,
                    u.STATUS,
                    u.COMPANY_ID,
                    u.CREATE_DATE
                FROM GUARDIAN.USERS u
                WHERE u.STATUS = 'A'
                ORDER BY u.LAST_NAME, u.FIRST_NAME
            `;
            console.log(`🔧 [DEBUG] Using fallback: returning ${fallbackUsers.length} active users from all companies`);
            users = fallbackUsers; // Use fallback for now
        }

        // OPTIMIZED: Get all user roles in single query to avoid N+1 problem
        const userIds = users.map(u => u.USER_ID);
        let allRoles = [];
        
        if (userIds.length > 0) {
            // Build dynamic query using template literals - more reliable than $queryRawUnsafe
            const userIdList = userIds.join(', ');
            allRoles = await prisma.$queryRawUnsafe(`
                SELECT 
                    ur.USER_ID,
                    r.ROLE_ID as id,
                    r.NAME as name,
                    r.DISPLAY_NAME as displayName
                FROM GUARDIAN.USER_ROLES ur
                JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
                WHERE ur.USER_ID IN (${userIdList}) AND ur.STATUS = 'P'
                ORDER BY ur.USER_ID, r.ROLE_ID
            `);
        }
        
        // Group roles by user ID for efficient lookup
        const rolesByUserId = {};
        allRoles.forEach(role => {
            if (!rolesByUserId[role.USER_ID]) {
                rolesByUserId[role.USER_ID] = [];
            }
            rolesByUserId[role.USER_ID].push({
                id: role.id,
                name: role.name,
                displayName: role.displayName
            });
        });
        
        // Map users with their roles efficiently
        const usersWithRoles = users.map(user => {
            const userRoles = rolesByUserId[user.USER_ID] || [];
            
            return {
                USER_ID: user.USER_ID,
                EMAIL: user.EMAIL,
                FIRST_NAME: user.FIRST_NAME,
                LAST_NAME: user.LAST_NAME,
                FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
                COMPANY_ID: user.COMPANY_ID,
                STATUS: user.STATUS,
                CREATE_DATE: user.CREATE_DATE,
                ROLE_NAMES: userRoles.map(role => role.name).join(', ') || 'No roles assigned',
                id: user.USER_ID,
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                email: user.EMAIL,
                companyId: user.COMPANY_ID,
                status: user.STATUS,
                createdAt: user.CREATE_DATE,
                roles: userRoles
            };
        });

        res.json({
            success: true,
            data: usersWithRoles,
            count: usersWithRoles.length
        });

    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

// Get all user profiles for profile switching (admin only)
app.get('/api/users/all-profiles', getAuthenticatedUserCompany, async (req, res) => {
  try {
    console.log('🔄 Fetching all user profiles for profile switching...');
    
    // Only allow admins (role 1 or 6) to fetch all profiles
    const userRoles = await prisma.$queryRaw`
      SELECT ur.ROLE_ID 
      FROM GUARDIAN.USER_ROLES ur 
      WHERE ur.USER_ID = ${req.userId}
    `;
    const roleIds = userRoles.map(role => role.ROLE_ID);
    const isAdmin = roleIds.includes(1) || roleIds.includes(6);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required for profile switching.' });
    }
    
    const allUsers = await prisma.$queryRaw`
      SELECT u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.COMPANY_ID, u.STATUS,
             CONCAT(u.FIRST_NAME, ' ', u.LAST_NAME) as FULL_NAME,
             STRING_AGG(r.ROLE_NAME, ', ') as ROLE_NAMES,
             u.CREATE_DATE, u.UPDATE_DATE
      FROM GUARDIAN.USERS u
      LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
      LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
      WHERE u.IS_ACTIVE = 1 AND u.IS_DELETED = 0
      GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.COMPANY_ID, u.STATUS, u.CREATE_DATE, u.UPDATE_DATE
      ORDER BY u.COMPANY_ID, u.LAST_NAME, u.FIRST_NAME
    `;
    
    console.log(`✅ Found ${allUsers.length} user profiles for switching`);
    res.json(allUsers);
  } catch (error) {
    console.error('❌ Error fetching all user profiles:', error);
    res.status(500).json({ error: 'Failed to fetch user profiles' });
  }
});

// Get users by company ID (for assignment dropdowns)
app.get('/api/users/company/:companyId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId);
        console.log(`👥 Fetching users for company ID: ${companyId}`);

        // Security check: users can only access their own company's users
        if (companyId !== req.companyId) {
            return res.status(403).json({
                error: 'Access denied: You can only view users from your own company'
            });
        }

        if (!companyId || isNaN(companyId)) {
            return res.status(400).json({
                error: 'Valid company ID is required'
            });
        }

        const users = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                STRING_AGG(r.NAME, ', ') as ROLE_NAMES
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE u.COMPANY_ID = ${companyId} 
            AND u.STATUS = 'A'
            GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.STATUS, u.COMPANY_ID
            ORDER BY u.LAST_NAME, u.FIRST_NAME
        `;

        console.log(`✅ Found ${users.length} users for company ${companyId}`);

        const formattedUsers = users.map(user => ({
            USER_ID: user.USER_ID,
            EMAIL: user.EMAIL,
            FIRST_NAME: user.FIRST_NAME,
            LAST_NAME: user.LAST_NAME,
            FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            COMPANY_ID: user.COMPANY_ID,
            ROLE_NAMES: user.ROLE_NAMES || 'No roles assigned',
            value: user.USER_ID,
            label: `${user.FIRST_NAME} ${user.LAST_NAME} (${user.EMAIL})`,
            subtitle: user.ROLE_NAMES || 'No roles'
        }));

        res.json(formattedUsers);

    } catch (error) {
        console.error('❌ Error fetching company users:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

// Get assignable users for the requester's company (used by Investigator dropdown etc.)
app.get('/api/users/assignable', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const companyId = req.companyId;

        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Company ID is required' });
        }

        console.log(`[USERS] Fetching assignable users for company ID: ${companyId}`);

        const users = await prisma.$queryRaw`
            SELECT
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.COMPANY_ID
            FROM GUARDIAN.USERS u
            WHERE u.COMPANY_ID = ${companyId}
            AND u.STATUS = 'A'
            ORDER BY u.LAST_NAME, u.FIRST_NAME
        `;

        const formattedUsers = users.map(user => ({
            USER_ID: user.USER_ID,
            FIRST_NAME: user.FIRST_NAME,
            LAST_NAME: user.LAST_NAME,
            FULL_NAME: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            EMAIL: user.EMAIL,
            COMPANY_ID: user.COMPANY_ID,
            value: user.USER_ID,
            label: `${user.FIRST_NAME} ${user.LAST_NAME}`,
            subtitle: user.EMAIL
        }));

        console.log(`[USERS] Found ${formattedUsers.length} assignable users`);
        res.json(formattedUsers);

    } catch (error) {
        console.error('[USERS] Error fetching assignable users:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch assignable users' });
    }
});

// Get user notification preferences
app.get('/api/users/notification-preferences', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📊 [NOTIFICATION-PREFERENCES] Getting notification preferences for user ID: ${req.userId}, company: ${req.companyId}`);

        const user = await prisma.$queryRawUnsafe(
            `SELECT NOTIFICATION_PREFERENCES 
             FROM GUARDIAN.USERS 
             WHERE USER_ID = ${req.userId} AND COMPANY_ID = ${req.companyId}`
        );

        if (!user || user.length === 0) {
            return res.status(404).json({ 
                error: 'User not found or access denied',
                timestamp: new Date().toISOString()
            });
        }

        // Parse notification preferences or return default values
        let preferences = {
            emailNotifications: {
                requestAssignments: true,
                requestUpdates: true,
                systemAnnouncements: true,
                weeklyReports: false
            },
            inAppNotifications: {
                requestAssignments: true,
                requestUpdates: true,
                mentions: true,
                systemAlerts: true
            },
            frequency: 'immediate'
        };

        if (user[0].NOTIFICATION_PREFERENCES) {
            try {
                const savedPreferences = JSON.parse(user[0].NOTIFICATION_PREFERENCES);
                preferences = { ...preferences, ...savedPreferences };
            } catch (parseError) {
                console.warn(`⚠️ [NOTIFICATION-PREFERENCES] Failed to parse saved preferences for user ${req.userId}:`, parseError);
                // Use default preferences if parsing fails
            }
        }

        res.json({
            success: true,
            preferences: preferences,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [NOTIFICATION-PREFERENCES] Error fetching notification preferences:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve notification preferences',
            timestamp: new Date().toISOString()
        });
    }
});

// Update user notification preferences
app.put('/api/users/notification-preferences', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📊 [NOTIFICATION-PREFERENCES] Updating notification preferences for user ID: ${req.userId}, company: ${req.companyId}`);
        
        const { preferences } = req.body;

        if (!preferences) {
            return res.status(400).json({
                error: 'Preferences data is required',
                timestamp: new Date().toISOString()
            });
        }

        // Validate preferences structure
        const validatedPreferences = {
            emailNotifications: {
                requestAssignments: Boolean(preferences.emailNotifications?.requestAssignments ?? true),
                requestUpdates: Boolean(preferences.emailNotifications?.requestUpdates ?? true),
                systemAnnouncements: Boolean(preferences.emailNotifications?.systemAnnouncements ?? true),
                weeklyReports: Boolean(preferences.emailNotifications?.weeklyReports ?? false)
            },
            inAppNotifications: {
                requestAssignments: Boolean(preferences.inAppNotifications?.requestAssignments ?? true),
                requestUpdates: Boolean(preferences.inAppNotifications?.requestUpdates ?? true),
                mentions: Boolean(preferences.inAppNotifications?.mentions ?? true),
                systemAlerts: Boolean(preferences.inAppNotifications?.systemAlerts ?? true)
            },
            frequency: ['immediate', 'daily', 'weekly'].includes(preferences.frequency) ? preferences.frequency : 'immediate'
        };

        // Convert to JSON string for database storage
        const preferencesJson = JSON.stringify(validatedPreferences);

        // Update user notification preferences
        const result = await prisma.$executeRawUnsafe(
            `UPDATE GUARDIAN.USERS 
             SET NOTIFICATION_PREFERENCES = '${preferencesJson.replace(/'/g, "''")}',
                 UPDATE_DATE = GETDATE(),
                 UPDATE_USER_ID = ${req.userId}
             WHERE USER_ID = ${req.userId} AND COMPANY_ID = ${req.companyId}`
        );

        if (result === 0) {
            return res.status(404).json({ 
                error: 'User not found or access denied',
                timestamp: new Date().toISOString()
            });
        }

        console.log(`✅ [NOTIFICATION-PREFERENCES] Successfully updated notification preferences for user ${req.userId}`);

        res.json({
            success: true,
            message: 'Notification preferences updated successfully',
            preferences: validatedPreferences,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ [NOTIFICATION-PREFERENCES] Error updating notification preferences:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to update notification preferences',
            timestamp: new Date().toISOString()
        });
    }
});


// Get invites endpoint
app.get('/api/invites', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📧 Fetching invites for company ID: ${req.companyId}`);

        const invites = await prisma.$queryRaw`
            SELECT 
                i.INVITE_ID,
                i.EMAIL,
                i.ROLE_ID,
                i.COMPANY_ID,
                i.TOKEN,
                i.STATUS,
                i.EXPIRES_AT,
                i.USED_AT,
                i.CREATED_AT,
                r.NAME as ROLE_NAME,
                r.DISPLAY_NAME as ROLE_DISPLAY_NAME
            FROM GUARDIAN.INVITES i
            LEFT JOIN GUARDIAN.ROLES r ON i.ROLE_ID = r.ROLE_ID
            WHERE i.COMPANY_ID = ${req.companyId}
            ORDER BY i.CREATED_AT DESC
        `;

        console.log(`✅ Found ${invites.length} invites`);

        const formattedInvites = invites.map(invite => ({
            INVITE_ID: invite.INVITE_ID,
            EMAIL: invite.EMAIL,
            ROLE_ID: invite.ROLE_ID,
            COMPANY_ID: invite.COMPANY_ID,
            TOKEN: invite.TOKEN,
            STATUS: invite.STATUS,
            EXPIRES_AT: invite.EXPIRES_AT,
            USED_AT: invite.USED_AT,
            CREATED_AT: invite.CREATED_AT,
            ROLE_NAME: invite.ROLE_NAME,
            ROLE_DISPLAY_NAME: invite.ROLE_DISPLAY_NAME,
            // Add frontend-friendly aliases
            id: invite.INVITE_ID,
            email: invite.EMAIL,
            roleId: invite.ROLE_ID,
            roleName: invite.ROLE_DISPLAY_NAME || invite.ROLE_NAME,
            status: invite.STATUS,
            expiresAt: invite.EXPIRES_AT,
            usedAt: invite.USED_AT,
            createdAt: invite.CREATED_AT,
            companyId: invite.COMPANY_ID
        }));

        res.json(formattedInvites);

    } catch (error) {
        console.error('❌ Error fetching invites:', error);
        res.status(500).json({
            error: 'Failed to fetch invites',
            message: error.message
        });
    }
});

// Send invites endpoint
app.post('/api/invites', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { invites } = req.body;
        console.log(`📧 Processing ${invites?.length || 0} invite requests for company ${req.companyId}`);

        if (!invites || !Array.isArray(invites) || invites.length === 0) {
            return res.status(400).json({
                error: 'Invites array is required and must not be empty'
            });
        }

        const results = [];
        const errors = [];

        for (const invite of invites) {
            try {
                const { email, roleId } = invite;

                if (!email || !roleId) {
                    errors.push(`Invalid invite data: email and roleId required`);
                    continue;
                }

                // Check if user already exists
                const existingUser = await prisma.$queryRaw`
                    SELECT USER_ID FROM GUARDIAN.USERS 
                    WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
                `;

                if (existingUser.length > 0) {
                    errors.push(`User with email ${email} already exists`);
                    continue;
                }

                // Check if there's already a pending invite
                const existingInvite = await prisma.$queryRaw`
                    SELECT INVITE_ID FROM GUARDIAN.INVITES 
                    WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email})) 
                    AND STATUS = 'P' AND EXPIRES_AT > GETDATE()
                `;

                if (existingInvite.length > 0) {
                    errors.push(`Pending invite already exists for ${email}`);
                    continue;
                }

                // Generate unique token
                const crypto = require('crypto');
                const token = crypto.randomBytes(32).toString('hex');
                
                // Set expiration to 7 days from now
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                
                // Get role name for the email
                const roleData = await prisma.$queryRaw`
                    SELECT DISPLAY_NAME, NAME FROM GUARDIAN.ROLES 
                    WHERE ROLE_ID = ${roleId}
                `;
                const roleName = roleData.length > 0 ? (roleData[0].DISPLAY_NAME || roleData[0].NAME) : 'User';

                // Insert the invite
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.INVITES (EMAIL, ROLE_ID, COMPANY_ID, TOKEN, STATUS, EXPIRES_AT)
                    VALUES (${email}, ${roleId}, ${req.companyId}, ${token}, 'P', ${expiresAt})
                `;

                // Send actual invite email using Resend
                console.log(`📧 Attempting to send invite email to ${email} with role: ${roleName}`);
                const emailSent = await sendInviteEmail(email, token, roleName);
                const status = emailSent ? 'sent' : 'created'; // Mark as 'created' if email failed but record exists

                results.push({
                    email: email,
                    roleId: roleId,
                    token: token,
                    status: status,
                    emailSent: emailSent,
                    roleName: roleName
                });

                if (emailSent) {
                    console.log(`✅ Invite sent to ${email} for role ${roleName}`);
                } else {
                    console.log(`⚠️ Failed to send invite email to ${email}, but invite record created`);
                    console.log(`📧 Invite token for ${email}: ${token} (expires: ${expiresAt.toISOString()})`);
                }

            } catch (inviteError) {
                console.error(`❌ Error processing invite for ${invite.email}:`, inviteError);
                errors.push(`Failed to send invite to ${invite.email}: ${inviteError.message}`);
            }
        }

        // Return results
        const response = {
            success: true,
            sent: results.length,
            errors: errors.length,
            results: results
        };

        if (errors.length > 0) {
            response.errors = errors;
        }

        console.log(`📧 Invite processing complete: ${results.length} sent, ${errors.length} errors`);
        
        res.json(response);

    } catch (error) {
        console.error('❌ Error processing invites:', error);
        res.status(500).json({
            error: 'Failed to process invites',
            message: error.message
        });
    }
});

// Delete an invite
app.delete('/api/invites/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const inviteId = parseInt(req.params.id);
        const companyId = req.companyId;

        console.log(`🗑️ Deleting invite ${inviteId} for company ${companyId}`);

        // Verify invite exists and belongs to the company
        const invite = await prisma.$queryRaw`
            SELECT INVITE_ID, EMAIL, COMPANY_ID 
            FROM GUARDIAN.INVITES 
            WHERE INVITE_ID = ${inviteId} AND COMPANY_ID = ${companyId}
        `;

        if (invite.length === 0) {
            console.log(`❌ Invite ${inviteId} not found or not authorized for company ${companyId}`);
            return res.status(404).json({
                error: 'Invite not found or not authorized'
            });
        }

        // Delete the invite
        const result = await prisma.$executeRaw`
            DELETE FROM GUARDIAN.INVITES 
            WHERE INVITE_ID = ${inviteId} AND COMPANY_ID = ${companyId}
        `;

        console.log(`✅ Invite ${inviteId} deleted successfully`);

        res.json({
            success: true,
            message: 'Invite deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting invite:', error);
        res.status(500).json({
            error: 'Failed to delete invite',
            message: error.message
        });
    }
});

// === CONTACT GROUPS MANAGEMENT ENDPOINTS ===

// Get contact groups endpoint
app.get('/api/contact-groups', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📧 Fetching contact groups for company ID: ${req.companyId}`);
        
        const contactGroups = await prisma.$queryRaw`
            SELECT 
                ncg.CONTACT_GROUP_ID,
                ncg.GROUP_NAME,
                ncg.GROUP_DESCRIPTION,
                ncg.GROUP_TYPE,
                ncg.COMPANY_ID,
                ncg.CREATED_BY_USER_ID,
                ncg.GROUP_STATUS,
                ncg.IS_PUBLIC,
                ncg.IS_SYSTEM_GROUP,
                ncg.AUTO_UPDATE,
                ncg.AUTO_UPDATE_CRITERIA,
                ncg.MEMBER_COUNT,
                ncg.LAST_USED_DATE,
                ncg.USAGE_COUNT,
                ncg.ACCESS_LEVEL,
                ncg.NOTIFICATION_PREFERENCES,
                ncg.GROUP_COLOR,
                ncg.GROUP_ICON,
                ncg.SORT_ORDER,
                ncg.CREATE_DATE,
                ncg.UPDATE_DATE,
                u.FIRST_NAME as CREATOR_FIRST_NAME,
                u.LAST_NAME as CREATOR_LAST_NAME,
                u.EMAIL as CREATOR_EMAIL
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS ncg
            LEFT JOIN GUARDIAN.USERS u ON ncg.CREATED_BY_USER_ID = u.USER_ID
            WHERE ncg.COMPANY_ID = ${req.companyId}
            ORDER BY ncg.SORT_ORDER ASC, ncg.GROUP_NAME ASC
        `;

        console.log(`✅ Found ${contactGroups.length} contact groups for company ${req.companyId}`);
        
        res.json(contactGroups);
    } catch (error) {
        console.error('❌ Error fetching contact groups:', error);
        res.status(500).json({
            error: 'Failed to fetch contact groups',
            message: error.message
        });
    }
});

// Create contact group endpoint
app.post('/api/contact-groups', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const {
            GROUP_NAME,
            GROUP_DESCRIPTION,
            GROUP_TYPE = 'CUSTOM',
            IS_PUBLIC = false,
            AUTO_UPDATE = false,
            AUTO_UPDATE_CRITERIA,
            ACCESS_LEVEL = 'ADMIN_ONLY',
            NOTIFICATION_PREFERENCES,
            GROUP_COLOR,
            GROUP_ICON,
            SORT_ORDER = 0
        } = req.body;

        console.log(`➕ Creating contact group "${GROUP_NAME}" for company ${req.companyId}`);

        if (!GROUP_NAME || GROUP_NAME.trim().length === 0) {
            return res.status(400).json({
                error: 'Group name is required'
            });
        }

        // Check for duplicate group names within company
        const existingGroup = await prisma.$queryRaw`
            SELECT CONTACT_GROUP_ID 
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS 
            WHERE COMPANY_ID = ${req.companyId} AND LOWER(TRIM(GROUP_NAME)) = LOWER(TRIM(${GROUP_NAME}))
        `;

        if (existingGroup.length > 0) {
            return res.status(400).json({
                error: 'A contact group with this name already exists'
            });
        }

        // Create the contact group
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.NOTICE_CONTACT_GROUPS (
                GROUP_NAME, GROUP_DESCRIPTION, GROUP_TYPE, COMPANY_ID, 
                CREATED_BY_USER_ID, IS_PUBLIC, AUTO_UPDATE, AUTO_UPDATE_CRITERIA,
                ACCESS_LEVEL, NOTIFICATION_PREFERENCES, GROUP_COLOR, GROUP_ICON,
                SORT_ORDER, CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
            )
            VALUES (
                ${GROUP_NAME}, ${GROUP_DESCRIPTION || null}, ${GROUP_TYPE}, ${req.companyId},
                ${req.userId}, ${IS_PUBLIC ? 1 : 0}, ${AUTO_UPDATE ? 1 : 0}, ${AUTO_UPDATE_CRITERIA || null},
                ${ACCESS_LEVEL}, ${NOTIFICATION_PREFERENCES || null}, ${GROUP_COLOR || null}, ${GROUP_ICON || null},
                ${SORT_ORDER}, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
            )
        `;

        // Get the created contact group
        const newGroup = await prisma.$queryRaw`
            SELECT 
                ncg.CONTACT_GROUP_ID,
                ncg.GROUP_NAME,
                ncg.GROUP_DESCRIPTION,
                ncg.GROUP_TYPE,
                ncg.COMPANY_ID,
                ncg.CREATED_BY_USER_ID,
                ncg.GROUP_STATUS,
                ncg.IS_PUBLIC,
                ncg.IS_SYSTEM_GROUP,
                ncg.AUTO_UPDATE,
                ncg.MEMBER_COUNT,
                ncg.ACCESS_LEVEL,
                ncg.CREATE_DATE,
                u.FIRST_NAME as CREATOR_FIRST_NAME,
                u.LAST_NAME as CREATOR_LAST_NAME
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS ncg
            LEFT JOIN GUARDIAN.USERS u ON ncg.CREATED_BY_USER_ID = u.USER_ID
            WHERE ncg.COMPANY_ID = ${req.companyId} AND ncg.CREATED_BY_USER_ID = ${req.userId}
            AND ncg.GROUP_NAME = ${GROUP_NAME}
            ORDER BY ncg.CREATE_DATE DESC
        `;

        console.log(`✅ Contact group "${GROUP_NAME}" created successfully`);
        
        res.status(201).json({
            success: true,
            message: 'Contact group created successfully',
            contactGroup: newGroup[0]
        });
    } catch (error) {
        console.error('❌ Error creating contact group:', error);
        res.status(500).json({
            error: 'Failed to create contact group',
            message: error.message
        });
    }
});

// Update contact group endpoint
app.put('/api/contact-groups/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const contactGroupId = parseInt(req.params.id);
        const {
            GROUP_NAME,
            GROUP_DESCRIPTION,
            GROUP_TYPE,
            IS_PUBLIC,
            AUTO_UPDATE,
            AUTO_UPDATE_CRITERIA,
            ACCESS_LEVEL,
            NOTIFICATION_PREFERENCES,
            GROUP_COLOR,
            GROUP_ICON,
            SORT_ORDER,
            GROUP_STATUS
        } = req.body;

        console.log(`✏️ Updating contact group ${contactGroupId} for company ${req.companyId}`);

        if (!contactGroupId || isNaN(contactGroupId)) {
            return res.status(400).json({
                error: 'Valid contact group ID is required'
            });
        }

        // Verify contact group exists and belongs to company
        const existingGroup = await prisma.$queryRaw`
            SELECT CONTACT_GROUP_ID, GROUP_NAME, CREATED_BY_USER_ID, IS_SYSTEM_GROUP
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS 
            WHERE CONTACT_GROUP_ID = ${contactGroupId} AND COMPANY_ID = ${req.companyId}
        `;

        if (existingGroup.length === 0) {
            return res.status(404).json({
                error: 'Contact group not found or access denied'
            });
        }

        const group = existingGroup[0];

        // Check if user can edit system groups
        if (group.IS_SYSTEM_GROUP) {
            const userRoles = await prisma.$queryRaw`
                SELECT ur.ROLE_ID 
                FROM GUARDIAN.USER_ROLES ur 
                WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
            `;
            const isAdmin = userRoles.some(role => [1, 6].includes(role.ROLE_ID));
            
            if (!isAdmin) {
                return res.status(403).json({
                    error: 'Only administrators can modify system groups'
                });
            }
        }

        // Check for duplicate names (if name is being changed)
        if (GROUP_NAME && GROUP_NAME.trim() !== group.GROUP_NAME) {
            const duplicateCheck = await prisma.$queryRaw`
                SELECT CONTACT_GROUP_ID 
                FROM GUARDIAN.NOTICE_CONTACT_GROUPS 
                WHERE COMPANY_ID = ${req.companyId} 
                AND LOWER(TRIM(GROUP_NAME)) = LOWER(TRIM(${GROUP_NAME}))
                AND CONTACT_GROUP_ID != ${contactGroupId}
            `;

            if (duplicateCheck.length > 0) {
                return res.status(400).json({
                    error: 'A contact group with this name already exists'
                });
            }
        }

        // Execute update using parameterized query syntax
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_CONTACT_GROUPS 
            SET GROUP_NAME = ${GROUP_NAME || group.GROUP_NAME},
                GROUP_DESCRIPTION = ${GROUP_DESCRIPTION || null},
                GROUP_TYPE = ${GROUP_TYPE || 'CUSTOM'},
                IS_PUBLIC = ${IS_PUBLIC !== undefined ? (IS_PUBLIC ? 1 : 0) : 0},
                AUTO_UPDATE = ${AUTO_UPDATE !== undefined ? (AUTO_UPDATE ? 1 : 0) : 0},
                AUTO_UPDATE_CRITERIA = ${AUTO_UPDATE_CRITERIA || null},
                ACCESS_LEVEL = ${ACCESS_LEVEL || 'ADMIN_ONLY'},
                NOTIFICATION_PREFERENCES = ${NOTIFICATION_PREFERENCES || null},
                GROUP_COLOR = ${GROUP_COLOR || null},
                GROUP_ICON = ${GROUP_ICON || null},
                SORT_ORDER = ${SORT_ORDER !== undefined ? SORT_ORDER : 0},
                GROUP_STATUS = ${GROUP_STATUS || 'ACTIVE'},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE CONTACT_GROUP_ID = ${contactGroupId} AND COMPANY_ID = ${req.companyId}
        `;

        // Get updated contact group
        const updatedGroup = await prisma.$queryRaw`
            SELECT 
                ncg.*,
                u.FIRST_NAME as CREATOR_FIRST_NAME,
                u.LAST_NAME as CREATOR_LAST_NAME
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS ncg
            LEFT JOIN GUARDIAN.USERS u ON ncg.CREATED_BY_USER_ID = u.USER_ID
            WHERE ncg.CONTACT_GROUP_ID = ${contactGroupId} AND ncg.COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Contact group ${contactGroupId} updated successfully`);
        
        res.json({
            success: true,
            message: 'Contact group updated successfully',
            contactGroup: updatedGroup[0]
        });
    } catch (error) {
        console.error('❌ Error updating contact group:', error);
        res.status(500).json({
            error: 'Failed to update contact group',
            message: error.message
        });
    }
});

// Delete contact group endpoint
app.delete('/api/contact-groups/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const contactGroupId = parseInt(req.params.id);
        console.log(`🗑️ Deleting contact group ${contactGroupId} for company ${req.companyId}`);

        if (!contactGroupId || isNaN(contactGroupId)) {
            return res.status(400).json({
                error: 'Valid contact group ID is required'
            });
        }

        // Verify contact group exists and belongs to company
        const existingGroup = await prisma.$queryRaw`
            SELECT CONTACT_GROUP_ID, GROUP_NAME, CREATED_BY_USER_ID, IS_SYSTEM_GROUP, MEMBER_COUNT
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS 
            WHERE CONTACT_GROUP_ID = ${contactGroupId} AND COMPANY_ID = ${req.companyId}
        `;

        if (existingGroup.length === 0) {
            return res.status(404).json({
                error: 'Contact group not found or access denied'
            });
        }

        const group = existingGroup[0];

        // Check if user can delete system groups
        if (group.IS_SYSTEM_GROUP) {
            const userRoles = await prisma.$queryRaw`
                SELECT ur.ROLE_ID 
                FROM GUARDIAN.USER_ROLES ur 
                WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
            `;
            const isAdmin = userRoles.some(role => [1, 6].includes(role.ROLE_ID));
            
            if (!isAdmin) {
                return res.status(403).json({
                    error: 'Only administrators can delete system groups'
                });
            }
        }

        // Delete contact group (cascade will handle members)
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.NOTICE_CONTACT_GROUPS 
            WHERE CONTACT_GROUP_ID = ${contactGroupId} AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Contact group "${group.GROUP_NAME}" deleted successfully`);
        
        res.json({
            success: true,
            message: 'Contact group deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting contact group:', error);
        res.status(500).json({
            error: 'Failed to delete contact group',
            message: error.message
        });
    }
});

// Get contact group members endpoint
app.get('/api/contact-groups/:id/members', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const contactGroupId = parseInt(req.params.id);
        console.log(`👥 Fetching members for contact group ${contactGroupId} (Company: ${req.companyId})`);

        if (!contactGroupId || isNaN(contactGroupId)) {
            return res.status(400).json({
                error: 'Valid contact group ID is required'
            });
        }

        // Verify contact group exists and belongs to company
        const groupCheck = await prisma.$queryRaw`
            SELECT CONTACT_GROUP_ID, GROUP_NAME 
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS 
            WHERE CONTACT_GROUP_ID = ${contactGroupId} AND COMPANY_ID = ${req.companyId}
        `;

        if (groupCheck.length === 0) {
            return res.status(404).json({
                error: 'Contact group not found or access denied'
            });
        }

        // Get group members with user details
        const members = await prisma.$queryRaw`
            SELECT 
                ncgm.GROUP_MEMBER_ID,
                ncgm.CONTACT_GROUP_ID,
                ncgm.USER_ID,
                ncgm.COMPANY_ID,
                ncgm.MEMBER_TYPE,
                ncgm.MEMBER_STATUS,
                ncgm.ADDED_BY_USER_ID,
                ncgm.ADDED_DATE,
                ncgm.NOTIFICATION_PREFERENCE,
                ncgm.IS_AUTO_ADDED,
                ncgm.AUTO_ADD_REASON,
                ncgm.LAST_NOTIFICATION_DATE,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                u.STATUS as USER_STATUS,
                adder.FIRST_NAME as ADDED_BY_FIRST_NAME,
                adder.LAST_NAME as ADDED_BY_LAST_NAME
            FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS ncgm
            INNER JOIN GUARDIAN.USERS u ON ncgm.USER_ID = u.USER_ID
            LEFT JOIN GUARDIAN.USERS adder ON ncgm.ADDED_BY_USER_ID = adder.USER_ID
            WHERE ncgm.CONTACT_GROUP_ID = ${contactGroupId} 
            AND ncgm.COMPANY_ID = ${req.companyId}
            ORDER BY ncgm.MEMBER_TYPE DESC, u.FIRST_NAME ASC, u.LAST_NAME ASC
        `;

        console.log(`✅ Found ${members.length} members for contact group ${contactGroupId}`);
        
        res.json(members);
    } catch (error) {
        console.error('❌ Error fetching contact group members:', error);
        res.status(500).json({
            error: 'Failed to fetch contact group members',
            message: error.message
        });
    }
});

// Add member to contact group endpoint
app.post('/api/contact-groups/:id/members', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const contactGroupId = parseInt(req.params.id);
        const {
            USER_ID,
            MEMBER_TYPE = 'MEMBER',
            MEMBER_STATUS = 'ACTIVE',
            NOTIFICATION_PREFERENCE = 'DEFAULT'
        } = req.body;

        console.log(`👤 Adding member ${USER_ID} to contact group ${contactGroupId} (Company: ${req.companyId})`);

        if (!contactGroupId || isNaN(contactGroupId) || !USER_ID) {
            return res.status(400).json({
                error: 'Valid contact group ID and user ID are required'
            });
        }

        // Verify contact group exists and belongs to company
        const groupCheck = await prisma.$queryRaw`
            SELECT CONTACT_GROUP_ID, GROUP_NAME 
            FROM GUARDIAN.NOTICE_CONTACT_GROUPS 
            WHERE CONTACT_GROUP_ID = ${contactGroupId} AND COMPANY_ID = ${req.companyId}
        `;

        if (groupCheck.length === 0) {
            return res.status(404).json({
                error: 'Contact group not found or access denied'
            });
        }

        // Verify user exists and belongs to same company
        const userCheck = await prisma.$queryRaw`
            SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL 
            FROM GUARDIAN.USERS 
            WHERE USER_ID = ${USER_ID} AND COMPANY_ID = ${req.companyId} AND STATUS = 'A'
        `;

        if (userCheck.length === 0) {
            return res.status(404).json({
                error: 'User not found or access denied'
            });
        }

        // Check if user is already a member
        const existingMember = await prisma.$queryRaw`
            SELECT GROUP_MEMBER_ID 
            FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS 
            WHERE CONTACT_GROUP_ID = ${contactGroupId} AND USER_ID = ${USER_ID}
        `;

        if (existingMember.length > 0) {
            return res.status(400).json({
                error: 'User is already a member of this contact group'
            });
        }

        // Add member to group
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS (
                CONTACT_GROUP_ID, USER_ID, COMPANY_ID, MEMBER_TYPE, MEMBER_STATUS,
                ADDED_BY_USER_ID, NOTIFICATION_PREFERENCE, ADDED_DATE, CREATE_DATE, UPDATE_DATE
            )
            VALUES (
                ${contactGroupId}, ${USER_ID}, ${req.companyId}, ${MEMBER_TYPE}, ${MEMBER_STATUS},
                ${req.userId}, ${NOTIFICATION_PREFERENCE}, GETDATE(), GETDATE(), GETDATE()
            )
        `;

        // Update member count in contact group
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_CONTACT_GROUPS 
            SET MEMBER_COUNT = (
                SELECT COUNT(*) 
                FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS 
                WHERE CONTACT_GROUP_ID = ${contactGroupId} AND MEMBER_STATUS = 'ACTIVE'
            ),
            UPDATE_DATE = GETDATE(),
            UPDATE_USER_ID = ${req.userId}
            WHERE CONTACT_GROUP_ID = ${contactGroupId}
        `;

        // Get the added member details
        const newMember = await prisma.$queryRaw`
            SELECT 
                ncgm.GROUP_MEMBER_ID,
                ncgm.CONTACT_GROUP_ID,
                ncgm.USER_ID,
                ncgm.MEMBER_TYPE,
                ncgm.MEMBER_STATUS,
                ncgm.NOTIFICATION_PREFERENCE,
                ncgm.ADDED_DATE,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS ncgm
            INNER JOIN GUARDIAN.USERS u ON ncgm.USER_ID = u.USER_ID
            WHERE ncgm.CONTACT_GROUP_ID = ${contactGroupId} 
            AND ncgm.USER_ID = ${USER_ID}
        `;

        console.log(`✅ Member ${USER_ID} added to contact group ${contactGroupId} successfully`);
        
        res.status(201).json({
            success: true,
            message: 'Member added to contact group successfully',
            member: newMember[0]
        });
    } catch (error) {
        console.error('❌ Error adding member to contact group:', error);
        res.status(500).json({
            error: 'Failed to add member to contact group',
            message: error.message
        });
    }
});

// Remove member from contact group endpoint
app.delete('/api/contact-groups/:id/members/:memberId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const contactGroupId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        
        console.log(`👤🗑️ Removing member ${memberId} from contact group ${contactGroupId} (Company: ${req.companyId})`);

        if (!contactGroupId || isNaN(contactGroupId) || !memberId || isNaN(memberId)) {
            return res.status(400).json({
                error: 'Valid contact group ID and member ID are required'
            });
        }

        // Verify member exists and belongs to the group and company
        const memberCheck = await prisma.$queryRaw`
            SELECT 
                ncgm.GROUP_MEMBER_ID,
                ncgm.USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME
            FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS ncgm
            INNER JOIN GUARDIAN.USERS u ON ncgm.USER_ID = u.USER_ID
            WHERE ncgm.GROUP_MEMBER_ID = ${memberId} 
            AND ncgm.CONTACT_GROUP_ID = ${contactGroupId}
            AND ncgm.COMPANY_ID = ${req.companyId}
        `;

        if (memberCheck.length === 0) {
            return res.status(404).json({
                error: 'Member not found in this contact group or access denied'
            });
        }

        const member = memberCheck[0];

        // Remove member from group
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS 
            WHERE GROUP_MEMBER_ID = ${memberId} 
            AND CONTACT_GROUP_ID = ${contactGroupId}
            AND COMPANY_ID = ${req.companyId}
        `;

        // Update member count in contact group
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_CONTACT_GROUPS 
            SET MEMBER_COUNT = (
                SELECT COUNT(*) 
                FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS 
                WHERE CONTACT_GROUP_ID = ${contactGroupId} AND MEMBER_STATUS = 'ACTIVE'
            ),
            UPDATE_DATE = GETDATE(),
            UPDATE_USER_ID = ${req.userId}
            WHERE CONTACT_GROUP_ID = ${contactGroupId}
        `;

        console.log(`✅ Member ${member.FIRST_NAME} ${member.LAST_NAME} removed from contact group ${contactGroupId} successfully`);
        
        res.json({
            success: true,
            message: 'Member removed from contact group successfully'
        });
    } catch (error) {
        console.error('❌ Error removing member from contact group:', error);
        res.status(500).json({
            error: 'Failed to remove member from contact group',
            message: error.message
        });
    }
});

// Update request assignment
app.put('/api/requests/:requestId/assign', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const { assignedUserId } = req.body;

        console.log(`📝 Assigning request ${requestId} to user ${assignedUserId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Check if user has permission to assign requests (Admin, Manager, Processor, or Super Admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Insufficient permissions for assignment operations'
            });
        }

        // Verify request belongs to user's company
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // If assigning to someone, verify they're in the same company
        if (assignedUserId) {
            const userExists = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS 
                WHERE USER_ID = ${assignedUserId} AND COMPANY_ID = ${req.companyId}
            `;

            if (!userExists.length) {
                return res.status(400).json({
                    error: 'Cannot assign to user outside your company'
                });
            }
        }

        await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET ASSIGNED_ID = ${assignedUserId || null}, 
                UPDATE_DATE = GETDATE()
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        // Create notification if assigning to someone
        if (assignedUserId) {
            try {
                // Get request details for notification
                const requestDetails = await prisma.$queryRaw`
                    SELECT REQUEST_NAME, REQUEST_DESCRIPTION, TRACKINGID 
                    FROM GUARDIAN.REQUESTS 
                    WHERE REQUEST_ID = ${requestId}
                `;

                if (requestDetails.length > 0) {
                    const request = requestDetails[0];
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${assignedUserId},
                            'assignment',
                            'New Request Assigned',
                            'You have been assigned to request: ' + ${request.REQUEST_NAME} + ' (ID: ' + ${request.TRACKINGID} + ')',
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                    console.log(`🔔 Notification created for user ${assignedUserId} about request assignment`);
                    
                    // Create milestone for request assignment
                    try {
                        const assignedUserDetails = await prisma.$queryRaw`
                            SELECT FIRST_NAME, LAST_NAME FROM GUARDIAN.USERS WHERE USER_ID = ${assignedUserId}
                        `;
                        const assignedUserName = assignedUserDetails.length > 0 
                            ? `${assignedUserDetails[0].FIRST_NAME} ${assignedUserDetails[0].LAST_NAME}` 
                            : `User ${assignedUserId}`;
                        
                        await createSystemMilestone(
                            requestId,
                            'system',
                            'Request Assigned',
                            `Request assigned to ${assignedUserName}`,
                            req.userId,
                            req.companyId,
                            JSON.stringify({
                                assignedUserId,
                                assignedUserName,
                                assignedBy: req.userId
                            })
                        );
                        console.log(`🏁 Request assignment milestone created for request ${requestId}`);
                    } catch (milestoneError) {
                        console.error('⚠️ Failed to create request assignment milestone (continuing):', milestoneError);
                    }
                    
                    // Send email notification
                    try {
                        // Get assigned user's email and name
                        const assignedUser = await prisma.$queryRaw`
                            SELECT EMAIL, FIRST_NAME, LAST_NAME 
                            FROM GUARDIAN.USERS 
                            WHERE USER_ID = ${assignedUserId}
                        `;
                        
                        // Get assigning user's name  
                        const assigningUser = await prisma.$queryRaw`
                            SELECT FIRST_NAME, LAST_NAME 
                            FROM GUARDIAN.USERS 
                            WHERE USER_ID = ${req.userId}
                        `;
                        
                        if (assignedUser.length > 0 && assigningUser.length > 0) {
                            const assigned = assignedUser[0];
                            const assigner = assigningUser[0];
                            const assignedUserName = `${assigned.FIRST_NAME} ${assigned.LAST_NAME}`;
                            const assignedByName = `${assigner.FIRST_NAME} ${assigner.LAST_NAME}`;
                            
                            console.log(`📧 Sending assignment email to ${assigned.EMAIL} for request: ${request.REQUEST_NAME}`);
                            
                            const emailSent = await sendAssignmentEmail(
                                assigned.EMAIL,
                                assignedUserName,
                                request.REQUEST_NAME,
                                request.TRACKINGID,
                                assignedByName
                            );
                            
                            if (emailSent) {
                                console.log(`✅ Assignment email sent successfully to ${assigned.EMAIL}`);
                            } else {
                                console.log(`⚠️ Assignment email could not be sent to ${assigned.EMAIL} (fallback mode or error)`);
                            }
                        }
                    } catch (emailError) {
                        console.error('⚠️ Failed to send assignment email:', emailError);
                        // Don't fail the assignment if email sending fails
                    }
                }
            } catch (notificationError) {
                console.error('⚠️ Failed to create notification:', notificationError);
                // Don't fail the assignment if notification creation fails
            }
        }

        console.log(`✅ Request ${requestId} assigned successfully`);

        res.json({
            success: true,
            message: 'Request assigned successfully',
            requestId: requestId,
            assignedUserId: assignedUserId
        });

    } catch (error) {
        console.error('❌ Error assigning request:', error);
        res.status(500).json({
            error: 'Failed to assign request',
            message: error.message
        });
    }
});

// Update request description
app.put('/api/requests/:requestId/description', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const { description } = req.body;

        console.log(`📝 Updating results description for request ${requestId} (Company: ${req.companyId})`);
        console.log(`🔍 Debug values:`, {
            requestId,
            description: description?.substring(0, 50) + '...',
            companyId: req.companyId,
            userId: req.userId,
            companyIdType: typeof req.companyId,
            userIdType: typeof req.userId
        });

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Validate description length (4000 character limit)
        if (description && description.length > 4000) {
            return res.status(400).json({
                error: 'Description cannot exceed 4000 characters',
                currentLength: description.length,
                maxLength: 4000
            });
        }

        // Verify request belongs to user's company
        console.log(`🔍 Checking if request ${requestId} exists in company ${req.companyId}`);
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${parseInt(req.companyId)}
        `;
        console.log(`🔍 Request exists check result:`, requestExists);

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Update request results description - simplified query first
        console.log(`🔍 Updating RESULTS_DESCRIPTION with values:`, {
            requestId,
            description: description || null,
            userId: req.userId,
            companyId: parseInt(req.companyId)
        });

        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.REQUESTS 
            SET RESULTS_DESCRIPTION = ${description || null}, 
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${parseInt(req.companyId)}
        `;
        
        console.log(`🔍 Update result:`, result);

        if (result === 0) {
            return res.status(404).json({
                error: 'Request not found or no changes made'
            });
        }

        // Create milestone for description update
        try {
            await createSystemMilestone(
                requestId,
                'system',
                'Results Updated',
                'Request results description was updated',
                req.userId,
                req.companyId,
                JSON.stringify({
                    action: 'results_update',
                    hasDescription: !!description,
                    descriptionLength: description ? description.length : 0
                })
            );
            console.log(`🏁 Results update milestone created for request ${requestId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create results update milestone (continuing):', milestoneError);
        }

        console.log(`✅ Results description updated successfully for request ${requestId}`);

        res.json({
            success: true,
            message: 'Request results description updated successfully',
            requestId: requestId,
            description: description
        });

    } catch (error) {
        console.error('❌ Error updating request results description:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            requestId: req.params.requestId,
            companyId: req.companyId,
            userId: req.userId,
            description: req.body.description
        });
        res.status(500).json({
            error: 'Failed to update request results description',
            message: error.message,
            details: error.stack
        });
    }
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, PDF, Word, Excel, and text files are allowed.'), false);
        }
    }
});

// === WORK PROGRESS MANAGEMENT ENDPOINTS ===

// Get all work progress entries for a request
app.get('/api/requests/:id/progress', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`📈 Fetching work progress for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Verify request belongs to user's company
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Get all progress entries for the request with user information
        const progressEntries = await prisma.$queryRaw`
            SELECT 
                wp.WORK_PROGRESS_ID,
                wp.REQUEST_ID,
                wp.USER_ID,
                wp.COMPANY_ID,
                wp.PROGRESS_TYPE,
                wp.TITLE,
                wp.DESCRIPTION,
                wp.HOURS_WORKED,
                wp.STATUS_UPDATE,
                wp.RELATED_ATTACHMENT_ID,
                wp.IS_MILESTONE,
                wp.IS_VISIBLE_TO_REQUESTOR,
                wp.CREATE_DATE,
                wp.UPDATE_DATE,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                a.FILE_NAME as ATTACHMENT_FILE_NAME
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.USERS u ON wp.USER_ID = u.USER_ID
            LEFT JOIN GUARDIAN.ATTACHMENTS a ON wp.RELATED_ATTACHMENT_ID = a.ATTACHMENT_ID
            WHERE wp.REQUEST_ID = ${requestId} 
            AND wp.COMPANY_ID = ${req.companyId}
            ORDER BY wp.CREATE_DATE DESC
        `;

        console.log(`✅ Found ${progressEntries.length} progress entries for request ${requestId}`);

        res.json({
            success: true,
            progress: progressEntries.map(entry => ({
                workProgressId: entry.WORK_PROGRESS_ID,
                requestId: entry.REQUEST_ID,
                userId: entry.USER_ID,
                companyId: entry.COMPANY_ID,
                progressType: entry.PROGRESS_TYPE,
                title: entry.TITLE,
                description: entry.DESCRIPTION,
                hoursWorked: entry.HOURS_WORKED ? parseFloat(entry.HOURS_WORKED) : null,
                statusUpdate: entry.STATUS_UPDATE,
                relatedAttachmentId: entry.RELATED_ATTACHMENT_ID,
                isMilestone: entry.IS_MILESTONE,
                isVisibleToRequestor: entry.IS_VISIBLE_TO_REQUESTOR,
                createDate: entry.CREATE_DATE,
                updateDate: entry.UPDATE_DATE,
                user: {
                    firstName: entry.FIRST_NAME,
                    lastName: entry.LAST_NAME,
                    email: entry.EMAIL
                },
                attachmentFileName: entry.ATTACHMENT_FILE_NAME
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching work progress:', error);
        res.status(500).json({
            error: 'Failed to fetch work progress',
            message: error.message
        });
    }
});

// Add new progress entry with optional file upload
app.post('/api/requests/:id/progress', getAuthenticatedUserCompany, upload.single('attachment'), async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const {
            progressType = 'note',
            title,
            description,
            hoursWorked,
            statusUpdate,
            isMilestone = false,
            isVisibleToRequestor = true
        } = req.body;

        console.log(`📝 Adding progress entry for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                error: 'Progress title is required'
            });
        }

        // Verify request belongs to user's company
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID, ASSIGNED_ID, REQUESTOR_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = requestExists[0];

        // Check if user is authorized to add progress (assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isAssigned = request.ASSIGNED_ID === req.userId;
        const isRequestor = request.REQUESTOR_ID === req.userId;

        if (!isAdmin && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to add progress to this request'
            });
        }

        let attachmentId = null;

        // Handle file upload if provided
        if (req.file) {
            console.log(`📎 Processing file upload: ${req.file.originalname}`);
            
            const fileResult = await prisma.$queryRaw`
                INSERT INTO GUARDIAN.ATTACHMENTS (
                    REQUEST_ID, 
                    FILE_NAME, 
                    ATTACHMENT, 
                    COMPANY_ID,
                    CREATE_USER_ID, 
                    CREATE_DATE
                ) 
                OUTPUT INSERTED.ATTACHMENT_ID
                VALUES (
                    ${requestId},
                    ${req.file.originalname},
                    ${req.file.buffer},
                    ${req.companyId},
                    ${req.userId},
                    GETDATE()
                )
            `;

            if (fileResult.length > 0) {
                attachmentId = fileResult[0].ATTACHMENT_ID;
                console.log(`✅ File uploaded with attachment ID: ${attachmentId}`);
            }
        }

        // Create the progress entry
        const progressResult = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.WORK_PROGRESS (
                REQUEST_ID,
                USER_ID,
                COMPANY_ID,
                PROGRESS_TYPE,
                TITLE,
                DESCRIPTION,
                HOURS_WORKED,
                STATUS_UPDATE,
                RELATED_ATTACHMENT_ID,
                IS_MILESTONE,
                IS_VISIBLE_TO_REQUESTOR,
                CREATE_USER_ID,
                CREATE_DATE
            )
            OUTPUT INSERTED.WORK_PROGRESS_ID
            VALUES (
                ${requestId},
                ${req.userId},
                ${req.companyId},
                ${progressType},
                ${title},
                ${description || null},
                ${hoursWorked ? parseFloat(hoursWorked) : null},
                ${statusUpdate || null},
                ${attachmentId},
                ${isMilestone === 'true' || isMilestone === true ? 1 : 0},
                ${isVisibleToRequestor === 'true' || isVisibleToRequestor === true ? 1 : 0},
                ${req.userId},
                GETDATE()
            )
        `;

        const workProgressId = progressResult[0].WORK_PROGRESS_ID;
        console.log(`✅ Progress entry created with ID: ${workProgressId}`);

        // If this is a milestone, status update, or question, create notifications for relevant users
        const isQuestion = progressType === 'communication' && title && title.toLowerCase().includes('question');
        const needsNotification = isMilestone === 'true' || isMilestone === true || statusUpdate || isQuestion || progressType === 'communication';
        
        if (needsNotification) {
            try {
                let notificationTitle = 'Progress Update';
                let notificationMessage = title || 'New progress update';
                
                // Set specific notification types
                if (isMilestone === 'true' || isMilestone === true) {
                    notificationTitle = 'Milestone Reached';
                } else if (statusUpdate) {
                    notificationTitle = 'Status Update';
                    notificationMessage = `${title}${statusUpdate ? ` - Status: ${statusUpdate}` : ''}`;
                } else if (isQuestion) {
                    notificationTitle = 'Question from Processor';
                    notificationMessage = `Your assigned processor has a question: ${title}`;
                } else if (progressType === 'communication') {
                    notificationTitle = 'Update from Processor';
                    notificationMessage = `New update on your request: ${title}`;
                }

                console.log(`📢 Creating notifications - Type: ${progressType}, Title: ${notificationTitle}`);

                // Notify requestor if not the same user
                if (request.REQUESTOR_ID && request.REQUESTOR_ID !== req.userId) {
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${request.REQUESTOR_ID},
                            'progress_update',
                            ${notificationTitle},
                            ${notificationMessage},
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                }

                // Notify assigned user if not the same user
                if (request.ASSIGNED_ID && request.ASSIGNED_ID !== req.userId) {
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID, 
                            TYPE, 
                            TITLE, 
                            MESSAGE, 
                            RELATED_ID, 
                            COMPANY_ID, 
                            CREATED_DATE, 
                            IS_READ
                        ) VALUES (
                            ${request.ASSIGNED_ID},
                            'progress_update',
                            ${notificationTitle},
                            ${notificationMessage},
                            ${requestId},
                            ${req.companyId},
                            GETDATE(),
                            0
                        )
                    `;
                }

                console.log(`🔔 Progress update notifications created`);
            } catch (notificationError) {
                console.error('⚠️ Failed to create progress notifications:', notificationError);
                // Don't fail the progress creation if notification creation fails
            }
        }

        res.json({
            success: true,
            message: 'Progress entry added successfully',
            workProgressId: workProgressId,
            attachmentId: attachmentId
        });

    } catch (error) {
        console.error('❌ Error adding progress entry:', error);
        res.status(500).json({
            error: 'Failed to add progress entry',
            message: error.message
        });
    }
});

// Update existing progress entry
app.put('/api/progress/:progressId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const progressId = parseInt(req.params.progressId);
        const {
            title,
            description,
            hoursWorked,
            statusUpdate,
            isMilestone,
            isVisibleToRequestor
        } = req.body;

        console.log(`✏️ Updating progress entry ${progressId} (Company: ${req.companyId})`);

        if (!progressId || isNaN(progressId)) {
            return res.status(400).json({
                error: 'Valid progress ID is required'
            });
        }

        // Verify progress entry belongs to user's company and get details
        const progressEntry = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.USER_ID, wp.REQUEST_ID, r.ASSIGNED_ID, r.REQUESTOR_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${progressId} 
            AND wp.COMPANY_ID = ${req.companyId}
        `;

        if (!progressEntry.length) {
            return res.status(404).json({
                error: 'Progress entry not found or access denied'
            });
        }

        const entry = progressEntry[0];

        // Check if user is authorized to update progress (creator, assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = entry.USER_ID === req.userId;
        const isAssigned = entry.ASSIGNED_ID === req.userId;
        const isRequestor = entry.REQUESTOR_ID === req.userId;

        if (!isAdmin && !isCreator && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to update this progress entry'
            });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (title !== undefined) {
            updates.push('TITLE = ?');
            values.push(title);
        }
        if (description !== undefined) {
            updates.push('DESCRIPTION = ?');
            values.push(description);
        }
        if (hoursWorked !== undefined) {
            updates.push('HOURS_WORKED = ?');
            values.push(hoursWorked ? parseFloat(hoursWorked) : null);
        }
        if (statusUpdate !== undefined) {
            updates.push('STATUS_UPDATE = ?');
            values.push(statusUpdate);
        }
        if (isMilestone !== undefined) {
            updates.push('IS_MILESTONE = ?');
            values.push(isMilestone === 'true' || isMilestone === true ? 1 : 0);
        }
        if (isVisibleToRequestor !== undefined) {
            updates.push('IS_VISIBLE_TO_REQUESTOR = ?');
            values.push(isVisibleToRequestor === 'true' || isVisibleToRequestor === true ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No valid fields provided for update'
            });
        }

        updates.push('UPDATE_DATE = GETDATE()');
        updates.push('UPDATE_USER_ID = ?');
        values.push(req.userId);

        await prisma.$executeRaw`
            UPDATE GUARDIAN.WORK_PROGRESS 
            SET TITLE = ${title || null},
                DESCRIPTION = ${description || null},
                HOURS_WORKED = ${hoursWorked ? parseFloat(hoursWorked) : null},
                STATUS_UPDATE = ${statusUpdate || null},
                IS_MILESTONE = ${isMilestone === 'true' || isMilestone === true ? 1 : 0},
                IS_VISIBLE_TO_REQUESTOR = ${isVisibleToRequestor === 'true' || isVisibleToRequestor === true ? 1 : 0},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE WORK_PROGRESS_ID = ${progressId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Progress entry ${progressId} updated successfully`);

        res.json({
            success: true,
            message: 'Progress entry updated successfully',
            workProgressId: progressId
        });

    } catch (error) {
        console.error('❌ Error updating progress entry:', error);
        res.status(500).json({
            error: 'Failed to update progress entry',
            message: error.message
        });
    }
});

// Delete progress entry
app.delete('/api/progress/:progressId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const progressId = parseInt(req.params.progressId);

        console.log(`🗑️ Deleting progress entry ${progressId} (Company: ${req.companyId})`);

        if (!progressId || isNaN(progressId)) {
            return res.status(400).json({
                error: 'Valid progress ID is required'
            });
        }

        // Verify progress entry belongs to user's company and get details
        const progressEntry = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.USER_ID, wp.REQUEST_ID, r.ASSIGNED_ID, r.REQUESTOR_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${progressId} 
            AND wp.COMPANY_ID = ${req.companyId}
        `;

        if (!progressEntry.length) {
            return res.status(404).json({
                error: 'Progress entry not found or access denied'
            });
        }

        const entry = progressEntry[0];

        // Check if user is authorized to delete progress (creator or admin only)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = entry.USER_ID === req.userId;

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                error: 'You are not authorized to delete this progress entry'
            });
        }

        // Delete the progress entry
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.WORK_PROGRESS 
            WHERE WORK_PROGRESS_ID = ${progressId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Progress entry ${progressId} deleted successfully`);

        res.json({
            success: true,
            message: 'Progress entry deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting progress entry:', error);
        res.status(500).json({
            error: 'Failed to delete progress entry',
            message: error.message
        });
    }
});

// Get progress summary/statistics for a request
app.get('/api/progress/:progressId/summary', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const progressId = parseInt(req.params.progressId);

        console.log(`📊 Fetching progress summary for ${progressId} (Company: ${req.companyId})`);

        if (!progressId || isNaN(progressId)) {
            return res.status(400).json({
                error: 'Valid progress ID is required'
            });
        }

        // Get the request ID from the progress entry
        const progressEntry = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.WORK_PROGRESS 
            WHERE WORK_PROGRESS_ID = ${progressId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!progressEntry.length) {
            return res.status(404).json({
                error: 'Progress entry not found or access denied'
            });
        }

        const requestId = progressEntry[0].REQUEST_ID;

        // Get summary statistics
        const summary = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as TOTAL_ENTRIES,
                SUM(CASE WHEN IS_MILESTONE = 1 THEN 1 ELSE 0 END) as MILESTONE_COUNT,
                SUM(CASE WHEN HOURS_WORKED IS NOT NULL THEN HOURS_WORKED ELSE 0 END) as TOTAL_HOURS,
                COUNT(DISTINCT USER_ID) as CONTRIBUTORS_COUNT,
                COUNT(CASE WHEN RELATED_ATTACHMENT_ID IS NOT NULL THEN 1 END) as ATTACHMENTS_COUNT,
                MIN(CREATE_DATE) as FIRST_ENTRY,
                MAX(CREATE_DATE) as LATEST_ENTRY
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        // Get progress type breakdown
        const typeBreakdown = await prisma.$queryRaw`
            SELECT 
                PROGRESS_TYPE,
                COUNT(*) as COUNT
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            GROUP BY PROGRESS_TYPE
            ORDER BY COUNT DESC
        `;

        const summaryData = summary[0];

        console.log(`✅ Progress summary compiled for request ${requestId}`);

        res.json({
            success: true,
            summary: {
                totalEntries: parseInt(summaryData.TOTAL_ENTRIES),
                milestoneCount: parseInt(summaryData.MILESTONE_COUNT),
                totalHours: parseFloat(summaryData.TOTAL_HOURS) || 0,
                contributorsCount: parseInt(summaryData.CONTRIBUTORS_COUNT),
                attachmentsCount: parseInt(summaryData.ATTACHMENTS_COUNT),
                firstEntry: summaryData.FIRST_ENTRY,
                latestEntry: summaryData.LATEST_ENTRY,
                typeBreakdown: typeBreakdown.map(item => ({
                    type: item.PROGRESS_TYPE,
                    count: parseInt(item.COUNT)
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error fetching progress summary:', error);
        res.status(500).json({
            error: 'Failed to fetch progress summary',
            message: error.message
        });
    }
});

// === MILESTONE TRACKING ENDPOINTS ===

// Helper function to create system-generated milestones
const createSystemMilestone = async (requestId, progressType, title, description, userId, companyId, eventData = null, relatedTaskId = null, statusFrom = null, statusTo = null) => {
    try {
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.WORK_PROGRESS (
                REQUEST_ID,
                USER_ID,
                COMPANY_ID,
                PROGRESS_TYPE,
                TITLE,
                DESCRIPTION,
                IS_MILESTONE,
                IS_VISIBLE_TO_REQUESTOR,
                IS_SYSTEM_GENERATED,
                RELATED_TASK_ID,
                STATUS_FROM,
                STATUS_TO,
                EVENT_DATA,
                CREATE_USER_ID,
                CREATE_DATE
            )
            OUTPUT INSERTED.WORK_PROGRESS_ID
            VALUES (
                ${requestId},
                ${userId},
                ${companyId},
                ${progressType},
                ${title},
                ${description},
                1,
                1,
                1,
                ${relatedTaskId},
                ${statusFrom},
                ${statusTo},
                ${eventData},
                ${userId},
                GETDATE()
            )
        `;
        
        console.log(`✅ System milestone created with ID: ${result[0].WORK_PROGRESS_ID}`);
        return result[0].WORK_PROGRESS_ID;
    } catch (error) {
        console.error('❌ Error creating system milestone:', error);
        throw error;
    }
};

// Helper function for status change milestones
const createStatusChangeMilestone = async (requestId, fromStatus, toStatus, userId, companyId) => {
    const statusLabels = {
        'P': 'Pending',
        'A': 'Active', 
        'D': 'Complete',
        'I': 'In Progress',
        'X': 'Cancelled',
        'H': 'On Hold',
        'R': 'Rejected'
    };
    
    const title = `Status Changed: ${statusLabels[fromStatus] || fromStatus} → ${statusLabels[toStatus] || toStatus}`;
    const description = `Request status automatically changed from "${statusLabels[fromStatus] || fromStatus}" to "${statusLabels[toStatus] || toStatus}"`;
    
    return await createSystemMilestone(
        requestId, 
        'status', 
        title, 
        description, 
        userId, 
        companyId, 
        JSON.stringify({ fromStatus, toStatus }),
        null,
        fromStatus,
        toStatus
    );
};

// Helper function for task-related milestones
const createTaskMilestone = async (requestId, taskId, action, userId, companyId) => {
    const actionLabels = {
        'created': 'Task Created',
        'started': 'Task Started',
        'completed': 'Task Completed',
        'cancelled': 'Task Cancelled',
        'assigned': 'Task Assigned'
    };
    
    const title = actionLabels[action] || `Task ${action}`;
    const description = `Task activity: ${action}`;
    
    return await createSystemMilestone(
        requestId, 
        'task', 
        title, 
        description, 
        userId, 
        companyId,
        JSON.stringify({ taskId, action }),
        taskId
    );
};

// Helper function for document milestones
const createDocumentMilestone = async (requestId, filename, action, userId, companyId) => {
    const title = `Document ${action}: ${filename}`;
    const description = `Document "${filename}" was ${action}`;
    
    return await createSystemMilestone(
        requestId, 
        'document', 
        title, 
        description, 
        userId, 
        companyId,
        JSON.stringify({ filename, action })
    );
};

// 1. GET /api/requests/:requestId/milestones - Get all milestones for a request
app.get('/api/requests/:requestId/milestones', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const { 
            type, 
            isSystemGenerated, 
            page = 1, 
            limit = 50, 
            sortBy = 'CREATE_DATE', 
            sortOrder = 'DESC' 
        } = req.query;
        
        console.log(`🏗️ Fetching milestones for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Verify request belongs to user's company (OR COMPANY_ID IS NULL for legacy records)
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS
            WHERE REQUEST_ID = ${requestId} AND (COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Build WHERE conditions
        const companyIdNum = Number(req.companyId);
        let whereConditions = `wp.REQUEST_ID = ${requestId} AND wp.COMPANY_ID = ${companyIdNum}`;
        
        if (type && type !== 'all') {
            whereConditions += ` AND wp.PROGRESS_TYPE = '${type}'`;
        }
        
        if (isSystemGenerated !== undefined) {
            const systemGenerated = isSystemGenerated === 'true' ? 1 : 0;
            whereConditions += ` AND wp.IS_SYSTEM_GENERATED = ${systemGenerated}`;
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        // Get milestones with rich user and task data
        const milestonesQuery = `
            SELECT 
                wp.WORK_PROGRESS_ID,
                wp.REQUEST_ID,
                wp.USER_ID,
                wp.COMPANY_ID,
                wp.PROGRESS_TYPE,
                wp.TITLE,
                wp.DESCRIPTION,
                wp.HOURS_WORKED,
                wp.STATUS_UPDATE,
                wp.RELATED_ATTACHMENT_ID,
                wp.IS_MILESTONE,
                wp.IS_VISIBLE_TO_REQUESTOR,
                wp.IS_SYSTEM_GENERATED,
                wp.RELATED_TASK_ID,
                wp.STATUS_FROM,
                wp.STATUS_TO,
                wp.EVENT_DATA,
                wp.CREATE_DATE,
                wp.UPDATE_DATE,
                wp.CREATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                creator.FIRST_NAME as CREATOR_FIRST_NAME,
                creator.LAST_NAME as CREATOR_LAST_NAME,
                creator.EMAIL as CREATOR_EMAIL,
                t.DESCRIPTION as TASK_DESCRIPTION,
                t.STATUS as TASK_STATUS,
                t.ASSIGNED_USER_ID as TASK_ASSIGNED_USER_ID,
                assigned_user.FIRST_NAME as TASK_ASSIGNED_FIRST_NAME,
                assigned_user.LAST_NAME as TASK_ASSIGNED_LAST_NAME,
                a.FILE_NAME as ATTACHMENT_FILE_NAME
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.USERS u ON wp.USER_ID = u.USER_ID
            LEFT JOIN GUARDIAN.USERS creator ON wp.CREATE_USER_ID = creator.USER_ID
            LEFT JOIN GUARDIAN.TASKS t ON wp.RELATED_TASK_ID = t.TASK_ID
            LEFT JOIN GUARDIAN.USERS assigned_user ON t.ASSIGNED_USER_ID = assigned_user.USER_ID
            LEFT JOIN GUARDIAN.ATTACHMENTS a ON wp.RELATED_ATTACHMENT_ID = a.ATTACHMENT_ID
            WHERE ${whereConditions}
            ORDER BY wp.${sortBy} ${sortOrder}
            OFFSET ${offset} ROWS FETCH NEXT ${limitNum} ROWS ONLY
        `;
        
        let milestones = [];
        let totalCount = 0;
        try {
            milestones = await prisma.$queryRawUnsafe(milestonesQuery);

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total_count
                FROM GUARDIAN.WORK_PROGRESS wp
                WHERE ${whereConditions}
            `;
            const countResult = await prisma.$queryRawUnsafe(countQuery);
            totalCount = parseInt(countResult[0]?.total_count || 0);
        } catch (queryError) {
            console.warn(`⚠️ Milestones query failed for request ${requestId}:`, queryError.message);
            // Return empty results rather than 500 if WORK_PROGRESS table is unavailable
        }
        const totalPages = Math.ceil(totalCount / limitNum);

        console.log(`✅ Found ${milestones.length} milestones for request ${requestId} (Page ${pageNum}/${totalPages})`);

        res.json({
            success: true,
            milestones: milestones.map(milestone => ({
                workProgressId: milestone.WORK_PROGRESS_ID,
                requestId: milestone.REQUEST_ID,
                userId: milestone.USER_ID,
                companyId: milestone.COMPANY_ID,
                progressType: milestone.PROGRESS_TYPE,
                title: milestone.TITLE,
                description: milestone.DESCRIPTION,
                hoursWorked: milestone.HOURS_WORKED ? parseFloat(milestone.HOURS_WORKED) : null,
                statusUpdate: milestone.STATUS_UPDATE,
                relatedAttachmentId: milestone.RELATED_ATTACHMENT_ID,
                isMilestone: milestone.IS_MILESTONE,
                isVisibleToRequestor: milestone.IS_VISIBLE_TO_REQUESTOR,
                isSystemGenerated: milestone.IS_SYSTEM_GENERATED,
                relatedTaskId: milestone.RELATED_TASK_ID,
                statusFrom: milestone.STATUS_FROM,
                statusTo: milestone.STATUS_TO,
                eventData: milestone.EVENT_DATA ? JSON.parse(milestone.EVENT_DATA) : null,
                createDate: milestone.CREATE_DATE,
                updateDate: milestone.UPDATE_DATE,
                createUserId: milestone.CREATE_USER_ID,
                user: {
                    firstName: milestone.FIRST_NAME,
                    lastName: milestone.LAST_NAME,
                    email: milestone.EMAIL
                },
                creator: milestone.CREATOR_FIRST_NAME ? {
                    firstName: milestone.CREATOR_FIRST_NAME,
                    lastName: milestone.CREATOR_LAST_NAME,
                    email: milestone.CREATOR_EMAIL
                } : null,
                relatedTask: milestone.RELATED_TASK_ID ? {
                    taskId: milestone.RELATED_TASK_ID,
                    description: milestone.TASK_DESCRIPTION,
                    status: milestone.TASK_STATUS,
                    assignedUser: milestone.TASK_ASSIGNED_FIRST_NAME ? {
                        firstName: milestone.TASK_ASSIGNED_FIRST_NAME,
                        lastName: milestone.TASK_ASSIGNED_LAST_NAME
                    } : null
                } : null,
                attachmentFileName: milestone.ATTACHMENT_FILE_NAME
            })),
            pagination: {
                currentPage: pageNum,
                totalPages: totalPages,
                totalItems: totalCount,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPreviousPage: pageNum > 1
            }
        });

    } catch (error) {
        console.error('❌ Error fetching milestones:', error);
        res.status(500).json({
            error: 'Failed to fetch milestones',
            message: error.message
        });
    }
});

// 2. POST /api/milestones - Create manual milestone
app.post('/api/milestones', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const {
            REQUEST_ID,
            TITLE,
            PROGRESS_DETAILS,
            PROGRESS_TYPE = 'milestone',
            EVENT_DATA
        } = req.body;

        console.log(`🏗️ Creating manual milestone for request ${REQUEST_ID} (Company: ${req.companyId})`);

        if (!REQUEST_ID || !TITLE) {
            return res.status(400).json({
                error: 'REQUEST_ID and TITLE are required'
            });
        }

        const requestId = parseInt(REQUEST_ID);
        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid REQUEST_ID is required'
            });
        }

        // Verify request belongs to user's company and user has access
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, ASSIGNED_ID, REQUESTOR_ID 
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!request.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Check authorization (assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isAssigned = request[0].ASSIGNED_ID === req.userId;
        const isRequestor = request[0].REQUESTOR_ID === req.userId;

        if (!isAdmin && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to create milestones for this request'
            });
        }

        // Create manual milestone
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.WORK_PROGRESS (
                REQUEST_ID,
                USER_ID,
                COMPANY_ID,
                PROGRESS_TYPE,
                TITLE,
                DESCRIPTION,
                IS_MILESTONE,
                IS_VISIBLE_TO_REQUESTOR,
                IS_SYSTEM_GENERATED,
                EVENT_DATA,
                CREATE_USER_ID,
                CREATE_DATE
            )
            OUTPUT INSERTED.WORK_PROGRESS_ID
            VALUES (
                ${requestId},
                ${req.userId},
                ${req.companyId},
                ${PROGRESS_TYPE},
                ${TITLE},
                ${PROGRESS_DETAILS || null},
                1,
                1,
                0,
                ${EVENT_DATA || null},
                ${req.userId},
                GETDATE()
            )
        `;

        const milestoneId = result[0].WORK_PROGRESS_ID;
        console.log(`✅ Manual milestone created with ID: ${milestoneId}`);

        // Create notification for milestone creation
        try {
            if (request[0].REQUESTOR_ID && request[0].REQUESTOR_ID !== req.userId) {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.NOTIFICATIONS (
                        USER_ID, 
                        TYPE, 
                        TITLE, 
                        MESSAGE, 
                        RELATED_ID, 
                        COMPANY_ID, 
                        CREATED_DATE, 
                        IS_READ
                    ) VALUES (
                        ${request[0].REQUESTOR_ID},
                        'milestone_created',
                        'New Milestone Added',
                        ${`Milestone: ${TITLE}`},
                        ${requestId},
                        ${req.companyId},
                        GETDATE(),
                        0
                    )
                `;
            }

            if (request[0].ASSIGNED_ID && request[0].ASSIGNED_ID !== req.userId) {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.NOTIFICATIONS (
                        USER_ID, 
                        TYPE, 
                        TITLE, 
                        MESSAGE, 
                        RELATED_ID, 
                        COMPANY_ID, 
                        CREATED_DATE, 
                        IS_READ
                    ) VALUES (
                        ${request[0].ASSIGNED_ID},
                        'milestone_created',
                        'New Milestone Added',
                        ${`Milestone: ${TITLE}`},
                        ${requestId},
                        ${req.companyId},
                        GETDATE(),
                        0
                    )
                `;
            }
        } catch (notificationError) {
            console.error('⚠️ Failed to create milestone notifications:', notificationError);
        }

        res.json({
            success: true,
            milestoneId: milestoneId,
            message: 'Milestone created successfully'
        });

    } catch (error) {
        console.error('❌ Error creating milestone:', error);
        res.status(500).json({
            error: 'Failed to create milestone',
            message: error.message
        });
    }
});

// 3. GET /api/requests/:requestId/milestones/stats - Get milestone statistics
app.get('/api/requests/:requestId/milestones/stats', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        console.log(`📊 Fetching milestone stats for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Verify request access
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Get comprehensive statistics
        const stats = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as TOTAL_MILESTONES,
                COUNT(CASE WHEN IS_SYSTEM_GENERATED = 1 THEN 1 END) as SYSTEM_MILESTONES,
                COUNT(CASE WHEN IS_SYSTEM_GENERATED = 0 THEN 1 END) as MANUAL_MILESTONES,
                COUNT(CASE WHEN PROGRESS_TYPE = 'status' THEN 1 END) as STATUS_CHANGES,
                COUNT(CASE WHEN PROGRESS_TYPE = 'task' THEN 1 END) as TASK_MILESTONES,
                COUNT(CASE WHEN PROGRESS_TYPE = 'document' THEN 1 END) as DOCUMENT_MILESTONES,
                COUNT(CASE WHEN PROGRESS_TYPE = 'milestone' THEN 1 END) as MANUAL_MILESTONE_COUNT,
                COUNT(CASE WHEN PROGRESS_TYPE = 'note' THEN 1 END) as NOTES_COUNT,
                COUNT(CASE WHEN PROGRESS_TYPE = 'communication' THEN 1 END) as COMMUNICATIONS_COUNT,
                MIN(CREATE_DATE) as FIRST_MILESTONE,
                MAX(CREATE_DATE) as LATEST_MILESTONE,
                COUNT(DISTINCT USER_ID) as UNIQUE_CONTRIBUTORS
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        // Get type breakdown with counts
        const typeBreakdown = await prisma.$queryRaw`
            SELECT 
                PROGRESS_TYPE,
                COUNT(*) as COUNT,
                COUNT(CASE WHEN IS_SYSTEM_GENERATED = 1 THEN 1 END) as SYSTEM_COUNT,
                COUNT(CASE WHEN IS_SYSTEM_GENERATED = 0 THEN 1 END) as MANUAL_COUNT
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            GROUP BY PROGRESS_TYPE
            ORDER BY COUNT(*) DESC
        `;

        // Calculate time-based metrics
        let timeMetrics = null;
        if (stats[0].FIRST_MILESTONE && stats[0].LATEST_MILESTONE) {
            const firstDate = new Date(stats[0].FIRST_MILESTONE);
            const latestDate = new Date(stats[0].LATEST_MILESTONE);
            const totalDays = Math.ceil((latestDate - firstDate) / (1000 * 60 * 60 * 24));
            const averageInterval = totalDays / Math.max(1, parseInt(stats[0].TOTAL_MILESTONES) - 1);

            timeMetrics = {
                totalDaysSpanned: totalDays,
                averageDaysBetweenMilestones: Math.round(averageInterval * 100) / 100,
                firstMilestone: stats[0].FIRST_MILESTONE,
                latestMilestone: stats[0].LATEST_MILESTONE
            };
        }

        // Get recent milestone activity
        const recentMilestones = await prisma.$queryRaw`
            SELECT TOP 5
                PROGRESS_TYPE,
                TITLE,
                CREATE_DATE,
                IS_SYSTEM_GENERATED
            FROM GUARDIAN.WORK_PROGRESS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            ORDER BY CREATE_DATE DESC
        `;

        console.log(`✅ Milestone stats calculated for request ${requestId}`);

        res.json({
            success: true,
            stats: {
                totalMilestones: parseInt(stats[0].TOTAL_MILESTONES),
                systemGenerated: parseInt(stats[0].SYSTEM_MILESTONES),
                manualCreated: parseInt(stats[0].MANUAL_MILESTONES),
                systemVsManualRatio: stats[0].TOTAL_MILESTONES > 0 ? 
                    Math.round((stats[0].SYSTEM_MILESTONES / stats[0].TOTAL_MILESTONES) * 100) : 0,
                uniqueContributors: parseInt(stats[0].UNIQUE_CONTRIBUTORS),
                breakdown: {
                    statusChanges: parseInt(stats[0].STATUS_CHANGES),
                    taskMilestones: parseInt(stats[0].TASK_MILESTONES),
                    documentMilestones: parseInt(stats[0].DOCUMENT_MILESTONES),
                    manualMilestones: parseInt(stats[0].MANUAL_MILESTONE_COUNT),
                    notes: parseInt(stats[0].NOTES_COUNT),
                    communications: parseInt(stats[0].COMMUNICATIONS_COUNT)
                },
                typeBreakdown: typeBreakdown.map(type => ({
                    type: type.PROGRESS_TYPE,
                    total: parseInt(type.COUNT),
                    systemGenerated: parseInt(type.SYSTEM_COUNT),
                    manualCreated: parseInt(type.MANUAL_COUNT)
                })),
                timeMetrics: timeMetrics,
                recentActivity: recentMilestones.map(milestone => ({
                    type: milestone.PROGRESS_TYPE,
                    title: milestone.TITLE,
                    createDate: milestone.CREATE_DATE,
                    isSystemGenerated: milestone.IS_SYSTEM_GENERATED
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error fetching milestone stats:', error);
        res.status(500).json({
            error: 'Failed to fetch milestone statistics',
            message: error.message
        });
    }
});

// 4. PUT /api/milestones/:milestoneId - Update manual milestone (non-system only)
app.put('/api/milestones/:milestoneId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const milestoneId = parseInt(req.params.milestoneId);
        const {
            TITLE,
            DESCRIPTION,
            PROGRESS_TYPE,
            EVENT_DATA
        } = req.body;

        console.log(`✏️ Updating milestone ${milestoneId} (Company: ${req.companyId})`);

        if (!milestoneId || isNaN(milestoneId)) {
            return res.status(400).json({
                error: 'Valid milestone ID is required'
            });
        }

        // Verify milestone exists, is not system-generated, and belongs to company
        const milestone = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.REQUEST_ID, wp.USER_ID, wp.IS_SYSTEM_GENERATED, 
                   r.ASSIGNED_ID, r.REQUESTOR_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${milestoneId} 
            AND wp.COMPANY_ID = ${req.companyId}
        `;

        if (!milestone.length) {
            return res.status(404).json({
                error: 'Milestone not found or access denied'
            });
        }

        if (milestone[0].IS_SYSTEM_GENERATED) {
            return res.status(403).json({
                error: 'System-generated milestones cannot be modified'
            });
        }

        // Check authorization
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = milestone[0].USER_ID === req.userId;
        const isAssigned = milestone[0].ASSIGNED_ID === req.userId;
        const isRequestor = milestone[0].REQUESTOR_ID === req.userId;

        if (!isAdmin && !isCreator && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to update this milestone'
            });
        }

        // Update milestone
        await prisma.$executeRaw`
            UPDATE GUARDIAN.WORK_PROGRESS 
            SET 
                TITLE = COALESCE(${TITLE}, TITLE),
                DESCRIPTION = COALESCE(${DESCRIPTION}, DESCRIPTION),
                PROGRESS_TYPE = COALESCE(${PROGRESS_TYPE}, PROGRESS_TYPE),
                EVENT_DATA = COALESCE(${EVENT_DATA}, EVENT_DATA),
                UPDATE_DATE = GETDATE()
            WHERE WORK_PROGRESS_ID = ${milestoneId} 
            AND COMPANY_ID = ${req.companyId}
            AND IS_SYSTEM_GENERATED = 0
        `;

        console.log(`✅ Milestone ${milestoneId} updated successfully`);

        res.json({
            success: true,
            message: 'Milestone updated successfully'
        });

    } catch (error) {
        console.error('❌ Error updating milestone:', error);
        res.status(500).json({
            error: 'Failed to update milestone',
            message: error.message
        });
    }
});

// 5. DELETE /api/milestones/:milestoneId - Delete manual milestone
app.delete('/api/milestones/:milestoneId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const milestoneId = parseInt(req.params.milestoneId);
        console.log(`🗑️ Deleting milestone ${milestoneId} (Company: ${req.companyId})`);

        if (!milestoneId || isNaN(milestoneId)) {
            return res.status(400).json({
                error: 'Valid milestone ID is required'
            });
        }

        // Verify milestone exists, is not system-generated, and user has permission
        const milestone = await prisma.$queryRaw`
            SELECT wp.WORK_PROGRESS_ID, wp.REQUEST_ID, wp.USER_ID, wp.IS_SYSTEM_GENERATED, wp.TITLE,
                   r.ASSIGNED_ID, r.REQUESTOR_ID
            FROM GUARDIAN.WORK_PROGRESS wp
            INNER JOIN GUARDIAN.REQUESTS r ON wp.REQUEST_ID = r.REQUEST_ID
            WHERE wp.WORK_PROGRESS_ID = ${milestoneId} 
            AND wp.COMPANY_ID = ${req.companyId}
        `;

        if (!milestone.length) {
            return res.status(404).json({
                error: 'Milestone not found or access denied'
            });
        }

        if (milestone[0].IS_SYSTEM_GENERATED) {
            return res.status(403).json({
                error: 'System-generated milestones cannot be deleted'
            });
        }

        // Check authorization (creator, admin, assigned, or requestor)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isCreator = milestone[0].USER_ID === req.userId;
        const isAssigned = milestone[0].ASSIGNED_ID === req.userId;
        const isRequestor = milestone[0].REQUESTOR_ID === req.userId;

        if (!isAdmin && !isCreator && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to delete this milestone'
            });
        }

        // Delete milestone
        const result = await prisma.$executeRaw`
            DELETE FROM GUARDIAN.WORK_PROGRESS 
            WHERE WORK_PROGRESS_ID = ${milestoneId} 
            AND COMPANY_ID = ${req.companyId}
            AND IS_SYSTEM_GENERATED = 0
        `;

        if (result === 0) {
            return res.status(404).json({
                error: 'Milestone not found or could not be deleted'
            });
        }

        console.log(`✅ Milestone ${milestoneId} "${milestone[0].TITLE}" deleted successfully`);

        res.json({
            success: true,
            message: 'Milestone deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting milestone:', error);
        res.status(500).json({
            error: 'Failed to delete milestone',
            message: error.message
        });
    }
});

// === TASK MANAGEMENT ENDPOINTS ===

// Get tasks for a specific request
app.get('/api/requests/:requestId/tasks', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        console.log(`📋 Fetching tasks for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Verify request belongs to user's company (OR COMPANY_ID IS NULL for legacy records)
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUESTOR_ID, ASSIGNED_ID, STATUS
            FROM GUARDIAN.REQUESTS
            WHERE REQUEST_ID = ${requestId} AND (COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
        `;

        if (!request.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Get tasks with user information
        const tasks = await prisma.$queryRaw`
            SELECT 
                t.TASK_ID,
                t.REQUEST_ID,
                t.STATUS,
                t.ASSIGNED_USER_ID,
                t.DESCRIPTION,
                t.CREATE_DATE,
                t.UPDATE_DATE,
                au.FIRST_NAME as ASSIGNED_FIRST_NAME,
                au.LAST_NAME as ASSIGNED_LAST_NAME,
                au.EMAIL as ASSIGNED_EMAIL,
                cu.FIRST_NAME as CREATED_BY_FIRST_NAME,
                cu.LAST_NAME as CREATED_BY_LAST_NAME,
                cu.EMAIL as CREATED_BY_EMAIL
            FROM GUARDIAN.TASKS t
            LEFT JOIN GUARDIAN.USERS au ON t.ASSIGNED_USER_ID = au.USER_ID
            LEFT JOIN GUARDIAN.USERS cu ON t.CREATE_USER_ID = cu.USER_ID
            WHERE t.REQUEST_ID = ${requestId}
            ORDER BY t.CREATE_DATE DESC
        `;

        // Format tasks with user objects
        const formattedTasks = tasks.map(task => ({
            ...task,
            assignedUser: task.ASSIGNED_USER_ID ? {
                FIRST_NAME: task.ASSIGNED_FIRST_NAME,
                LAST_NAME: task.ASSIGNED_LAST_NAME,
                EMAIL: task.ASSIGNED_EMAIL
            } : null,
            createdBy: {
                FIRST_NAME: task.CREATED_BY_FIRST_NAME,
                LAST_NAME: task.CREATED_BY_LAST_NAME,
                EMAIL: task.CREATED_BY_EMAIL
            }
        }));

        // Calculate summary
        const summary = {
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.STATUS === 'Pending').length,
            inProgressTasks: tasks.filter(t => t.STATUS === 'In Progress').length,
            completedTasks: tasks.filter(t => t.STATUS === 'Completed').length
        };

        console.log(`✅ Found ${tasks.length} tasks for request ${requestId}`);

        res.json({
            success: true,
            data: formattedTasks,
            summary: summary
        });

    } catch (error) {
        console.error('❌ Error fetching tasks:', error);
        res.status(500).json({
            error: 'Failed to fetch tasks',
            message: error.message
        });
    }
});

// Create a new task
app.post('/api/tasks', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { requestId, assignedUserId, description, status = 'Pending' } = req.body;
        // Parse assigned user id if provided
        const assignedId = assignedUserId === undefined || assignedUserId === null
            ? assignedUserId
            : parseInt(assignedUserId);
        
        console.log(`➕ Creating task for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || !description) {
            return res.status(400).json({
                error: 'Request ID and description are required'
            });
        }

        // Verify request belongs to user's company
        const request = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUESTOR_ID, ASSIGNED_ID, STATUS
            FROM GUARDIAN.REQUESTS
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!request.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // If assignedUserId is provided, verify the user exists and belongs to the same company
        if (assignedId !== undefined && assignedId && Number.isInteger(assignedId)) {
            const assignedUser = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS
                WHERE USER_ID = ${assignedId} AND COMPANY_ID = ${req.companyId}
            `;

            if (!assignedUser.length) {
                return res.status(400).json({
                    error: 'Assigned user not found or not in the same company'
                });
            }
        }

        // Create the task (TRACKINGID is computed column, no need to insert)
        await prisma.$queryRaw`
            INSERT INTO GUARDIAN.TASKS (
                REQUEST_ID,
                STATUS,
                ASSIGNED_USER_ID,
                DESCRIPTION,
                CREATE_USER_ID,
                UPDATE_USER_ID,
                CREATE_DATE,
                UPDATE_DATE
            )
            VALUES (
                ${requestId},
                ${status},
                ${assignedId || null},
                ${description},
                ${req.userId},
                ${req.userId},
                GETDATE(),
                GETDATE()
            )
        `;

        // Get the inserted task ID using SCOPE_IDENTITY()
        const taskIdResult = await prisma.$queryRaw`SELECT SCOPE_IDENTITY() as TASK_ID`;
        const taskId = taskIdResult[0]?.TASK_ID;
        console.log(`✅ Task created with ID: ${taskId}`, taskIdResult);

        // Resolve finalTaskId WITH fallback BEFORE using it
        let finalTaskId = taskId;
        if (!finalTaskId) {
            console.log('⚠️ SCOPE_IDENTITY returned null, trying alternative method...');
            const recentTask = await prisma.$queryRaw`
                SELECT TOP 1 TASK_ID
                FROM GUARDIAN.TASKS
                WHERE REQUEST_ID = ${requestId} AND CREATE_USER_ID = ${req.userId}
                ORDER BY CREATE_DATE DESC
            `;
            finalTaskId = recentTask[0]?.TASK_ID;
            console.log(`🔄 Alternative task ID retrieval result: ${finalTaskId}`);
        }

        // Create milestone for task creation
        try {
            await createTaskMilestone(
                requestId,
                finalTaskId,
                'created',
                req.userId,
                req.companyId
            );
            console.log(`🏁 Task creation milestone created for task ${finalTaskId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create task creation milestone (continuing):', milestoneError);
        }

        // Create notification for assigned user if different from creator
        if (assignedUserId && assignedUserId !== req.userId) {
            try {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.NOTIFICATIONS (
                        USER_ID, 
                        TYPE, 
                        TITLE, 
                        MESSAGE, 
                        RELATED_ID, 
                        COMPANY_ID, 
                        CREATED_DATE, 
                        IS_READ
                    ) VALUES (
                        ${assignedUserId}, 
                        'task_assigned', 
                        'New Task Assigned', 
                        ${'You have been assigned a new task: ' + description}, 
                        ${finalTaskId}, 
                        ${req.companyId}, 
                        GETDATE(), 
                        0
                    )
                `;
                console.log(`📢 Notification sent to user ${assignedUserId} for task assignment`);
            } catch (notificationError) {
                console.error('⚠️ Failed to create notification:', notificationError);
                // Continue anyway - task creation should not fail due to notification issues
            }
            
            // Send email notification for task assignment
            console.log(`🎯 About to send email for task assignment to user: ${assignedUserId}`);
            try {
                // Get assigned user's email and name
                const assignedUser = await prisma.$queryRaw`
                    SELECT EMAIL, FIRST_NAME, LAST_NAME 
                    FROM GUARDIAN.USERS 
                    WHERE USER_ID = ${assignedUserId}
                `;
                
                // Get assigning user's name  
                const assigningUser = await prisma.$queryRaw`
                    SELECT FIRST_NAME, LAST_NAME 
                    FROM GUARDIAN.USERS 
                    WHERE USER_ID = ${req.userId}
                `;
                
                // Get request details for context
                const requestDetails = await prisma.$queryRaw`
                    SELECT REQUEST_NAME, TRACKINGID 
                    FROM GUARDIAN.REQUESTS 
                    WHERE REQUEST_ID = ${requestId}
                `;
                
                if (assignedUser.length > 0 && assigningUser.length > 0 && requestDetails.length > 0) {
                    const assigned = assignedUser[0];
                    const assigner = assigningUser[0];
                    const request = requestDetails[0];
                    const assignedUserName = `${assigned.FIRST_NAME} ${assigned.LAST_NAME}`;
                    const assignedByName = `${assigner.FIRST_NAME} ${assigner.LAST_NAME}`;
                    
                    console.log(`📧 Sending task assignment email to ${assigned.EMAIL} for task: ${description}`);
                    
                    const emailSent = await sendTaskAssignmentEmail(
                        assigned.EMAIL,
                        assignedUserName,
                        request.REQUEST_NAME,
                        request.TRACKINGID,
                        description,
                        `T-${finalTaskId}`,
                        assignedByName
                    );
                    
                    if (emailSent) {
                        console.log(`✅ Task assignment email sent successfully`);
                    } else {
                        console.log(`⚠️ Task assignment email failed to send`);
                    }
                }
            } catch (emailError) {
                console.error('⚠️ Failed to send task assignment email:', emailError);
                // Continue anyway - task creation should not fail due to email issues
            }
        }

        res.json({
            success: true,
            message: 'Task created successfully',
            taskId: finalTaskId
        });

    } catch (error) {
        console.error('❌ Error creating task:', error);
        res.status(500).json({
            error: 'Failed to create task',
            message: error.message
        });
    }
});

// Update a task
app.put('/api/tasks/:taskId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        const { assignedUserId, description, status } = req.body;
        // Log raw body for diagnostics
        try { console.log('📦 [TASK UPDATE] Raw body:', JSON.stringify(req.body)); } catch {}
        const assignedId = assignedUserId === undefined || assignedUserId === null
            ? assignedUserId
            : parseInt(assignedUserId);
        // Status is stored as VARCHAR(20) with string values like "Pending", "In Progress", "Completed", "Cancelled"

        console.log('🧪 [TASK UPDATE] Incoming:', {
            taskId,
            descriptionType: typeof description,
            statusType: typeof status,
            statusValue: status,
            assignedUserIdRaw: assignedUserId,
            assignedIdParsed: assignedId
        });

        console.log(`✏️ Updating task ${taskId} (Company: ${req.companyId})`);

        if (!taskId || isNaN(taskId)) {
            return res.status(400).json({
                error: 'Valid task ID is required'
            });
        }

        // Check if user has permission for task assignment operations (Admin, Manager, Processor, or Super Admin)
        if (assignedUserId !== undefined) {
            const userRoles = await prisma.$queryRaw`
                SELECT ur.ROLE_ID 
                FROM GUARDIAN.USER_ROLES ur 
                WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
            `;
            
            const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
            if (!isAdmin) {
                return res.status(403).json({
                    error: 'Insufficient permissions for assignment operations'
                });
            }
        }

        // Verify task exists and belongs to user's company
        const task = await prisma.$queryRaw`
            SELECT t.TASK_ID, t.REQUEST_ID, t.ASSIGNED_USER_ID, t.CREATE_USER_ID, r.COMPANY_ID,
                   t.DESCRIPTION, r.REQUEST_NAME, r.TRACKINGID
            FROM GUARDIAN.TASKS t
            INNER JOIN GUARDIAN.REQUESTS r ON t.REQUEST_ID = r.REQUEST_ID
            WHERE t.TASK_ID = ${taskId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!task.length) {
            return res.status(404).json({
                error: 'Task not found or access denied'
            });
        }

        // Validate assignedUserId if provided
        if (assignedId !== undefined && assignedId && Number.isInteger(assignedId)) {
            // Verify the user exists and belongs to the same company
            const assignedUser = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS
                WHERE USER_ID = ${assignedId} AND COMPANY_ID = ${req.companyId}
            `;

            if (!assignedUser.length) {
                return res.status(400).json({
                    error: 'Assigned user not found or not in the same company'
                });
            }
        }

        // Check if we have at least one field to update
        if (description === undefined && status === undefined && assignedId === undefined) {
            return res.status(400).json({
                error: 'No valid fields to update'
            });
        }

        // Force assignment-only when assignedUserId is present
        if (assignedUserId !== undefined) {
            if (assignedId === undefined || (!Number.isInteger(assignedId) && assignedId !== null)) {
                console.warn('⚠️ [TASK UPDATE] Invalid assignedUserId payload:', assignedUserId);
                return res.status(400).json({ error: 'Invalid assignedUserId' });
            }
            await prisma.$executeRaw`
                UPDATE GUARDIAN.TASKS
                SET ASSIGNED_USER_ID = ${assignedId || null},
                    UPDATE_DATE = GETDATE(),
                    UPDATE_USER_ID = ${req.userId}
                WHERE TASK_ID = ${taskId}
            `;

            // Create milestone for task assignment
            try {
                await createTaskMilestone(
                    task[0].REQUEST_ID,
                    taskId,
                    'assigned',
                    req.userId,
                    req.companyId
                );
                console.log(`🏁 Task assignment milestone created for task ${taskId}`);
            } catch (milestoneError) {
                console.error('⚠️ Failed to create task assignment milestone (continuing):', milestoneError);
            }

            // Notify and email the new assignee if different from the person making the change
            if (assignedId && assignedId !== req.userId) {
                try {
                    const assignedUser = await prisma.$queryRaw`
                        SELECT FIRST_NAME, LAST_NAME, EMAIL FROM GUARDIAN.USERS
                        WHERE USER_ID = ${assignedId} AND COMPANY_ID = ${req.companyId}
                    `;
                    if (assignedUser.length > 0) {
                        const u = assignedUser[0];
                        await prisma.$executeRaw`
                            INSERT INTO GUARDIAN.NOTIFICATIONS
                                (USER_ID, TYPE, TITLE, MESSAGE, RELATED_ID, COMPANY_ID, CREATED_DATE, IS_READ)
                            VALUES
                                (${assignedId}, 'task_assigned', 'Task Assigned',
                                 ${'You have been assigned a task: ' + task[0].DESCRIPTION},
                                 ${taskId}, ${req.companyId}, GETDATE(), 0)
                        `;
                        console.log(`📢 Reassignment notification sent to user ${assignedId} for task ${taskId}`);
                        const assigningUser = await prisma.$queryRaw`
                            SELECT FIRST_NAME, LAST_NAME FROM GUARDIAN.USERS WHERE USER_ID = ${req.userId}
                        `;
                        const assignedByName = assigningUser.length > 0
                            ? `${assigningUser[0].FIRST_NAME} ${assigningUser[0].LAST_NAME}`.trim()
                            : '';
                        await sendTaskAssignmentEmail(
                            u.EMAIL,
                            `${u.FIRST_NAME} ${u.LAST_NAME}`,
                            task[0].REQUEST_NAME,
                            task[0].TRACKINGID,
                            task[0].DESCRIPTION,
                            `T-${taskId}`,
                            assignedByName
                        );
                    }
                } catch (notifErr) {
                    console.error('⚠️ Failed to create reassignment notification:', notifErr);
                }
            }

            console.log(`✅ Task ${taskId} assigned to ${assignedId || 'null'} successfully`);
            return res.json({ success: true, message: 'Task assigned successfully', taskId });
        }

        // Otherwise, update other fields (description/status) if provided
        if (description !== undefined) {
            await prisma.$executeRaw`
                UPDATE GUARDIAN.TASKS
                SET DESCRIPTION = ${description},
                    UPDATE_DATE = GETDATE(),
                    UPDATE_USER_ID = ${req.userId}
                WHERE TASK_ID = ${taskId}
            `;
        }

        if (status !== undefined && status !== null) {
            // Validate status is one of the allowed string values
            const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
            if (validStatuses.includes(status)) {
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.TASKS
                    SET STATUS = ${status},
                        UPDATE_DATE = GETDATE(),
                        UPDATE_USER_ID = ${req.userId}
                    WHERE TASK_ID = ${taskId}
                `;
                console.log(`✅ Task ${taskId} status updated to: ${status}`);

                // Create milestone for the status change
                try {
                    const statusToAction = {
                        'In Progress': 'started',
                        'Completed': 'completed',
                        'Cancelled': 'cancelled'
                    };
                    const milestoneAction = statusToAction[status];
                    if (milestoneAction) {
                        await createTaskMilestone(task[0].REQUEST_ID, taskId, milestoneAction, req.userId, req.companyId);
                        console.log(`🏁 Task status milestone '${milestoneAction}' created for task ${taskId}`);
                    }
                } catch (milestoneError) {
                    console.error('⚠️ Failed to create task status milestone (continuing):', milestoneError);
                }

                // Notify the task's assignee of the status change (in-app only)
                const statusMessages = {
                    'In Progress': 'A task assigned to you has been started.',
                    'Completed':   'A task assigned to you has been completed.',
                    'Cancelled':   'A task assigned to you has been cancelled.',
                };
                const notifMessage = statusMessages[status];
                if (notifMessage && task[0].ASSIGNED_USER_ID && task[0].ASSIGNED_USER_ID !== req.userId) {
                    try {
                        await prisma.$executeRaw`
                            INSERT INTO GUARDIAN.NOTIFICATIONS
                                (USER_ID, TYPE, TITLE, MESSAGE, RELATED_ID, COMPANY_ID, CREATED_DATE, IS_READ)
                            VALUES
                                (${task[0].ASSIGNED_USER_ID}, 'task_update',
                                 ${'Task ' + status},
                                 ${notifMessage + ' Task: ' + task[0].DESCRIPTION},
                                 ${taskId}, ${req.companyId}, GETDATE(), 0)
                        `;
                        console.log(`📢 Status notification sent to user ${task[0].ASSIGNED_USER_ID} for task ${taskId}`);
                    } catch (notifErr) {
                        console.error('⚠️ Failed to create status notification:', notifErr);
                    }
                }
            } else {
                console.warn('⚠️ [TASK UPDATE] Invalid status value:', status, 'Valid values:', validStatuses);
                return res.status(400).json({
                    error: 'Invalid status value',
                    validValues: validStatuses,
                    receivedValue: status
                });
            }
        }

        console.log(`✅ Task ${taskId} updated successfully`);

        res.json({
            success: true,
            message: 'Task updated successfully',
            taskId: taskId
        });

    } catch (error) {
        console.error('❌ Error updating task:', error);
        res.status(500).json({
            error: 'Failed to update task',
            message: error.message
        });
    }
});

// Delete a task
app.delete('/api/tasks/:taskId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);

        console.log(`🗑️ Deleting task ${taskId} (Company: ${req.companyId})`);

        if (!taskId || isNaN(taskId)) {
            return res.status(400).json({
                error: 'Valid task ID is required'
            });
        }

        // Verify task exists and belongs to user's company
        const task = await prisma.$queryRaw`
            SELECT t.TASK_ID, t.REQUEST_ID, r.COMPANY_ID
            FROM GUARDIAN.TASKS t
            INNER JOIN GUARDIAN.REQUESTS r ON t.REQUEST_ID = r.REQUEST_ID
            WHERE t.TASK_ID = ${taskId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!task.length) {
            return res.status(404).json({
                error: 'Task not found or access denied'
            });
        }

        // Create milestone for task deletion before deleting
        try {
            await createTaskMilestone(
                task[0].REQUEST_ID,
                taskId,
                'deleted',
                req.userId,
                req.companyId
            );
            console.log(`🏁 Task deletion milestone created for task ${taskId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create task deletion milestone (continuing):', milestoneError);
        }

        // Delete the task
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.TASKS WHERE TASK_ID = ${taskId}
        `;

        console.log(`✅ Task ${taskId} deleted successfully`);

        res.json({
            success: true,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting task:', error);
        res.status(500).json({
            error: 'Failed to delete task',
            message: error.message
        });
    }
});

// === ATTACHMENT MANAGEMENT ENDPOINTS ===

// Upload file attachment to request
app.post('/api/requests/:id/attachments', getAuthenticatedUserCompany, upload.single('file'), async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        console.log(`📎 Uploading attachment for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: 'File is required'
            });
        }

        // Verify request belongs to user's company
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        console.log(`📁 Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

        // Insert the attachment
        const attachmentResult = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.ATTACHMENTS (
                REQUEST_ID, 
                FILE_NAME, 
                ATTACHMENT, 
                COMPANY_ID,
                CREATE_USER_ID, 
                CREATE_DATE
            ) 
            OUTPUT INSERTED.ATTACHMENT_ID
            VALUES (
                ${requestId},
                ${req.file.originalname},
                ${req.file.buffer},
                ${req.companyId},
                ${req.userId},
                GETDATE()
            )
        `;

        const attachmentId = attachmentResult[0].ATTACHMENT_ID;
        console.log(`✅ Attachment uploaded successfully with ID: ${attachmentId}`);
        
        // Create milestone for file upload
        try {
            await createDocumentMilestone(
                requestId,
                req.file.originalname,
                'uploaded',
                req.userId,
                req.companyId
            );
            console.log(`🏁 File upload milestone created for attachment ${attachmentId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create file upload milestone (continuing):', milestoneError);
        }

        res.json({
            success: true,
            message: 'File uploaded successfully',
            attachmentId: attachmentId,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('❌ Error uploading attachment:', error);
        res.status(500).json({
            error: 'Failed to upload attachment',
            message: error.message
        });
    }
});

// Get all attachments for a request
app.get('/api/requests/:id/attachments', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        console.log(`📎 Fetching attachments for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Verify request belongs to user's company (OR COMPANY_ID IS NULL for legacy records)
        const requestExists = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS
            WHERE REQUEST_ID = ${requestId} AND (COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
        `;

        if (!requestExists.length) {
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        // Get all attachments for the request
        const attachments = await prisma.$queryRaw`
            SELECT 
                a.ATTACHMENT_ID,
                a.REQUEST_ID,
                a.FILE_NAME,
                a.CREATE_DATE,
                a.CREATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.ATTACHMENTS a
            LEFT JOIN GUARDIAN.USERS u ON a.CREATE_USER_ID = u.USER_ID
            WHERE a.REQUEST_ID = ${requestId} 
            AND a.COMPANY_ID = ${req.companyId}
            ORDER BY a.CREATE_DATE DESC
        `;

        console.log(`✅ Found ${attachments.length} attachments for request ${requestId}`);

        res.json({
            success: true,
            attachments: attachments.map(attachment => ({
                attachmentId: attachment.ATTACHMENT_ID,
                requestId: attachment.REQUEST_ID,
                fileName: attachment.FILE_NAME,
                createDate: attachment.CREATE_DATE,
                uploadedBy: {
                    userId: attachment.CREATE_USER_ID,
                    firstName: attachment.FIRST_NAME,
                    lastName: attachment.LAST_NAME,
                    email: attachment.EMAIL
                }
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching attachments:', error);
        res.status(500).json({
            error: 'Failed to fetch attachments',
            message: error.message
        });
    }
});

// Download specific attachment
app.get('/api/attachments/:id/download', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const attachmentId = parseInt(req.params.id);

        console.log(`⬇️ Downloading attachment ${attachmentId} (Company: ${req.companyId})`);

        if (!attachmentId || isNaN(attachmentId)) {
            return res.status(400).json({
                error: 'Valid attachment ID is required'
            });
        }

        // Get the attachment with company verification
        const attachments = await prisma.$queryRaw`
            SELECT 
                a.ATTACHMENT_ID,
                a.FILE_NAME,
                a.ATTACHMENT,
                a.CREATE_DATE
            FROM GUARDIAN.ATTACHMENTS a
            WHERE a.ATTACHMENT_ID = ${attachmentId} 
            AND a.COMPANY_ID = ${req.companyId}
        `;

        if (!attachments.length) {
            return res.status(404).json({
                error: 'Attachment not found or access denied'
            });
        }

        const attachment = attachments[0];
        console.log(`📁 Serving file: ${attachment.FILE_NAME}`);

        // Detect MIME type from extension so browsers can render images inline
        const ext = (attachment.FILE_NAME || '').split('.').pop()?.toLowerCase() || '';
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', pdf: 'application/pdf' };
        const contentType = mimeMap[ext] || 'application/octet-stream';

        res.setHeader('Content-Disposition', `inline; filename="${attachment.FILE_NAME}"`);
        res.setHeader('Content-Type', contentType);

        // Send the file buffer
        res.send(attachment.ATTACHMENT);

    } catch (error) {
        console.error('❌ Error downloading attachment:', error);
        res.status(500).json({
            error: 'Failed to download attachment',
            message: error.message
        });
    }
});

// Delete attachment
app.delete('/api/attachments/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const attachmentId = parseInt(req.params.id);

        console.log(`🗑️ Deleting attachment ${attachmentId} (Company: ${req.companyId})`);

        if (!attachmentId || isNaN(attachmentId)) {
            return res.status(400).json({
                error: 'Valid attachment ID is required'
            });
        }

        // Verify attachment belongs to user's company and get details
        const attachments = await prisma.$queryRaw`
            SELECT 
                a.ATTACHMENT_ID,
                a.CREATE_USER_ID,
                a.REQUEST_ID,
                r.ASSIGNED_ID,
                r.REQUESTOR_ID
            FROM GUARDIAN.ATTACHMENTS a
            INNER JOIN GUARDIAN.REQUESTS r ON a.REQUEST_ID = r.REQUEST_ID
            WHERE a.ATTACHMENT_ID = ${attachmentId} 
            AND a.COMPANY_ID = ${req.companyId}
        `;

        if (!attachments.length) {
            return res.status(404).json({
                error: 'Attachment not found or access denied'
            });
        }

        const attachment = attachments[0];

        // Check if user is authorized to delete attachment (uploader, assigned user, requestor, or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;

        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isUploader = attachment.CREATE_USER_ID === req.userId;
        const isAssigned = attachment.ASSIGNED_ID === req.userId;
        const isRequestor = attachment.REQUESTOR_ID === req.userId;

        if (!isAdmin && !isUploader && !isAssigned && !isRequestor) {
            return res.status(403).json({
                error: 'You are not authorized to delete this attachment'
            });
        }

        // Check if attachment is referenced by any work progress entries
        const progressReferences = await prisma.$queryRaw`
            SELECT COUNT(*) as COUNT 
            FROM GUARDIAN.WORK_PROGRESS 
            WHERE RELATED_ATTACHMENT_ID = ${attachmentId}
        `;

        if (progressReferences[0].COUNT > 0) {
            return res.status(400).json({
                error: 'Cannot delete attachment that is referenced by work progress entries'
            });
        }

        // Delete the attachment
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.ATTACHMENTS 
            WHERE ATTACHMENT_ID = ${attachmentId} 
            AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ Attachment ${attachmentId} deleted successfully`);

        res.json({
            success: true,
            message: 'Attachment deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting attachment:', error);
        res.status(500).json({
            error: 'Failed to delete attachment',
            message: error.message
        });
    }
});

// Get form for a specific request (for form fulfillment)
app.get('/api/requests/:id/form', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`📋 Fetching form for request ${requestId} (Company: ${req.companyId})`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Get the request details
        console.log(`🔍 Querying for request ${requestId} in company ${req.companyId}`);
        const requests = await prisma.$queryRaw`
            SELECT r.REQUEST_ID, r.REQUEST_NAME, r.FORM_ID, r.STATUS, r.REQUESTOR_ID, r.ASSIGNED_ID,
                   r.CREATE_DATE, r.UPDATE_DATE, r.COMPANY_ID, r.REQUEST_DESCRIPTION
            FROM GUARDIAN.REQUESTS r
            WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${req.companyId}
        `;

        console.log(`🔍 Found ${requests.length} requests matching criteria`);
        if (!requests.length) {
            console.log(`❌ Request ${requestId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = requests[0];
        console.log(`✅ Found request with FORM_ID: ${request.FORM_ID}`);

        if (!request.FORM_ID) {
            console.log(`❌ Request ${requestId} has no form associated`);
            return res.status(404).json({
                error: 'No form associated with this request'
            });
        }

        // Get the form details (check both company-specific and global forms)
        console.log(`🔍 Querying for form ${request.FORM_ID} (company-specific or global)`);
        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${request.FORM_ID} 
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
        `;

        console.log(`🔍 Found ${forms.length} forms matching criteria`);
        if (!forms.length) {
            console.log(`❌ Form ${request.FORM_ID} not found for organization ${req.companyId}`);
            return res.status(404).json({
                error: 'Form template not found or access denied',
                details: `Request ${requestId} references form ${request.FORM_ID} which is not available for your organization`,
                requestId: requestId,
                formId: request.FORM_ID,
                companyId: req.companyId
            });
        }

        const form = forms[0];

        // Get fields specific to this form using the FORMS_FIELDS junction table
        console.log(`🔍 Querying fields for form ${request.FORM_ID} using junction table`);
        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_SENSITIVE, 
                   f.CREATE_DATE, f.UPDATE_DATE, f.ORGANIZATION_ID,
                   ff.IS_REQUIRED as FORM_IS_REQUIRED, ff.SORT_ORDER
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = ${request.FORM_ID}
            AND (f.ORGANIZATION_ID = ${req.companyId} OR f.ORGANIZATION_ID IS NULL)
            AND f.IS_DELETED = 0
            ORDER BY ff.SORT_ORDER, f.FIELD_ID
        `;
        console.log(`✅ Found ${fields.length} form-specific fields for form ${request.FORM_ID}`);

        // Check for existing form instance and values
        console.log(`🔍 Checking for existing form instance for request ${requestId}`);
        
        // Admin roles (1, 3, 4, 6) can see all form instances, others only see their own
        const isAdmin = req.userRoleIds && req.userRoleIds.some(roleId => [1, 3, 4, 6].includes(roleId));
        
        let existingInstances;
        // Look for existing form instance for this specific request
        existingInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID, SUBMITTED_DATE, CREATE_DATE, UPDATE_DATE, ASSIGNED_ID
            FROM GUARDIAN.FORMS_INSTANCE 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            ORDER BY CREATE_DATE DESC
        `;
        console.log(`🔍 Fetching form instance for request ${requestId}`);

        let existingValues = {};
        let formInstanceId = null;
        let formStatus = 'new'; // new, in_progress, completed

        if (existingInstances.length > 0) {
            formInstanceId = existingInstances[0].FORM_INSTANCE_ID;
            const submittedDate = existingInstances[0].SUBMITTED_DATE;
            
            console.log(`📋 Found existing form instance: ${formInstanceId}`);
            
            // Get existing field values
            const savedValues = await prisma.$queryRaw`
                SELECT FIELD_ID, VALUE
                FROM GUARDIAN.FORMS_INSTANCE_VALUES 
                WHERE FORM_INSTANCE_ID = ${formInstanceId}
            `;
            
            // Convert to object with field IDs as keys (for backend processing)
            const existingValuesByFieldId = savedValues.reduce((acc, value) => {
                acc[value.FIELD_ID] = value.VALUE;
                return acc;
            }, {});
            
            // Also create a mapping by field name (for frontend usage)
            existingValues = savedValues.reduce((acc, value) => {
                // Find the field with this FIELD_ID to get its name
                const field = fields.find(f => f.FIELD_ID === value.FIELD_ID);
                if (field) {
                    acc[field.FIELD_NAME] = value.VALUE;
                }
                return acc;
            }, {});
            
            console.log(`📊 Found ${savedValues.length} existing field values`);
            
            // Determine form completion status
            const requiredFields = fields.filter(f => f.FORM_IS_REQUIRED || f.IS_REQUIRED);
            const filledRequiredFields = requiredFields.filter(f => 
                existingValuesByFieldId[f.FIELD_ID] && existingValuesByFieldId[f.FIELD_ID].trim() !== ''
            );
            
            if (submittedDate && filledRequiredFields.length === requiredFields.length) {
                formStatus = 'completed';
            } else if (savedValues.length > 0) {
                formStatus = 'in_progress';
            }
            
            console.log(`📈 Form status: ${formStatus} (${filledRequiredFields.length}/${requiredFields.length} required fields filled)`);
        } else {
            console.log(`📝 No existing form instance found - new form`);
        }

        console.log(`✅ Found request ${requestId} with form ${request.FORM_ID} containing ${fields.length} fields`);

        // Prepare response in expected format
        const response = {
            request: {
                REQUEST_ID: request.REQUEST_ID,
                REQUEST_NAME: request.REQUEST_NAME,
                STATUS: request.STATUS,
                FORM_ID: request.FORM_ID,
                REQUESTOR_ID: request.REQUESTOR_ID,
                ASSIGNED_ID: request.ASSIGNED_ID,
                CREATE_DATE: request.CREATE_DATE,
                UPDATE_DATE: request.UPDATE_DATE,
                REQUEST_DESCRIPTION: request.REQUEST_DESCRIPTION
            },
            form: {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                FORM_DESCRIPTION: form.FORM_DESCRIPTION,
                IS_ACTIVE: form.IS_ACTIVE,
                IS_PUBLIC: form.IS_PUBLIC,
                IS_DELETED: form.IS_DELETED
            },
            fields: fields.map(field => ({
                FIELD_ID: field.FIELD_ID,
                FIELD_NAME: field.FIELD_NAME,
                FIELD_TYPE_ID: field.FIELD_TYPE_ID,
                DISPLAY_FORMAT: field.DISPLAY_FORMAT,
                HAS_LOOKUP: field.HAS_LOOKUP,
                IS_PUBLIC: field.IS_PUBLIC,
                IS_ACTIVE: field.IS_ACTIVE,
                IS_DELETED: field.IS_DELETED,
                IS_REQUIRED: field.FORM_IS_REQUIRED || field.IS_REQUIRED, // Use form-specific requirement
                IS_SENSITIVE: field.IS_SENSITIVE,
                SORT_ORDER: field.SORT_ORDER,
                CREATE_DATE: field.CREATE_DATE,
                UPDATE_DATE: field.UPDATE_DATE,
                ORGANIZATION_ID: field.ORGANIZATION_ID
            })),
            values: existingValues, // Include existing values for form pre-filling
            formInstanceId: formInstanceId,
            formStatus: formStatus, // new, in_progress, completed
            isCompleted: formStatus === 'completed',
            hasExistingData: Object.keys(existingValues).length > 0
        };

        console.log(`📤 Sending form data for request ${requestId} to frontend`);
        res.json(response);

    } catch (error) {
        console.error(`❌ Error fetching form for request ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to fetch request form',
            message: error.message
        });
    }
});

// Clear a single field value — used to remove stale references (e.g. deleted photo attachment)
app.delete('/api/requests/:requestId/field-value/:fieldId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const fieldId   = parseInt(req.params.fieldId);
        if (isNaN(requestId) || isNaN(fieldId)) {
            return res.status(400).json({ error: 'Invalid requestId or fieldId' });
        }
        // Find the form instance for this request (company-isolated)
        const instances = await prisma.$queryRaw`
            SELECT fi.FORM_INSTANCE_ID
            FROM GUARDIAN.FORMS_INSTANCE fi
            INNER JOIN GUARDIAN.REQUESTS r ON fi.REQUEST_ID = r.REQUEST_ID
            WHERE fi.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${req.companyId}
        `;
        if (!instances.length) {
            return res.status(404).json({ error: 'Form instance not found' });
        }
        const formInstanceId = instances[0].FORM_INSTANCE_ID;
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES
            WHERE FORM_INSTANCE_ID = ${formInstanceId} AND FIELD_ID = ${fieldId}
        `;
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error clearing field value:', error);
        res.status(500).json({ error: 'Failed to clear field value' });
    }
});

// Submit form data for a specific request
app.post('/api/requests/:id/form/submit', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { fieldValues, isComplete = false, isDraft = false } = req.body;

        console.log(`📝 Submitting form data for request ${requestId} (Company: ${req.companyId})`);
        console.log(`📋 Field values:`, JSON.stringify(fieldValues, null, 2));
        console.log(`📊 Submission type: ${isComplete ? 'Complete' : isDraft ? 'Draft' : 'Auto-save'}`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        if (!fieldValues || typeof fieldValues !== 'object') {
            return res.status(400).json({
                error: 'Field values are required'
            });
        }

        // Get the request details to verify ownership and get form ID
        const requests = await prisma.$queryRaw`
            SELECT r.REQUEST_ID, r.FORM_ID, r.ASSIGNED_ID, r.COMPANY_ID
            FROM GUARDIAN.REQUESTS r
            WHERE r.REQUEST_ID = ${requestId} AND r.COMPANY_ID = ${req.companyId}
        `;

        if (!requests.length) {
            console.log(`❌ Request ${requestId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = requests[0];
        
        if (!request.FORM_ID) {
            return res.status(400).json({
                error: 'No form associated with this request'
            });
        }

        // Check if form instance already exists for this request
        // Admin roles (1, 3, 4, 6) can see all form instances, others only see their own
        const isAdmin = req.userRoleIds && req.userRoleIds.some(roleId => [1, 3, 4, 6].includes(roleId));
        
        let existingInstances;
        // Look for existing form instance for this specific request
        existingInstances = await prisma.$queryRaw`
            SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            ORDER BY CREATE_DATE DESC
        `;

        let formInstanceId;

        if (existingInstances.length > 0) {
            formInstanceId = existingInstances[0].FORM_INSTANCE_ID;
            console.log(`📋 Using existing form instance: ${formInstanceId}`);
            
            // Update the existing instance with appropriate submitted date
            if (isComplete) {
                // Set submitted date for completed forms
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.FORMS_INSTANCE 
                    SET SUBMITTED_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}, UPDATE_DATE = GETDATE()
                    WHERE FORM_INSTANCE_ID = ${formInstanceId}
                `;
                console.log(`✅ Marked form instance as completed`);
            } else {
                // For drafts/in-progress, update timestamp but keep submitted_date NULL
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.FORMS_INSTANCE 
                    SET UPDATE_USER_ID = ${req.userId}, UPDATE_DATE = GETDATE()
                    WHERE FORM_INSTANCE_ID = ${formInstanceId}
                `;
                console.log(`📝 Updated form instance as in-progress`);
            }
        } else {
            // Create new form instance
            if (isComplete) {
                // Complete submission
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${requestId}, ${request.FORM_ID}, ${request.ASSIGNED_ID || req.userId}, ${req.companyId}, GETDATE(), ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new completed form instance`);
            } else {
                // Draft/in-progress submission (no submitted date)
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE (
                        REQUEST_ID, FORM_ID, ASSIGNED_ID, COMPANY_ID, SUBMITTED_DATE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${requestId}, ${request.FORM_ID}, ${request.ASSIGNED_ID || req.userId}, ${req.companyId}, NULL, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                console.log(`📋 Created new draft form instance`);
            }

            // Get the new instance ID
            let newInstances;
            if (isAdmin) {
                newInstances = await prisma.$queryRaw`
                    SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                    WHERE FORM_ID = ${request.FORM_ID} AND COMPANY_ID = ${req.companyId}
                    ORDER BY CREATE_DATE DESC
                `;
            } else {
                newInstances = await prisma.$queryRaw`
                    SELECT FORM_INSTANCE_ID FROM GUARDIAN.FORMS_INSTANCE 
                    WHERE FORM_ID = ${request.FORM_ID} AND ASSIGNED_ID = ${request.ASSIGNED_ID} AND COMPANY_ID = ${req.companyId}
                    ORDER BY CREATE_DATE DESC
                `;
            }
            
            formInstanceId = newInstances[0].FORM_INSTANCE_ID;
        }

        // Delete existing field values for this instance
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES 
            WHERE FORM_INSTANCE_ID = ${formInstanceId}
        `;

        // Insert new field values
        let savedCount = 0;
        for (const [fieldId, value] of Object.entries(fieldValues)) {
            if (value !== null && value !== undefined && value !== '') {
                const safeValue = String(value);
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.FORMS_INSTANCE_VALUES (
                        FORM_INSTANCE_ID, FIELD_ID, VALUE, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    ) VALUES (
                        ${formInstanceId}, ${parseInt(fieldId)}, ${safeValue}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                savedCount++;
            }
        }

        // Sync Analyst / Investigator USER_IDs onto the REQUESTS record (Fidelity-Subject only)
        try {
            const formNameRows = await prisma.$queryRaw`
                SELECT FORM_NAME FROM GUARDIAN.FORMS WHERE FORM_ID = ${request.FORM_ID} AND IS_DELETED = 0
            `;
            if (formNameRows.length > 0 && formNameRows[0].FORM_NAME === 'Fidelity-Subject') {
                const fieldRows = await prisma.$queryRaw`
                    SELECT FIELD_ID, FIELD_NAME FROM GUARDIAN.FIELDS
                    WHERE FIELD_NAME IN ('Analyst', 'Investigator') AND IS_DELETED = 0
                `;
                const resolveUserId = async (fullName) => {
                    if (!fullName || !fullName.trim()) return null;
                    const parts = fullName.trim().split(' ');
                    const firstName = parts[0];
                    const lastName = parts.slice(1).join(' ');
                    if (!firstName || !lastName) return null;
                    const users = await prisma.$queryRaw`
                        SELECT USER_ID FROM GUARDIAN.USERS
                        WHERE FIRST_NAME = ${firstName} AND LAST_NAME = ${lastName}
                          AND COMPANY_ID = ${req.companyId} AND STATUS = 'A'
                    `;
                    return users.length > 0 ? users[0].USER_ID : null;
                };
                const analystRow = fieldRows.find(f => f.FIELD_NAME === 'Analyst');
                const investigatorRow = fieldRows.find(f => f.FIELD_NAME === 'Investigator');
                if (analystRow) {
                    const analystName = fieldValues[String(analystRow.FIELD_ID)];
                    const analystId = await resolveUserId(analystName);
                    if (analystId !== null) {
                        await prisma.$executeRaw`UPDATE GUARDIAN.REQUESTS SET ANALYST_ID = ${analystId} WHERE REQUEST_ID = ${requestId}`;
                        console.log(`🔗 Set ANALYST_ID=${analystId} on request ${requestId}`);
                        await createSystemMilestone(requestId, 'system', 'Analyst Assigned',
                            `Analyst set to ${analystName}`, req.userId, req.companyId);
                    }
                }
                if (investigatorRow) {
                    const investigatorName = fieldValues[String(investigatorRow.FIELD_ID)];
                    const investigatorId = await resolveUserId(investigatorName);
                    if (investigatorId !== null) {
                        await prisma.$executeRaw`UPDATE GUARDIAN.REQUESTS SET INVESTIGATOR_ID = ${investigatorId} WHERE REQUEST_ID = ${requestId}`;
                        console.log(`🔗 Set INVESTIGATOR_ID=${investigatorId} on request ${requestId}`);
                        await createSystemMilestone(requestId, 'system', 'Investigator Assigned',
                            `Investigator set to ${investigatorName}`, req.userId, req.companyId);
                    }
                }
            }
        } catch (syncError) {
            console.warn('⚠️ Could not sync analyst/investigator IDs (continuing):', syncError.message);
        }

        // Determine the final status
        const finalStatus = isComplete ? 'completed' : (savedCount > 0 ? 'in_progress' : 'new');
        const statusMessage = isComplete ? 'Form completed successfully' : 
                            isDraft ? 'Draft saved successfully' : 
                            'Form data saved successfully';

        // Create milestone for form submission
        try {
            const submissionType = isComplete ? 'completed' : isDraft ? 'saved as draft' : 'auto-saved';
            await createSystemMilestone(
                requestId,
                'form',
                `Form ${submissionType}`,
                `Form data was ${submissionType} with ${savedCount} field values`,
                req.userId,
                req.companyId,
                JSON.stringify({
                    action: 'form_submission',
                    isComplete: isComplete,
                    isDraft: isDraft,
                    fieldCount: savedCount,
                    formInstanceId: formInstanceId,
                    formStatus: finalStatus
                })
            );
            console.log(`🏁 Form submission milestone created for request ${requestId}`);
        } catch (milestoneError) {
            console.error('⚠️ Failed to create form submission milestone (continuing):', milestoneError);
        }

        console.log(`✅ Form submitted successfully for request ${requestId}: ${savedCount} field values saved (Status: ${finalStatus})`);

        res.json({
            success: true,
            message: statusMessage,
            formInstanceId: formInstanceId,
            savedFieldCount: savedCount,
            formStatus: finalStatus,
            isComplete: isComplete,
            isDraft: isDraft
        });

    } catch (error) {
        console.error(`❌ Error submitting form for request ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to submit form data',
            message: error.message
        });
    }
});

// Delete a specific request
app.delete('/api/requests/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        console.log(`🗑️ Attempting to delete request ${requestId} for company ${req.companyId}`);

        if (!requestId || isNaN(requestId)) {
            return res.status(400).json({
                error: 'Valid request ID is required'
            });
        }

        // Check if user has permission to delete (Admin, Manager, or Super Admin roles: 1, 3, 6)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const canDelete = roleIds.includes(1) || roleIds.includes(3) || roleIds.includes(6);
        
        if (!canDelete) {
            console.log(`❌ User ${req.userId} lacks permission to delete requests`);
            return res.status(403).json({
                error: 'You do not have permission to delete requests'
            });
        }

        // First, check if the request exists and belongs to the company
        const existingRequest = await prisma.$queryRaw`
            SELECT REQUEST_ID, REQUEST_NAME, FORM_ID
            FROM GUARDIAN.REQUESTS 
            WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
        `;

        if (!existingRequest.length) {
            console.log(`❌ Request ${requestId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Request not found or access denied'
            });
        }

        const request = existingRequest[0];
        console.log(`📋 Found request to delete: ${request.REQUEST_NAME}`);

        // Use a transaction to ensure all deletions succeed or all fail
        await prisma.$transaction(async (tx) => {
            
            // 1. First, get all form instance IDs for this request
            const formInstances = await tx.$queryRaw`
                SELECT FORM_INSTANCE_ID 
                FROM GUARDIAN.FORMS_INSTANCE 
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`📋 Found ${formInstances.length} form instances to delete`);

            // 2. Delete form instance values for each form instance (avoid foreign key constraint issues)
            let totalValuesDeleted = 0;
            if (formInstances.length > 0) {
                for (const instance of formInstances) {
                    const deletedValues = await tx.$executeRaw`
                        DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES 
                        WHERE FORM_INSTANCE_ID = ${instance.FORM_INSTANCE_ID}
                    `;
                    console.log(`🗑️ Deleted ${deletedValues} values for form instance ${instance.FORM_INSTANCE_ID}`);
                    totalValuesDeleted += deletedValues;
                }
                console.log(`✅ Deleted total of ${totalValuesDeleted} form instance values`);
            }

            // 3. Delete form instances (to avoid foreign key constraint with REQUEST_ID)
            const deletedInstances = await tx.$executeRaw`
                DELETE FROM GUARDIAN.FORMS_INSTANCE
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted ${deletedInstances} form instances`);

            // Verify form instances are actually deleted
            const remainingInstances = await tx.$queryRaw`
                SELECT COUNT(*) as count 
                FROM GUARDIAN.FORMS_INSTANCE 
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`🔍 Remaining form instances: ${remainingInstances[0].count}`);
            
            if (remainingInstances[0].count > 0) {
                throw new Error(`Failed to delete all form instances. ${remainingInstances[0].count} remain.`);
            }

            // 4. Delete tasks related to this request
            const deletedTasks = await tx.$executeRaw`
                DELETE FROM GUARDIAN.TASKS
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted ${deletedTasks} related tasks`);

            // 5. Delete notifications related to this specific request
            const deletedNotifications = await tx.$executeRaw`
                DELETE FROM GUARDIAN.NOTIFICATIONS
                WHERE RELATED_ID = ${requestId} OR MESSAGE LIKE 'Request #${requestId}%' OR MESSAGE LIKE '%request ${requestId}%'
            `;
            console.log(`✅ Deleted ${deletedNotifications} related notifications`);

            // 6. Delete work progress entries related to this request
            const deletedProgress = await tx.$executeRaw`
                DELETE FROM GUARDIAN.WORK_PROGRESS
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted ${deletedProgress} work progress entries`);

            // 7. Delete attachments related to this request
            const deletedAttachments = await tx.$executeRaw`
                DELETE FROM GUARDIAN.ATTACHMENTS
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted ${deletedAttachments} related attachments`);

            // 8. Finally, delete the request itself
            const deletedRequests = await tx.$executeRaw`
                DELETE FROM GUARDIAN.REQUESTS
                WHERE REQUEST_ID = ${requestId} AND COMPANY_ID = ${req.companyId}
            `;
            console.log(`✅ Deleted ${deletedRequests} request(s)`);
            
            if (deletedRequests === 0) {
                throw new Error(`Failed to delete request ${requestId}`);
            }
        });

        console.log(`✅ Successfully deleted request ${requestId}: ${request.REQUEST_NAME}`);

        res.json({
            success: true,
            message: `Request "${request.REQUEST_NAME}" has been deleted successfully`
        });

    } catch (error) {
        console.error(`❌ Error deleting request ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to delete request',
            message: error.message
        });
    }
});

// Get specific form by ID
app.get('/api/forms/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        console.log(`📋 Fetching form ${formId} from database for company:`, req.companyId);

        if (!formId || isNaN(formId)) {
            return res.status(400).json({
                error: 'Valid form ID is required'
            });
        }

        // Get user's roles to check for admin access
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(6); // Role ID 6 can edit global forms
        
        console.log(`👤 User ${req.userId} roles: [${roleIds.join(', ')}], isAdmin: ${isAdmin}`);
        
        // Get the form details - admin users can access global forms (ORGANIZATION_ID IS NULL)
        let forms;
        
        // Users can access their company's forms, global forms (both IDs null), or any public form
        forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID, COMPANY_ID
            FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${formId}
            AND (
                ORGANIZATION_ID = ${req.companyId}
                OR COMPANY_ID = ${req.companyId}
                OR (ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL)
                OR IS_PUBLIC = 1
            )
            AND IS_DELETED = 0
        `;

        if (!forms.length) {
            console.log(`❌ Form ${formId} not found for company ${req.companyId}. Checking if form exists at all...`);
            
            // Check if form exists but belongs to different company
            const anyForm = await prisma.$queryRaw`
                SELECT FORM_ID, ORGANIZATION_ID FROM GUARDIAN.FORMS WHERE FORM_ID = ${formId}
            `;
            
            if (anyForm.length > 0) {
                console.log(`📋 Form ${formId} exists but belongs to company ${anyForm[0].ORGANIZATION_ID}, user is in company ${req.companyId}`);
            } else {
                console.log(`📋 Form ${formId} does not exist in database at all`);
            }
            
            return res.status(404).json({
                error: 'Form not found or access denied',
                details: anyForm.length > 0 
                    ? `Form ${formId} exists but belongs to a different company`
                    : `Form ${formId} does not exist in the database`,
                formId: formId,
                userCompanyId: req.companyId
            });
        }

        const form = forms[0];

        // Get the form fields - join with FORMS_FIELDS to get only fields that belong to this specific form
        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, ff.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CREATE_DATE, f.UPDATE_DATE, f.ORGANIZATION_ID, ff.SORT_ORDER
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            WHERE ff.FORM_ID = ${formId}
            AND f.IS_DELETED = 0
            ORDER BY ff.SORT_ORDER, f.FIELD_ID
        `;

        console.log(`✅ Found form ${formId} with ${fields.length} fields`);

        const response = {
            form: {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                FORM_DESCRIPTION: form.FORM_DESCRIPTION,
                IS_ACTIVE: form.IS_ACTIVE,
                IS_PUBLIC: form.IS_PUBLIC,
                IS_DELETED: form.IS_DELETED
            },
            fields: fields.map(field => ({
                FIELD_ID: field.FIELD_ID,
                FIELD_NAME: field.FIELD_NAME,
                FIELD_TYPE_ID: field.FIELD_TYPE_ID,
                DISPLAY_FORMAT: field.DISPLAY_FORMAT,
                HAS_LOOKUP: field.HAS_LOOKUP,
                IS_PUBLIC: field.IS_PUBLIC,
                IS_ACTIVE: field.IS_ACTIVE,
                IS_DELETED: field.IS_DELETED,
                IS_REQUIRED: field.IS_REQUIRED,
                IS_SENSITIVE: field.IS_SENSITIVE,
                SORT_ORDER: field.SORT_ORDER,
                CREATE_DATE: field.CREATE_DATE,
                UPDATE_DATE: field.UPDATE_DATE,
                ORGANIZATION_ID: field.ORGANIZATION_ID
            }))
        };

        console.log(`📤 Sending form ${formId} data to frontend`);
        res.json(response);

    } catch (error) {
        console.error(`❌ Error fetching form ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to fetch form',
            message: error.message
        });
    }
});

// Update form template endpoint
app.put('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        const { name, description, formFields } = req.body;
        
        console.log(`📝 Updating form template ${formId} for company:`, req.companyId);
        console.log(`📝 New data: name="${name}", description="${description}", fields count=${formFields?.length || 0}`);

        if (!formId || isNaN(formId)) {
            return res.status(400).json({
                error: 'Valid form ID is required'
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Form name is required'
            });
        }

        // Get user's roles to check for admin access
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(6); // Role ID 6 can edit global forms
        
        console.log(`👤 User ${req.userId} roles: [${roleIds.join(', ')}], isAdmin: ${isAdmin}`);
        
        // Check if form exists and user has permission to edit it
        let existingForm;
        
        if (isAdmin) {
            // Admin users can edit both company forms and global forms
            existingForm = await prisma.$queryRaw`
                SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID
                FROM GUARDIAN.FORMS 
                WHERE FORM_ID = ${formId} 
                AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
            `;
        } else {
            // Regular users can only edit their company's forms
            existingForm = await prisma.$queryRaw`
                SELECT FORM_ID, FORM_NAME, ORGANIZATION_ID
                FROM GUARDIAN.FORMS 
                WHERE FORM_ID = ${formId} 
                AND ORGANIZATION_ID = ${req.companyId}
            `;
        }

        if (!existingForm.length) {
            console.log(`❌ Form ${formId} not found or access denied for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        // Update form basic details
        await prisma.$queryRaw`
            UPDATE GUARDIAN.FORMS
            SET FORM_NAME = ${name.trim()},
                FORM_DESCRIPTION = ${description?.trim() || ''},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE FORM_ID = ${formId}
        `;

        console.log(`✅ Form ${formId} basic details updated successfully`);

        // Handle form fields update if provided
        if (formFields && Array.isArray(formFields)) {
            console.log(`📝 Updating ${formFields.length} form fields for form ${formId}`);
            
            // Step 1: Get existing form fields from FORMS_FIELDS junction table
            const existingFormFields = await prisma.$queryRaw`
                SELECT ff.FIELD_ID, ff.IS_REQUIRED, ff.SORT_ORDER, f.FIELD_NAME
                FROM GUARDIAN.FORMS_FIELDS ff
                INNER JOIN GUARDIAN.FIELDS f ON ff.FIELD_ID = f.FIELD_ID
                WHERE ff.FORM_ID = ${formId}
            `;
            
            console.log(`📋 Found ${existingFormFields.length} existing form fields`);
            
            // Step 2: Create a map of current fields by their database ID (dbFieldId)
            const currentFieldIds = new Set();
            const formFieldData = [];
            
            for (let i = 0; i < formFields.length; i++) {
                const field = formFields[i];
                console.log(`🔍 Processing field: ${field.fieldName} (dbFieldId: ${field.dbFieldId})`);
                
                let fieldId = field.dbFieldId;
                
                // If field doesn't have a database ID, it's a new field - create it
                if (!fieldId) {
                    console.log(`🆕 Creating new field: ${field.fieldName}`);
                    
                    // Insert into FIELDS table
                    const insertResult = await prisma.$queryRaw`
                        INSERT INTO GUARDIAN.FIELDS (
                            FIELD_NAME, FIELD_TYPE_ID, ORGANIZATION_ID, IS_ACTIVE, IS_DELETED, IS_PUBLIC, IS_SENSITIVE,
                            CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                        )
                        OUTPUT INSERTED.FIELD_ID
                        VALUES (
                            ${field.fieldName}, ${field.fieldTypeId || 1}, ${req.companyId}, 1, 0, 1, 0,
                            GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
                        )
                    `;
                    
                    fieldId = insertResult[0].FIELD_ID;
                    console.log(`✅ Created new field with ID: ${fieldId}`);
                }
                
                currentFieldIds.add(fieldId);
                formFieldData.push({
                    fieldId,
                    fieldName: field.fieldName,
                    isRequired: field.required || false,
                    sortOrder: i + 1
                });
            }
            
            // Step 3: Remove fields that are no longer in the form
            const fieldsToRemove = existingFormFields.filter(ef => !currentFieldIds.has(ef.FIELD_ID));
            
            if (fieldsToRemove.length > 0) {
                console.log(`🗑️  Removing ${fieldsToRemove.length} fields from form: ${fieldsToRemove.map(f => f.FIELD_NAME).join(', ')}`);
                
                for (const fieldToRemove of fieldsToRemove) {
                    await prisma.$executeRaw`
                        DELETE FROM GUARDIAN.FORMS_FIELDS 
                        WHERE FORM_ID = ${formId} AND FIELD_ID = ${fieldToRemove.FIELD_ID}
                    `;
                }
                
                console.log(`✅ Removed ${fieldsToRemove.length} field associations`);
            }
            
            // Step 4: Update existing fields and their associations
            for (let i = 0; i < formFields.length; i++) {
                const field = formFields[i];
                const fieldData = formFieldData[i];
                
                // If field has a database ID, it's an existing field that may need updates
                if (field.dbFieldId) {
                    console.log(`🔄 Updating existing field ${field.dbFieldId}: ${field.fieldName} (type: ${field.fieldTypeId})`);
                    
                    // Update the field in GUARDIAN.FIELDS table with new properties including fieldTypeId
                    await prisma.$executeRaw`
                        UPDATE GUARDIAN.FIELDS 
                        SET 
                            FIELD_NAME = ${field.fieldName},
                            FIELD_TYPE_ID = ${field.fieldTypeId || 1},
                            UPDATE_DATE = GETDATE(),
                            UPDATE_USER_ID = ${req.userId}
                        WHERE FIELD_ID = ${field.dbFieldId} AND ORGANIZATION_ID = ${req.companyId}
                    `;
                    
                    console.log(`✅ Updated field ${field.dbFieldId} with type ${field.fieldTypeId}`);
                }
                
                // Check if this field association already exists in FORMS_FIELDS
                const existingAssociation = await prisma.$queryRaw`
                    SELECT FIELD_ID FROM GUARDIAN.FORMS_FIELDS 
                    WHERE FORM_ID = ${formId} AND FIELD_ID = ${fieldData.fieldId}
                `;
                
                if (existingAssociation.length > 0) {
                    // Update existing association
                    await prisma.$executeRaw`
                        UPDATE GUARDIAN.FORMS_FIELDS 
                        SET IS_REQUIRED = ${fieldData.isRequired ? 1 : 0},
                            SORT_ORDER = ${fieldData.sortOrder},
                            UPDATE_DATE = GETDATE(),
                            UPDATE_USER_ID = ${req.userId}
                        WHERE FORM_ID = ${formId} AND FIELD_ID = ${fieldData.fieldId}
                    `;
                } else {
                    // Create new association
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.FORMS_FIELDS (
                            FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER,
                            CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                        )
                        VALUES (
                            ${formId}, ${fieldData.fieldId}, ${fieldData.isRequired ? 1 : 0}, ${fieldData.sortOrder},
                            GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
                        )
                    `;
                }
            }
            
            console.log(`✅ Successfully updated form fields for form ${formId}`);
        } else {
            console.log(`ℹ️  No form fields provided for update`);
        }

        res.json({
            success: true,
            message: 'Form template updated successfully',
            formId: formId
        });

    } catch (error) {
        console.error(`❌ Error updating form ${req.params.formId}:`, error);
        res.status(500).json({
            error: 'Failed to update form template',
            message: error.message
        });
    }
});

// Get specific form by ID (alternative endpoint for compatibility)
app.get('/api/forms/:formId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.formId);
        console.log(`📋 Fetching form ${formId} for company:`, req.companyId);

        // Get the form
        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID, COMPANY_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} 
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL OR COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
            AND IS_DELETED = ${false}
        `;

        if (forms.length === 0) {
            return res.status(404).json({
                error: 'Form not found'
            });
        }

        // Get the form fields using the FORMS_FIELDS junction table
        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, ff.IS_REQUIRED, f.OPTIONS, ff.SORT_ORDER as SEQUENCE,
                   f.IS_ACTIVE, ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE ff.FORM_ID = ${formId} AND f.IS_DELETED = 0
            ORDER BY ff.SORT_ORDER, f.FIELD_ID
        `;

        console.log(`✅ Found form ${formId} with ${fields.length} fields`);

        res.json({
            success: true,
            form: forms[0],
            fields: fields
        });

    } catch (error) {
        console.error(`❌ Error fetching form ${req.params.formId}:`, error);
        res.status(500).json({
            error: 'Failed to fetch form',
            message: error.message
        });
    }
});

// Delete a form (comprehensive cascading delete)

// Email validation endpoint (for frontend compatibility)
app.post('/api/validate-email', async (req, res) => {
    try {
        const { email, purpose = 'register' } = req.body;
        console.log(`📧 Email validation request for: ${email} (purpose: ${purpose})`);

        if (!email) {
            return res.status(400).json({
                valid: false,
                reason: 'Email is required'
            });
        }

        // Enhanced email format validation
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            return res.json({
                valid: false,
                reason: emailValidation.reason
            });
        }

        const normalizedEmail = emailValidation.email;

        // For registration, check if user already exists
        if (purpose === 'register') {
            const existingUser = await prisma.$queryRaw`
                SELECT USER_ID FROM GUARDIAN.USERS 
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
            `;

            if (existingUser.length > 0) {
                return res.json({
                    valid: false,
                    reason: 'User with this email already exists'
                });
            }
        }

        // Email is valid
        res.json({
            valid: true,
            reason: 'Email is valid'
        });

    } catch (error) {
        console.error('❌ Email validation error:', error);
        res.status(500).json({
            valid: false,
            reason: 'Server error during email validation',
            message: error.message
        });
    }
});

// Update user endpoint (PUT /api/users/:id)
app.put('/api/users/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { firstName, lastName, email, roleId, status } = req.body;

        console.log(`✏️ Updating user ${userId} with data:`, { firstName, lastName, email, roleId, status });

        // Validate required fields
        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'firstName, lastName, and email are required'
            });
        }

        // Validate userId
        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }

        // Check if user exists and belongs to the same company
        const existingUser = await prisma.$queryRaw`
            SELECT USER_ID, COMPANY_ID, EMAIL 
            FROM GUARDIAN.USERS 
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}
        `;

        if (existingUser.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User not found or you do not have permission to edit this user'
            });
        }

        // Check if email is already taken by another user (excluding current user)
        if (email !== existingUser[0].EMAIL) {
            const emailCheck = await prisma.$queryRaw`
                SELECT USER_ID 
                FROM GUARDIAN.USERS 
                WHERE EMAIL = ${email} AND USER_ID != ${userId} AND COMPANY_ID = ${req.companyId}
            `;

            if (emailCheck.length > 0) {
                return res.status(400).json({
                    error: 'Email already exists',
                    message: 'Another user with this email already exists in your company'
                });
            }
        }

        // Update user information
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET 
                FIRST_NAME = ${firstName},
                LAST_NAME = ${lastName},
                EMAIL = ${email},
                STATUS = ${status || 'A'},
                UPDATE_DATE = GETDATE()
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ User ${userId} basic information updated`);

        // Update user role if roleId is provided
        if (roleId) {
            // Validate roleId exists
            const roleExists = await prisma.$queryRaw`
                SELECT ROLE_ID FROM GUARDIAN.ROLES WHERE ROLE_ID = ${roleId} AND STATUS = 'A'
            `;

            if (roleExists.length === 0) {
                return res.status(400).json({
                    error: 'Invalid role',
                    message: 'Selected role does not exist or is inactive'
                });
            }

            // Check current user roles
            const currentRoles = await prisma.$queryRaw`
                SELECT USER_ROLE_ID, ROLE_ID 
                FROM GUARDIAN.USER_ROLES 
                WHERE USER_ID = ${userId}
            `;

            // If user has roles, update the first one, otherwise create new one
            if (currentRoles.length > 0) {
                // Update existing role
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.USER_ROLES 
                    SET ROLE_ID = ${roleId}, UPDATE_DATE = GETDATE()
                    WHERE USER_ROLE_ID = ${currentRoles[0].USER_ROLE_ID}
                `;
                console.log(`✅ User ${userId} role updated to ${roleId}`);
            } else {
                // Create new role assignment
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.USER_ROLES (USER_ID, ROLE_ID, CREATE_DATE, UPDATE_DATE)
                    VALUES (${userId}, ${roleId}, GETDATE(), GETDATE())
                `;
                console.log(`✅ User ${userId} assigned new role ${roleId}`);
            }
        }

        // Fetch updated user data to return
        const updatedUser = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                u.COMPANY_ID,
                u.CREATE_DATE,
                STRING_AGG(r.NAME, ', ') as ROLE_NAMES,
                STRING_AGG(CAST(r.ROLE_ID AS VARCHAR), ',') as ROLE_IDS
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE u.USER_ID = ${userId} AND u.COMPANY_ID = ${req.companyId}
            GROUP BY u.USER_ID, u.EMAIL, u.FIRST_NAME, u.LAST_NAME, u.STATUS, u.COMPANY_ID, u.CREATE_DATE
        `;

        if (updatedUser.length === 0) {
            return res.status(404).json({
                error: 'User not found after update',
                message: 'Failed to retrieve updated user information'
            });
        }

        const user = updatedUser[0];
        const formattedUser = {
            USER_ID: user.USER_ID,
            id: user.USER_ID,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            email: user.EMAIL,
            companyId: user.COMPANY_ID,
            status: user.STATUS,
            createdAt: user.CREATE_DATE,
            roleNames: user.ROLE_NAMES,
            roleIds: user.ROLE_IDS ? user.ROLE_IDS.split(',').map(id => parseInt(id)) : []
        };

        console.log(`✅ User ${userId} successfully updated and retrieved`);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: formattedUser
        });

    } catch (error) {
        console.error(`❌ Error updating user:`, error);
        res.status(500).json({
            error: 'Failed to update user',
            message: error.message
        });
    }
});

// DELETE /api/delete-user/:id - Soft delete user (Admin only)
app.delete('/api/delete-user/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        console.log(`🗑️ Delete user request for ID: ${userId} by user ${req.userId} (company: ${req.companyId})`);
        
        // Validate userId parameter
        if (!userId || isNaN(userId)) {
            console.error('❌ Invalid user ID provided:', req.params.id);
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }

        // Check if requesting user has admin privileges (role IDs 1 or 6)
        const isAdmin = req.userRoleIds && req.userRoleIds.some(roleId => [1, 6].includes(roleId));
        if (!isAdmin) {
            console.error('❌ Non-admin user attempted to delete user:', req.userId);
            return res.status(403).json({
                error: 'Access denied',
                message: 'Only administrators can delete users'
            });
        }

        // Check if user exists and belongs to the same company
        const existingUser = await prisma.$queryRaw`
            SELECT USER_ID, COMPANY_ID, EMAIL, FIRST_NAME, LAST_NAME, STATUS
            FROM GUARDIAN.USERS 
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}
        `;

        if (existingUser.length === 0) {
            console.error('❌ User not found or permission denied:', userId);
            return res.status(404).json({
                error: 'User not found',
                message: 'User not found or you do not have permission to delete this user'
            });
        }

        const userToDelete = existingUser[0];

        // Check if user is already deleted
        if (userToDelete.STATUS === 'D') {
            console.log('⚠️ User already deleted:', userId);
            return res.status(400).json({
                error: 'User already deleted',
                message: 'This user has already been deleted'
            });
        }

        // Prevent users from deleting themselves
        if (userId === req.userId) {
            console.error('❌ User attempted to delete themselves:', userId);
            return res.status(400).json({
                error: 'Cannot delete yourself',
                message: 'You cannot delete your own account'
            });
        }

        // Perform soft delete by setting STATUS to 'D' (deleted)
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET 
                STATUS = 'D',
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}
        `;

        console.log(`✅ User ${userId} (${userToDelete.FIRST_NAME} ${userToDelete.LAST_NAME}) soft deleted by admin ${req.userId}`);

        // Return success response
        res.json({
            success: true,
            message: 'User successfully deleted',
            data: {
                deletedUserId: userId,
                deletedUserName: `${userToDelete.FIRST_NAME} ${userToDelete.LAST_NAME}`,
                deletedUserEmail: userToDelete.EMAIL,
                deletedBy: req.userId,
                deletedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'An error occurred while deleting the user'
        });
    }
});

// Get roles endpoint for invite forms
app.get('/api/roles', async (req, res) => {
    try {
        console.log('🎭 Fetching roles from database...');

        const roles = await prisma.$queryRaw`
            SELECT ROLE_ID, NAME, DISPLAY_NAME, DESCRIPTION, STATUS
            FROM GUARDIAN.ROLES 
            WHERE STATUS = 'A'
            ORDER BY DISPLAY_NAME
        `;

        console.log(`✅ Found ${roles.length} roles in database`);

        // Format the data to match frontend expectations
        const formattedRoles = roles.map(role => ({
            id: role.ROLE_ID,
            ROLE_ID: role.ROLE_ID,
            name: role.NAME,
            NAME: role.NAME,
            displayName: role.DISPLAY_NAME,
            DISPLAY_NAME: role.DISPLAY_NAME,
            description: role.DESCRIPTION,
            DESCRIPTION: role.DESCRIPTION,
            status: role.STATUS,
            STATUS: role.STATUS
        }));

        console.log(`📤 Sending ${formattedRoles.length} formatted roles to frontend`);
        res.json({
            success: true,
            data: formattedRoles,
            count: formattedRoles.length
        });

    } catch (error) {
        console.error('❌ Error fetching roles:', error);
        res.status(500).json({
            error: 'Failed to fetch roles',
            message: error.message
        });
    }
});

// Get all roles endpoint for role switcher (admin access required)
app.get('/api/roles/all', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('🎭 Fetching all roles for role switcher...');
        
        // Check if user has admin privileges (roles 1, 6 - Admin or Super Admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(1) || roleIds.includes(6);
        
        if (!isAdmin) {
            console.log('❌ User lacks admin privileges for role switching');
            return res.status(403).json({
                error: 'Admin privileges required for role switching'
            });
        }

        // Fetch all active roles
        const roles = await prisma.$queryRaw`
            SELECT ROLE_ID, NAME as ROLE_NAME, DISPLAY_NAME, DESCRIPTION, STATUS
            FROM GUARDIAN.ROLES 
            WHERE STATUS = 'A'
            ORDER BY DISPLAY_NAME
        `;

        console.log(`✅ Found ${roles.length} roles for role switcher`);

        // Format the data to match RoleSwitcher expectations
        const formattedRoles = roles.map(role => ({
            ROLE_ID: role.ROLE_ID,
            ROLE_NAME: role.ROLE_NAME,
            DISPLAY_NAME: role.DISPLAY_NAME,
            DESCRIPTION: role.DESCRIPTION
        }));

        console.log(`📤 Sending ${formattedRoles.length} roles for role switcher`);
        res.json(formattedRoles);

    } catch (error) {
        console.error('❌ Error fetching all roles:', error);
        res.status(500).json({
            error: 'Failed to fetch all roles',
            message: error.message
        });
    }
});

// Get field types endpoint
app.get('/api/field-types', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('🔧 Fetching field types from database...');

        const fieldTypes = await prisma.$queryRaw`
            SELECT FIELD_TYPE_ID, FIELD_TYPE_DESC, SORT_ORDER
            FROM GUARDIAN.FIELD_TYPE 
            ORDER BY SORT_ORDER, FIELD_TYPE_DESC
        `;

        console.log(`✅ Found ${fieldTypes.length} field types`);

        // Format the data to match frontend expectations
        const formattedFieldTypes = fieldTypes.map(fieldType => ({
            FIELD_TYPE_ID: fieldType.FIELD_TYPE_ID,
            FIELD_TYPE_DESC: fieldType.FIELD_TYPE_DESC,
            SORT_ORDER: fieldType.SORT_ORDER
        }));

        console.log(`📤 Sending ${formattedFieldTypes.length} field types to frontend`);
        res.json(formattedFieldTypes);

    } catch (error) {
        console.error('❌ Error fetching field types:', error);
        res.status(500).json({
            error: 'Failed to fetch field types',
            message: error.message
        });
    }
});

// Get fields endpoint
app.get('/api/fields', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📝 Fetching fields from database for company:', req.companyId);

        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CAN_SELECT_MULIPLE, f.ORGANIZATION_ID, f.SORT_ORDER,
                   ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE (f.ORGANIZATION_ID = ${req.companyId} OR f.ORGANIZATION_ID IS NULL)
            AND f.IS_DELETED = 0
            ORDER BY f.SORT_ORDER, f.FIELD_NAME
        `;

        console.log(`✅ Found ${fields.length} fields for company ${req.companyId}`);
        
        // Debug: Check for duplicate field IDs
        const fieldIds = fields.map(f => f.FIELD_ID);
        const uniqueFieldIds = [...new Set(fieldIds)];
        if (fieldIds.length !== uniqueFieldIds.length) {
            console.log(`⚠️  WARNING: Found duplicate field IDs!`);
            console.log(`Total fields: ${fieldIds.length}, Unique fields: ${uniqueFieldIds.length}`);
            console.log(`Duplicate IDs:`, fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index));
        }

        // Format the data to match frontend expectations
        const formattedFields = fields.map(field => ({
            FIELD_ID: field.FIELD_ID,
            FIELD_NAME: field.FIELD_NAME,
            FIELD_TYPE_ID: field.FIELD_TYPE_ID,
            DISPLAY_FORMAT: field.DISPLAY_FORMAT,
            HAS_LOOKUP: field.HAS_LOOKUP,
            IS_PUBLIC: field.IS_PUBLIC,
            IS_ACTIVE: field.IS_ACTIVE,
            IS_DELETED: field.IS_DELETED,
            IS_REQUIRED: field.IS_REQUIRED,
            IS_SENSITIVE: field.IS_SENSITIVE,
            CAN_SELECT_MULIPLE: field.CAN_SELECT_MULIPLE,
            ORGANIZATION_ID: field.ORGANIZATION_ID,
            SORT_ORDER: field.SORT_ORDER,
            FIELD_TYPE: {
                FIELD_TYPE_DESC: field.FIELD_TYPE_DESC,
                FIELD_TYPE_ID: field.FIELD_TYPE_ID
            }
        }));

        console.log(`📤 Sending ${formattedFields.length} fields to frontend`);
        res.json(formattedFields);

    } catch (error) {
        console.error('❌ Error fetching fields:', error);
        res.status(500).json({
            error: 'Failed to fetch fields',
            message: error.message
        });
    }
});

// Create a new field
app.post('/api/fields', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📝 Creating new field for company: ${req.companyId}`);
        
        const {
            FIELD_NAME,
            FIELD_TYPE_ID,
            DISPLAY_FORMAT,
            HAS_LOOKUP,
            IS_PUBLIC,
            IS_ACTIVE,
            IS_REQUIRED,
            IS_SENSITIVE,
            CAN_SELECT_MULIPLE,
            SORT_ORDER
        } = req.body;
        
        // Validation
        if (!FIELD_NAME || !FIELD_NAME.trim()) {
            return res.status(400).json({
                error: 'Field name is required'
            });
        }
        
        if (!FIELD_TYPE_ID) {
            return res.status(400).json({
                error: 'Field type is required'
            });
        }
        
        // Check for duplicate field names within the same company/organization
        const existingField = await prisma.$queryRaw`
            SELECT FIELD_ID, FIELD_NAME FROM GUARDIAN.FIELDS 
            WHERE LOWER(TRIM(FIELD_NAME)) = LOWER(TRIM(${FIELD_NAME}))
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
            AND IS_DELETED = 0
        `;
        
        if (existingField.length > 0) {
            return res.status(409).json({
                error: 'Field name already exists',
                message: `A field with the name "${FIELD_NAME}" already exists. Please choose a different name.`,
                existingField: existingField[0].FIELD_NAME
            });
        }
        
        // Create the new field
        const currentDate = new Date();
        
        // Insert the field and get the ID
        const insertResult = await prisma.$queryRaw`
            DECLARE @InsertedId INT;
            
            INSERT INTO GUARDIAN.FIELDS (
                FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP,
                IS_PUBLIC, IS_ACTIVE, IS_REQUIRED, IS_SENSITIVE, 
                CAN_SELECT_MULIPLE, SORT_ORDER, ORGANIZATION_ID,
                IS_DELETED, CREATE_DATE, UPDATE_DATE, 
                CREATE_USER_ID, UPDATE_USER_ID
            )
            VALUES (
                ${FIELD_NAME.trim()},
                ${FIELD_TYPE_ID},
                ${DISPLAY_FORMAT || null},
                ${HAS_LOOKUP || false},
                ${IS_PUBLIC !== undefined ? IS_PUBLIC : true},
                ${IS_ACTIVE !== undefined ? IS_ACTIVE : true},
                ${IS_REQUIRED || false},
                ${IS_SENSITIVE || false},
                ${CAN_SELECT_MULIPLE || false},
                ${SORT_ORDER || 0},
                ${req.companyId},
                0,
                ${currentDate},
                ${currentDate},
                ${req.userId},
                ${req.userId}
            );
            
            SET @InsertedId = SCOPE_IDENTITY();
            SELECT @InsertedId AS FIELD_ID;
        `;
        
        const insertedId = insertResult[0]?.FIELD_ID;
        
        if (!insertedId) {
            return res.status(500).json({
                error: 'Failed to create field - no ID returned'
            });
        }
        
        console.log(`✅ Field created successfully with ID: ${insertedId}`);
        
        // Get the newly created field with field type information
        const newField = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CAN_SELECT_MULIPLE, f.ORGANIZATION_ID, f.SORT_ORDER,
                   ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE f.FIELD_ID = ${insertedId}
        `;
        
        if (newField.length > 0) {
            const field = newField[0];
            const formattedField = {
                FIELD_ID: field.FIELD_ID,
                FIELD_NAME: field.FIELD_NAME,
                FIELD_TYPE_ID: field.FIELD_TYPE_ID,
                DISPLAY_FORMAT: field.DISPLAY_FORMAT,
                HAS_LOOKUP: field.HAS_LOOKUP,
                IS_PUBLIC: field.IS_PUBLIC,
                IS_ACTIVE: field.IS_ACTIVE,
                IS_DELETED: field.IS_DELETED,
                IS_REQUIRED: field.IS_REQUIRED,
                IS_SENSITIVE: field.IS_SENSITIVE,
                CAN_SELECT_MULIPLE: field.CAN_SELECT_MULIPLE,
                ORGANIZATION_ID: field.ORGANIZATION_ID,
                SORT_ORDER: field.SORT_ORDER,
                FIELD_TYPE: {
                    FIELD_TYPE_DESC: field.FIELD_TYPE_DESC,
                    FIELD_TYPE_ID: field.FIELD_TYPE_ID
                }
            };
            
            res.status(201).json(formattedField);
        } else {
            res.status(500).json({
                error: 'Field created but could not be retrieved'
            });
        }
    } catch (error) {
        console.error('❌ Error creating field:', error);
        res.status(500).json({
            error: 'Failed to create field',
            message: error.message
        });
    }
});

// Update a field
app.put('/api/fields/:fieldId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const fieldId = parseInt(req.params.fieldId);
        console.log(`📝 Updating field ${fieldId} for company: ${req.companyId}`);
        
        const {
            FIELD_NAME,
            FIELD_TYPE_ID,
            DISPLAY_FORMAT,
            HAS_LOOKUP,
            IS_PUBLIC,
            IS_ACTIVE,
            IS_REQUIRED,
            IS_SENSITIVE,
            CAN_SELECT_MULIPLE,
            SORT_ORDER
        } = req.body;

        if (!fieldId || isNaN(fieldId)) {
            return res.status(400).json({
                error: 'Valid field ID is required'
            });
        }

        // Verify field exists and belongs to user's company (or is global)
        const existingField = await prisma.$queryRaw`
            SELECT FIELD_ID FROM GUARDIAN.FIELDS 
            WHERE FIELD_ID = ${fieldId} 
            AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
        `;

        if (!existingField.length) {
            return res.status(404).json({
                error: 'Field not found or access denied'
            });
        }

        // Update the field
        await prisma.$executeRaw`
            UPDATE GUARDIAN.FIELDS 
            SET 
                FIELD_NAME = ${FIELD_NAME},
                FIELD_TYPE_ID = ${FIELD_TYPE_ID || null},
                DISPLAY_FORMAT = ${DISPLAY_FORMAT || null},
                HAS_LOOKUP = ${HAS_LOOKUP || false},
                IS_PUBLIC = ${IS_PUBLIC !== undefined ? IS_PUBLIC : true},
                IS_ACTIVE = ${IS_ACTIVE !== undefined ? IS_ACTIVE : true},
                IS_REQUIRED = ${IS_REQUIRED || false},
                IS_SENSITIVE = ${IS_SENSITIVE || false},
                CAN_SELECT_MULIPLE = ${CAN_SELECT_MULIPLE || false},
                SORT_ORDER = ${SORT_ORDER || 0},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE FIELD_ID = ${fieldId}
        `;

        console.log(`✅ Field ${fieldId} updated successfully`);

        // Return the updated field
        const updatedField = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.DISPLAY_FORMAT, f.HAS_LOOKUP, 
                   f.IS_PUBLIC, f.IS_ACTIVE, f.IS_DELETED, f.IS_REQUIRED, f.IS_SENSITIVE, 
                   f.CAN_SELECT_MULIPLE, f.ORGANIZATION_ID, f.SORT_ORDER,
                   ft.FIELD_TYPE_DESC
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE f.FIELD_ID = ${fieldId}
        `;

        if (updatedField.length > 0) {
            const field = updatedField[0];
            const formattedField = {
                FIELD_ID: field.FIELD_ID,
                FIELD_NAME: field.FIELD_NAME,
                FIELD_TYPE_ID: field.FIELD_TYPE_ID,
                DISPLAY_FORMAT: field.DISPLAY_FORMAT,
                HAS_LOOKUP: field.HAS_LOOKUP,
                IS_PUBLIC: field.IS_PUBLIC,
                IS_ACTIVE: field.IS_ACTIVE,
                IS_DELETED: field.IS_DELETED,
                IS_REQUIRED: field.IS_REQUIRED,
                IS_SENSITIVE: field.IS_SENSITIVE,
                CAN_SELECT_MULIPLE: field.CAN_SELECT_MULIPLE,
                ORGANIZATION_ID: field.ORGANIZATION_ID,
                SORT_ORDER: field.SORT_ORDER,
                FIELD_TYPE: {
                    FIELD_TYPE_DESC: field.FIELD_TYPE_DESC,
                    FIELD_TYPE_ID: field.FIELD_TYPE_ID
                }
            };

            res.json({
                success: true,
                message: 'Field updated successfully',
                data: formattedField
            });
        } else {
            res.status(404).json({
                error: 'Field not found after update'
            });
        }

    } catch (error) {
        console.error('❌ Error updating field:', error);
        res.status(500).json({
            error: 'Failed to update field',
            message: error.message
        });
    }
});

// ===== FORMS GROUPS ENDPOINTS =====

// Get forms groups endpoint
app.get('/api/forms-groups', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📁 Fetching forms groups from database for company:', req.companyId);

        const formsGroups = await prisma.$queryRawUnsafe(`
            SELECT fg.GROUP_ID, fg.ORGANIZATION_ID, fg.GROUP_NAME, fg.GROUP_DESCRIPTION, 
                   fg.SORT_ORDER, fg.IS_PUBLIC, fg.CREATE_USER_ID, fg.UPDATE_USER_ID,
                   fg.CREATE_DATE, fg.UPDATE_DATE
            FROM GUARDIAN.FORMS_GROUPS fg
            WHERE fg.ORGANIZATION_ID = ${req.companyId} OR fg.ORGANIZATION_ID IS NULL
            ORDER BY fg.SORT_ORDER, fg.GROUP_NAME
        `);

        console.log(`✅ Found ${formsGroups.length} forms groups for company ${req.companyId}`);
        res.json(formsGroups);
    } catch (error) {
        console.error('❌ Error fetching forms groups:', error);
        res.status(500).json({
            error: 'Failed to fetch forms groups',
            message: error.message
        });
    }
});

// Create forms group endpoint
app.post('/api/forms-groups', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const {
            GROUP_NAME,
            GROUP_DESCRIPTION,
            SORT_ORDER,
            IS_PUBLIC
        } = req.body;
        
        console.log(`📁 Creating new forms group for company: ${req.companyId}`);
        
        if (!GROUP_NAME || !GROUP_DESCRIPTION) {
            return res.status(400).json({
                error: 'GROUP_NAME and GROUP_DESCRIPTION are required'
            });
        }
        
        // Check for duplicate group name within the company
        const existingGroup = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE ORGANIZATION_ID = ${req.companyId} AND GROUP_NAME = '${GROUP_NAME.replace(/'/g, "''")}'`
        );
        
        if (existingGroup.length > 0) {
            return res.status(409).json({
                error: 'A forms group with this name already exists in your organization'
            });
        }
        
        const result = await prisma.$queryRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS_GROUPS (
                ORGANIZATION_ID, GROUP_NAME, GROUP_DESCRIPTION, SORT_ORDER, IS_PUBLIC,
                CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
            ) 
            OUTPUT INSERTED.GROUP_ID, INSERTED.ORGANIZATION_ID, INSERTED.GROUP_NAME, 
                   INSERTED.GROUP_DESCRIPTION, INSERTED.SORT_ORDER, INSERTED.IS_PUBLIC,
                   INSERTED.CREATE_USER_ID, INSERTED.UPDATE_USER_ID, INSERTED.CREATE_DATE, INSERTED.UPDATE_DATE
            VALUES (
                ${req.companyId}, '${GROUP_NAME.replace(/'/g, "''")}', '${GROUP_DESCRIPTION.replace(/'/g, "''")}', 
                ${SORT_ORDER || 'NULL'}, ${IS_PUBLIC ? 1 : 0}, ${req.userId}, ${req.userId}, 
                GETUTCDATE(), GETUTCDATE()
            )`
        );
        
        console.log(`✅ Created forms group with ID: ${result[0].GROUP_ID}`);
        res.status(201).json(result[0]);
        
    } catch (error) {
        console.error('❌ Error creating forms group:', error);
        res.status(500).json({
            error: 'Failed to create forms group',
            message: error.message
        });
    }
});

// Update forms group endpoint
app.put('/api/forms-groups/:groupId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const {
            GROUP_NAME,
            GROUP_DESCRIPTION,
            SORT_ORDER,
            IS_PUBLIC
        } = req.body;
        
        console.log(`📁 Updating forms group ${groupId} for company: ${req.companyId}`);
        
        if (!groupId || isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        if (!GROUP_NAME || !GROUP_DESCRIPTION) {
            return res.status(400).json({
                error: 'GROUP_NAME and GROUP_DESCRIPTION are required'
            });
        }
        
        // Verify the group belongs to the user's company
        const existingGroup = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        if (existingGroup.length === 0) {
            return res.status(404).json({
                error: 'Forms group not found or does not belong to your organization'
            });
        }
        
        // Check for duplicate name (excluding current group)
        const duplicateCheck = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE ORGANIZATION_ID = ${req.companyId} AND GROUP_NAME = '${GROUP_NAME.replace(/'/g, "''")}' 
            AND GROUP_ID != ${groupId}`
        );
        
        if (duplicateCheck.length > 0) {
            return res.status(409).json({
                error: 'A forms group with this name already exists in your organization'
            });
        }
        
        const result = await prisma.$queryRawUnsafe(`
            UPDATE GUARDIAN.FORMS_GROUPS 
            SET GROUP_NAME = '${GROUP_NAME.replace(/'/g, "''")}',
                GROUP_DESCRIPTION = '${GROUP_DESCRIPTION.replace(/'/g, "''")}',
                SORT_ORDER = ${SORT_ORDER || 'NULL'},
                IS_PUBLIC = ${IS_PUBLIC ? 1 : 0},
                UPDATE_USER_ID = ${req.userId},
                UPDATE_DATE = GETUTCDATE()
            OUTPUT INSERTED.GROUP_ID, INSERTED.ORGANIZATION_ID, INSERTED.GROUP_NAME,
                   INSERTED.GROUP_DESCRIPTION, INSERTED.SORT_ORDER, INSERTED.IS_PUBLIC,
                   INSERTED.CREATE_USER_ID, INSERTED.UPDATE_USER_ID, INSERTED.CREATE_DATE, INSERTED.UPDATE_DATE
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Forms group not found' });
        }
        
        console.log(`✅ Updated forms group ${groupId}`);
        res.json(result[0]);
        
    } catch (error) {
        console.error('❌ Error updating forms group:', error);
        res.status(500).json({
            error: 'Failed to update forms group',
            message: error.message
        });
    }
});

// Delete forms group endpoint
app.delete('/api/forms-groups/:groupId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        console.log(`🗑️ Deleting forms group ${groupId} for company: ${req.companyId}`);
        
        if (!groupId || isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // Verify the group belongs to the user's company
        const existingGroup = await prisma.$queryRawUnsafe(`
            SELECT GROUP_ID FROM GUARDIAN.FORMS_GROUPS 
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        if (existingGroup.length === 0) {
            return res.status(404).json({
                error: 'Forms group not found or does not belong to your organization'
            });
        }
        
        // Check if group has any associated fields
        const associatedFields = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as fieldCount FROM GUARDIAN.FORMS_GROUPS_FIELDS 
            WHERE GROUP_ID = ${groupId}`
        );
        
        if (associatedFields[0].fieldCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete forms group that has associated fields. Please remove all fields from this group first.'
            });
        }
        
        // Delete the group
        await prisma.$queryRawUnsafe(`
            DELETE FROM GUARDIAN.FORMS_GROUPS 
            WHERE GROUP_ID = ${groupId} AND ORGANIZATION_ID = ${req.companyId}`
        );
        
        console.log(`✅ Deleted forms group ${groupId}`);
        res.json({ message: 'Forms group deleted successfully' });
        
    } catch (error) {
        console.error('❌ Error deleting forms group:', error);
        res.status(500).json({
            error: 'Failed to delete forms group',
            message: error.message
        });
    }
});

// Get forms endpoint for templates
app.get('/api/forms', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📋 Fetching forms from database for company:', req.companyId);
        console.log('🔍 Company ID type:', typeof req.companyId);

        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, ORGANIZATION_ID, COMPANY_ID
            FROM GUARDIAN.FORMS 
            WHERE (
                ORGANIZATION_ID = ${req.companyId} 
                OR COMPANY_ID = ${req.companyId}
                OR (ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL AND IS_PUBLIC = 1)
            )
            AND IS_DELETED = 0
            ORDER BY 
                CASE 
                    WHEN ORGANIZATION_ID IS NULL AND COMPANY_ID IS NULL THEN 0
                    ELSE 1
                END,
                FORM_NAME
        `;

        console.log(`✅ Found ${forms.length} forms for company ${req.companyId}`);
        
        // Validate all form IDs before returning to prevent 404 errors in frontend
        const invalidForms = forms.filter(form => !form.FORM_ID || form.FORM_ID <= 0);
        if (invalidForms.length > 0) {
            console.warn(`⚠️ WARNING: Found ${invalidForms.length} forms with invalid IDs:`, 
                invalidForms.map(f => ({ name: f.FORM_NAME, id: f.FORM_ID })));
        }
        
        // Filter out any forms with invalid IDs to prevent frontend 404 errors
        const validForms = forms.filter(form => form.FORM_ID && form.FORM_ID > 0);
        
        if (validForms.length !== forms.length) {
            console.warn(`⚠️ Filtered out ${forms.length - validForms.length} invalid forms. Returning ${validForms.length} valid forms.`);
        }
        
        // Debug: Log form IDs that will be returned to frontend
        console.log('📋 Valid form IDs being returned:', validForms.map(f => `${f.FORM_NAME}(${f.FORM_ID})`).join(', '));

        // Format the data to match frontend expectations - use validForms instead of forms
        const formattedForms = validForms.map(form => ({
            FORM_ID: form.FORM_ID,
            FORM_NAME: form.FORM_NAME,
            FORM_DESCRIPTION: form.FORM_DESCRIPTION,
            IS_ACTIVE: form.IS_ACTIVE,
            IS_PUBLIC: form.IS_PUBLIC,
            IS_DELETED: form.IS_DELETED,
            ORGANIZATION_ID: form.ORGANIZATION_ID,
            COMPANY_ID: form.COMPANY_ID
        }));

        console.log('🔍 ===== FORMATTED FORMS BEFORE SENDING =====');
        formattedForms.forEach((form, index) => {
            console.log(`🔍 Form ${index + 1} formatted:`, {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                COMPANY_ID: form.COMPANY_ID,
                COMPANY_ID_TYPE: typeof form.COMPANY_ID,
                COMPANY_ID_IS_NULL: form.COMPANY_ID === null,
                COMPANY_ID_IS_UNDEFINED: form.COMPANY_ID === undefined
            });
        });
        console.log(`📤 Sending ${formattedForms.length} formatted forms to frontend`);
        res.json(formattedForms);

    } catch (error) {
        console.error('❌ Error fetching forms:', error);
        res.status(500).json({
            error: 'Failed to fetch forms',
            message: error.message
        });
    }
});

// Create a new form with fields
app.post('/api/forms', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { form, fields } = req.body;
        console.log('📝 Creating new form with fields for company:', req.companyId);

        if (!form || !form.FORM_NAME) {
            return res.status(400).json({
                error: 'Form name is required'
            });
        }

        // Insert the form first - escape strings properly for SQL injection prevention
        const escapedFormName = form.FORM_NAME.replace(/'/g, "''");
        const escapedFormDescription = (form.FORM_DESCRIPTION || '').replace(/'/g, "''");
        
        const formResult = await prisma.$queryRawUnsafe(`
            INSERT INTO GUARDIAN.FORMS (
                FORM_NAME, FORM_DESCRIPTION, COMPANY_ID, IS_PUBLIC, IS_ACTIVE, IS_DELETED,
                CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
            )
            OUTPUT INSERTED.FORM_ID
            VALUES (
                '${escapedFormName}', '${escapedFormDescription}', ${req.companyId}, ${form.IS_PUBLIC ? 1 : 0}, ${form.IS_ACTIVE !== false ? 1 : 0}, 0, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
            )
        `);

        const formId = formResult[0].FORM_ID;
        console.log(`✅ Created form with ID: ${formId}`);

        // Insert fields if provided
        const createdFields = [];
        if (fields && Array.isArray(fields) && fields.length > 0) {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                
                // First, create the field in GUARDIAN.FIELDS table - escape strings for SQL injection prevention
                const escapedFieldName = field.FIELD_NAME.replace(/'/g, "''");
                
                const fieldResult = await prisma.$queryRawUnsafe(`
                    INSERT INTO GUARDIAN.FIELDS (
                        FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, IS_ACTIVE, IS_DELETED,
                        CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID, ORGANIZATION_ID
                    )
                    OUTPUT INSERTED.FIELD_ID
                    VALUES (
                        '${escapedFieldName}', ${field.FIELD_TYPE_ID}, ${field.IS_REQUIRED ? 1 : 0}, ${field.IS_ACTIVE !== false ? 1 : 0}, 0, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}, ${req.companyId}
                    )
                `);
                
                const fieldId = fieldResult[0].FIELD_ID;
                
                // Then, create the relationship in GUARDIAN.FORMS_FIELDS junction table
                await prisma.$queryRawUnsafe(`
                    INSERT INTO GUARDIAN.FORMS_FIELDS (
                        FORM_ID, FIELD_ID, IS_REQUIRED, SORT_ORDER,
                        CREATE_DATE, UPDATE_DATE, CREATE_USER_ID, UPDATE_USER_ID
                    )
                    VALUES (
                        ${formId}, ${fieldId}, ${field.IS_REQUIRED ? 1 : 0}, ${field.SEQUENCE || i + 1}, GETDATE(), GETDATE(), ${req.userId}, ${req.userId}
                    )
                `);

                createdFields.push({
                    ...field,
                    FIELD_ID: fieldId,
                    FORM_ID: formId
                });
            }
        }

        console.log(`✅ Created ${createdFields.length} fields for form ${formId}`);

        res.json({
            success: true,
            form: {
                ...form,
                FORM_ID: formId,
                COMPANY_ID: req.companyId
            },
            fields: createdFields
        });

    } catch (error) {
        console.error('❌ Error creating form:', error);
        res.status(500).json({
            error: 'Failed to create form',
            message: error.message
        });
    }
});

// Delete a form/workflow template with cascading delete
app.delete('/api/forms/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const formId = parseInt(req.params.id);
        console.log(`🗑️ Attempting to delete form/template ${formId} for company ${req.companyId}`);

        if (!formId || isNaN(formId)) {
            return res.status(400).json({
                error: 'Valid form ID is required'
            });
        }

        // Check if user has permission to delete (Admin or Super Admin roles: 1, 6)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const canDelete = roleIds.includes(1) || roleIds.includes(6);
        
        if (!canDelete) {
            console.log(`❌ User ${req.userId} lacks permission to delete forms`);
            return res.status(403).json({
                error: 'You do not have permission to delete forms'
            });
        }

        // Check if the form exists and belongs to the company (or is global with null COMPANY_ID)
        const existingForm = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, COMPANY_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${formId} AND (COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
        `;

        if (!existingForm.length) {
            console.log(`❌ Form ${formId} not found for company ${req.companyId}`);
            return res.status(404).json({
                error: 'Form not found or access denied'
            });
        }

        const form = existingForm[0];
        console.log(`📋 Found form to delete: ${form.FORM_NAME}`);

        // CASCADING DELETE - Remove all related data in the correct order to handle foreign key constraints
        
        // 1. Delete form instance values related to this form
        await prisma.$executeRaw`
            DELETE fiv FROM GUARDIAN.FORMS_INSTANCE_VALUES fiv
            INNER JOIN GUARDIAN.FORMS_INSTANCE fi ON fiv.FORM_INSTANCE_ID = fi.FORM_INSTANCE_ID
            WHERE fi.FORM_ID = ${formId}
        `;
        console.log('✅ Deleted form instance values');

        // 2. Delete form instances related to this form
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_INSTANCE
            WHERE FORM_ID = ${formId}
        `;
        console.log('✅ Deleted form instances');

        // 3. Delete requests that use this form
        const requestsToDelete = await prisma.$queryRaw`
            SELECT REQUEST_ID FROM GUARDIAN.REQUESTS 
            WHERE FORM_ID = ${formId} AND COMPANY_ID = ${req.companyId}
        `;

        for (const request of requestsToDelete) {
            const requestId = request.REQUEST_ID;
            
            // Delete work progress entries (CRITICAL: Must be deleted before requests due to FK_WORK_PROGRESS_REQUEST constraint)
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.WORK_PROGRESS
                WHERE REQUEST_ID = ${requestId}
            `;
            console.log(`✅ Deleted work progress entries for request ${requestId}`);
            
            // Delete tasks related to each request
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.TASKS
                WHERE REQUEST_ID = ${requestId}
            `;
            
            // Delete notifications related to each request  
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.NOTIFICATIONS
                WHERE MESSAGE LIKE '%Request ${requestId}%'
            `;
            
            // Delete attachments related to each request
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.ATTACHMENTS
                WHERE REQUEST_ID = ${requestId}
            `;
        }

        // 4. Delete the requests themselves
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.REQUESTS
            WHERE FORM_ID = ${formId} AND COMPANY_ID = ${req.companyId}
        `;
        console.log('✅ Deleted related requests and their associated data');

        // 5. Get field IDs before deleting relationships (to delete company-specific fields later)
        const fieldIds = await prisma.$queryRaw`
            SELECT DISTINCT ff.FIELD_ID
            FROM GUARDIAN.FORMS_FIELDS ff
            WHERE ff.FORM_ID = ${formId}
        `;
        
        // 6. Delete form-field relationships
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS_FIELDS
            WHERE FORM_ID = ${formId}
        `;
        console.log('✅ Deleted form-field relationships');

        // 7. Delete fields that were created specifically for this form (company-specific fields)
        if (fieldIds.length > 0) {
            for (const fieldRecord of fieldIds) {
                await prisma.$executeRaw`
                    DELETE FROM GUARDIAN.FIELDS
                    WHERE FIELD_ID = ${fieldRecord.FIELD_ID} AND ORGANIZATION_ID = ${req.companyId}
                `;
            }
            console.log('✅ Deleted company-specific fields');
        }

        // 8. Finally, delete the form itself
        await prisma.$executeRaw`
            DELETE FROM GUARDIAN.FORMS
            WHERE FORM_ID = ${formId} AND (COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
        `;

        console.log(`✅ Successfully deleted form ${formId}: ${form.FORM_NAME} and all related data`);

        res.json({
            success: true,
            message: `Form "${form.FORM_NAME}" has been deleted successfully along with all associated data`
        });

    } catch (error) {
        console.error(`❌ Error deleting form ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to delete form',
            message: error.message
        });
    }
});

// Logout endpoint
app.post('/logout', async (req, res) => {
    try {
        console.log('🚪 Logout request received');
        
        // Since we're using JWT tokens (stateless), logout is mainly handled client-side
        // The client should remove the token from localStorage/sessionStorage
        // Here we can log the logout event or perform any server-side cleanup if needed
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            error: 'Failed to logout',
            message: error.message
        });
    }
});

// Registration endpoints

// Start registration process
app.post('/api/register', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`📝 Registration request for: ${email}`);

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for registration: ${email}`);
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // ========== ENHANCED REGISTRATION WITH COMPREHENSIVE CLEANUP ==========
        
        // Step 1: Check for verified users first (these should block registration)
        console.log(`🔍 Checking for existing verified users with email: ${email}`);
        const verifiedUsers = await prisma.$queryRaw`
            SELECT USER_ID, EMAIL_VALIDATED, COMPANY_ID, CREATE_DATE FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
                AND EMAIL_VALIDATED = 1
            ORDER BY CREATE_DATE DESC
        `;
        
        if (verifiedUsers.length > 0) {
            console.log(`❌ Email already registered and verified: ${email} (${verifiedUsers.length} verified users found)`);
            return res.status(409).json({
                error: 'An account with this email already exists and is verified. Please sign in instead.'
            });
        }

        // Step 2: Check for recent unverified registrations (within 30 minutes)
        console.log(`🔍 Checking for recent unverified registrations for: ${email}`);
        const recentUnverified = await prisma.$queryRaw`
            SELECT USER_ID, CREATE_DATE, 
                   DATEDIFF(MINUTE, CREATE_DATE, GETDATE()) as AGE_MINUTES 
            FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
                AND EMAIL_VALIDATED = 0
                AND CREATE_DATE > DATEADD(MINUTE, -30, GETDATE())
            ORDER BY CREATE_DATE DESC
        `;
        
        if (recentUnverified.length > 0) {
            const mostRecent = recentUnverified[0];
            console.log(`ℹ️ Recent unverified registration exists for: ${email} (User ID: ${mostRecent.USER_ID}, Age: ${mostRecent.AGE_MINUTES} minutes)`);
            
            // Resend verification email for recent registration
            try {
                const userData = await prisma.$queryRaw`
                    SELECT EMAIL_VALIDATION_TOKEN FROM GUARDIAN.USERS 
                    WHERE USER_ID = ${mostRecent.USER_ID}
                `;
                
                if (userData.length > 0) {
                    // Generate new verification code and update existing user
                    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                    const crypto = require('crypto');
                    const hashedCode = crypto.createHash('sha256').update(newVerificationCode).digest('hex');
                    const tokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
                    
                    await prisma.$executeRaw`
                        UPDATE GUARDIAN.USERS 
                        SET EMAIL_VALIDATION_TOKEN = ${hashedCode},
                            EMAIL_VALIDATION_TOKEN_EXPIRY = ${tokenExpiry},
                            UPDATE_DATE = GETDATE()
                        WHERE USER_ID = ${mostRecent.USER_ID}
                    `;
                    
                    // Send new verification email
                    await sendVerificationEmail(normalizedEmail, newVerificationCode);
                    console.log(`✅ Resent verification email to: ${normalizedEmail}`);
                }
            } catch (error) {
                console.error(`⚠️ Error resending verification email:`, error);
            }
            
            return res.status(200).json({
                success: true,
                message: 'A verification code has been sent to your email. Please check your inbox.',
                existingRegistration: true
            });
        }

        // Step 3: Perform comprehensive cleanup of stale unverified registrations
        console.log(`🧹 Performing comprehensive cleanup for email: ${email}`);
        try {
            const cleanupResults = await cleanupIncompleteRegistrations(normalizedEmail, 30);
            
            if (cleanupResults.totalCleaned > 0) {
                console.log(`✅ Cleanup completed - removed ${cleanupResults.totalCleaned} stale registrations for ${email}`);
            } else {
                console.log(`✅ No cleanup needed for ${email} - no stale registrations found`);
            }
        } catch (cleanupError) {
            // Log cleanup error but don't block registration
            console.error(`⚠️ Cleanup failed for ${email} (proceeding with registration):`, cleanupError.message);
        }

        // Generate 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash the verification code for secure storage
        const crypto = require('crypto');
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        const tokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
        const passwordHash = crypto.createHash('sha256').update('').digest('hex');
        
        // Get name parts from email
        const firstName = email.split('@')[0].split('.')[0];
        const lastName = email.split('@')[0].split('.')[1] || '';

        // Create user in database using raw SQL (without company - company created during complete-registration)
        console.log(`🔧 Creating user with raw SQL for: ${email}`);
        const createUserResult = await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USERS (
                EMAIL, PASSWORD_HASH, EMAIL_VALIDATION_TOKEN, EMAIL_VALIDATION_TOKEN_EXPIRY,
                EMAIL_VALIDATED, STATUS, CREATE_DATE, UPDATE_DATE, FIRST_NAME, LAST_NAME
            )
            VALUES (
                ${email}, ${passwordHash}, ${hashedCode}, ${tokenExpiry},
                0, 'P', GETDATE(), GETDATE(), ${firstName}, ${lastName}
            )
        `;
        console.log(`🔧 Insert result:`, createUserResult);
        
        // Get the newly created user
        const newUsers = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
            ORDER BY CREATE_DATE DESC
        `;
        
        console.log(`🔧 Retrieved user after insert:`, newUsers);
        
        if (newUsers.length === 0) {
            throw new Error('Failed to create user - user not found after insert');
        }
        
        const user = { USER_ID: newUsers[0].USER_ID };

        console.log(`✅ User created in database with ID: ${user.USER_ID}, verification code: ${verificationCode}`);

        // Send actual email with verification code using Resend
        const emailSent = await sendVerificationEmail(normalizedEmail, verificationCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send email to ${normalizedEmail}, but user created in database (code available in dev mode)`);
        }

        res.json({
            success: true,
            message: 'Verification code sent to your email',
            // In development, return the code for testing
            ...(process.env.NODE_ENV === 'development' && { verificationCode })
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            error: 'Failed to start registration',
            message: error.message
        });
    }
});

// Verify email with code
app.post('/api/verify-email', async (req, res) => {
    try {
        const { email, verificationCode } = req.body;
        console.log(`🔍 Email verification attempt for: ${email}`);
        console.log(`📧 Request body:`, JSON.stringify(req.body, null, 2));

        if (!email || !verificationCode) {
            console.log(`❌ Missing required fields - email: ${!!email}, verificationCode: ${!!verificationCode}`);
            return res.status(400).json({
                error: 'Email and verification code are required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for verification: ${email}`);
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Look up most recent unverified user with this email using raw SQL (matches registration pattern)
        console.log(`🔍 Looking up most recent unverified user in database for email: ${normalizedEmail}`);
        const unverifiedUsers = await prisma.$queryRaw`
            SELECT USER_ID, EMAIL, EMAIL_VALIDATED, EMAIL_VALIDATION_TOKEN, EMAIL_VALIDATION_TOKEN_EXPIRY, CREATE_DATE
            FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
            AND EMAIL_VALIDATED = 0
            AND EMAIL_VALIDATION_TOKEN IS NOT NULL
            ORDER BY CREATE_DATE DESC
        `;
        
        let user = null;
        if (unverifiedUsers.length > 0) {
            user = unverifiedUsers[0];
            console.log(`✅ Found unverified user - ID: ${user.USER_ID}, Email: ${user.EMAIL}`);
        }
        
        // If no unverified user found, check if email is already verified
        if (!user) {
            console.log(`🔍 No unverified user found, checking for verified user with email: ${normalizedEmail}`);
            const verifiedUsers = await prisma.$queryRaw`
                SELECT USER_ID, EMAIL, EMAIL_VALIDATED
                FROM GUARDIAN.USERS 
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
                AND EMAIL_VALIDATED = 1
                ORDER BY CREATE_DATE DESC
            `;
            
            if (verifiedUsers.length > 0) {
                console.log(`✅ Email already verified for: ${normalizedEmail}`);
                return res.status(200).json({
                    success: true,
                    message: 'Email already verified',
                    alreadyVerified: true
                });
            }
        }

        if (!user) {
            console.log(`❌ No user found with email: ${normalizedEmail}`);
            return res.status(400).json({
                error: 'Invalid verification request'
            });
        }

        console.log(`✅ User found - ID: ${user.USER_ID}, Email Validated: ${user.EMAIL_VALIDATED}`);
        console.log(`🔑 Has validation token: ${!!user.EMAIL_VALIDATION_TOKEN}`);
        console.log(`⏰ Token expiry: ${user.EMAIL_VALIDATION_TOKEN_EXPIRY}`);

        if (!user.EMAIL_VALIDATION_TOKEN || !user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            console.log(`❌ No verification code found for email: ${normalizedEmail}`);
            return res.status(400).json({
                error: 'No verification code found for this email'
            });
        }

        if (new Date() > user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            console.log(`❌ Verification code expired for ${email}. Expired at: ${user.EMAIL_VALIDATION_TOKEN_EXPIRY}`);
            return res.status(400).json({
                error: 'Verification code has expired'
            });
        }

        // Hash the provided code and compare with stored hash
        const crypto = require('crypto');
        const hashedProvidedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        
        console.log(`🔍 Comparing codes for ${email}:`);
        console.log(`📥 Provided code: ${verificationCode}`);
        console.log(`🔐 Hashed provided: ${hashedProvidedCode}`);
        console.log(`💾 Stored hash: ${user.EMAIL_VALIDATION_TOKEN}`);
        console.log(`✅ Codes match: ${user.EMAIL_VALIDATION_TOKEN === hashedProvidedCode}`);

        if (user.EMAIL_VALIDATION_TOKEN !== hashedProvidedCode) {
            console.log(`❌ Invalid verification code for ${email}`);
            return res.status(400).json({
                error: 'Invalid verification code'
            });
        }

        // Mark user as verified in database using raw SQL (matches registration pattern)
        console.log(`🔧 Updating user verification status for User ID: ${user.USER_ID}`);
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET EMAIL_VALIDATED = 1,
                EMAIL_VALIDATION_TOKEN = NULL,
                EMAIL_VALIDATION_TOKEN_EXPIRY = NULL,
                STATUS = 'A',
                UPDATE_DATE = GETDATE()
            WHERE USER_ID = ${user.USER_ID}
        `;
        console.log(`✅ Email verified successfully for: ${email}`);

        res.json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error('❌ Email verification error:', error);
        res.status(500).json({
            error: 'Failed to verify email',
            message: error.message
        });
    }
});

// Resend verification email
app.post('/api/send-verification-email', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`📧 Resend verification code request for: ${email}`);

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for resend: ${email}`);
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Find the most recent unverified user for this email
        const user = await prisma.USERS.findFirst({
            where: { 
                EMAIL: normalizedEmail,
                EMAIL_VALIDATED: false
            },
            orderBy: { CREATE_DATE: 'desc' }
        });

        if (!user) {
            console.log(`❌ No unverified user found for resend: ${normalizedEmail}`);
            return res.status(400).json({
                error: 'No pending verification found for this email'
            });
        }

        // Generate new 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash the verification code for secure storage
        const crypto = require('crypto');
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        const tokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

        // Update the user's verification token in database
        await prisma.USERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                EMAIL_VALIDATION_TOKEN: hashedCode,
                EMAIL_VALIDATION_TOKEN_EXPIRY: tokenExpiry,
                UPDATE_DATE: new Date()
            }
        });

        console.log(`✅ New verification code generated for ${email}: ${verificationCode}`);

        // Send actual email with verification code using Resend
        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to resend email to ${email}, but continuing (code available in dev mode)`);
        }

        res.json({
            success: true,
            message: 'Verification code resent to your email',
            expiryTime: expiresAt.toISOString(),
            // In development, return the code for testing
            ...(process.env.NODE_ENV === 'development' && { code: verificationCode })
        });

    } catch (error) {
        console.error('❌ Resend verification error:', error);
        res.status(500).json({
            error: 'Failed to resend verification code',
            message: error.message
        });
    }
});

// Request password reset
app.post('/api/request-password-reset', async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`🔄 Password reset request for: ${email}`);

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for password reset: ${email}`);
            return res.json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Check if user exists
        const user = await prisma.USERS.findFirst({
            where: { EMAIL: normalizedEmail }
        });

        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account with this email exists, you will receive a password reset link.'
            });
        }

        // Generate a 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash the reset code for secure storage
        const crypto = require('crypto');
        const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');
        const resetExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

        // Store reset code in user record
        await prisma.USERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                EMAIL_VALIDATION_TOKEN: hashedCode,
                EMAIL_VALIDATION_TOKEN_EXPIRY: resetExpiry,
                UPDATE_DATE: new Date()
            }
        });

        // Send reset email
        const emailSent = await sendVerificationEmail(normalizedEmail, resetCode);
        if (!emailSent) {
            console.log(`⚠️ Failed to send reset email to ${normalizedEmail}, but continuing (code available in dev mode)`);
        }

        console.log(`✅ Password reset code generated for ${email}: ${resetCode}`);

        res.json({
            success: true,
            message: 'If an account with this email exists, you will receive a password reset link.',
            // In development, return the code for testing
            ...(process.env.NODE_ENV === 'development' && { verificationCode: resetCode })
        });

    } catch (error) {
        console.error('❌ Password reset request error:', error);
        res.status(500).json({
            error: 'Failed to process password reset request',
            message: error.message
        });
    }
});

// Verify reset code (just validation, doesn't reset password)
app.post('/api/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        console.log(`🔍 Verifying reset code for: ${email}`);

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                error: 'Email and verification code are required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for reset code verification: ${email}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid request format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Find user
        const user = await prisma.USERS.findFirst({
            where: { EMAIL: normalizedEmail }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid reset request'
            });
        }

        if (!user.EMAIL_VALIDATION_TOKEN || !user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                success: false,
                error: 'No active password reset request found'
            });
        }

        if (new Date() > user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                success: false,
                error: 'Verification code has expired'
            });
        }

        // Verify reset code
        const crypto = require('crypto');
        const hashedProvidedCode = crypto.createHash('sha256').update(code).digest('hex');

        if (user.EMAIL_VALIDATION_TOKEN !== hashedProvidedCode) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification code'
            });
        }

        console.log(`✅ Reset code verified successfully for: ${email}`);

        res.json({
            success: true,
            message: 'Verification code is valid'
        });

    } catch (error) {
        console.error('❌ Reset code verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify reset code',
            message: error.message
        });
    }
});

// Reset password with code
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, resetCode, newPassword } = req.body;
        // Support both 'code' and 'resetCode' parameter names
        const verificationCode = code || resetCode;
        console.log(`🔒 Password reset attempt for: ${email}`);

        if (!email || !verificationCode || !newPassword) {
            return res.status(400).json({
                error: 'Email, reset code, and new password are required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for password reset: ${email}`);
            return res.status(400).json({
                error: 'Invalid request format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Find user
        const user = await prisma.USERS.findFirst({
            where: { EMAIL: normalizedEmail }
        });

        if (!user) {
            return res.status(400).json({
                error: 'Invalid reset request'
            });
        }

        if (!user.EMAIL_VALIDATION_TOKEN || !user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                error: 'No active password reset request found'
            });
        }

        if (new Date() > user.EMAIL_VALIDATION_TOKEN_EXPIRY) {
            return res.status(400).json({
                error: 'Password reset code has expired'
            });
        }

        // Verify reset code
        const crypto = require('crypto');
        const hashedProvidedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');

        if (user.EMAIL_VALIDATION_TOKEN !== hashedProvidedCode) {
            return res.status(400).json({
                error: 'Invalid reset code'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await prisma.USERS.update({
            where: { USER_ID: user.USER_ID },
            data: {
                PASSWORD_HASH: hashedPassword,
                EMAIL_VALIDATION_TOKEN: null,
                EMAIL_VALIDATION_TOKEN_EXPIRY: null,
                UPDATE_DATE: new Date()
            }
        });

        console.log(`✅ Password reset successful for: ${email}`);

        res.json({
            success: true,
            message: 'Password has been reset successfully'
        });

    } catch (error) {
        console.error('❌ Password reset error:', error);
        res.status(500).json({
            error: 'Failed to reset password',
            message: error.message
        });
    }
});


// Complete registration after email verification
app.post('/api/complete-registration', async (req, res) => {
    try {
        const { email, password, fullName, workspaceName: customWorkspaceName, role, teamSize, companySize } = req.body;
        console.log(`👤 Completing registration for: ${email}`);
        console.log(`📋 Complete registration request body:`, JSON.stringify(req.body, null, 2));
        console.log(`🔍 DEBUG - customWorkspaceName from request: "${customWorkspaceName}"`);
        console.log(`🔍 DEBUG - customWorkspaceName type: ${typeof customWorkspaceName}`);
        console.log(`🔍 DEBUG - customWorkspaceName truthy: ${!!customWorkspaceName}`);

        // Use custom workspace name if provided, otherwise auto-generate military call sign
        const workspaceName = customWorkspaceName || await generateMilitaryCallSign();
        console.log(`🎖️ Using workspace name: "${workspaceName}" ${customWorkspaceName ? '(custom)' : '(auto-generated)'}`);

        // Validate required fields (workspaceName now auto-generated)
        console.log(`✅ Field validation - email: ${!!email}, password: ${!!password}, fullName: ${!!fullName}, workspaceName: ${!!workspaceName}`);
        if (!email || !password || !fullName) {
            console.log(`❌ Missing required fields for complete-registration`);
            return res.status(400).json({
                error: 'Email, password, and full name are required'
            });
        }

        // Enhanced email validation before database operations
        const emailValidation = validateEmailServer(email);
        if (!emailValidation.valid) {
            console.log(`❌ Invalid email format for complete-registration: ${email}`);
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        const normalizedEmail = emailValidation.email;

        // Check if user exists and email was verified - use enhanced query for compatibility
        console.log(`🔍 Looking up most recent verified user in database for complete-registration: ${normalizedEmail}`);
        let existingUser;
        try {
            // Find most recent verified user with enhanced EMAIL_VALIDATED compatibility
            const verifiedUsers = await prisma.$queryRaw`
                SELECT USER_ID, EMAIL, EMAIL_VALIDATED, PASSWORD_HASH, COMPANY_ID, CREATE_DATE
                FROM GUARDIAN.USERS 
                WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${normalizedEmail}))
                AND (EMAIL_VALIDATED = 1 OR EMAIL_VALIDATED = CAST(1 as BIT))
                ORDER BY CREATE_DATE DESC
            `;
            
            if (verifiedUsers.length > 0) {
                existingUser = verifiedUsers[0];
                console.log(`✅ Found most recent verified user - ID: ${existingUser.USER_ID}, Email: ${existingUser.EMAIL}, Created: ${existingUser.CREATE_DATE}`);
            } else {
                existingUser = null;
            }
            console.log(`✅ Database query successful for user lookup`);
        } catch (dbError) {
            console.error(`❌ Database error during user lookup:`, dbError);
            return res.status(500).json({
                error: 'Database connection error',
                details: dbError.message
            });
        }

        console.log(`🔍 Checking user existence for: ${normalizedEmail}`);
        if (!existingUser) {
            console.log(`❌ No user found for email: ${normalizedEmail}`);
            return res.status(400).json({
                error: 'No verified user found. Please register and verify your email first.'
            });
        }

        console.log(`✅ Most recent verified user found - ID: ${existingUser.USER_ID}, Email: ${existingUser.EMAIL}`);
        console.log(`📧 Email validated: ${existingUser.EMAIL_VALIDATED}`);
        console.log(`🔐 Has password: ${!!existingUser.PASSWORD_HASH}`);
        console.log(`🏢 Company ID: ${existingUser.COMPANY_ID}`);

        // Email validation check is redundant since we only selected EMAIL_VALIDATED = 1 users
        console.log(`✅ Email validation confirmed (selected only verified users)`);

        console.log(`✅ Email validation check passed`);

        // Allow profile updates even if user already has a password
        if (existingUser.PASSWORD_HASH && existingUser.PASSWORD_HASH !== '') {
            console.log(`ℹ️ User already has password, will update profile information for: ${email}`);
        }

        console.log(`✅ Password check passed - ready to update user`);
        
        // Hash password
        console.log(`🔐 Starting password hashing process`);
        const hashedPassword = await bcrypt.hash(password, 12);
        console.log(`✅ Password hashed successfully`);

        // Split full name into first and last name
        console.log(`📝 Processing name: ${fullName}`);
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        console.log(`✅ Name parsed - First: ${firstName}, Last: ${lastName}`);

        // Update the existing user with password and name using raw SQL for compatibility
        console.log(`💾 Starting database update for user ID: ${existingUser.USER_ID}`);
        const userIdInt = parseInt(existingUser.USER_ID);
        
        // Use raw SQL update for better compatibility with database connection timing
        await prisma.$executeRaw`
            UPDATE GUARDIAN.USERS 
            SET PASSWORD_HASH = ${hashedPassword},
                FIRST_NAME = ${firstName},
                LAST_NAME = ${lastName},
                STATUS = 'A',
                UPDATE_DATE = GETDATE()
            WHERE USER_ID = ${userIdInt}
        `;
        console.log(`✅ User updated successfully in database`);

        const userId = existingUser.USER_ID;

        // Check if user already has roles, if not assign Admin role (they already have it from registration)
        const existingRoles = await prisma.USER_ROLES.findMany({
            where: { USER_ID: userId }
        });

        if (existingRoles.length === 0) {
            // Assign Admin role if no roles exist
            let adminRole = await prisma.ROLES.findFirst({ where: { NAME: 'Admin' } });
            if (adminRole) {
                await prisma.USER_ROLES.create({
                    data: { USER_ID: userId, ROLE_ID: adminRole.ROLE_ID }
                });
            }
        }

        // Update company info - ALWAYS update with new workspace name
        console.log(`📝 Updating company info for user ${userId} (USER_ID type: ${typeof userId})`);
        
        // Use the existing userIdInt from above
        console.log(`🔍 Looking up company info for user ID: ${userIdInt} (converted from ${userId})`);
        console.log(`🎖️ New workspace name to set: ${workspaceName}`);
        
        // Use raw SQL for more reliable lookup and debugging
        const existingCompanyInfoResult = await prisma.$queryRaw`
            SELECT COMPANY_INFO_ID, USER_ID, COMPANY_ID, WORKSPACE_NAME, ROLE, TEAM_SIZE, COMPANY_SIZE
            FROM GUARDIAN.COMPANY_INFO 
            WHERE USER_ID = ${userIdInt}
        `;
        
        console.log(`🔍 Company info lookup result:`, existingCompanyInfoResult);

        if (existingCompanyInfoResult.length > 0) {
            const existingCompanyInfo = existingCompanyInfoResult[0];
            console.log(`✅ Found existing company info record:`, {
                companyInfoId: existingCompanyInfo.COMPANY_INFO_ID,
                userId: existingCompanyInfo.USER_ID,
                companyId: existingCompanyInfo.COMPANY_ID,
                currentWorkspaceName: existingCompanyInfo.WORKSPACE_NAME || 'NULL'
            });
            
            // Log values being saved
            console.log(`📝 Updating company info with values:`, {
                companyInfoId: existingCompanyInfo.COMPANY_INFO_ID,
                workspaceName: workspaceName,
                role: role || 'NULL',
                teamSize: teamSize || 'NULL',
                companySize: companySize || 'NULL'
            });
            
            // Use raw SQL for the update to ensure compatibility
            const updateData = {
                WORKSPACE_NAME: workspaceName,
                UPDATED_AT: 'GETDATE()'
            };
            
            if (role) updateData.ROLE = role;
            if (teamSize) updateData.TEAM_SIZE = teamSize;
            if (companySize) updateData.COMPANY_SIZE = companySize;
            
            await prisma.$executeRaw`
                UPDATE GUARDIAN.COMPANY_INFO
                SET WORKSPACE_NAME = ${workspaceName},
                    ROLE = ${role || existingCompanyInfo.ROLE},
                    TEAM_SIZE = ${teamSize || existingCompanyInfo.TEAM_SIZE},
                    COMPANY_SIZE = ${companySize || existingCompanyInfo.COMPANY_SIZE},
                    UPDATED_AT = GETDATE()
                WHERE COMPANY_INFO_ID = ${existingCompanyInfo.COMPANY_INFO_ID}
            `;
            
            console.log(`✅ Company info updated successfully with workspace name: ${workspaceName}`);
            
            // Verify the update
            const verificationResult = await prisma.$queryRaw`
                SELECT WORKSPACE_NAME, ROLE, TEAM_SIZE, COMPANY_SIZE
                FROM GUARDIAN.COMPANY_INFO 
                WHERE COMPANY_INFO_ID = ${existingCompanyInfo.COMPANY_INFO_ID}
            `;
            console.log(`🔍 Updated company info verification:`, verificationResult[0]);
            
        } else {
            console.log(`❌ No existing company info found for user ${userIdInt}`);
            console.log(`🔍 User COMPANY_ID: ${existingUser.COMPANY_ID}`);
            
            // Handle case where user has null COMPANY_ID - create company first
            let companyIdToUse = existingUser.COMPANY_ID;
            
            if (!companyIdToUse) {
                console.log(`🏢 User has null COMPANY_ID, creating new company with name: ${workspaceName}`);
                
                // Create new company
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.COMPANY (NAME, CREATED_AT) VALUES (${workspaceName}, GETDATE())
                `;
                
                // Get the newly created company ID
                const newCompanies = await prisma.$queryRaw`
                    SELECT TOP 1 COMPANY_ID FROM GUARDIAN.COMPANY 
                    WHERE NAME = ${workspaceName} ORDER BY CREATED_AT DESC
                `;
                
                if (newCompanies.length > 0) {
                    companyIdToUse = newCompanies[0].COMPANY_ID;
                    console.log(`✅ Created new company with ID: ${companyIdToUse}`);
                    
                    // Update user's COMPANY_ID
                    await prisma.$executeRaw`
                        UPDATE GUARDIAN.USERS
                        SET COMPANY_ID = ${companyIdToUse}, UPDATE_DATE = GETDATE()
                        WHERE USER_ID = ${userIdInt}
                    `;
                    console.log(`✅ Updated user ${userIdInt} with COMPANY_ID: ${companyIdToUse}`);
                } else {
                    throw new Error('Failed to create company - no company ID returned');
                }
            }
            
            console.log(`🔍 Creating company_info record for user ${userIdInt}, company ${companyIdToUse}`);
            
            // Create the missing company_info record with valid company ID
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.COMPANY_INFO (USER_ID, COMPANY_ID, WORKSPACE_NAME, CREATED_AT, UPDATED_AT)
                VALUES (${userIdInt}, ${companyIdToUse}, ${workspaceName}, GETDATE(), GETDATE())
            `;
            console.log(`✅ Created missing company_info record with workspace name: ${workspaceName}`);
        }

        // Get the current company ID (might have been updated if it was null)
        const updatedUser = await prisma.$queryRaw`
            SELECT COMPANY_ID FROM GUARDIAN.USERS WHERE USER_ID = ${userIdInt}
        `;
        const currentCompanyId = updatedUser.length > 0 ? updatedUser[0].COMPANY_ID : existingUser.COMPANY_ID;
        
        // Update company name if custom workspace name was provided
        if (customWorkspaceName && currentCompanyId) {
            console.log(`🔧 Updating company name to custom workspace name: ${workspaceName}`);
            await prisma.$executeRaw`
                UPDATE GUARDIAN.COMPANY 
                SET NAME = ${workspaceName}
                WHERE COMPANY_ID = ${currentCompanyId}
            `;
            console.log(`✅ Company name updated to: ${workspaceName}`);
        }

        console.log(`✅ Registration completed successfully for: ${email} (User ID: ${userId})`);

        // Get the actual company name (call sign) from the database
        const companyResult = await prisma.$queryRaw`
            SELECT NAME FROM GUARDIAN.COMPANY 
            WHERE COMPANY_ID = ${currentCompanyId}
        `;
        const actualCallSign = companyResult.length > 0 ? companyResult[0].NAME : workspaceName;
        console.log(`🎖️ Using actual company call sign from database: ${actualCallSign}`);

        res.json({
            success: true,
            message: `Registration completed successfully! Welcome to organization ${actualCallSign}`,
            user: {
                id: userId,
                email: email,
                firstName: firstName,
                lastName: lastName,
                companyId: currentCompanyId
            },
            callSign: actualCallSign // Use the actual company name from database
        });

    } catch (error) {
        console.error('❌ Complete registration error:', error);
        res.status(500).json({
            error: 'Failed to complete registration',
            message: error.message
        });
    }
});

// Accept invite
app.post('/api/invite/accept', async (req, res) => {
    try {
        const { token, firstName, lastName, password } = req.body;
        console.log(`📩 Processing invite acceptance with token: ${token}`);

        if (!token || !firstName || !lastName || !password) {
            return res.status(400).json({
                error: 'Token, first name, last name, and password are required'
            });
        }

        // Find and validate invite
        const invites = await prisma.$queryRaw`
            SELECT INVITE_ID, EMAIL, ROLE_ID, COMPANY_ID, STATUS, EXPIRES_AT
            FROM GUARDIAN.INVITES 
            WHERE TOKEN = ${token} AND STATUS = 'P' AND EXPIRES_AT > GETDATE()
        `;

        if (invites.length === 0) {
            return res.status(400).json({
                error: 'Invalid or expired invite token'
            });
        }

        const invite = invites[0];

        // Check if user already exists
        const existingUser = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${invite.EMAIL}))
        `;

        if (existingUser.length > 0) {
            return res.status(400).json({
                error: 'An account with this email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user account
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USERS (
                EMAIL, PASSWORD_HASH, FIRST_NAME, LAST_NAME, 
                STATUS, COMPANY_ID, CREATE_DATE, UPDATE_DATE
            )
            VALUES (
                ${invite.EMAIL}, ${hashedPassword}, ${firstName}, ${lastName},
                'A', ${invite.COMPANY_ID}, GETDATE(), GETDATE()
            )
        `;

        // Get the newly created user ID
        const newUser = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${invite.EMAIL}))
        `;

        const userId = newUser[0].USER_ID;

        // Assign the role from the invite
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.USER_ROLES (USER_ID, ROLE_ID, CREATE_DATE, UPDATE_DATE)
            VALUES (${userId}, ${invite.ROLE_ID}, GETDATE(), GETDATE())
        `;

        // Mark invite as used
        await prisma.$executeRaw`
            UPDATE GUARDIAN.INVITES 
            SET STATUS = 'U', USED_AT = GETDATE()
            WHERE INVITE_ID = ${invite.INVITE_ID}
        `;

        console.log(`✅ Invite accepted successfully for: ${invite.EMAIL} (User ID: ${userId})`);

        res.json({
            success: true,
            message: 'Invite accepted successfully. You can now log in.',
            user: {
                id: userId,
                email: invite.EMAIL,
                firstName: firstName,
                lastName: lastName,
                companyId: invite.COMPANY_ID,
                roleId: invite.ROLE_ID
            }
        });

    } catch (error) {
        console.error('❌ Invite acceptance error:', error);
        res.status(500).json({
            error: 'Failed to accept invite',
            message: error.message
        });
    }
});

// Send invites endpoint
app.post('/invites/send', async (req, res) => {
    try {
        const { invites } = req.body;
        console.log(`📧 Processing ${invites?.length || 0} invite requests`);

        if (!invites || !Array.isArray(invites) || invites.length === 0) {
            return res.status(400).json({
                error: 'Invites array is required and must not be empty'
            });
        }

        const results = [];
        const errors = [];

        for (const invite of invites) {
            try {
                const { email, roleId } = invite;

                if (!email || !roleId) {
                    errors.push(`Invalid invite data: email and roleId required`);
                    continue;
                }

                // Check if user already exists
                const existingUser = await prisma.$queryRaw`
                    SELECT USER_ID FROM GUARDIAN.USERS 
                    WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email}))
                `;

                if (existingUser.length > 0) {
                    errors.push(`User with email ${email} already exists`);
                    continue;
                }

                // Check if there's already a pending invite
                const existingInvite = await prisma.$queryRaw`
                    SELECT INVITE_ID FROM GUARDIAN.INVITES 
                    WHERE LOWER(TRIM(EMAIL)) = LOWER(TRIM(${email})) 
                    AND STATUS = 'P' AND EXPIRES_AT > GETDATE()
                `;

                if (existingInvite.length > 0) {
                    errors.push(`Active invite already exists for ${email}`);
                    continue;
                }

                // Generate unique token
                const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                
                // Set expiration to 7 days from now
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                // For now, default to company ID 1 - you may want to get this from the authenticated user
                const companyId = 1;

                // Insert invite record
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.INVITES (EMAIL, ROLE_ID, COMPANY_ID, TOKEN, STATUS, EXPIRES_AT)
                    VALUES (${email}, ${roleId}, ${companyId}, ${token}, 'P', ${expiresAt})
                `;

                console.log(`✅ Invite created for ${email} with role ${roleId}`);
                
                // Send actual invite email using Resend
                const emailSent = await sendInviteEmail(email, token, 'User'); // TODO: Get actual role name from roleId
                const status = emailSent ? 'sent' : 'created'; // Mark as 'created' if email failed but record exists
                
                results.push({
                    email: email,
                    status: status,
                    token: token,
                    expiresAt: expiresAt.toISOString(),
                    emailSent: emailSent
                });

                if (!emailSent) {
                    console.log(`⚠️ Failed to send invite email to ${email}, but invite record created`);
                    console.log(`📧 Invite token for ${email}: ${token} (expires: ${expiresAt.toISOString()})`);
                }

            } catch (inviteError) {
                console.error(`❌ Error processing invite for ${invite?.email}:`, inviteError);
                errors.push(`Failed to process invite for ${invite?.email}: ${inviteError.message}`);
            }
        }

        const response = {
            success: results.length > 0,
            message: `Processed ${invites.length} invite(s). ${results.length} sent, ${errors.length} failed.`,
            results: results,
            errors: errors.length > 0 ? errors : undefined
        };

        console.log(`📤 Invite processing complete:`, response);

        if (results.length === 0 && errors.length > 0) {
            return res.status(400).json(response);
        }

        res.json(response);

    } catch (error) {
        console.error('❌ Error in invite endpoint:', error);
        res.status(500).json({
            error: 'Failed to process invites',
            message: error.message
        });
    }
});

// === CUSTOM TEMPLATE ENDPOINTS (JAFAR ROLE ONLY) ===

// Get custom templates - only for role_id 6 (JAFAR)
app.get('/api/custom-templates', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log('📋 Fetching custom templates for role_id 6 user, company:', req.companyId);
        
        // Check if user has role_id 6 (JAFAR)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const hasJafarRole = userRoles.some(role => role.ROLE_ID === 6);
        if (!hasJafarRole) {
            return res.status(403).json({
                error: 'Access denied. Custom templates are only available to JAFAR users (role_id 6).'
            });
        }
        
        // Fetch custom templates for the company (all active forms serve as templates)
        const customTemplates = await prisma.$queryRaw`
            SELECT 
                f.FORM_ID, f.FORM_NAME, f.FORM_DESCRIPTION, 
                f.IS_ACTIVE, f.IS_PUBLIC, f.CREATE_DATE, f.UPDATE_DATE,
                COUNT(ff.FIELD_ID) as fieldCount
            FROM GUARDIAN.FORMS f
            LEFT JOIN GUARDIAN.FORMS_FIELDS ff ON f.FORM_ID = ff.FORM_ID
            WHERE f.COMPANY_ID = ${req.companyId}
            AND f.IS_DELETED = 0
            AND f.IS_ACTIVE = 1
            GROUP BY f.FORM_ID, f.FORM_NAME, f.FORM_DESCRIPTION, 
                     f.IS_ACTIVE, f.IS_PUBLIC, f.CREATE_DATE, f.UPDATE_DATE
            ORDER BY f.CREATE_DATE DESC
        `;
        
        console.log(`✅ Found ${customTemplates.length} custom templates for company ${req.companyId}`);
        res.json(customTemplates);
    } catch (error) {
        console.error('❌ Error fetching custom templates:', error);
        res.status(500).json({
            error: 'Failed to fetch custom templates',
            details: error.message
        });
    }
});

// Get specific custom template with fields
app.get('/api/custom-templates/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const templateId = parseInt(req.params.id);
        console.log(`📋 Fetching custom template ${templateId} for company:`, req.companyId);
        
        // Check if user has role_id 6 (JAFAR)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const hasJafarRole = userRoles.some(role => role.ROLE_ID === 6);
        if (!hasJafarRole) {
            return res.status(403).json({
                error: 'Access denied. Custom templates are only available to JAFAR users (role_id 6).'
            });
        }
        
        if (!templateId || isNaN(templateId)) {
            return res.status(400).json({ error: 'Valid template ID required' });
        }
        
        // Get the form
        const forms = await prisma.$queryRaw`
            SELECT FORM_ID, FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED, COMPANY_ID
            FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${templateId} 
            AND COMPANY_ID = ${req.companyId}
            AND IS_DELETED = 0
            AND IS_ACTIVE = 1
        `;
        
        if (forms.length === 0) {
            return res.status(404).json({
                error: 'Custom template not found'
            });
        }
        
        const form = forms[0];
        
        // Get the fields
        const fields = await prisma.$queryRaw`
            SELECT f.FIELD_ID, f.FIELD_NAME, f.FIELD_TYPE_ID, f.IS_REQUIRED,
                   ff.SORT_ORDER, ft.TYPE_NAME as fieldType, f.DISPLAY_FORMAT,
                   f.HAS_LOOKUP, f.IS_SENSITIVE, f.CAN_SELECT_MULIPLE, f.OPTIONS,
                   f.ORGANIZATION_ID, f.IS_PUBLIC, f.IS_ACTIVE
            FROM GUARDIAN.FIELDS f
            INNER JOIN GUARDIAN.FORMS_FIELDS ff ON f.FIELD_ID = ff.FIELD_ID
            LEFT JOIN GUARDIAN.FIELD_TYPE ft ON f.FIELD_TYPE_ID = ft.FIELD_TYPE_ID
            WHERE ff.FORM_ID = ${templateId}
            AND f.IS_DELETED = 0
            ORDER BY ff.SORT_ORDER, f.FIELD_ID
        `;
        
        console.log(`✅ Found custom template ${templateId} with ${fields.length} fields`);
        
        const response = {
            form: {
                FORM_ID: form.FORM_ID,
                FORM_NAME: form.FORM_NAME,
                FORM_DESCRIPTION: form.FORM_DESCRIPTION,
                IS_ACTIVE: form.IS_ACTIVE,
                IS_PUBLIC: form.IS_PUBLIC,
                COMPANY_ID: form.COMPANY_ID
            },
            fields: fields
        };
        
        res.json(response);
    } catch (error) {
        console.error('❌ Error fetching custom template:', error);
        res.status(500).json({
            error: 'Failed to fetch custom template',
            details: error.message
        });
    }
});

// Create custom template
app.post('/api/custom-templates', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { form, fields } = req.body;
        console.log('📝 Creating custom template for company:', req.companyId);
        
        // Check if user has role_id 6 (JAFAR)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const hasJafarRole = userRoles.some(role => role.ROLE_ID === 6);
        if (!hasJafarRole) {
            return res.status(403).json({
                error: 'Access denied. Only JAFAR users (role_id 6) can create custom templates.'
            });
        }
        
        if (!form || !form.FORM_NAME) {
            return res.status(400).json({ error: 'Form name is required' });
        }
        
        // Check for duplicate form name within the company
        const existingForms = await prisma.$queryRaw`
            SELECT FORM_ID FROM GUARDIAN.FORMS 
            WHERE COMPANY_ID = ${req.companyId} 
            AND FORM_NAME = ${form.FORM_NAME.trim()}
            AND IS_DELETED = 0
        `;
        
        if (existingForms.length > 0) {
            return res.status(409).json({
                error: 'A form with this name already exists in your organization'
            });
        }
        
        // Create the form (custom template)
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.FORMS (
                FORM_NAME, FORM_DESCRIPTION, IS_ACTIVE, IS_PUBLIC, IS_DELETED,
                COMPANY_ID, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
            )
            OUTPUT INSERTED.FORM_ID, INSERTED.FORM_NAME, INSERTED.FORM_DESCRIPTION,
                   INSERTED.IS_ACTIVE, INSERTED.IS_PUBLIC,
                   INSERTED.COMPANY_ID, INSERTED.CREATE_DATE
            VALUES (
                ${form.FORM_NAME.trim()}, ${form.FORM_DESCRIPTION?.trim() || ''},
                ${form.IS_ACTIVE !== false}, ${form.IS_PUBLIC !== false}, 0,
                ${req.companyId}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
            )
        `;
        
        console.log(`✅ Created custom template ${result[0].FORM_ID}: ${result[0].FORM_NAME}`);
        
        // Add fields if provided
        if (fields && fields.length > 0) {
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                
                // Create field if it doesn't exist
                const fieldResult = await prisma.$queryRaw`
                    INSERT INTO GUARDIAN.FIELDS (
                        FIELD_NAME, FIELD_TYPE_ID, IS_REQUIRED, OPTIONS, IS_ACTIVE, IS_DELETED,
                        COMPANY_ID, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    )
                    OUTPUT INSERTED.FIELD_ID
                    VALUES (
                        ${field.FIELD_NAME}, ${field.FIELD_TYPE_ID || 1}, 
                        ${field.IS_REQUIRED || false}, ${field.OPTIONS || ''}, 1, 0,
                        ${req.companyId}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
                
                // Link field to form
                await prisma.$queryRaw`
                    INSERT INTO GUARDIAN.FORMS_FIELDS (
                        FORM_ID, FIELD_ID, SORT_ORDER, IS_REQUIRED, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
                    )
                    VALUES (
                        ${result[0].FORM_ID}, ${fieldResult[0].FIELD_ID}, ${i + 1}, 
                        ${field.IS_REQUIRED || false}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE()
                    )
                `;
            }
            console.log(`✅ Added ${fields.length} fields to custom template`);
        }
        
        res.status(201).json({
            success: true,
            message: 'Custom template created successfully',
            form: result[0]
        });
    } catch (error) {
        console.error('❌ Error creating custom template:', error);
        res.status(500).json({
            error: 'Failed to create custom template',
            details: error.message
        });
    }
});

// Update custom template
app.put('/api/custom-templates/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const templateId = parseInt(req.params.id);
        const { form, fields } = req.body;
        console.log(`📝 Updating custom template ${templateId} for company:`, req.companyId);
        console.log('🔍 Update data:', { form, fieldsCount: fields?.length });
        
        // Check if user has role_id 6 (JAFAR)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const hasJafarRole = userRoles.some(role => role.ROLE_ID === 6);
        if (!hasJafarRole) {
            return res.status(403).json({
                error: 'Access denied. Only JAFAR users (role_id 6) can update custom templates.'
            });
        }
        
        if (!templateId || isNaN(templateId)) {
            return res.status(400).json({ error: 'Valid template ID required' });
        }
        
        // Verify template exists and belongs to user's company
        const existingTemplate = await prisma.$queryRaw`
            SELECT FORM_ID FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${templateId} 
            AND COMPANY_ID = ${req.companyId}
        `;
        
        if (existingTemplate.length === 0) {
            return res.status(404).json({
                error: 'Custom template not found or access denied'
            });
        }

        // Handle backward compatibility - support both old format (direct updates) and new format (form + fields)
        let formUpdates;
        if (form) {
            // New format with form and fields
            formUpdates = form;
        } else {
            // Backward compatibility with old format
            formUpdates = req.body;
        }
        
        // Update the form metadata if provided
        if (formUpdates) {
            console.log('📝 Updating form metadata:', formUpdates);
            
            const formName = formUpdates.FORM_NAME?.trim();
            const formDescription = formUpdates.FORM_DESCRIPTION?.trim() || '';
            const isActive = formUpdates.IS_ACTIVE;
            
            if (formName !== undefined || formDescription !== undefined || isActive !== undefined) {
                await prisma.$executeRaw`
                    UPDATE GUARDIAN.FORMS 
                    SET FORM_NAME = ${formName || existingTemplate[0].FORM_NAME},
                        FORM_DESCRIPTION = ${formDescription},
                        IS_ACTIVE = ${isActive !== undefined ? isActive : true},
                        UPDATE_USER_ID = ${req.userId}, 
                        UPDATE_DATE = GETDATE()
                    WHERE FORM_ID = ${templateId}
                    AND COMPANY_ID = ${req.companyId}
                `;
                console.log('✅ Updated form metadata');
            }
        }
        
        // Update fields if provided
        if (fields && Array.isArray(fields)) {
            console.log(`📝 Updating ${fields.length} fields for template`);
            
            // First, delete existing form-field associations
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.FORMS_FIELDS 
                WHERE FORM_ID = ${templateId}
            `;
            console.log('🗑️ Removed existing field associations');
            
            // Create new field associations
            let fieldOrder = 1;
            for (const field of fields) {
                if (!field.FIELD_NAME?.trim()) {
                    console.log('⚠️ Skipping field with empty name');
                    continue;
                }
                
                try {
                    // Check if a field with this name already exists in the company/global scope
                    const existingField = await prisma.$queryRaw`
                        SELECT FIELD_ID FROM GUARDIAN.FIELDS 
                        WHERE FIELD_NAME = ${field.FIELD_NAME.trim()}
                        AND (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL)
                        AND IS_DELETED = 0
                        ORDER BY ORGANIZATION_ID DESC
                    `;
                    
                    let fieldId;
                    
                    if (existingField.length > 0) {
                        // Use existing field
                        fieldId = existingField[0].FIELD_ID;
                        console.log(`🔗 Using existing field: ${field.FIELD_NAME} (ID: ${fieldId})`);
                    } else {
                        // Create new field for this company
                        await prisma.$executeRaw`
                            INSERT INTO GUARDIAN.FIELDS (
                                FIELD_NAME, 
                                FIELD_TYPE_ID, 
                                DISPLAY_FORMAT, 
                                HAS_LOOKUP, 
                                IS_PUBLIC, 
                                IS_ACTIVE, 
                                IS_DELETED, 
                                IS_REQUIRED, 
                                IS_SENSITIVE, 
                                CREATE_DATE, 
                                UPDATE_DATE, 
                                CREATE_USER_ID,
                                UPDATE_USER_ID,
                                ORGANIZATION_ID
                            ) VALUES (
                                ${field.FIELD_NAME.trim()}, 
                                ${field.FIELD_TYPE_ID || 1}, 
                                'text', 
                                0, 
                                1, 
                                1, 
                                0, 
                                ${field.IS_REQUIRED || false}, 
                                0, 
                                GETDATE(), 
                                GETDATE(), 
                                ${req.userId},
                                ${req.userId},
                                ${req.companyId}
                            )
                        `;
                        
                        // Get the newly created field ID
                        const newField = await prisma.$queryRaw`
                            SELECT FIELD_ID FROM GUARDIAN.FIELDS 
                            WHERE FIELD_NAME = ${field.FIELD_NAME.trim()}
                            AND ORGANIZATION_ID = ${req.companyId}
                            ORDER BY CREATE_DATE DESC
                        `;
                        
                        fieldId = newField[0].FIELD_ID;
                        console.log(`➕ Created new field: ${field.FIELD_NAME} (ID: ${fieldId})`);
                    }
                    
                    // Create the form-field association
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.FORMS_FIELDS (
                            FORM_ID, 
                            FIELD_ID, 
                            IS_REQUIRED, 
                            SORT_ORDER, 
                            CREATE_USER_ID,
                            CREATE_DATE
                        ) VALUES (
                            ${templateId}, 
                            ${fieldId}, 
                            ${field.IS_REQUIRED || false}, 
                            ${fieldOrder}, 
                            ${req.userId},
                            GETDATE()
                        )
                    `;
                    
                    fieldOrder++;
                    console.log(`🔗 Associated field ${field.FIELD_NAME} with template (order: ${fieldOrder - 1})`);
                    
                } catch (fieldError) {
                    console.error(`❌ Error processing field ${field.FIELD_NAME}:`, fieldError);
                    // Continue with other fields rather than failing the entire operation
                }
            }
            
            console.log(`✅ Updated ${fields.length} fields for template ${templateId}`);
        }
        
        console.log(`✅ Successfully updated custom template ${templateId}`);
        
        res.json({
            success: true,
            message: 'Custom template updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating custom template:', error);
        res.status(500).json({
            error: 'Failed to update custom template',
            details: error.message
        });
    }
});

// Delete custom template
app.delete('/api/custom-templates/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const templateId = parseInt(req.params.id);
        console.log(`🗑️ Deleting custom template ${templateId} for company:`, req.companyId);
        
        // Check if user has role_id 6 (JAFAR)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID 
            FROM GUARDIAN.USER_ROLES ur 
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const hasJafarRole = userRoles.some(role => role.ROLE_ID === 6);
        if (!hasJafarRole) {
            return res.status(403).json({
                error: 'Access denied. Only JAFAR users (role_id 6) can delete custom templates.'
            });
        }
        
        if (!templateId || isNaN(templateId)) {
            return res.status(400).json({ error: 'Valid template ID required' });
        }
        
        // Verify template exists and belongs to user's company
        const existingTemplate = await prisma.$queryRaw`
            SELECT FORM_ID FROM GUARDIAN.FORMS 
            WHERE FORM_ID = ${templateId} 
            AND COMPANY_ID = ${req.companyId}
            AND IS_DELETED = 0
        `;
        
        if (existingTemplate.length === 0) {
            return res.status(404).json({
                error: 'Custom template not found or access denied'
            });
        }
        
        // Delete form-field relationships first
        await prisma.$queryRaw`DELETE FROM GUARDIAN.FORMS_FIELDS WHERE FORM_ID = ${templateId}`;
        
        // Delete the form itself (soft delete)
        await prisma.$queryRaw`
            UPDATE GUARDIAN.FORMS 
            SET IS_DELETED = 1, UPDATE_USER_ID = ${req.userId}, UPDATE_DATE = GETDATE()
            WHERE FORM_ID = ${templateId} AND COMPANY_ID = ${req.companyId}
        `;
        
        console.log(`✅ Deleted custom template ${templateId}`);
        
        res.json({
            success: true,
            message: 'Custom template deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting custom template:', error);
        res.status(500).json({
            error: 'Failed to delete custom template',
            details: error.message
        });
    }
});

// =========================================
// NOTICE MODULE API ENDPOINTS
// =========================================

// Helper function to check role permissions for notice management
const hasNoticeManagementRole = async (userId) => {
    const userRoles = await prisma.$queryRaw`
        SELECT ur.ROLE_ID FROM GUARDIAN.USER_ROLES ur WHERE ur.USER_ID = ${userId}
    `;
    const roleIds = userRoles.map(role => role.ROLE_ID);
    // Roles: 1=Admin, 3=Processor, 4=Manager, 6=Super Admin
    return roleIds.includes(1) || roleIds.includes(3) || roleIds.includes(4) || roleIds.includes(6);
};

// Get notices for logged-in user (notices issued to them)
app.get('/api/notices/my', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📢 Fetching my notices for user ${req.userId} (Company: ${req.companyId})`);
        
        const { status, noticeType, unreadOnly, dateFrom, dateTo } = req.query;
        
        let whereClause = `WHERE nr.RECIPIENT_USER_ID = ${req.userId} AND n.COMPANY_ID = ${req.companyId} AND n.IS_DELETED = 0`;
        
        if (status) {
            whereClause += ` AND n.STATUS = '${status}'`;
        }
        if (noticeType) {
            whereClause += ` AND n.NOTICE_TYPE = '${noticeType}'`;
        }
        if (unreadOnly === 'true') {
            whereClause += ` AND nrs.NOTICE_READ_STATUS_ID IS NULL`;
        }
        if (dateFrom) {
            whereClause += ` AND n.ISSUE_DATE >= '${dateFrom}'`;
        }
        if (dateTo) {
            whereClause += ` AND n.ISSUE_DATE <= '${dateTo}'`;
        }
        
        const notices = await prisma.$queryRawUnsafe(`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                CASE WHEN nrs.NOTICE_READ_STATUS_ID IS NOT NULL THEN 1 ELSE 0 END as IS_READ
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.NOTICE_RECIPIENTS nr ON n.NOTICE_ID = nr.NOTICE_ID
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            LEFT JOIN GUARDIAN.NOTICE_READ_STATUS nrs ON n.NOTICE_ID = nrs.NOTICE_ID AND nrs.USER_ID = ${req.userId}
            ${whereClause}
            ORDER BY n.ISSUE_DATE DESC, n.CREATE_DATE DESC
        `);
        
        console.log(`✅ Found ${notices.length} notices for user`);
        
        res.json(notices);
    } catch (error) {
        console.error('❌ Error fetching my notices:', error);
        res.status(500).json({
            error: 'Failed to fetch notices',
            message: error.message
        });
    }
});

// Get all notices (role-based - only for authorized users)
app.get('/api/notices', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📢 Fetching all notices for user ${req.userId} (Company: ${req.companyId})`);
        
        // Check permissions
        const hasPermission = await hasNoticeManagementRole(req.userId);
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to view all notices.'
            });
        }
        
        const { status, noticeType, unreadOnly, issuedByMe, dateFrom, dateTo } = req.query;
        
        let whereClause = `WHERE n.COMPANY_ID = ${req.companyId} AND n.IS_DELETED = 0`;
        
        if (status) {
            whereClause += ` AND n.STATUS = '${status}'`;
        }
        if (noticeType) {
            whereClause += ` AND n.NOTICE_TYPE = '${noticeType}'`;
        }
        if (issuedByMe === 'true') {
            whereClause += ` AND n.ISSUED_BY_USER_ID = ${req.userId}`;
        }
        if (dateFrom) {
            whereClause += ` AND n.ISSUE_DATE >= '${dateFrom}'`;
        }
        if (dateTo) {
            whereClause += ` AND n.ISSUE_DATE <= '${dateTo}'`;
        }
        
        const notices = await prisma.$queryRawUnsafe(`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                (SELECT COUNT(*) FROM GUARDIAN.NOTICE_RECIPIENTS nr WHERE nr.NOTICE_ID = n.NOTICE_ID) as RECIPIENT_COUNT,
                (SELECT COUNT(*) FROM GUARDIAN.NOTICE_READ_STATUS nrs WHERE nrs.NOTICE_ID = n.NOTICE_ID) as READ_COUNT
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            ${whereClause}
            ORDER BY n.ISSUE_DATE DESC, n.CREATE_DATE DESC
        `);
        
        console.log(`✅ Found ${notices.length} notices for admin user`);
        
        res.json(notices);
    } catch (error) {
        console.error('❌ Error fetching all notices:', error);
        res.status(500).json({
            error: 'Failed to fetch notices',
            message: error.message
        });
    }
});

// Get notice statistics
app.get('/api/notices/stats', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📊 Fetching notice statistics for user ${req.userId} (Company: ${req.companyId})`);
        
        // Get total notices for the user (as recipient)
        const totalNoticesResult = await prisma.$queryRaw`
            SELECT COUNT(*) as total_count
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.NOTICE_RECIPIENTS nr ON n.NOTICE_ID = nr.NOTICE_ID
            WHERE nr.RECIPIENT_USER_ID = ${req.userId} 
            AND n.COMPANY_ID = ${req.companyId} 
            AND n.IS_DELETED = 0
        `;
        
        // Get unread notices for the user
        const unreadNoticesResult = await prisma.$queryRaw`
            SELECT COUNT(*) as unread_count
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.NOTICE_RECIPIENTS nr ON n.NOTICE_ID = nr.NOTICE_ID
            LEFT JOIN GUARDIAN.NOTICE_READ_STATUS nrs ON n.NOTICE_ID = nrs.NOTICE_ID AND nrs.USER_ID = ${req.userId}
            WHERE nr.RECIPIENT_USER_ID = ${req.userId} 
            AND n.COMPANY_ID = ${req.companyId} 
            AND n.IS_DELETED = 0
            AND nrs.NOTICE_READ_STATUS_ID IS NULL
        `;
        
        // Get notices issued by the user
        const issuedByMeResult = await prisma.$queryRaw`
            SELECT COUNT(*) as issued_count
            FROM GUARDIAN.NOTICES n
            WHERE n.ISSUED_BY_USER_ID = ${req.userId} 
            AND n.COMPANY_ID = ${req.companyId} 
            AND n.IS_DELETED = 0
        `;
        
        // Get active notices for the user
        const activeNoticesResult = await prisma.$queryRaw`
            SELECT COUNT(*) as active_count
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.NOTICE_RECIPIENTS nr ON n.NOTICE_ID = nr.NOTICE_ID
            WHERE nr.RECIPIENT_USER_ID = ${req.userId} 
            AND n.COMPANY_ID = ${req.companyId} 
            AND n.IS_DELETED = 0
            AND n.STATUS = 'PUBLISHED'
            AND n.IS_ACTIVE = 1
        `;
        
        const stats = {
            totalNotices: parseInt(totalNoticesResult[0].total_count) || 0,
            unreadNotices: parseInt(unreadNoticesResult[0].unread_count) || 0,
            issuedByMe: parseInt(issuedByMeResult[0].issued_count) || 0,
            activeNotices: parseInt(activeNoticesResult[0].active_count) || 0
        };
        
        console.log(`✅ Notice stats:`, stats);
        
        res.json(stats);
    } catch (error) {
        console.error('❌ Error fetching notice statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch notice statistics',
            message: error.message
        });
    }
});

// Get specific notice details
app.get('/api/notices/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        console.log(`📢 Fetching notice ${noticeId} for user ${req.userId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Get notice details with issuer information
        const notices = await prisma.$queryRaw`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            WHERE n.NOTICE_ID = ${noticeId} 
            AND n.COMPANY_ID = ${req.companyId} 
            AND n.IS_DELETED = 0
        `;
        
        if (notices.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        const notice = notices[0];
        
        // Check if user is authorized to view this notice
        const isRecipient = await prisma.$queryRaw`
            SELECT NOTICE_RECIPIENT_ID 
            FROM GUARDIAN.NOTICE_RECIPIENTS 
            WHERE NOTICE_ID = ${noticeId} AND RECIPIENT_USER_ID = ${req.userId}
        `;
        
        const hasManagementRole = await hasNoticeManagementRole(req.userId);
        
        if (isRecipient.length === 0 && !hasManagementRole) {
            return res.status(403).json({
                error: 'Access denied. You are not authorized to view this notice.'
            });
        }
        
        // Auto-mark as read if user is a recipient and notice is viewed
        if (isRecipient.length > 0) {
            const existingReadStatus = await prisma.$queryRaw`
                SELECT NOTICE_READ_STATUS_ID 
                FROM GUARDIAN.NOTICE_READ_STATUS 
                WHERE NOTICE_ID = ${noticeId} AND USER_ID = ${req.userId}
            `;
            
            if (existingReadStatus.length === 0) {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.NOTICE_READ_STATUS (NOTICE_ID, USER_ID, READ_DATE, COMPANY_ID, CREATE_DATE)
                    VALUES (${noticeId}, ${req.userId}, GETDATE(), ${req.companyId}, GETDATE())
                `;
                console.log(`📖 Auto-marked notice ${noticeId} as read for user ${req.userId}`);
            }
        }
        
        console.log(`✅ Retrieved notice ${noticeId} successfully`);
        
        res.json(notice);
    } catch (error) {
        console.error('❌ Error fetching notice details:', error);
        res.status(500).json({
            error: 'Failed to fetch notice details',
            message: error.message
        });
    }
});

// Create new notice
app.post('/api/notices', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📢 Creating new notice for user ${req.userId} (Company: ${req.companyId})`);
        
        // Check permissions
        const hasPermission = await hasNoticeManagementRole(req.userId);
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to create notices.'
            });
        }
        
        const { TITLE, CONTENT, NOTICE_TYPE, FORM_TEMPLATE_ID, recipients = [], contactGroups = [], STATUS, PRIORITY_LEVEL, DUE_DATE } = req.body;
        
        if (!TITLE || !CONTENT || !NOTICE_TYPE) {
            return res.status(400).json({
                error: 'Title, content, and notice type are required'
            });
        }
        
        // Support both old format (recipientUserIds) and new format (recipients + contactGroups)
        const recipientUserIds = req.body.recipientUserIds || recipients || [];
        const contactGroupIds = contactGroups || [];
        
        if (recipientUserIds.length === 0 && contactGroupIds.length === 0) {
            return res.status(400).json({
                error: 'At least one recipient or contact group is required'
            });
        }
        
        // Collect all recipient user IDs
        let allRecipientIds = [...recipientUserIds];
        
        // Resolve contact groups to individual user IDs
        if (contactGroupIds.length > 0) {
            console.log(`🔍 Resolving ${contactGroupIds.length} contact groups to individual users`);
            
            // Validate contact groups belong to the same company
            const validGroups = await prisma.$queryRawUnsafe(`
                SELECT CONTACT_GROUP_ID FROM GUARDIAN.NOTICE_CONTACT_GROUPS
                WHERE CONTACT_GROUP_ID IN (${contactGroupIds.join(',')}) 
                AND COMPANY_ID = ${req.companyId}
            `);
            
            if (validGroups.length !== contactGroupIds.length) {
                return res.status(400).json({
                    error: 'All contact groups must belong to the same company'
                });
            }
            
            // Get all active members from these contact groups
            const contactGroupMembers = await prisma.$queryRawUnsafe(`
                SELECT DISTINCT ncgm.USER_ID
                FROM GUARDIAN.NOTICE_CONTACT_GROUP_MEMBERS ncgm
                INNER JOIN GUARDIAN.USERS u ON ncgm.USER_ID = u.USER_ID
                WHERE ncgm.CONTACT_GROUP_ID IN (${contactGroupIds.join(',')}) 
                AND ncgm.COMPANY_ID = ${req.companyId}
                AND ncgm.MEMBER_STATUS = 'ACTIVE'
                AND u.STATUS = 'ACTIVE'
            `);
            
            const groupUserIds = contactGroupMembers.map(member => member.USER_ID);
            console.log(`✅ Resolved contact groups to ${groupUserIds.length} individual users`);
            
            // Combine with individual recipients and remove duplicates
            allRecipientIds = [...new Set([...allRecipientIds, ...groupUserIds])];
        }
        
        if (allRecipientIds.length === 0) {
            return res.status(400).json({
                error: 'No valid recipients found after resolving contact groups'
            });
        }
        
        // Validate all final recipients are from same company
        const validRecipients = await prisma.$queryRawUnsafe(`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE USER_ID IN (${allRecipientIds.join(',')}) 
            AND COMPANY_ID = ${req.companyId}
            AND STATUS = 'ACTIVE'
        `);
        
        if (validRecipients.length !== allRecipientIds.length) {
            return res.status(400).json({
                error: 'All recipients must be active users from the same company'
            });
        }
        
        // Create notice
        const issueDate = STATUS === 'PUBLISHED' ? new Date().toISOString() : null;
        
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.NOTICES (
                TITLE, CONTENT, NOTICE_TYPE, STATUS, PRIORITY_LEVEL, DUE_DATE,
                ISSUED_BY_USER_ID, ISSUE_DATE, COMPANY_ID, FORM_TEMPLATE_ID, 
                IS_ACTIVE, IS_DELETED, CREATE_DATE, CREATE_USER_ID
            )
            OUTPUT INSERTED.NOTICE_ID
            VALUES (
                ${TITLE}, ${CONTENT}, ${NOTICE_TYPE}, ${STATUS || 'DRAFT'}, 
                ${PRIORITY_LEVEL || 'MEDIUM'}, ${DUE_DATE}, ${req.userId},
                ${issueDate}, ${req.companyId}, ${FORM_TEMPLATE_ID || null}, 1,
                0, GETDATE(), ${req.userId}
            )
        `;
        
        const noticeId = result[0].NOTICE_ID;
        
        // Add recipients
        for (const recipientId of allRecipientIds) {
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.NOTICE_RECIPIENTS (
                    NOTICE_ID, RECIPIENT_USER_ID, RECIPIENT_TYPE, 
                    COMPANY_ID, CREATE_DATE, CREATE_USER_ID
                )
                VALUES (
                    ${noticeId}, ${recipientId}, 'USER', 
                    ${req.companyId}, GETDATE(), ${req.userId}
                )
            `;
        }
        
        console.log(`✅ Created notice ${noticeId} with ${allRecipientIds.length} recipients (${recipientUserIds.length} individual + ${contactGroupIds.length} contact groups)`);
        
        // Return the created notice
        const createdNotice = await prisma.$queryRaw`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            WHERE n.NOTICE_ID = ${noticeId}
        `;
        
        res.status(201).json(createdNotice[0]);
    } catch (error) {
        console.error('❌ Error creating notice:', error);
        res.status(500).json({
            error: 'Failed to create notice',
            message: error.message
        });
    }
});

// Edit notice
app.put('/api/notices/:id', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        console.log(`📢 Updating notice ${noticeId} for user ${req.userId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Check permissions
        const hasPermission = await hasNoticeManagementRole(req.userId);
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to edit notices.'
            });
        }
        
        const { TITLE, CONTENT, NOTICE_TYPE, FORM_TEMPLATE_ID, STATUS, CANCELLATION_REASON, recipientUserIds } = req.body;
        
        // Check if notice exists and belongs to company
        const existingNotice = await prisma.$queryRaw`
            SELECT NOTICE_ID, STATUS, ISSUED_BY_USER_ID 
            FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} 
            AND COMPANY_ID = ${req.companyId} 
            AND IS_DELETED = 0
        `;
        
        if (existingNotice.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        // Check if user can edit this notice (issuer or admin)
        const notice = existingNotice[0];
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID FROM GUARDIAN.USER_ROLES ur WHERE ur.USER_ID = ${req.userId}
        `;
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(1) || roleIds.includes(6);
        
        if (notice.ISSUED_BY_USER_ID !== req.userId && !isAdmin) {
            return res.status(403).json({
                error: 'Access denied. You can only edit your own notices or you must be an admin.'
            });
        }
        
        // Build update query dynamically
        let updateFields = [];
        let updateValues = {};
        
        if (TITLE !== undefined) {
            updateFields.push('TITLE = @title');
            updateValues.title = TITLE;
        }
        if (CONTENT !== undefined) {
            updateFields.push('CONTENT = @content');
            updateValues.content = CONTENT;
        }
        if (NOTICE_TYPE !== undefined) {
            updateFields.push('NOTICE_TYPE = @noticeType');
            updateValues.noticeType = NOTICE_TYPE;
        }
        if (FORM_TEMPLATE_ID !== undefined) {
            updateFields.push('FORM_TEMPLATE_ID = @formTemplateId');
            updateValues.formTemplateId = FORM_TEMPLATE_ID;
        }
        if (STATUS !== undefined) {
            updateFields.push('STATUS = @status');
            updateValues.status = STATUS;
        }
        if (CANCELLATION_REASON !== undefined) {
            updateFields.push('CANCELLATION_REASON = @cancellationReason');
            updateValues.cancellationReason = CANCELLATION_REASON;
        }
        
        if (updateFields.length > 0) {
            updateFields.push('UPDATE_DATE = GETDATE()');
            updateFields.push(`UPDATE_USER_ID = ${req.userId}`);
            
            const updateQuery = `
                UPDATE GUARDIAN.NOTICES 
                SET ${updateFields.join(', ')}
                WHERE NOTICE_ID = ${noticeId} AND COMPANY_ID = ${req.companyId}
            `;
            
            await prisma.$queryRawUnsafe(updateQuery, updateValues);
        }
        
        // Update recipients if provided
        if (recipientUserIds && Array.isArray(recipientUserIds)) {
            // Validate recipients are from same company
            const validRecipients = await prisma.$queryRawUnsafe(`
                SELECT USER_ID FROM GUARDIAN.USERS 
                WHERE USER_ID IN (${recipientUserIds.join(',')}) 
                AND COMPANY_ID = ${req.companyId}
            `);
            
            if (validRecipients.length !== recipientUserIds.length) {
                return res.status(400).json({
                    error: 'All recipients must be from the same company'
                });
            }
            
            // Remove existing recipients
            await prisma.$executeRaw`
                DELETE FROM GUARDIAN.NOTICE_RECIPIENTS 
                WHERE NOTICE_ID = ${noticeId}
            `;
            
            // Add new recipients
            for (const recipientId of recipientUserIds) {
                await prisma.$executeRaw`
                    INSERT INTO GUARDIAN.NOTICE_RECIPIENTS (
                        NOTICE_ID, RECIPIENT_USER_ID, RECIPIENT_TYPE, 
                        COMPANY_ID, CREATE_DATE, CREATE_USER_ID
                    )
                    VALUES (
                        ${noticeId}, ${recipientId}, 'USER', 
                        ${req.companyId}, GETDATE(), ${req.userId}
                    )
                `;
            }
        }
        
        console.log(`✅ Updated notice ${noticeId} successfully`);
        
        // Return updated notice
        const updatedNotice = await prisma.$queryRaw`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            WHERE n.NOTICE_ID = ${noticeId}
        `;
        
        res.json(updatedNotice[0]);
    } catch (error) {
        console.error('❌ Error updating notice:', error);
        res.status(500).json({
            error: 'Failed to update notice',
            message: error.message
        });
    }
});

// Cancel notice with reason
app.put('/api/notices/:id/cancel', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { CANCELLATION_REASON } = req.body;
        
        console.log(`📢 Cancelling notice ${noticeId} for user ${req.userId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        if (!CANCELLATION_REASON || CANCELLATION_REASON.trim() === '') {
            return res.status(400).json({
                error: 'Cancellation reason is required'
            });
        }
        
        // Check permissions
        const hasPermission = await hasNoticeManagementRole(req.userId);
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to cancel notices.'
            });
        }
        
        // Check if notice exists and belongs to company
        const existingNotice = await prisma.$queryRaw`
            SELECT NOTICE_ID, STATUS, ISSUED_BY_USER_ID 
            FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} 
            AND COMPANY_ID = ${req.companyId} 
            AND IS_DELETED = 0
        `;
        
        if (existingNotice.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        // Check if user can cancel this notice (issuer or admin)
        const notice = existingNotice[0];
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID FROM GUARDIAN.USER_ROLES ur WHERE ur.USER_ID = ${req.userId}
        `;
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(1) || roleIds.includes(6);
        
        if (notice.ISSUED_BY_USER_ID !== req.userId && !isAdmin) {
            return res.status(403).json({
                error: 'Access denied. You can only cancel your own notices or you must be an admin.'
            });
        }
        
        if (notice.STATUS === 'CANCELLED') {
            return res.status(400).json({
                error: 'Notice is already cancelled'
            });
        }
        
        // Cancel the notice
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICES 
            SET STATUS = 'CANCELLED', 
                CANCELLATION_REASON = ${CANCELLATION_REASON},
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE NOTICE_ID = ${noticeId} AND COMPANY_ID = ${req.companyId}
        `;
        
        console.log(`✅ Cancelled notice ${noticeId} successfully`);
        
        // Return updated notice
        const cancelledNotice = await prisma.$queryRaw`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            WHERE n.NOTICE_ID = ${noticeId}
        `;
        
        res.json(cancelledNotice[0]);
    } catch (error) {
        console.error('❌ Error cancelling notice:', error);
        res.status(500).json({
            error: 'Failed to cancel notice',
            message: error.message
        });
    }
});

// Mark notice as read
app.post('/api/notices/:id/read', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        console.log(`📖 Marking notice ${noticeId} as read for user ${req.userId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Check if user is a recipient of this notice
        const isRecipient = await prisma.$queryRaw`
            SELECT nr.NOTICE_RECIPIENT_ID 
            FROM GUARDIAN.NOTICE_RECIPIENTS nr
            INNER JOIN GUARDIAN.NOTICES n ON nr.NOTICE_ID = n.NOTICE_ID
            WHERE nr.NOTICE_ID = ${noticeId} 
            AND nr.RECIPIENT_USER_ID = ${req.userId}
            AND n.COMPANY_ID = ${req.companyId}
        `;
        
        if (isRecipient.length === 0) {
            return res.status(403).json({
                error: 'Access denied. You are not a recipient of this notice.'
            });
        }
        
        // Check if already marked as read
        const existingReadStatus = await prisma.$queryRaw`
            SELECT NOTICE_READ_STATUS_ID 
            FROM GUARDIAN.NOTICE_READ_STATUS 
            WHERE NOTICE_ID = ${noticeId} AND USER_ID = ${req.userId}
        `;
        
        if (existingReadStatus.length > 0) {
            return res.json({
                success: true,
                message: 'Notice already marked as read'
            });
        }
        
        // Mark as read
        await prisma.$executeRaw`
            INSERT INTO GUARDIAN.NOTICE_READ_STATUS (NOTICE_ID, USER_ID, READ_DATE, COMPANY_ID, CREATE_DATE)
            VALUES (${noticeId}, ${req.userId}, GETDATE(), ${req.companyId}, GETDATE())
        `;
        
        console.log(`✅ Marked notice ${noticeId} as read for user ${req.userId}`);
        
        res.json({
            success: true,
            message: 'Notice marked as read successfully'
        });
    } catch (error) {
        console.error('❌ Error marking notice as read:', error);
        res.status(500).json({
            error: 'Failed to mark notice as read',
            message: error.message
        });
    }
});

// Publish draft notice
app.post('/api/notices/:id/publish', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        console.log(`📢 Publishing notice ${noticeId} for user ${req.userId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Check permissions
        const hasPermission = await hasNoticeManagementRole(req.userId);
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to publish notices.'
            });
        }
        
        // Check if notice exists and belongs to company
        const existingNotice = await prisma.$queryRaw`
            SELECT NOTICE_ID, STATUS, ISSUED_BY_USER_ID 
            FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} 
            AND COMPANY_ID = ${req.companyId} 
            AND IS_DELETED = 0
        `;
        
        if (existingNotice.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        const notice = existingNotice[0];
        
        if (notice.STATUS !== 'DRAFT') {
            return res.status(400).json({
                error: 'Only draft notices can be published'
            });
        }
        
        // Check if user can publish this notice (issuer or admin)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID FROM GUARDIAN.USER_ROLES ur WHERE ur.USER_ID = ${req.userId}
        `;
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(1) || roleIds.includes(6);
        
        if (notice.ISSUED_BY_USER_ID !== req.userId && !isAdmin) {
            return res.status(403).json({
                error: 'Access denied. You can only publish your own notices or you must be an admin.'
            });
        }
        
        // Publish the notice
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICES 
            SET STATUS = 'PUBLISHED', 
                ISSUE_DATE = GETDATE(),
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE NOTICE_ID = ${noticeId} AND COMPANY_ID = ${req.companyId}
        `;
        
        console.log(`✅ Published notice ${noticeId} successfully`);
        
        // Return updated notice
        const publishedNotice = await prisma.$queryRaw`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            WHERE n.NOTICE_ID = ${noticeId}
        `;
        
        res.json(publishedNotice[0]);
    } catch (error) {
        console.error('❌ Error publishing notice:', error);
        res.status(500).json({
            error: 'Failed to publish notice',
            message: error.message
        });
    }
});

// Get notice templates (forms with NOTICE type)
app.get('/api/notices/templates', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📋 Fetching notice templates for company ${req.companyId}`);
        
        const templates = await prisma.$queryRaw`
            SELECT 
                FORM_ID,
                FORM_NAME,
                FORM_DESCRIPTION,
                IS_ACTIVE,
                IS_PUBLIC,
                ORGANIZATION_ID,
                COMPANY_ID,
                CREATE_DATE
            FROM GUARDIAN.FORMS 
            WHERE (ORGANIZATION_ID = ${req.companyId} OR ORGANIZATION_ID IS NULL OR COMPANY_ID = ${req.companyId} OR COMPANY_ID IS NULL)
            AND IS_DELETED = 0
            AND IS_ACTIVE = 1
            ORDER BY FORM_NAME
        `;
        
        console.log(`✅ Found ${templates.length} notice templates`);
        
        res.json(templates);
    } catch (error) {
        console.error('❌ Error fetching notice templates:', error);
        res.status(500).json({
            error: 'Failed to fetch notice templates',
            message: error.message
        });
    }
});


// Search notices
app.get('/api/notices/search', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { q: searchTerm, status, noticeType, unreadOnly } = req.query;
        
        console.log(`🔍 Searching notices for user ${req.userId} (Company: ${req.companyId}) with term: "${searchTerm}"`);
        
        if (!searchTerm || searchTerm.trim() === '') {
            return res.status(400).json({
                error: 'Search term is required'
            });
        }
        
        let whereClause = `WHERE (nr.RECIPIENT_USER_ID = ${req.userId} OR n.ISSUED_BY_USER_ID = ${req.userId})
                          AND n.COMPANY_ID = ${req.companyId} 
                          AND n.IS_DELETED = 0
                          AND (n.TITLE LIKE '%${searchTerm}%' OR n.CONTENT LIKE '%${searchTerm}%')`;
        
        if (status) {
            whereClause += ` AND n.STATUS = '${status}'`;
        }
        if (noticeType) {
            whereClause += ` AND n.NOTICE_TYPE = '${noticeType}'`;
        }
        if (unreadOnly === 'true') {
            whereClause += ` AND nrs.NOTICE_READ_STATUS_ID IS NULL`;
        }
        
        const notices = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT
                n.NOTICE_ID,
                n.TITLE,
                n.CONTENT,
                n.NOTICE_TYPE,
                n.STATUS,
                n.ISSUED_BY_USER_ID,
                n.ISSUE_DATE,
                n.COMPANY_ID,
                n.FORM_TEMPLATE_ID,
                n.CANCELLATION_REASON,
                n.IS_ACTIVE,
                n.IS_DELETED,
                n.CREATE_DATE,
                n.UPDATE_DATE,
                n.CREATE_USER_ID,
                n.UPDATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                CASE WHEN nrs.NOTICE_READ_STATUS_ID IS NOT NULL THEN 1 ELSE 0 END as IS_READ
            FROM GUARDIAN.NOTICES n
            LEFT JOIN GUARDIAN.NOTICE_RECIPIENTS nr ON n.NOTICE_ID = nr.NOTICE_ID
            INNER JOIN GUARDIAN.USERS u ON n.ISSUED_BY_USER_ID = u.USER_ID
            LEFT JOIN GUARDIAN.NOTICE_READ_STATUS nrs ON n.NOTICE_ID = nrs.NOTICE_ID AND nrs.USER_ID = ${req.userId}
            ${whereClause}
            ORDER BY n.ISSUE_DATE DESC, n.CREATE_DATE DESC
        `);
        
        console.log(`✅ Found ${notices.length} notices matching search term`);
        
        res.json(notices);
    } catch (error) {
        console.error('❌ Error searching notices:', error);
        res.status(500).json({
            error: 'Failed to search notices',
            message: error.message
        });
    }
});

// Get notice recipients
app.get('/api/notices/:id/recipients', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        console.log(`👥 Fetching recipients for notice ${noticeId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Check permissions - user must be authorized to view notice details
        const hasPermission = await hasNoticeManagementRole(req.userId);
        const isRecipient = await prisma.$queryRaw`
            SELECT NOTICE_RECIPIENT_ID 
            FROM GUARDIAN.NOTICE_RECIPIENTS 
            WHERE NOTICE_ID = ${noticeId} AND RECIPIENT_USER_ID = ${req.userId}
        `;
        
        if (!hasPermission && isRecipient.length === 0) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to view notice recipients.'
            });
        }
        
        // Verify notice belongs to company
        const noticeExists = await prisma.$queryRaw`
            SELECT NOTICE_ID FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} AND COMPANY_ID = ${req.companyId} AND IS_DELETED = 0
        `;
        
        if (noticeExists.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        const recipients = await prisma.$queryRaw`
            SELECT 
                nr.NOTICE_RECIPIENT_ID,
                nr.NOTICE_ID,
                nr.RECIPIENT_USER_ID,
                nr.RECIPIENT_TYPE,
                nr.COMPANY_ID,
                nr.CREATE_DATE,
                nr.CREATE_USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICE_RECIPIENTS nr
            INNER JOIN GUARDIAN.USERS u ON nr.RECIPIENT_USER_ID = u.USER_ID
            WHERE nr.NOTICE_ID = ${noticeId}
            ORDER BY u.FIRST_NAME, u.LAST_NAME
        `;
        
        console.log(`✅ Found ${recipients.length} recipients for notice ${noticeId}`);
        
        res.json(recipients);
    } catch (error) {
        console.error('❌ Error fetching notice recipients:', error);
        res.status(500).json({
            error: 'Failed to fetch notice recipients',
            message: error.message
        });
    }
});

// Get notice read status
app.get('/api/notices/:id/read-status', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        console.log(`📖 Fetching read status for notice ${noticeId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Check permissions - only notice issuers or admins can view read status
        const hasPermission = await hasNoticeManagementRole(req.userId);
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to view read status.'
            });
        }
        
        // Verify notice belongs to company
        const noticeExists = await prisma.$queryRaw`
            SELECT NOTICE_ID FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} AND COMPANY_ID = ${req.companyId} AND IS_DELETED = 0
        `;
        
        if (noticeExists.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        const readStatus = await prisma.$queryRaw`
            SELECT 
                nrs.NOTICE_READ_STATUS_ID,
                nrs.NOTICE_ID,
                nrs.USER_ID,
                nrs.READ_DATE,
                nrs.COMPANY_ID,
                nrs.CREATE_DATE,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL
            FROM GUARDIAN.NOTICE_READ_STATUS nrs
            INNER JOIN GUARDIAN.USERS u ON nrs.USER_ID = u.USER_ID
            WHERE nrs.NOTICE_ID = ${noticeId}
            ORDER BY nrs.READ_DATE DESC
        `;
        
        console.log(`✅ Found ${readStatus.length} read status records for notice ${noticeId}`);
        
        res.json(readStatus);
    } catch (error) {
        console.error('❌ Error fetching notice read status:', error);
        res.status(500).json({
            error: 'Failed to fetch notice read status',
            message: error.message
        });
    }
});

// Get users eligible to receive notices (within same company)
app.get('/api/notices/eligible-recipients', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`👥 Fetching eligible recipients for company ${req.companyId}`);
        
        // Check permissions
        const hasPermission = await hasNoticeManagementRole(req.userId);
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to view eligible recipients.'
            });
        }
        
        const eligibleUsers = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                r.NAME as ROLE_NAME
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE u.COMPANY_ID = ${req.companyId}
            AND u.IS_ACTIVE = 1
            AND u.IS_DELETED = 0
            ORDER BY u.FIRST_NAME, u.LAST_NAME
        `;
        
        console.log(`✅ Found ${eligibleUsers.length} eligible recipients`);
        
        res.json(eligibleUsers);
    } catch (error) {
        console.error('❌ Error fetching eligible recipients:', error);
        res.status(500).json({
            error: 'Failed to fetch eligible recipients',
            message: error.message
        });
    }
});

// ==============================================
// NOTICE ANALYTICS ENDPOINTS
// ==============================================

// Start view tracking for a notice
app.post('/api/notices/:id/analytics/start', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { deviceType, referrerSource } = req.body;
        
        console.log(`📊 Starting view tracking for notice ${noticeId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Verify notice exists and belongs to user's company
        const notice = await prisma.$queryRaw`
            SELECT NOTICE_ID FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} AND COMPANY_ID = ${req.companyId}
        `;
        
        if (notice.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        // Create or update metrics record
        const result = await prisma.$executeRaw`
            INSERT INTO GUARDIAN.NOTICE_METRICS 
            (NOTICE_ID, USER_ID, COMPANY_ID, VIEW_START_TIME, DEVICE_TYPE, REFERRER_SOURCE)
            VALUES (${noticeId}, ${req.userId}, ${req.companyId}, GETDATE(), ${deviceType || 'unknown'}, ${referrerSource || 'direct'})
        `;
        
        console.log(`✅ Started view tracking for notice ${noticeId}`);
        res.json({ 
            success: true,
            message: 'View tracking started'
        });
        
    } catch (error) {
        console.error('❌ Error starting notice view tracking:', error);
        res.status(500).json({
            error: 'Failed to start view tracking',
            message: error.message
        });
    }
});

// Update scroll percentage for notice analytics
app.put('/api/notices/:id/analytics/scroll', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { scrollPercentage } = req.body;
        
        console.log(`📊 Updating scroll tracking for notice ${noticeId} to ${scrollPercentage}% (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        if (scrollPercentage < 0 || scrollPercentage > 100) {
            return res.status(400).json({
                error: 'Scroll percentage must be between 0 and 100'
            });
        }
        
        // Update the latest metrics record for this user and notice
        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_METRICS 
            SET SCROLL_PERCENTAGE = ${scrollPercentage},
                LAST_UPDATE_TIME = GETDATE()
            WHERE NOTICE_ID = ${noticeId} 
                AND USER_ID = ${req.userId} 
                AND COMPANY_ID = ${req.companyId}
                AND METRIC_ID = (
                    SELECT TOP 1 METRIC_ID 
                    FROM GUARDIAN.NOTICE_METRICS 
                    WHERE NOTICE_ID = ${noticeId} 
                        AND USER_ID = ${req.userId} 
                        AND COMPANY_ID = ${req.companyId}
                    ORDER BY VIEW_START_TIME DESC
                )
        `;
        
        console.log(`✅ Updated scroll tracking for notice ${noticeId}`);
        res.json({ 
            success: true,
            message: 'Scroll tracking updated'
        });
        
    } catch (error) {
        console.error('❌ Error updating notice scroll tracking:', error);
        res.status(500).json({
            error: 'Failed to update scroll tracking',
            message: error.message
        });
    }
});

// Track user interaction with notice
app.post('/api/notices/:id/analytics/interaction', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { interactionType } = req.body;
        
        console.log(`📊 Recording interaction '${interactionType}' for notice ${noticeId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        if (!interactionType) {
            return res.status(400).json({
                error: 'Interaction type is required'
            });
        }
        
        // Update interaction count for the latest metrics record
        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_METRICS 
            SET INTERACTION_COUNT = ISNULL(INTERACTION_COUNT, 0) + 1,
                LAST_UPDATE_TIME = GETDATE()
            WHERE NOTICE_ID = ${noticeId} 
                AND USER_ID = ${req.userId} 
                AND COMPANY_ID = ${req.companyId}
                AND METRIC_ID = (
                    SELECT TOP 1 METRIC_ID 
                    FROM GUARDIAN.NOTICE_METRICS 
                    WHERE NOTICE_ID = ${noticeId} 
                        AND USER_ID = ${req.userId} 
                        AND COMPANY_ID = ${req.companyId}
                    ORDER BY VIEW_START_TIME DESC
                )
        `;
        
        console.log(`✅ Recorded interaction for notice ${noticeId}`);
        res.json({ 
            success: true,
            message: 'Interaction recorded'
        });
        
    } catch (error) {
        console.error('❌ Error recording notice interaction:', error);
        res.status(500).json({
            error: 'Failed to record interaction',
            message: error.message
        });
    }
});

// End view tracking with completion data
app.put('/api/notices/:id/analytics/end', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { completionStatus, finalScrollPercentage } = req.body;
        
        console.log(`📊 Ending view tracking for notice ${noticeId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Calculate view duration and update completion data
        const result = await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_METRICS 
            SET VIEW_END_TIME = GETDATE(),
                VIEW_DURATION_SECONDS = DATEDIFF(SECOND, VIEW_START_TIME, GETDATE()),
                COMPLETION_STATUS = ${completionStatus || 'partial'},
                SCROLL_PERCENTAGE = COALESCE(${finalScrollPercentage}, SCROLL_PERCENTAGE, 0),
                LAST_UPDATE_TIME = GETDATE()
            WHERE NOTICE_ID = ${noticeId} 
                AND USER_ID = ${req.userId} 
                AND COMPANY_ID = ${req.companyId}
                AND METRIC_ID = (
                    SELECT TOP 1 METRIC_ID 
                    FROM GUARDIAN.NOTICE_METRICS 
                    WHERE NOTICE_ID = ${noticeId} 
                        AND USER_ID = ${req.userId} 
                        AND COMPANY_ID = ${req.companyId}
                        AND VIEW_END_TIME IS NULL
                    ORDER BY VIEW_START_TIME DESC
                )
        `;
        
        console.log(`✅ Ended view tracking for notice ${noticeId}`);
        res.json({ 
            success: true,
            message: 'View tracking completed'
        });
        
    } catch (error) {
        console.error('❌ Error ending notice view tracking:', error);
        res.status(500).json({
            error: 'Failed to end view tracking',
            message: error.message
        });
    }
});

// Get analytics for specific notice (admin only)
app.get('/api/notices/:id/analytics', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        
        console.log(`📊 Fetching analytics for notice ${noticeId} (Company: ${req.companyId})`);
        
        if (!noticeId || isNaN(noticeId)) {
            return res.status(400).json({
                error: 'Valid notice ID is required'
            });
        }
        
        // Check if user has admin privileges (role 1 or 6)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID FROM GUARDIAN.USER_ROLES ur WHERE ur.USER_ID = ${req.userId}
        `;
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(1) || roleIds.includes(6);
        
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Access denied: Admin privileges required'
            });
        }
        
        // Verify notice exists and belongs to user's company
        const notice = await prisma.$queryRaw`
            SELECT NOTICE_ID, TITLE FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} AND COMPANY_ID = ${req.companyId}
        `;
        
        if (notice.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        // Get detailed analytics for the notice
        const analytics = await prisma.$queryRaw`
            SELECT 
                nm.METRIC_ID,
                nm.USER_ID,
                u.FIRST_NAME + ' ' + u.LAST_NAME as USER_NAME,
                nm.VIEW_START_TIME,
                nm.VIEW_END_TIME,
                nm.VIEW_DURATION_SECONDS,
                nm.SCROLL_PERCENTAGE,
                nm.DEVICE_TYPE,
                nm.REFERRER_SOURCE,
                nm.INTERACTION_COUNT,
                nm.COMPLETION_STATUS,
                nm.LAST_UPDATE_TIME
            FROM GUARDIAN.NOTICE_METRICS nm
            JOIN GUARDIAN.USERS u ON nm.USER_ID = u.USER_ID
            WHERE nm.NOTICE_ID = ${noticeId} 
                AND nm.COMPANY_ID = ${req.companyId}
            ORDER BY nm.VIEW_START_TIME DESC
        `;
        
        // Get summary statistics
        const summary = await prisma.$queryRaw`
            SELECT 
                COUNT(DISTINCT nm.USER_ID) as UNIQUE_VIEWERS,
                COUNT(*) as TOTAL_VIEWS,
                AVG(CAST(nm.VIEW_DURATION_SECONDS AS FLOAT)) as AVG_VIEW_DURATION,
                AVG(CAST(nm.SCROLL_PERCENTAGE AS FLOAT)) as AVG_SCROLL_PERCENTAGE,
                SUM(CAST(nm.INTERACTION_COUNT AS INT)) as TOTAL_INTERACTIONS,
                SUM(CASE WHEN nm.COMPLETION_STATUS = 'complete' THEN 1 ELSE 0 END) as COMPLETED_VIEWS,
                SUM(CASE WHEN nm.COMPLETION_STATUS = 'partial' THEN 1 ELSE 0 END) as PARTIAL_VIEWS
            FROM GUARDIAN.NOTICE_METRICS nm
            WHERE nm.NOTICE_ID = ${noticeId} 
                AND nm.COMPANY_ID = ${req.companyId}
        `;
        
        console.log(`✅ Retrieved analytics for notice ${noticeId}`);
        res.json({
            notice: notice[0],
            summary: summary[0] || {},
            details: analytics || []
        });
        
    } catch (error) {
        console.error('❌ Error fetching notice analytics:', error);
        res.status(500).json({
            error: 'Failed to fetch analytics',
            message: error.message
        });
    }
});

// Get company-wide notice analytics (admin only)
app.get('/api/notices/analytics/company', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📊 Fetching company-wide notice analytics (Company: ${req.companyId})`);
        
        // Check if user has admin privileges (role 1 or 6)
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID FROM GUARDIAN.USER_ROLES ur WHERE ur.USER_ID = ${req.userId}
        `;
        const roleIds = userRoles.map(role => role.ROLE_ID);
        const isAdmin = roleIds.includes(1) || roleIds.includes(6);
        
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Access denied: Admin privileges required'
            });
        }
        
        // Get overall company statistics
        const companySummary = await prisma.$queryRaw`
            SELECT 
                COUNT(DISTINCT nm.NOTICE_ID) as TOTAL_NOTICES_WITH_VIEWS,
                COUNT(DISTINCT nm.USER_ID) as UNIQUE_VIEWERS,
                COUNT(*) as TOTAL_VIEWS,
                AVG(CAST(nm.VIEW_DURATION_SECONDS AS FLOAT)) as AVG_VIEW_DURATION,
                AVG(CAST(nm.SCROLL_PERCENTAGE AS FLOAT)) as AVG_SCROLL_PERCENTAGE,
                SUM(CAST(nm.INTERACTION_COUNT AS INT)) as TOTAL_INTERACTIONS,
                SUM(CASE WHEN nm.COMPLETION_STATUS = 'complete' THEN 1 ELSE 0 END) as COMPLETED_VIEWS,
                SUM(CASE WHEN nm.COMPLETION_STATUS = 'partial' THEN 1 ELSE 0 END) as PARTIAL_VIEWS
            FROM GUARDIAN.NOTICE_METRICS nm
            WHERE nm.COMPANY_ID = ${req.companyId}
        `;
        
        // Get per-notice statistics
        const noticeStats = await prisma.$queryRaw`
            SELECT 
                n.NOTICE_ID,
                n.TITLE,
                n.CREATED_DATE,
                COUNT(DISTINCT nm.USER_ID) as UNIQUE_VIEWERS,
                COUNT(*) as TOTAL_VIEWS,
                AVG(CAST(nm.VIEW_DURATION_SECONDS AS FLOAT)) as AVG_VIEW_DURATION,
                AVG(CAST(nm.SCROLL_PERCENTAGE AS FLOAT)) as AVG_SCROLL_PERCENTAGE,
                SUM(CAST(nm.INTERACTION_COUNT AS INT)) as TOTAL_INTERACTIONS,
                SUM(CASE WHEN nm.COMPLETION_STATUS = 'complete' THEN 1 ELSE 0 END) as COMPLETED_VIEWS,
                SUM(CASE WHEN nm.COMPLETION_STATUS = 'partial' THEN 1 ELSE 0 END) as PARTIAL_VIEWS,
                MAX(nm.VIEW_START_TIME) as LAST_VIEWED
            FROM GUARDIAN.NOTICES n
            LEFT JOIN GUARDIAN.NOTICE_METRICS nm ON n.NOTICE_ID = nm.NOTICE_ID
            WHERE n.COMPANY_ID = ${req.companyId}
            GROUP BY n.NOTICE_ID, n.TITLE, n.CREATED_DATE
            ORDER BY LAST_VIEWED DESC, n.CREATED_DATE DESC
        `;
        
        // Get device type breakdown
        const deviceStats = await prisma.$queryRaw`
            SELECT 
                nm.DEVICE_TYPE,
                COUNT(*) as VIEW_COUNT,
                COUNT(DISTINCT nm.USER_ID) as UNIQUE_USERS
            FROM GUARDIAN.NOTICE_METRICS nm
            WHERE nm.COMPANY_ID = ${req.companyId}
            GROUP BY nm.DEVICE_TYPE
            ORDER BY VIEW_COUNT DESC
        `;
        
        console.log(`✅ Retrieved company-wide analytics for ${noticeStats.length} notices`);
        res.json({
            companySummary: companySummary[0] || {},
            noticeStats: noticeStats || [],
            deviceStats: deviceStats || []
        });
        
    } catch (error) {
        console.error('❌ Error fetching company analytics:', error);
        res.status(500).json({
            error: 'Failed to fetch company analytics',
            message: error.message
        });
    }
});

// ===== NOTICE RESPONSES API ENDPOINTS =====

// Create new notice response
app.post('/api/notices/:id/responses', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { responseType, responseMessage, requiresFollowup, followupPriority, isAnonymous } = req.body;
        
        console.log(`📝 Creating notice response for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Validate required fields
        if (!noticeId || !responseType) {
            return res.status(400).json({
                error: 'Notice ID and response type are required'
            });
        }
        
        // Validate response type
        const validResponseTypes = ['ACKNOWLEDGED', 'UNDERSTOOD', 'COMPLETED', 'REQUIRES_CLARIFICATION', 'CANNOT_COMPLY', 'NEEDS_EXTENSION', 'PARTIALLY_COMPLETED'];
        if (!validResponseTypes.includes(responseType)) {
            return res.status(400).json({
                error: 'Invalid response type'
            });
        }
        
        // Check if notice exists and user has access to it
        const noticeCheck = await prisma.$queryRaw`
            SELECT n.NOTICE_ID, n.STATUS, n.ISSUED_BY_USER_ID
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.NOTICE_RECIPIENTS nr ON n.NOTICE_ID = nr.NOTICE_ID
            WHERE n.NOTICE_ID = ${noticeId} 
                AND nr.USER_ID = ${req.userId}
                AND n.COMPANY_ID = ${req.companyId}
                AND n.STATUS = 'PUBLISHED'
        `;
        
        if (noticeCheck.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or you do not have permission to respond to it'
            });
        }
        
        const notice = noticeCheck[0];
        
        // Check if user already has an active response
        const existingResponse = await prisma.$queryRaw`
            SELECT NOTICE_RESPONSE_ID 
            FROM GUARDIAN.NOTICE_RESPONSES 
            WHERE NOTICE_ID = ${noticeId} 
                AND USER_ID = ${req.userId} 
                AND RESPONSE_STATUS = 'ACTIVE'
        `;
        
        if (existingResponse.length > 0) {
            return res.status(409).json({
                error: 'You have already responded to this notice. Use PUT to update your response.'
            });
        }
        
        // Create the response
        const result = await prisma.$executeRaw`
            INSERT INTO GUARDIAN.NOTICE_RESPONSES (
                NOTICE_ID,
                USER_ID,
                COMPANY_ID,
                RESPONSE_TYPE,
                RESPONSE_MESSAGE,
                REQUIRES_FOLLOWUP,
                FOLLOWUP_PRIORITY,
                IS_ANONYMOUS,
                CREATE_USER_ID,
                UPDATE_USER_ID
            ) VALUES (
                ${noticeId},
                ${req.userId},
                ${req.companyId},
                ${responseType},
                ${responseMessage || null},
                ${requiresFollowup ? 1 : 0},
                ${requiresFollowup && followupPriority ? followupPriority : null},
                ${isAnonymous ? 1 : 0},
                ${req.userId},
                ${req.userId}
            )
        `;
        
        // Get the created response
        const createdResponse = await prisma.$queryRaw`
            SELECT TOP 1 * 
            FROM GUARDIAN.NOTICE_RESPONSES 
            WHERE NOTICE_ID = ${noticeId} 
                AND USER_ID = ${req.userId} 
                AND RESPONSE_STATUS = 'ACTIVE'
            ORDER BY CREATE_DATE DESC
        `;
        
        // Create notification for notice issuer if response requires follow-up
        if (requiresFollowup && notice.ISSUED_BY_USER_ID !== req.userId) {
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.NOTIFICATIONS (
                    USER_ID, 
                    TYPE, 
                    TITLE, 
                    MESSAGE, 
                    REFERENCE_TYPE, 
                    REFERENCE_ID, 
                    COMPANY_ID
                ) VALUES (
                    ${notice.ISSUED_BY_USER_ID},
                    'notice_response_followup',
                    'Notice Response Requires Follow-up',
                    ${`A user has responded to your notice and requires follow-up action. Response type: ${responseType}`},
                    'notice_response',
                    ${createdResponse[0]?.NOTICE_RESPONSE_ID || null},
                    ${req.companyId}
                )
            `;
        }
        
        // Update notification sent flag
        if (requiresFollowup && notice.ISSUED_BY_USER_ID !== req.userId) {
            await prisma.$executeRaw`
                UPDATE GUARDIAN.NOTICE_RESPONSES 
                SET NOTIFICATION_SENT = 1, UPDATE_DATE = GETUTCDATE(), UPDATE_USER_ID = ${req.userId}
                WHERE NOTICE_RESPONSE_ID = ${createdResponse[0]?.NOTICE_RESPONSE_ID}
            `;
        }
        
        console.log(`✅ Created notice response successfully`);
        res.status(201).json({
            message: 'Response created successfully',
            response: createdResponse[0]
        });
        
    } catch (error) {
        console.error(`❌ Error creating notice response:`, error);
        res.status(500).json({
            error: 'Failed to create notice response',
            message: error.message
        });
    }
});

// Get all responses for a notice (admin only)
app.get('/api/notices/:id/responses', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        
        console.log(`📝 Fetching responses for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Check permissions (only admins or notice issuer can see all responses)
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        // Check if user is the issuer of the notice
        const noticeCheck = await prisma.$queryRaw`
            SELECT ISSUED_BY_USER_ID
            FROM GUARDIAN.NOTICES 
            WHERE NOTICE_ID = ${noticeId} 
                AND COMPANY_ID = ${req.companyId}
        `;
        
        if (noticeCheck.length === 0) {
            return res.status(404).json({
                error: 'Notice not found'
            });
        }
        
        const isIssuer = noticeCheck[0].ISSUED_BY_USER_ID === req.userId;
        
        if (!isAdmin && !isIssuer) {
            return res.status(403).json({
                error: 'Access denied. Only administrators or notice issuers can view all responses.'
            });
        }
        
        // Get all responses for the notice
        const responses = await prisma.$queryRawUnsafe(`
            SELECT 
                nr.NOTICE_RESPONSE_ID,
                nr.NOTICE_ID,
                nr.USER_ID,
                nr.RESPONSE_TYPE,
                nr.RESPONSE_MESSAGE,
                nr.RESPONSE_DATE,
                nr.RESPONSE_STATUS,
                nr.REQUIRES_FOLLOWUP,
                nr.FOLLOWUP_PRIORITY,
                nr.FOLLOWUP_ASSIGNED_TO,
                nr.FOLLOWUP_COMPLETED_DATE,
                nr.FOLLOWUP_NOTES,
                nr.IS_ANONYMOUS,
                nr.CREATE_DATE,
                CASE WHEN nr.IS_ANONYMOUS = 1 THEN 'Anonymous User' ELSE u.FULL_NAME END AS RESPONDER_NAME,
                CASE WHEN nr.IS_ANONYMOUS = 1 THEN NULL ELSE u.EMAIL END AS RESPONDER_EMAIL,
                fa.FULL_NAME AS FOLLOWUP_ASSIGNED_NAME
            FROM GUARDIAN.NOTICE_RESPONSES nr
            LEFT JOIN GUARDIAN.USERS u ON nr.USER_ID = u.USER_ID AND nr.IS_ANONYMOUS = 0
            LEFT JOIN GUARDIAN.USERS fa ON nr.FOLLOWUP_ASSIGNED_TO = fa.USER_ID
            WHERE nr.NOTICE_ID = ${noticeId}
                AND nr.COMPANY_ID = ${req.companyId}
            ORDER BY nr.CREATE_DATE DESC
        `);
        
        console.log(`✅ Found ${responses.length} responses for notice`);
        res.json(responses);
        
    } catch (error) {
        console.error(`❌ Error fetching notice responses:`, error);
        res.status(500).json({
            error: 'Failed to fetch notice responses',
            message: error.message
        });
    }
});

// Get current user's response for a notice
app.get('/api/notices/:id/responses/my', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        
        console.log(`📝 Fetching my response for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Check if notice exists and user has access to it
        const noticeCheck = await prisma.$queryRaw`
            SELECT n.NOTICE_ID
            FROM GUARDIAN.NOTICES n
            INNER JOIN GUARDIAN.NOTICE_RECIPIENTS nr ON n.NOTICE_ID = nr.NOTICE_ID
            WHERE n.NOTICE_ID = ${noticeId} 
                AND nr.USER_ID = ${req.userId}
                AND n.COMPANY_ID = ${req.companyId}
        `;
        
        if (noticeCheck.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or you do not have access to it'
            });
        }
        
        // Get user's response
        const response = await prisma.$queryRaw`
            SELECT 
                NOTICE_RESPONSE_ID,
                NOTICE_ID,
                RESPONSE_TYPE,
                RESPONSE_MESSAGE,
                RESPONSE_DATE,
                RESPONSE_STATUS,
                REQUIRES_FOLLOWUP,
                FOLLOWUP_PRIORITY,
                IS_ANONYMOUS,
                CREATE_DATE,
                UPDATE_DATE
            FROM GUARDIAN.NOTICE_RESPONSES
            WHERE NOTICE_ID = ${noticeId}
                AND USER_ID = ${req.userId}
                AND COMPANY_ID = ${req.companyId}
                AND RESPONSE_STATUS = 'ACTIVE'
        `;
        
        console.log(`✅ Retrieved user's response for notice`);
        res.json(response[0] || null);
        
    } catch (error) {
        console.error(`❌ Error fetching user's notice response:`, error);
        res.status(500).json({
            error: 'Failed to fetch your response',
            message: error.message
        });
    }
});

// Update existing notice response
app.put('/api/notices/:id/responses/:responseId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const responseId = parseInt(req.params.responseId);
        const { responseType, responseMessage, requiresFollowup, followupPriority, isAnonymous } = req.body;
        
        console.log(`📝 Updating notice response ${responseId} for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Validate response type
        if (responseType) {
            const validResponseTypes = ['ACKNOWLEDGED', 'UNDERSTOOD', 'COMPLETED', 'REQUIRES_CLARIFICATION', 'CANNOT_COMPLY', 'NEEDS_EXTENSION', 'PARTIALLY_COMPLETED'];
            if (!validResponseTypes.includes(responseType)) {
                return res.status(400).json({
                    error: 'Invalid response type'
                });
            }
        }
        
        // Check if response exists and belongs to user
        const responseCheck = await prisma.$queryRaw`
            SELECT nr.NOTICE_RESPONSE_ID, nr.USER_ID, nr.REQUIRES_FOLLOWUP, n.ISSUED_BY_USER_ID
            FROM GUARDIAN.NOTICE_RESPONSES nr
            INNER JOIN GUARDIAN.NOTICES n ON nr.NOTICE_ID = n.NOTICE_ID
            WHERE nr.NOTICE_RESPONSE_ID = ${responseId}
                AND nr.NOTICE_ID = ${noticeId}
                AND nr.USER_ID = ${req.userId}
                AND nr.COMPANY_ID = ${req.companyId}
                AND nr.RESPONSE_STATUS = 'ACTIVE'
        `;
        
        if (responseCheck.length === 0) {
            return res.status(404).json({
                error: 'Response not found or you do not have permission to update it'
            });
        }
        
        const existingResponse = responseCheck[0];
        const wasRequiringFollowup = existingResponse.REQUIRES_FOLLOWUP;
        const noticeIssuerId = existingResponse.ISSUED_BY_USER_ID;
        
        // Update the response
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_RESPONSES 
            SET 
                RESPONSE_TYPE = ${responseType || null},
                RESPONSE_MESSAGE = ${responseMessage || null},
                REQUIRES_FOLLOWUP = ${requiresFollowup !== undefined ? (requiresFollowup ? 1 : 0) : null},
                FOLLOWUP_PRIORITY = ${(requiresFollowup && followupPriority) ? followupPriority : null},
                IS_ANONYMOUS = ${isAnonymous !== undefined ? (isAnonymous ? 1 : 0) : null},
                UPDATE_DATE = GETUTCDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE NOTICE_RESPONSE_ID = ${responseId}
        `;
        
        // Create notification if followup requirement changed from false to true
        if (!wasRequiringFollowup && requiresFollowup && noticeIssuerId !== req.userId) {
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.NOTIFICATIONS (
                    USER_ID, 
                    TYPE, 
                    TITLE, 
                    MESSAGE, 
                    REFERENCE_TYPE, 
                    REFERENCE_ID, 
                    COMPANY_ID
                ) VALUES (
                    ${noticeIssuerId},
                    'notice_response_followup',
                    'Notice Response Requires Follow-up',
                    ${`A user has updated their response to your notice and now requires follow-up action. Response type: ${responseType}`},
                    'notice_response',
                    ${responseId},
                    ${req.companyId}
                )
            `;
            
            // Update notification sent flag
            await prisma.$executeRaw`
                UPDATE GUARDIAN.NOTICE_RESPONSES 
                SET NOTIFICATION_SENT = 1
                WHERE NOTICE_RESPONSE_ID = ${responseId}
            `;
        }
        
        // Get updated response
        const updatedResponse = await prisma.$queryRaw`
            SELECT * 
            FROM GUARDIAN.NOTICE_RESPONSES 
            WHERE NOTICE_RESPONSE_ID = ${responseId}
        `;
        
        console.log(`✅ Updated notice response successfully`);
        res.json({
            message: 'Response updated successfully',
            response: updatedResponse[0]
        });
        
    } catch (error) {
        console.error(`❌ Error updating notice response:`, error);
        res.status(500).json({
            error: 'Failed to update notice response',
            message: error.message
        });
    }
});

// Delete/withdraw notice response
app.delete('/api/notices/:id/responses/:responseId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const responseId = parseInt(req.params.responseId);
        
        console.log(`🗑️ Withdrawing notice response ${responseId} for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Check if response exists and belongs to user
        const responseCheck = await prisma.$queryRaw`
            SELECT NOTICE_RESPONSE_ID, USER_ID
            FROM GUARDIAN.NOTICE_RESPONSES
            WHERE NOTICE_RESPONSE_ID = ${responseId}
                AND NOTICE_ID = ${noticeId}
                AND USER_ID = ${req.userId}
                AND COMPANY_ID = ${req.companyId}
                AND RESPONSE_STATUS = 'ACTIVE'
        `;
        
        if (responseCheck.length === 0) {
            return res.status(404).json({
                error: 'Response not found or you do not have permission to withdraw it'
            });
        }
        
        // Mark response as withdrawn instead of deleting
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_RESPONSES 
            SET 
                RESPONSE_STATUS = 'WITHDRAWN',
                UPDATE_DATE = GETUTCDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE NOTICE_RESPONSE_ID = ${responseId}
        `;
        
        console.log(`✅ Withdrew notice response successfully`);
        res.json({
            message: 'Response withdrawn successfully'
        });
        
    } catch (error) {
        console.error(`❌ Error withdrawing notice response:`, error);
        res.status(500).json({
            error: 'Failed to withdraw notice response',
            message: error.message
        });
    }
});

// Get responses requiring follow-up (admin only)
app.get('/api/responses/followups', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📝 Fetching responses requiring follow-up for user ${req.userId} (Company: ${req.companyId})`);
        
        // Check permissions
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const hasPermission = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to view follow-up responses.'
            });
        }
        
        const { status, priority, assignedTo } = req.query;
        
        let whereClause = 'WHERE nr.REQUIRES_FOLLOWUP = 1 AND nr.COMPANY_ID = ${req.companyId}';
        const params = [req.companyId];
        
        if (status === 'pending') {
            whereClause += ' AND nr.FOLLOWUP_COMPLETED_DATE IS NULL';
        } else if (status === 'completed') {
            whereClause += ' AND nr.FOLLOWUP_COMPLETED_DATE IS NOT NULL';
        }
        
        if (priority) {
            whereClause += ` AND nr.FOLLOWUP_PRIORITY = '${priority}'`;
        }
        
        if (assignedTo) {
            if (assignedTo === 'me') {
                whereClause += ` AND nr.FOLLOWUP_ASSIGNED_TO = ${req.userId}`;
            } else if (assignedTo === 'unassigned') {
                whereClause += ' AND nr.FOLLOWUP_ASSIGNED_TO IS NULL';
            } else {
                const assignedUserId = parseInt(assignedTo);
                if (!isNaN(assignedUserId)) {
                    whereClause += ` AND nr.FOLLOWUP_ASSIGNED_TO = ${assignedUserId}`;
                }
            }
        }
        
        const responses = await prisma.$queryRawUnsafe(`
            SELECT 
                nr.NOTICE_RESPONSE_ID,
                nr.NOTICE_ID,
                nr.USER_ID,
                nr.RESPONSE_TYPE,
                nr.RESPONSE_MESSAGE,
                nr.RESPONSE_DATE,
                nr.FOLLOWUP_PRIORITY,
                nr.FOLLOWUP_ASSIGNED_TO,
                nr.FOLLOWUP_COMPLETED_DATE,
                nr.FOLLOWUP_NOTES,
                nr.IS_ANONYMOUS,
                n.TITLE AS NOTICE_TITLE,
                n.ISSUED_BY_USER_ID,
                issuer.FULL_NAME AS ISSUED_BY_NAME,
                CASE WHEN nr.IS_ANONYMOUS = 1 THEN 'Anonymous User' ELSE u.FULL_NAME END AS RESPONDER_NAME,
                CASE WHEN nr.IS_ANONYMOUS = 1 THEN NULL ELSE u.EMAIL END AS RESPONDER_EMAIL,
                fa.FULL_NAME AS FOLLOWUP_ASSIGNED_NAME
            FROM GUARDIAN.NOTICE_RESPONSES nr
            INNER JOIN GUARDIAN.NOTICES n ON nr.NOTICE_ID = n.NOTICE_ID
            LEFT JOIN GUARDIAN.USERS u ON nr.USER_ID = u.USER_ID AND nr.IS_ANONYMOUS = 0
            LEFT JOIN GUARDIAN.USERS issuer ON n.ISSUED_BY_USER_ID = issuer.USER_ID
            LEFT JOIN GUARDIAN.USERS fa ON nr.FOLLOWUP_ASSIGNED_TO = fa.USER_ID
            ${whereClause}
            ORDER BY 
                CASE nr.FOLLOWUP_PRIORITY 
                    WHEN 'HIGH' THEN 1 
                    WHEN 'MEDIUM' THEN 2 
                    WHEN 'LOW' THEN 3 
                    ELSE 4 
                END,
                nr.RESPONSE_DATE ASC
        `);
        
        console.log(`✅ Found ${responses.length} responses requiring follow-up`);
        res.json(responses);
        
    } catch (error) {
        console.error(`❌ Error fetching follow-up responses:`, error);
        res.status(500).json({
            error: 'Failed to fetch follow-up responses',
            message: error.message
        });
    }
});

// Update follow-up status (admin only)
app.put('/api/responses/:responseId/followup', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const responseId = parseInt(req.params.responseId);
        const { assignedTo, priority, notes, completed } = req.body;
        
        console.log(`📝 Updating follow-up for response ${responseId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Check permissions
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const hasPermission = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        if (!hasPermission) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions to update follow-up status.'
            });
        }
        
        // Check if response exists and requires follow-up
        const responseCheck = await prisma.$queryRaw`
            SELECT NOTICE_RESPONSE_ID, REQUIRES_FOLLOWUP, FOLLOWUP_ASSIGNED_TO
            FROM GUARDIAN.NOTICE_RESPONSES
            WHERE NOTICE_RESPONSE_ID = ${responseId}
                AND COMPANY_ID = ${req.companyId}
                AND REQUIRES_FOLLOWUP = 1
        `;
        
        if (responseCheck.length === 0) {
            return res.status(404).json({
                error: 'Response not found or does not require follow-up'
            });
        }
        
        const existingResponse = responseCheck[0];
        
        // Validate assignedTo user exists in same company if provided
        if (assignedTo) {
            const userCheck = await prisma.$queryRaw`
                SELECT USER_ID 
                FROM GUARDIAN.USERS 
                WHERE USER_ID = ${assignedTo} 
                    AND COMPANY_ID = ${req.companyId}
            `;
            
            if (userCheck.length === 0) {
                return res.status(400).json({
                    error: 'Assigned user not found or not in same company'
                });
            }
        }
        
        // Update follow-up details
        let updateQuery = `
            UPDATE GUARDIAN.NOTICE_RESPONSES 
            SET 
                UPDATE_DATE = GETUTCDATE(),
                UPDATE_USER_ID = ${req.userId}
        `;
        
        if (assignedTo !== undefined) {
            updateQuery += `, FOLLOWUP_ASSIGNED_TO = ${assignedTo || null}`;
        }
        
        if (priority !== undefined) {
            const validPriorities = ['HIGH', 'MEDIUM', 'LOW'];
            if (priority && !validPriorities.includes(priority)) {
                return res.status(400).json({
                    error: 'Invalid priority level'
                });
            }
            updateQuery += `, FOLLOWUP_PRIORITY = ${priority ? `'${priority}'` : 'NULL'}`;
        }
        
        if (notes !== undefined) {
            updateQuery += `, FOLLOWUP_NOTES = ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}`;
        }
        
        if (completed === true) {
            updateQuery += `, FOLLOWUP_COMPLETED_DATE = GETUTCDATE()`;
        } else if (completed === false) {
            updateQuery += `, FOLLOWUP_COMPLETED_DATE = NULL`;
        }
        
        updateQuery += ` WHERE NOTICE_RESPONSE_ID = ${responseId}`;
        
        await prisma.$queryRawUnsafe(updateQuery);
        
        // Create notification if newly assigned to someone other than current user
        if (assignedTo && assignedTo !== req.userId && assignedTo !== existingResponse.FOLLOWUP_ASSIGNED_TO) {
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.NOTIFICATIONS (
                    USER_ID, 
                    TYPE, 
                    TITLE, 
                    MESSAGE, 
                    REFERENCE_TYPE, 
                    REFERENCE_ID, 
                    COMPANY_ID
                ) VALUES (
                    ${assignedTo},
                    'followup_assignment',
                    'Follow-up Assignment',
                    'You have been assigned to follow up on a notice response.',
                    'notice_response',
                    ${responseId},
                    ${req.companyId}
                )
            `;
        }
        
        // Get updated response
        const updatedResponse = await prisma.$queryRaw`
            SELECT 
                nr.*,
                fa.FULL_NAME AS FOLLOWUP_ASSIGNED_NAME
            FROM GUARDIAN.NOTICE_RESPONSES nr
            LEFT JOIN GUARDIAN.USERS fa ON nr.FOLLOWUP_ASSIGNED_TO = fa.USER_ID
            WHERE nr.NOTICE_RESPONSE_ID = ${responseId}
        `;
        
        console.log(`✅ Updated follow-up status successfully`);
        res.json({
            message: 'Follow-up updated successfully',
            response: updatedResponse[0]
        });
        
    } catch (error) {
        console.error(`❌ Error updating follow-up status:`, error);
        res.status(500).json({
            error: 'Failed to update follow-up status',
            message: error.message
        });
    }
});

// =============================================================================
// NOTICE UPDATES & THREADING API ENDPOINTS
// =============================================================================

// Get threaded updates for a notice
app.get('/api/notices/:id/updates', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { threadId, includeAcknowledgments } = req.query;
        
        console.log(`📄 Fetching updates for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Verify notice exists and user has access
        const noticeCheck = await prisma.$queryRaw`
            SELECT NOTICE_ID, TITLE
            FROM GUARDIAN.NOTICES
            WHERE NOTICE_ID = ${noticeId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        if (noticeCheck.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        // Build query for updates with threading
        let whereClause = `WHERE nu.NOTICE_ID = ${noticeId} AND nu.COMPANY_ID = ${req.companyId}`;
        
        if (threadId) {
            whereClause += ` AND (nu.UPDATE_ID = ${threadId} OR nu.PARENT_UPDATE_ID = ${threadId})`;
        }
        
        // Fetch updates with user info and threading
        const updates = await prisma.$queryRaw`
            WITH UpdateTree AS (
                SELECT 
                    nu.*,
                    u.FULL_NAME AS AUTHOR_NAME,
                    u.EMAIL AS AUTHOR_EMAIL,
                    ur.ROLE_ID AS AUTHOR_ROLE_ID,
                    r.ROLE_NAME AS AUTHOR_ROLE_NAME,
                    0 as REPLY_COUNT,
                    nu.THREAD_LEVEL,
                    nu.PARENT_UPDATE_ID
                FROM GUARDIAN.NOTICE_UPDATES nu
                INNER JOIN GUARDIAN.USERS u ON nu.CREATED_BY = u.USER_ID
                LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
                LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
                ${whereClause}
            )
            SELECT 
                ut.*,
                (
                    SELECT COUNT(*)
                    FROM GUARDIAN.NOTICE_UPDATES replies
                    WHERE replies.PARENT_UPDATE_ID = ut.UPDATE_ID
                        AND replies.COMPANY_ID = ${req.companyId}
                ) AS REPLY_COUNT,
                (
                    SELECT COUNT(*)
                    FROM GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS ack
                    WHERE ack.UPDATE_ID = ut.UPDATE_ID
                        AND ack.COMPANY_ID = ${req.companyId}
                ) AS ACKNOWLEDGMENT_COUNT,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS my_ack
                        WHERE my_ack.UPDATE_ID = ut.UPDATE_ID 
                            AND my_ack.USER_ID = ${req.userId}
                            AND my_ack.COMPANY_ID = ${req.companyId}
                    ) THEN 1 
                    ELSE 0 
                END AS USER_ACKNOWLEDGED
            FROM UpdateTree ut
            ORDER BY ut.THREAD_LEVEL ASC, ut.CREATED_DATE ASC
        `;
        
        // Get acknowledgments if requested
        let acknowledgments = [];
        if (includeAcknowledgments === 'true') {
            acknowledgments = await prisma.$queryRaw`
                SELECT 
                    ack.UPDATE_ID,
                    ack.USER_ID,
                    u.FULL_NAME AS USER_NAME,
                    u.EMAIL AS USER_EMAIL,
                    ack.ACKNOWLEDGED_DATE,
                    ack.ACKNOWLEDGMENT_TYPE
                FROM GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS ack
                INNER JOIN GUARDIAN.USERS u ON ack.USER_ID = u.USER_ID
                WHERE ack.UPDATE_ID IN (${updates.map(u => u.UPDATE_ID).join(',')})
                    AND ack.COMPANY_ID = ${req.companyId}
                ORDER BY ack.ACKNOWLEDGED_DATE ASC
            `;
        }
        
        // Increment view count for the notice
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_UPDATES 
            SET VIEW_COUNT = ISNULL(VIEW_COUNT, 0) + 1
            WHERE NOTICE_ID = ${noticeId} 
                AND CREATED_BY != ${req.userId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        console.log(`✅ Retrieved ${updates.length} updates for notice ${noticeId}`);
        res.json({
            updates,
            acknowledgments: acknowledgments || [],
            notice: noticeCheck[0]
        });
        
    } catch (error) {
        console.error(`❌ Error fetching notice updates:`, error);
        res.status(500).json({
            error: 'Failed to fetch notice updates',
            message: error.message
        });
    }
});

// Create new update or reply
app.post('/api/notices/:id/updates', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const { 
            content, 
            updateType = 'UPDATE', 
            parentUpdateId, 
            visibilityScope = 'COMPANY',
            taggedUsers = [],
            isPinned = false
        } = req.body;
        
        console.log(`💬 Creating update for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Validate required fields
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                error: 'Update content is required'
            });
        }
        
        // Verify notice exists and user has access
        const noticeCheck = await prisma.$queryRaw`
            SELECT NOTICE_ID, STATUS, CREATED_BY
            FROM GUARDIAN.NOTICES
            WHERE NOTICE_ID = ${noticeId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        if (noticeCheck.length === 0) {
            return res.status(404).json({
                error: 'Notice not found or access denied'
            });
        }
        
        const notice = noticeCheck[0];
        
        // Check if notice is still active (allow updates on published notices)
        if (notice.STATUS === 'CANCELLED') {
            return res.status(400).json({
                error: 'Cannot add updates to cancelled notices'
            });
        }
        
        // Determine thread level
        let threadLevel = 0;
        let parentUpdate = null;
        
        if (parentUpdateId) {
            const parentCheck = await prisma.$queryRaw`
                SELECT UPDATE_ID, THREAD_LEVEL, NOTICE_ID
                FROM GUARDIAN.NOTICE_UPDATES
                WHERE UPDATE_ID = ${parentUpdateId}
                    AND NOTICE_ID = ${noticeId}
                    AND COMPANY_ID = ${req.companyId}
            `;
            
            if (parentCheck.length === 0) {
                return res.status(400).json({
                    error: 'Parent update not found'
                });
            }
            
            parentUpdate = parentCheck[0];
            threadLevel = parentUpdate.THREAD_LEVEL + 1;
            
            // Limit thread depth to prevent excessive nesting
            if (threadLevel > 5) {
                return res.status(400).json({
                    error: 'Maximum thread depth exceeded'
                });
            }
        }
        
        // Check admin permissions for certain operations
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        // Only admins can pin updates or use certain update types
        if (isPinned && !isAdmin) {
            return res.status(403).json({
                error: 'Only administrators can pin updates'
            });
        }
        
        if (['ANNOUNCEMENT', 'AMENDMENT'].includes(updateType) && !isAdmin) {
            return res.status(403).json({
                error: 'Only administrators can create announcements or amendments'
            });
        }
        
        // Create the update
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.NOTICE_UPDATES (
                NOTICE_ID,
                CONTENT,
                UPDATE_TYPE,
                PARENT_UPDATE_ID,
                THREAD_LEVEL,
                VISIBILITY_SCOPE,
                CREATED_BY,
                CREATED_DATE,
                COMPANY_ID,
                IS_PINNED,
                VIEW_COUNT
            ) 
            OUTPUT INSERTED.UPDATE_ID
            VALUES (
                ${noticeId},
                ${content.trim()},
                ${updateType},
                ${parentUpdateId || null},
                ${threadLevel},
                ${visibilityScope},
                ${req.userId},
                GETUTCDATE(),
                ${req.companyId},
                ${isPinned ? 1 : 0},
                0
            )
        `;
        
        const updateId = result[0].UPDATE_ID;
        
        // Handle user tagging and notifications
        if (taggedUsers.length > 0) {
            for (const taggedUserId of taggedUsers) {
                // Verify tagged user exists in same company
                const userCheck = await prisma.$queryRaw`
                    SELECT USER_ID, FULL_NAME
                    FROM GUARDIAN.USERS
                    WHERE USER_ID = ${taggedUserId}
                        AND COMPANY_ID = ${req.companyId}
                `;
                
                if (userCheck.length > 0) {
                    // Create notification for tagged user
                    await prisma.$executeRaw`
                        INSERT INTO GUARDIAN.NOTIFICATIONS (
                            USER_ID,
                            TYPE,
                            TITLE,
                            MESSAGE,
                            REFERENCE_TYPE,
                            REFERENCE_ID,
                            COMPANY_ID
                        ) VALUES (
                            ${taggedUserId},
                            'notice_update_mention',
                            'You were mentioned in a notice update',
                            ${`You were mentioned in an update on notice: ${notice.TITLE || 'Notice'}`},
                            'notice_update',
                            ${updateId},
                            ${req.companyId}
                        )
                    `;
                }
            }
        }
        
        // Create notification for parent update author if this is a reply
        if (parentUpdate && parentUpdate.CREATED_BY !== req.userId) {
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.NOTIFICATIONS (
                    USER_ID,
                    TYPE,
                    TITLE,
                    MESSAGE,
                    REFERENCE_TYPE,
                    REFERENCE_ID,
                    COMPANY_ID
                ) VALUES (
                    ${parentUpdate.CREATED_BY},
                    'notice_update_reply',
                    'Reply to your update',
                    'Someone replied to your update on a notice',
                    'notice_update',
                    ${updateId},
                    ${req.companyId}
                )
            `;
        }
        
        // Get the created update with user info
        const createdUpdate = await prisma.$queryRaw`
            SELECT 
                nu.*,
                u.FULL_NAME AS AUTHOR_NAME,
                u.EMAIL AS AUTHOR_EMAIL,
                ur.ROLE_ID AS AUTHOR_ROLE_ID,
                r.ROLE_NAME AS AUTHOR_ROLE_NAME
            FROM GUARDIAN.NOTICE_UPDATES nu
            INNER JOIN GUARDIAN.USERS u ON nu.CREATED_BY = u.USER_ID
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE nu.UPDATE_ID = ${updateId}
        `;
        
        console.log(`✅ Created notice update ${updateId} successfully`);
        res.status(201).json({
            message: 'Update created successfully',
            update: createdUpdate[0]
        });
        
    } catch (error) {
        console.error(`❌ Error creating notice update:`, error);
        res.status(500).json({
            error: 'Failed to create notice update',
            message: error.message
        });
    }
});

// Edit existing update
app.put('/api/notices/:id/updates/:updateId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const updateId = parseInt(req.params.updateId);
        const { content, updateType } = req.body;
        
        console.log(`✏️ Editing update ${updateId} for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Validate content
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                error: 'Update content is required'
            });
        }
        
        // Check if update exists and user has permission to edit
        const updateCheck = await prisma.$queryRaw`
            SELECT 
                nu.UPDATE_ID, 
                nu.CREATED_BY, 
                nu.CREATED_DATE,
                nu.UPDATE_TYPE,
                n.CREATED_BY as NOTICE_CREATOR
            FROM GUARDIAN.NOTICE_UPDATES nu
            INNER JOIN GUARDIAN.NOTICES n ON nu.NOTICE_ID = n.NOTICE_ID
            WHERE nu.UPDATE_ID = ${updateId}
                AND nu.NOTICE_ID = ${noticeId}
                AND nu.COMPANY_ID = ${req.companyId}
        `;
        
        if (updateCheck.length === 0) {
            return res.status(404).json({
                error: 'Update not found'
            });
        }
        
        const update = updateCheck[0];
        
        // Check edit permissions
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        const isAuthor = update.CREATED_BY === req.userId;
        const isNoticeCreator = update.NOTICE_CREATOR === req.userId;
        
        // Allow edit if: user is author, admin, or notice creator
        if (!isAuthor && !isAdmin && !isNoticeCreator) {
            return res.status(403).json({
                error: 'You do not have permission to edit this update'
            });
        }
        
        // Check edit time limit (24 hours for non-admins)
        if (!isAdmin) {
            const hoursSinceCreation = (Date.now() - new Date(update.CREATED_DATE).getTime()) / (1000 * 60 * 60);
            if (hoursSinceCreation > 24) {
                return res.status(403).json({
                    error: 'Updates can only be edited within 24 hours of creation'
                });
            }
        }
        
        // Update the content
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_UPDATES 
            SET 
                CONTENT = ${content.trim()},
                UPDATE_TYPE = ${updateType || update.UPDATE_TYPE},
                UPDATED_DATE = GETUTCDATE(),
                UPDATED_BY = ${req.userId}
            WHERE UPDATE_ID = ${updateId}
        `;
        
        // Get updated record
        const updatedRecord = await prisma.$queryRaw`
            SELECT 
                nu.*,
                u.FULL_NAME AS AUTHOR_NAME,
                u.EMAIL AS AUTHOR_EMAIL,
                uu.FULL_NAME AS UPDATED_BY_NAME
            FROM GUARDIAN.NOTICE_UPDATES nu
            INNER JOIN GUARDIAN.USERS u ON nu.CREATED_BY = u.USER_ID
            LEFT JOIN GUARDIAN.USERS uu ON nu.UPDATED_BY = uu.USER_ID
            WHERE nu.UPDATE_ID = ${updateId}
        `;
        
        console.log(`✅ Updated notice update ${updateId} successfully`);
        res.json({
            message: 'Update edited successfully',
            update: updatedRecord[0]
        });
        
    } catch (error) {
        console.error(`❌ Error editing notice update:`, error);
        res.status(500).json({
            error: 'Failed to edit notice update',
            message: error.message
        });
    }
});

// Delete/hide update (admin only)
app.delete('/api/notices/:id/updates/:updateId', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const updateId = parseInt(req.params.updateId);
        
        console.log(`🗑️ Deleting update ${updateId} for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Check admin permissions
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Only administrators can delete updates'
            });
        }
        
        // Check if update exists
        const updateCheck = await prisma.$queryRaw`
            SELECT UPDATE_ID, CREATED_BY
            FROM GUARDIAN.NOTICE_UPDATES
            WHERE UPDATE_ID = ${updateId}
                AND NOTICE_ID = ${noticeId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        if (updateCheck.length === 0) {
            return res.status(404).json({
                error: 'Update not found'
            });
        }
        
        // Soft delete by marking as hidden instead of actual deletion
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_UPDATES 
            SET 
                IS_HIDDEN = 1,
                HIDDEN_DATE = GETUTCDATE(),
                HIDDEN_BY = ${req.userId}
            WHERE UPDATE_ID = ${updateId}
        `;
        
        console.log(`✅ Marked update ${updateId} as hidden successfully`);
        res.json({
            message: 'Update hidden successfully'
        });
        
    } catch (error) {
        console.error(`❌ Error deleting notice update:`, error);
        res.status(500).json({
            error: 'Failed to delete notice update',
            message: error.message
        });
    }
});

// Acknowledge update
app.post('/api/notices/:id/updates/:updateId/acknowledge', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const updateId = parseInt(req.params.updateId);
        const { acknowledgmentType = 'READ' } = req.body;
        
        console.log(`👍 Acknowledging update ${updateId} for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Verify update exists
        const updateCheck = await prisma.$queryRaw`
            SELECT UPDATE_ID, CREATED_BY
            FROM GUARDIAN.NOTICE_UPDATES
            WHERE UPDATE_ID = ${updateId}
                AND NOTICE_ID = ${noticeId}
                AND COMPANY_ID = ${req.companyId}
                AND IS_HIDDEN != 1
        `;
        
        if (updateCheck.length === 0) {
            return res.status(404).json({
                error: 'Update not found'
            });
        }
        
        // Check if already acknowledged
        const existingAck = await prisma.$queryRaw`
            SELECT ACKNOWLEDGMENT_ID
            FROM GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS
            WHERE UPDATE_ID = ${updateId}
                AND USER_ID = ${req.userId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        if (existingAck.length > 0) {
            // Update existing acknowledgment
            await prisma.$executeRaw`
                UPDATE GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS 
                SET 
                    ACKNOWLEDGMENT_TYPE = ${acknowledgmentType},
                    ACKNOWLEDGED_DATE = GETUTCDATE()
                WHERE UPDATE_ID = ${updateId}
                    AND USER_ID = ${req.userId}
                    AND COMPANY_ID = ${req.companyId}
            `;
        } else {
            // Create new acknowledgment
            await prisma.$executeRaw`
                INSERT INTO GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS (
                    UPDATE_ID,
                    USER_ID,
                    ACKNOWLEDGMENT_TYPE,
                    ACKNOWLEDGED_DATE,
                    COMPANY_ID
                ) VALUES (
                    ${updateId},
                    ${req.userId},
                    ${acknowledgmentType},
                    GETUTCDATE(),
                    ${req.companyId}
                )
            `;
        }
        
        // Get acknowledgment count
        const ackCount = await prisma.$queryRaw`
            SELECT COUNT(*) as ACK_COUNT
            FROM GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS
            WHERE UPDATE_ID = ${updateId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        console.log(`✅ Acknowledged update ${updateId} successfully`);
        res.json({
            message: 'Update acknowledged successfully',
            acknowledgmentCount: ackCount[0].ACK_COUNT
        });
        
    } catch (error) {
        console.error(`❌ Error acknowledging notice update:`, error);
        res.status(500).json({
            error: 'Failed to acknowledge notice update',
            message: error.message
        });
    }
});

// Pin/unpin update (admin only)
app.post('/api/notices/:id/updates/:updateId/pin', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const noticeId = parseInt(req.params.id);
        const updateId = parseInt(req.params.updateId);
        const { isPinned } = req.body;
        
        console.log(`📌 ${isPinned ? 'Pinning' : 'Unpinning'} update ${updateId} for notice ${noticeId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Check admin permissions
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Only administrators can pin/unpin updates'
            });
        }
        
        // Verify update exists
        const updateCheck = await prisma.$queryRaw`
            SELECT UPDATE_ID
            FROM GUARDIAN.NOTICE_UPDATES
            WHERE UPDATE_ID = ${updateId}
                AND NOTICE_ID = ${noticeId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        if (updateCheck.length === 0) {
            return res.status(404).json({
                error: 'Update not found'
            });
        }
        
        // Update pin status
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_UPDATES 
            SET 
                IS_PINNED = ${isPinned ? 1 : 0},
                PINNED_DATE = ${isPinned ? 'GETUTCDATE()' : 'NULL'},
                PINNED_BY = ${isPinned ? req.userId : 'NULL'}
            WHERE UPDATE_ID = ${updateId}
        `;
        
        console.log(`✅ ${isPinned ? 'Pinned' : 'Unpinned'} update ${updateId} successfully`);
        res.json({
            message: `Update ${isPinned ? 'pinned' : 'unpinned'} successfully`
        });
        
    } catch (error) {
        console.error(`❌ Error pinning/unpinning notice update:`, error);
        res.status(500).json({
            error: 'Failed to pin/unpin notice update',
            message: error.message
        });
    }
});

// Get company-wide updates feed (admin only)
app.get('/api/updates/company', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📊 Fetching company-wide updates feed for user ${req.userId} (Company: ${req.companyId})`);
        
        // Check admin permissions
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Access denied. Administrator privileges required.'
            });
        }
        
        const { 
            limit = 50, 
            offset = 0, 
            updateType, 
            startDate, 
            endDate,
            authorId 
        } = req.query;
        
        // Build where clause
        let whereClause = `WHERE nu.COMPANY_ID = ${req.companyId} AND nu.IS_HIDDEN != 1`;
        
        if (updateType) {
            whereClause += ` AND nu.UPDATE_TYPE = '${updateType}'`;
        }
        
        if (startDate) {
            whereClause += ` AND nu.CREATED_DATE >= '${startDate}'`;
        }
        
        if (endDate) {
            whereClause += ` AND nu.CREATED_DATE <= '${endDate}'`;
        }
        
        if (authorId) {
            whereClause += ` AND nu.CREATED_BY = ${authorId}`;
        }
        
        // Get updates with notice and user info
        const updates = await prisma.$queryRaw`
            SELECT 
                nu.*,
                n.TITLE AS NOTICE_TITLE,
                n.STATUS AS NOTICE_STATUS,
                u.FULL_NAME AS AUTHOR_NAME,
                u.EMAIL AS AUTHOR_EMAIL,
                ur.ROLE_ID AS AUTHOR_ROLE_ID,
                r.ROLE_NAME AS AUTHOR_ROLE_NAME,
                (
                    SELECT COUNT(*)
                    FROM GUARDIAN.NOTICE_UPDATE_ACKNOWLEDGMENTS ack
                    WHERE ack.UPDATE_ID = nu.UPDATE_ID
                        AND ack.COMPANY_ID = ${req.companyId}
                ) AS ACKNOWLEDGMENT_COUNT,
                (
                    SELECT COUNT(*)
                    FROM GUARDIAN.NOTICE_UPDATES replies
                    WHERE replies.PARENT_UPDATE_ID = nu.UPDATE_ID
                        AND replies.COMPANY_ID = ${req.companyId}
                ) AS REPLY_COUNT
            FROM GUARDIAN.NOTICE_UPDATES nu
            INNER JOIN GUARDIAN.NOTICES n ON nu.NOTICE_ID = n.NOTICE_ID
            INNER JOIN GUARDIAN.USERS u ON nu.CREATED_BY = u.USER_ID
            LEFT JOIN GUARDIAN.USER_ROLES ur ON u.USER_ID = ur.USER_ID
            LEFT JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            ${whereClause}
            ORDER BY nu.IS_PINNED DESC, nu.CREATED_DATE DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${limit} ROWS ONLY
        `;
        
        // Get total count
        const totalCount = await prisma.$queryRaw`
            SELECT COUNT(*) as TOTAL_COUNT
            FROM GUARDIAN.NOTICE_UPDATES nu
            INNER JOIN GUARDIAN.NOTICES n ON nu.NOTICE_ID = n.NOTICE_ID
            ${whereClause}
        `;
        
        console.log(`✅ Retrieved ${updates.length} updates from company feed`);
        res.json({
            updates,
            totalCount: totalCount[0].TOTAL_COUNT,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error(`❌ Error fetching company updates feed:`, error);
        res.status(500).json({
            error: 'Failed to fetch company updates feed',
            message: error.message
        });
    }
});

// Update visibility scope (admin only)
app.put('/api/updates/:updateId/visibility', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const updateId = parseInt(req.params.updateId);
        const { visibilityScope } = req.body;
        
        console.log(`👁️ Updating visibility for update ${updateId} by user ${req.userId} (Company: ${req.companyId})`);
        
        // Validate visibility scope
        const validScopes = ['COMPANY', 'DEPARTMENT', 'ROLE', 'SPECIFIC_USERS'];
        if (!validScopes.includes(visibilityScope)) {
            return res.status(400).json({
                error: 'Invalid visibility scope'
            });
        }
        
        // Check admin permissions
        const userRoles = await prisma.$queryRaw`
            SELECT r.ROLE_ID, r.ROLE_NAME 
            FROM GUARDIAN.USER_ROLES ur
            JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId}
        `;
        
        const isAdmin = userRoles.some(role => [1, 3, 4, 6].includes(role.ROLE_ID));
        
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Only administrators can update visibility scope'
            });
        }
        
        // Verify update exists
        const updateCheck = await prisma.$queryRaw`
            SELECT UPDATE_ID, CREATED_BY
            FROM GUARDIAN.NOTICE_UPDATES
            WHERE UPDATE_ID = ${updateId}
                AND COMPANY_ID = ${req.companyId}
        `;
        
        if (updateCheck.length === 0) {
            return res.status(404).json({
                error: 'Update not found'
            });
        }
        
        // Update visibility scope
        await prisma.$executeRaw`
            UPDATE GUARDIAN.NOTICE_UPDATES 
            SET 
                VISIBILITY_SCOPE = ${visibilityScope},
                UPDATED_DATE = GETUTCDATE(),
                UPDATED_BY = ${req.userId}
            WHERE UPDATE_ID = ${updateId}
        `;
        
        console.log(`✅ Updated visibility scope for update ${updateId} to ${visibilityScope}`);
        res.json({
            message: 'Visibility scope updated successfully'
        });
        
    } catch (error) {
        console.error(`❌ Error updating update visibility:`, error);
        res.status(500).json({
            error: 'Failed to update visibility scope',
            message: error.message
        });
    }
});

// === NO CATCH-ALL ROUTE ===
// IIS handles SPA routing via web.config

// ========================================
// WORKSPACE MANAGEMENT ENDPOINTS
// ========================================

// Helper function to check if user has JAFAR role (role_id=6) for workspace management
const checkJafarRole = async (req, res, next) => {
    try {
        console.log(`🔑 Checking JAFAR role for user ${req.userId}`);
        
        // Get user roles from database
        const userRoles = await prisma.$queryRaw`
            SELECT ur.ROLE_ID, r.NAME as ROLE_NAME, r.DISPLAY_NAME
            FROM GUARDIAN.USER_ROLES ur
            INNER JOIN GUARDIAN.ROLES r ON ur.ROLE_ID = r.ROLE_ID
            WHERE ur.USER_ID = ${req.userId} AND ur.STATUS = 'P'
        `;
        
        const hasJafarRole = userRoles.some(role => role.ROLE_ID === 6);
        
        if (!hasJafarRole) {
            console.log(`❌ Access denied - user ${req.userId} does not have JAFAR role (role_id=6)`);
            return res.status(403).json({
                success: false,
                error: 'Access denied. Workspace management is only available to JAFAR users (role_id=6).'
            });
        }
        
        console.log(`✅ JAFAR role verified for user ${req.userId}`);
        next();
    } catch (error) {
        console.error('❌ Error checking JAFAR role:', error);
        res.status(500).json({
            success: false,
            error: 'Error validating user permissions'
        });
    }
};

const normalizeDeleteCount = (value) => {
    if (value == null) return 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const sqlQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const joinIds = (ids) => ids.map(id => Number(id)).filter(id => Number.isFinite(id)).join(', ');
const uniqueIds = (rows, key) => [...new Set(rows.map(row => normalizeDeleteCount(row[key])).filter(Boolean))];

const countRaw = async (sql) => {
    const rows = await prisma.$queryRawUnsafe(sql);
    const firstRow = Array.isArray(rows) ? rows[0] : rows;
    if (!firstRow) return 0;
    const firstKey = Object.keys(firstRow)[0];
    return normalizeDeleteCount(firstRow[firstKey]);
};

const idRaw = async (sql, key) => {
    const rows = await prisma.$queryRawUnsafe(sql);
    return uniqueIds(rows, key);
};

const getJafarUserById = async (userId) => {
    const rows = await prisma.$queryRawUnsafe(`
        SELECT TOP 1
            u.USER_ID,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.EMAIL,
            TRY_CONVERT(INT, u.COMPANY_ID) AS COMPANY_ID,
            c.NAME AS COMPANY_NAME
        FROM GUARDIAN.USERS u
        LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, u.COMPANY_ID)
        WHERE u.USER_ID = ${userId}
    `);

    return rows[0] || null;
};

const getJafarCompanyById = async (companyId) => {
    const rows = await prisma.$queryRawUnsafe(`
        SELECT TOP 1 COMPANY_ID, NAME
        FROM GUARDIAN.COMPANY
        WHERE COMPANY_ID = ${companyId}
    `);

    return rows[0] || null;
};

const getJafarUserRequestIds = async (userId) => idRaw(`
    SELECT DISTINCT REQUEST_ID
    FROM GUARDIAN.REQUESTS
    WHERE REQUESTOR_ID = ${userId}
       OR ASSIGNED_ID = ${userId}
       OR CANCELLED_BY = ${userId}
       OR CREATE_USER_ID = ${userId}
       OR UPDATE_USER_ID = ${userId}
`, 'REQUEST_ID');

const getJafarCompanyRequestIds = async (companyId, userIds) => {
    const clauses = [`TRY_CONVERT(INT, COMPANY_ID) = ${companyId}`];
    if (userIds.length > 0) {
        const idList = joinIds(userIds);
        clauses.push(`CREATE_USER_ID IN (${idList})`);
        clauses.push(`ASSIGNED_ID IN (${idList})`);
        clauses.push(`UPDATE_USER_ID IN (${idList})`);
        clauses.push(`REQUESTOR_ID IN (${idList})`);
        clauses.push(`CANCELLED_BY IN (${idList})`);
    }

    return idRaw(`
        SELECT DISTINCT REQUEST_ID
        FROM GUARDIAN.REQUESTS
        WHERE ${clauses.join(' OR ')}
    `, 'REQUEST_ID');
};

const getJafarUserAttachmentIds = async (userId, requestIds) => {
    const clauses = [`CREATE_USER_ID = ${userId}`, `UPDATE_USER_ID = ${userId}`];
    if (requestIds.length > 0) clauses.push(`REQUEST_ID IN (${joinIds(requestIds)})`);
    return idRaw(`
        SELECT DISTINCT ATTACHMENT_ID
        FROM GUARDIAN.ATTACHMENTS
        WHERE ${clauses.join(' OR ')}
    `, 'ATTACHMENT_ID');
};

const getJafarCompanyAttachmentIds = async (companyId, userIds, requestIds) => {
    const clauses = [`COMPANY_ID = ${companyId}`];
    if (userIds.length > 0) {
        const idList = joinIds(userIds);
        clauses.push(`CREATE_USER_ID IN (${idList})`);
        clauses.push(`UPDATE_USER_ID IN (${idList})`);
    }
    if (requestIds.length > 0) clauses.push(`REQUEST_ID IN (${joinIds(requestIds)})`);

    return idRaw(`
        SELECT DISTINCT ATTACHMENT_ID
        FROM GUARDIAN.ATTACHMENTS
        WHERE ${clauses.join(' OR ')}
    `, 'ATTACHMENT_ID');
};

const getJafarUserNoticeIds = async (userId) => idRaw(`
    SELECT DISTINCT NOTICE_ID
    FROM GUARDIAN.NOTICES
    WHERE ISSUED_BY_USER_ID = ${userId}
`, 'NOTICE_ID');

const getJafarCompanyNoticeIds = async (companyId, userIds) => {
    const clauses = [`COMPANY_ID = ${companyId}`];
    if (userIds.length > 0) {
        const idList = joinIds(userIds);
        clauses.push(`ISSUED_BY_USER_ID IN (${idList})`);
    }

    return idRaw(`
        SELECT DISTINCT NOTICE_ID
        FROM GUARDIAN.NOTICES
        WHERE ${clauses.join(' OR ')}
    `, 'NOTICE_ID');
};

const getJafarUserFormInstanceIds = async (userId) => idRaw(`
    SELECT DISTINCT FORM_INSTANCE_ID
    FROM GUARDIAN.FORMS_INSTANCE
    WHERE ASSIGNED_ID = ${userId}
       OR CREATE_USER_ID = ${userId}
       OR UPDATE_USER_ID = ${userId}
`, 'FORM_INSTANCE_ID');

const getJafarCompanyFormInstanceIds = async (companyId, requestIds) => {
    const clauses = [`COMPANY_ID = ${companyId}`];
    if (requestIds.length > 0) clauses.push(`REQUEST_ID IN (${joinIds(requestIds)})`);

    return idRaw(`
        SELECT DISTINCT FORM_INSTANCE_ID
        FROM GUARDIAN.FORMS_INSTANCE
        WHERE ${clauses.join(' OR ')}
    `, 'FORM_INSTANCE_ID');
};

const getJafarCompanyWorkspaceIds = async (companyId) => idRaw(`
    SELECT WORKSPACE_ID
    FROM GUARDIAN.WORKSPACES
    WHERE COMPANY_ID = ${companyId}
`, 'WORKSPACE_ID');

const getJafarCompanyFormIds = async (companyId) => idRaw(`
    SELECT FORM_ID
    FROM GUARDIAN.FORMS
    WHERE COMPANY_ID = ${companyId}
`, 'FORM_ID');

const getJafarCompanyUserIds = async (companyId) => idRaw(`
    SELECT USER_ID
    FROM GUARDIAN.USERS
    WHERE TRY_CONVERT(INT, COMPANY_ID) = ${companyId}
`, 'USER_ID');

const createEmptyJafarCounts = () => ({
    attachments: 0,
    requests: 0,
    tasks: 0,
    workProgress: 0,
    milestones: 0,
    noticesIssued: 0,
    noticeRecipients: 0,
    noticeReadStatus: 0,
    notifications: 0,
    invites: 0,
    companyInfo: 0,
    userRoles: 0,
    userWorkspaces: 0,
    workspaces: 0,
    users: 0,
    company: 0,
    forms: 0,
    formFields: 0,
    formInstances: 0,
    formInstanceValues: 0
});

const buildJafarUserPreview = async (userId, actorUserId) => {
    const user = await getJafarUserById(userId);
    if (!user) throw new Error('Target user not found');

    const counts = createEmptyJafarCounts();
    const blockers = [];

    if (userId === actorUserId) {
        blockers.push('You cannot purge your own active JAFAR account.');
    }

    const requestIds = await getJafarUserRequestIds(userId);
    const attachmentIds = await getJafarUserAttachmentIds(userId, requestIds);
    const noticeIds = await getJafarUserNoticeIds(userId);
    const formInstanceIds = await getJafarUserFormInstanceIds(userId);

    counts.requests = requestIds.length;
    counts.attachments = attachmentIds.length;
    counts.noticesIssued = noticeIds.length;
    counts.formInstances = formInstanceIds.length;

    counts.tasks = requestIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.TASKS WHERE REQUEST_ID IN (${joinIds(requestIds)})`)
        : 0;
    counts.formInstanceValues = formInstanceIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.FORMS_INSTANCE_VALUES WHERE FORM_INSTANCE_ID IN (${joinIds(formInstanceIds)})`)
        : 0;
    counts.userRoles = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.USER_ROLES WHERE USER_ID = ${userId}`);
    counts.userWorkspaces = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.USER_WORKSPACES WHERE USER_ID = ${userId}`);
    counts.companyInfo = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.COMPANY_INFO WHERE USER_ID = ${userId}`);
    counts.notifications = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.NOTIFICATIONS WHERE USER_ID = ${userId}`);
    counts.invites = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.INVITES WHERE EMAIL = ${sqlQuote(user.EMAIL || '')}`);
    counts.workProgress = await countRaw(`
        SELECT COUNT(*) AS count
        FROM GUARDIAN.WORK_PROGRESS
        WHERE USER_ID = ${userId}
           OR ${requestIds.length > 0 ? `REQUEST_ID IN (${joinIds(requestIds)})` : '1 = 0'}
           OR ${attachmentIds.length > 0 ? `RELATED_ATTACHMENT_ID IN (${joinIds(attachmentIds)})` : '1 = 0'}
    `);
    counts.milestones = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.MILESTONES WHERE EVENT_USER_ID = ${userId}`);
    counts.noticeRecipients = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_RECIPIENTS WHERE RECIPIENT_USER_ID = ${userId}`);
    counts.noticeReadStatus = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_READ_STATUS WHERE USER_ID = ${userId}`);
    counts.tasks = await countRaw(`
        SELECT COUNT(*) AS count
        FROM GUARDIAN.TASKS
        WHERE ASSIGNED_USER_ID = ${userId}
           OR CREATE_USER_ID = ${userId}
           OR UPDATE_USER_ID = ${userId}
           OR ${requestIds.length > 0 ? `REQUEST_ID IN (${joinIds(requestIds)})` : '1 = 0'}
    `);
    counts.users = 1;

    return {
        scope: 'user',
        allowed: blockers.length === 0,
        blockers,
        target: {
            id: normalizeDeleteCount(user.USER_ID),
            email: user.EMAIL || '',
            firstName: user.FIRST_NAME || '',
            lastName: user.LAST_NAME || '',
            companyId: normalizeDeleteCount(user.COMPANY_ID),
            companyName: user.COMPANY_NAME || ''
        },
        counts
    };
};

const buildJafarCompanyPreview = async (companyId, actorUserId) => {
    const company = await getJafarCompanyById(companyId);
    if (!company) throw new Error('Target company not found');

    const counts = createEmptyJafarCounts();
    const blockers = [];

    const userIds = await getJafarCompanyUserIds(companyId);
    if (userIds.includes(actorUserId)) {
        blockers.push('You cannot wipe the company that contains your active JAFAR account.');
    }

    const requestIds = await getJafarCompanyRequestIds(companyId, userIds);
    const attachmentIds = await getJafarCompanyAttachmentIds(companyId, userIds, requestIds);
    const noticeIds = await getJafarCompanyNoticeIds(companyId, userIds);
    const formInstanceIds = await getJafarCompanyFormInstanceIds(companyId, requestIds);
    const workspaceIds = await getJafarCompanyWorkspaceIds(companyId);
    const formIds = await getJafarCompanyFormIds(companyId);

    counts.users = userIds.length;
    counts.requests = requestIds.length;
    counts.attachments = attachmentIds.length;
    counts.noticesIssued = noticeIds.length;
    counts.formInstances = formInstanceIds.length;
    counts.workspaces = workspaceIds.length;
    counts.forms = formIds.length;

    counts.tasks = requestIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.TASKS WHERE REQUEST_ID IN (${joinIds(requestIds)})`)
        : 0;
    counts.formInstanceValues = formInstanceIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.FORMS_INSTANCE_VALUES WHERE FORM_INSTANCE_ID IN (${joinIds(formInstanceIds)})`)
        : 0;
    counts.workProgress = await countRaw(`
        SELECT COUNT(*) AS count
        FROM GUARDIAN.WORK_PROGRESS
        WHERE COMPANY_ID = ${companyId}
           OR ${requestIds.length > 0 ? `REQUEST_ID IN (${joinIds(requestIds)})` : '1 = 0'}
           OR ${attachmentIds.length > 0 ? `RELATED_ATTACHMENT_ID IN (${joinIds(attachmentIds)})` : '1 = 0'}
    `);
    counts.milestones = userIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.MILESTONES WHERE EVENT_USER_ID IN (${joinIds(userIds)})`)
        : 0;
    counts.noticeRecipients = noticeIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_RECIPIENTS WHERE NOTICE_ID IN (${joinIds(noticeIds)}) OR COMPANY_ID = ${companyId}`)
        : 0;
    counts.noticeReadStatus = noticeIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_READ_STATUS WHERE NOTICE_ID IN (${joinIds(noticeIds)}) OR COMPANY_ID = ${companyId}`)
        : 0;
    counts.notifications = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.NOTIFICATIONS WHERE COMPANY_ID = ${companyId}`);
    counts.invites = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.INVITES WHERE COMPANY_ID = ${companyId}`);
    counts.companyInfo = await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.COMPANY_INFO WHERE COMPANY_ID = ${companyId}`);
    counts.userRoles = userIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.USER_ROLES WHERE USER_ID IN (${joinIds(userIds)})`)
        : 0;
    counts.userWorkspaces = workspaceIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.USER_WORKSPACES WHERE WORKSPACE_ID IN (${joinIds(workspaceIds)})`)
        : 0;
    counts.formFields = formIds.length > 0
        ? await countRaw(`SELECT COUNT(*) AS count FROM GUARDIAN.FORMS_FIELDS WHERE FORM_ID IN (${joinIds(formIds)})`)
        : 0;
    counts.company = 1;

    return {
        scope: 'company',
        allowed: blockers.length === 0,
        blockers,
        target: {
            id: normalizeDeleteCount(company.COMPANY_ID),
            name: company.NAME || ''
        },
        counts
    };
};

const executeJafarUserPurge = async (userId, actorUserId) => {
    const preview = await buildJafarUserPreview(userId, actorUserId);
    if (!preview.allowed) {
        const error = new Error(preview.blockers[0] || 'User purge is blocked');
        error.statusCode = 400;
        throw error;
    }

    const counts = createEmptyJafarCounts();
    const requestIds = await getJafarUserRequestIds(userId);
    const attachmentIds = await getJafarUserAttachmentIds(userId, requestIds);
    const noticeIds = await getJafarUserNoticeIds(userId);
    const formInstanceIds = await getJafarUserFormInstanceIds(userId);
    const user = await getJafarUserById(userId);

    await prisma.$transaction(async (tx) => {
        if (noticeIds.length > 0) {
            counts.noticeRecipients += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICE_RECIPIENTS WHERE NOTICE_ID IN (${joinIds(noticeIds)})`);
            counts.noticeReadStatus += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICE_READ_STATUS WHERE NOTICE_ID IN (${joinIds(noticeIds)})`);
            counts.noticesIssued += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICES WHERE NOTICE_ID IN (${joinIds(noticeIds)})`);
        }

        counts.noticeRecipients += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICE_RECIPIENTS WHERE RECIPIENT_USER_ID = ${userId}`);
        counts.noticeReadStatus += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICE_READ_STATUS WHERE USER_ID = ${userId}`);
        counts.notifications += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTIFICATIONS WHERE USER_ID = ${userId}`);
        counts.invites += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.INVITES WHERE EMAIL = ${sqlQuote(user?.EMAIL || '')}`);

        if (formInstanceIds.length > 0) {
            counts.formInstanceValues += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES WHERE FORM_INSTANCE_ID IN (${joinIds(formInstanceIds)})`);
            counts.formInstances += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.FORMS_INSTANCE WHERE FORM_INSTANCE_ID IN (${joinIds(formInstanceIds)})`);
        }

        const workProgressClauses = [`USER_ID = ${userId}`];
        if (requestIds.length > 0) workProgressClauses.push(`REQUEST_ID IN (${joinIds(requestIds)})`);
        if (attachmentIds.length > 0) workProgressClauses.push(`RELATED_ATTACHMENT_ID IN (${joinIds(attachmentIds)})`);
        counts.workProgress += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.WORK_PROGRESS WHERE ${workProgressClauses.join(' OR ')}`);

        counts.milestones += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.MILESTONES WHERE EVENT_USER_ID = ${userId}`);

        counts.tasks += await tx.$executeRawUnsafe(`
            DELETE FROM GUARDIAN.TASKS
            WHERE ${requestIds.length > 0 ? `REQUEST_ID IN (${joinIds(requestIds)}) OR` : ''}
                  ASSIGNED_USER_ID = ${userId}
               OR CREATE_USER_ID = ${userId}
               OR UPDATE_USER_ID = ${userId}
        `);

        if (attachmentIds.length > 0) {
            counts.attachments += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.ATTACHMENTS WHERE ATTACHMENT_ID IN (${joinIds(attachmentIds)})`);
        }

        if (requestIds.length > 0) {
            counts.requests += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.REQUESTS WHERE REQUEST_ID IN (${joinIds(requestIds)})`);
        }

        counts.companyInfo += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.COMPANY_INFO WHERE USER_ID = ${userId}`);
        counts.userRoles += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USER_ROLES WHERE USER_ID = ${userId}`);
        counts.userWorkspaces += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USER_WORKSPACES WHERE USER_ID = ${userId}`);
        counts.users += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USERS WHERE USER_ID = ${userId}`);
    });

    return { success: true, scope: 'user', targetId: userId, deletedCounts: counts };
};

const executeJafarCompanyPurge = async (companyId, actorUserId) => {
    const preview = await buildJafarCompanyPreview(companyId, actorUserId);
    if (!preview.allowed) {
        const error = new Error(preview.blockers[0] || 'Company purge is blocked');
        error.statusCode = 400;
        throw error;
    }

    const counts = createEmptyJafarCounts();
    const userIds = await getJafarCompanyUserIds(companyId);
    const requestIds = await getJafarCompanyRequestIds(companyId, userIds);
    const attachmentIds = await getJafarCompanyAttachmentIds(companyId, userIds, requestIds);
    const noticeIds = await getJafarCompanyNoticeIds(companyId, userIds);
    const formInstanceIds = await getJafarCompanyFormInstanceIds(companyId, requestIds);
    const workspaceIds = await getJafarCompanyWorkspaceIds(companyId);
    const formIds = await getJafarCompanyFormIds(companyId);

    await prisma.$transaction(async (tx) => {
        if (noticeIds.length > 0) {
            counts.noticeRecipients += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICE_RECIPIENTS WHERE NOTICE_ID IN (${joinIds(noticeIds)})`);
            counts.noticeReadStatus += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICE_READ_STATUS WHERE NOTICE_ID IN (${joinIds(noticeIds)})`);
            counts.noticesIssued += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTICES WHERE NOTICE_ID IN (${joinIds(noticeIds)})`);
        }

        counts.notifications += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.NOTIFICATIONS WHERE COMPANY_ID = ${companyId}`);
        counts.invites += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.INVITES WHERE COMPANY_ID = ${companyId}`);

        if (formInstanceIds.length > 0) {
            counts.formInstanceValues += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES WHERE FORM_INSTANCE_ID IN (${joinIds(formInstanceIds)})`);
            counts.formInstances += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.FORMS_INSTANCE WHERE FORM_INSTANCE_ID IN (${joinIds(formInstanceIds)})`);
        }

        const workProgressClauses = [`COMPANY_ID = ${companyId}`];
        if (requestIds.length > 0) workProgressClauses.push(`REQUEST_ID IN (${joinIds(requestIds)})`);
        if (userIds.length > 0) workProgressClauses.push(`USER_ID IN (${joinIds(userIds)})`);
        if (attachmentIds.length > 0) workProgressClauses.push(`RELATED_ATTACHMENT_ID IN (${joinIds(attachmentIds)})`);
        counts.workProgress += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.WORK_PROGRESS WHERE ${workProgressClauses.join(' OR ')}`);

        if (userIds.length > 0) {
            counts.milestones += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.MILESTONES WHERE EVENT_USER_ID IN (${joinIds(userIds)})`);
        }

        if (requestIds.length > 0) {
            counts.tasks += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.TASKS WHERE REQUEST_ID IN (${joinIds(requestIds)})`);
        }

        if (attachmentIds.length > 0) {
            counts.attachments += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.ATTACHMENTS WHERE ATTACHMENT_ID IN (${joinIds(attachmentIds)})`);
        }

        if (requestIds.length > 0) {
            counts.requests += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.REQUESTS WHERE REQUEST_ID IN (${joinIds(requestIds)})`);
        }

        if (workspaceIds.length > 0) {
            counts.userWorkspaces += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USER_WORKSPACES WHERE WORKSPACE_ID IN (${joinIds(workspaceIds)})`);
            counts.workspaces += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.WORKSPACES WHERE WORKSPACE_ID IN (${joinIds(workspaceIds)})`);
        }

        counts.companyInfo += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.COMPANY_INFO WHERE COMPANY_ID = ${companyId}`);

        if (formIds.length > 0) {
            counts.formFields += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.FORMS_FIELDS WHERE FORM_ID IN (${joinIds(formIds)})`);
            counts.forms += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.FORMS WHERE FORM_ID IN (${joinIds(formIds)})`);
        }

        if (userIds.length > 0) {
            counts.userRoles += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USER_ROLES WHERE USER_ID IN (${joinIds(userIds)})`);
            counts.users += await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.USERS WHERE USER_ID IN (${joinIds(userIds)})`);
        }

        await tx.$executeRawUnsafe(`DELETE FROM GUARDIAN.COMPANY WHERE COMPANY_ID = ${companyId}`);
        counts.company = 1;
    });

    return { success: true, scope: 'company', targetId: companyId, deletedCounts: counts };
};

app.get('/api/jafar-admin/users', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        const filter = query ? `
            AND (
                u.EMAIL LIKE ${sqlQuote(`%${query}%`)}
                OR CONCAT(COALESCE(u.FIRST_NAME, ''), ' ', COALESCE(u.LAST_NAME, '')) LIKE ${sqlQuote(`%${query}%`)}
            )
        ` : '';

        const users = await prisma.$queryRawUnsafe(`
            SELECT TOP 250
                u.USER_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                TRY_CONVERT(INT, u.COMPANY_ID) AS COMPANY_ID,
                u.STATUS,
                c.NAME AS COMPANY_NAME
            FROM GUARDIAN.USERS u
            LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, u.COMPANY_ID)
            WHERE 1 = 1
              ${filter}
            ORDER BY u.EMAIL ASC
        `);

        res.json({ success: true, data: users });
    } catch (error) {
        console.error('❌ [JAFAR ADMIN] Failed to load users:', error);
        res.status(500).json({ error: 'Failed to load users' });
    }
});

app.get('/api/jafar-admin/companies', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        const filter = query ? `AND c.NAME LIKE ${sqlQuote(`%${query}%`)}` : '';
        const companies = await prisma.$queryRawUnsafe(`
            SELECT TOP 250
                c.COMPANY_ID,
                c.NAME,
                COUNT(u.USER_ID) AS USER_COUNT
            FROM GUARDIAN.COMPANY c
            LEFT JOIN GUARDIAN.USERS u ON TRY_CONVERT(INT, u.COMPANY_ID) = c.COMPANY_ID
            WHERE 1 = 1
              ${filter}
            GROUP BY c.COMPANY_ID, c.NAME
            ORDER BY c.NAME ASC
        `);

        res.json({
            success: true,
            data: companies.map(company => ({
                ...company,
                USER_COUNT: normalizeDeleteCount(company.USER_COUNT)
            }))
        });
    } catch (error) {
        console.error('❌ [JAFAR ADMIN] Failed to load companies:', error);
        res.status(500).json({ error: 'Failed to load companies' });
    }
});

app.get('/api/jafar-admin/purge/user/:userId/preview', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (!userId || Number.isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        const preview = await buildJafarUserPreview(userId, req.userId);
        res.json(preview);
    } catch (error) {
        console.error('❌ [JAFAR ADMIN] Failed to preview user purge:', error);
        res.status(String(error.message || '').includes('not found') ? 404 : 500).json({
            error: error.message || 'Failed to preview user purge'
        });
    }
});

app.post('/api/jafar-admin/purge/user/:userId', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const confirmation = String(req.body?.confirmation || '');
        if (!userId || Number.isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        if (confirmation !== 'DELETE') {
            return res.status(400).json({ error: 'Confirmation phrase must be DELETE' });
        }

        const result = await executeJafarUserPurge(userId, req.userId);
        res.json(result);
    } catch (error) {
        console.error('❌ [JAFAR ADMIN] Failed to purge user:', error);
        res.status(String(error.message || '').includes('not found') ? 404 : 500).json({
            error: error.message || 'Failed to purge user'
        });
    }
});

app.get('/api/jafar-admin/purge/company/:companyId/preview', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId);
        if (!companyId || Number.isNaN(companyId)) {
            return res.status(400).json({ error: 'Invalid company id' });
        }

        const preview = await buildJafarCompanyPreview(companyId, req.userId);
        res.json(preview);
    } catch (error) {
        console.error('❌ [JAFAR ADMIN] Failed to preview company wipe:', error);
        res.status(String(error.message || '').includes('not found') ? 404 : 500).json({
            error: error.message || 'Failed to preview company purge'
        });
    }
});

app.post('/api/jafar-admin/purge/company/:companyId', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const companyId = parseInt(req.params.companyId);
        const confirmation = String(req.body?.confirmation || '');
        if (!companyId || Number.isNaN(companyId)) {
            return res.status(400).json({ error: 'Invalid company id' });
        }
        if (confirmation !== 'DELETE') {
            return res.status(400).json({ error: 'Confirmation phrase must be DELETE' });
        }

        const result = await executeJafarCompanyPurge(companyId, req.userId);
        res.json(result);
    } catch (error) {
        console.error('❌ [JAFAR ADMIN] Failed to purge company:', error);
        res.status(String(error.message || '').includes('not found') ? 404 : 500).json({
            error: error.message || 'Failed to purge company'
        });
    }
});

// GET /api/workspaces - List all workspaces for company (role_id=6 only)
app.get('/api/workspaces', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        console.log(`📋 Fetching workspaces for company ${req.companyId}`);
        
        const workspaces = await prisma.$queryRaw`
            SELECT 
                w.WORKSPACE_ID,
                w.WORKSPACE_NAME,
                w.DESCRIPTION,
                w.COMPANY_ID,
                w.IS_ACTIVE,
                w.IS_DEFAULT,
                w.CREATE_DATE,
                w.UPDATE_DATE,
                COUNT(uw.USER_ID) as USER_COUNT
            FROM GUARDIAN.WORKSPACES w
            LEFT JOIN GUARDIAN.USER_WORKSPACES uw ON w.WORKSPACE_ID = uw.WORKSPACE_ID AND uw.IS_ACTIVE = 1
            WHERE w.COMPANY_ID = ${req.companyId}
            GROUP BY w.WORKSPACE_ID, w.WORKSPACE_NAME, w.DESCRIPTION, w.COMPANY_ID, w.IS_ACTIVE, w.IS_DEFAULT, w.CREATE_DATE, w.UPDATE_DATE
            ORDER BY w.IS_DEFAULT DESC, w.WORKSPACE_NAME ASC
        `;
        
        console.log(`✅ Found ${workspaces.length} workspaces for company ${req.companyId}`);
        
        res.json({
            success: true,
            workspaces: workspaces
        });
        
    } catch (error) {
        console.error('❌ Error fetching workspaces:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workspaces'
        });
    }
});

// POST /api/workspaces - Create new workspace (role_id=6 only)
app.post('/api/workspaces', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const { workspaceName, description, isDefault = false } = req.body;
        
        console.log(`➕ Creating new workspace for company ${req.companyId}:`, { workspaceName, description, isDefault });
        
        // Validation
        if (!workspaceName || workspaceName.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Workspace name is required'
            });
        }
        
        if (workspaceName.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Workspace name must be 100 characters or less'
            });
        }
        
        // Check for duplicate workspace name within company
        const existingWorkspace = await prisma.$queryRaw`
            SELECT WORKSPACE_ID FROM GUARDIAN.WORKSPACES 
            WHERE COMPANY_ID = ${req.companyId} AND WORKSPACE_NAME = ${workspaceName.trim()}
        `;
        
        if (existingWorkspace.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'A workspace with this name already exists in your company'
            });
        }
        
        // If setting as default, unset existing default
        if (isDefault) {
            await prisma.$queryRaw`
                UPDATE GUARDIAN.WORKSPACES 
                SET IS_DEFAULT = 0, UPDATE_DATE = GETDATE()
                WHERE COMPANY_ID = ${req.companyId} AND IS_DEFAULT = 1
            `;
        }
        
        // Create the workspace
        const result = await prisma.$queryRaw`
            INSERT INTO GUARDIAN.WORKSPACES 
            (WORKSPACE_NAME, DESCRIPTION, COMPANY_ID, IS_ACTIVE, IS_DEFAULT, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
            OUTPUT INSERTED.WORKSPACE_ID
            VALUES (${workspaceName.trim()}, ${description || ''}, ${req.companyId}, 1, ${isDefault ? 1 : 0}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE())
        `;
        
        const newWorkspaceId = result[0].WORKSPACE_ID;
        
        // Get the created workspace
        const newWorkspace = await prisma.$queryRaw`
            SELECT 
                w.WORKSPACE_ID,
                w.WORKSPACE_NAME,
                w.DESCRIPTION,
                w.COMPANY_ID,
                w.IS_ACTIVE,
                w.IS_DEFAULT,
                w.CREATE_DATE,
                w.UPDATE_DATE
            FROM GUARDIAN.WORKSPACES w
            WHERE w.WORKSPACE_ID = ${newWorkspaceId}
        `;
        
        console.log(`✅ Created workspace: ${workspaceName} (ID: ${newWorkspaceId})`);
        
        res.status(201).json({
            success: true,
            workspace: newWorkspace[0],
            message: 'Workspace created successfully'
        });
        
    } catch (error) {
        console.error('❌ Error creating workspace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create workspace'
        });
    }
});

// PUT /api/workspaces/:id - Update workspace (role_id=6 only)
app.put('/api/workspaces/:id', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const workspaceId = parseInt(req.params.id);
        const { workspaceName, description, isActive, isDefault } = req.body;
        
        console.log(`✏️ Updating workspace ${workspaceId} for company ${req.companyId}:`, { workspaceName, description, isActive, isDefault });
        
        // Verify workspace belongs to user's company
        const workspace = await prisma.$queryRaw`
            SELECT WORKSPACE_ID, WORKSPACE_NAME, IS_DEFAULT
            FROM GUARDIAN.WORKSPACES 
            WHERE WORKSPACE_ID = ${workspaceId} AND COMPANY_ID = ${req.companyId}
        `;
        
        if (workspace.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workspace not found'
            });
        }
        
        // Validation
        if (workspaceName && workspaceName.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Workspace name must be 100 characters or less'
            });
        }
        
        // Check for duplicate workspace name if name is being changed
        if (workspaceName && workspaceName !== workspace[0].WORKSPACE_NAME) {
            const existingWorkspace = await prisma.$queryRaw`
                SELECT WORKSPACE_ID FROM GUARDIAN.WORKSPACES 
                WHERE COMPANY_ID = ${req.companyId} AND WORKSPACE_NAME = ${workspaceName.trim()} 
                AND WORKSPACE_ID != ${workspaceId}
            `;
            
            if (existingWorkspace.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'A workspace with this name already exists in your company'
                });
            }
        }
        
        // If setting as default, unset existing default
        if (isDefault && !workspace[0].IS_DEFAULT) {
            await prisma.$queryRaw`
                UPDATE GUARDIAN.WORKSPACES 
                SET IS_DEFAULT = 0, UPDATE_DATE = GETDATE()
                WHERE COMPANY_ID = ${req.companyId} AND IS_DEFAULT = 1
            `;
        }
        
        // Build update query dynamically
        let updateQuery = `UPDATE GUARDIAN.WORKSPACES SET UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}`;
        
        if (workspaceName !== undefined) {
            updateQuery += `, WORKSPACE_NAME = '${workspaceName.trim().replace(/'/g, "''")}'`;
        }
        if (description !== undefined) {
            updateQuery += `, DESCRIPTION = '${(description || '').replace(/'/g, "''")}'`;
        }
        if (isActive !== undefined) {
            updateQuery += `, IS_ACTIVE = ${isActive ? 1 : 0}`;
        }
        if (isDefault !== undefined) {
            updateQuery += `, IS_DEFAULT = ${isDefault ? 1 : 0}`;
        }
        
        updateQuery += ` WHERE WORKSPACE_ID = ${workspaceId} AND COMPANY_ID = ${req.companyId}`;
        
        await prisma.$queryRawUnsafe(updateQuery);
        
        // Get updated workspace
        const updatedWorkspace = await prisma.$queryRaw`
            SELECT 
                w.WORKSPACE_ID,
                w.WORKSPACE_NAME,
                w.DESCRIPTION,
                w.COMPANY_ID,
                w.IS_ACTIVE,
                w.IS_DEFAULT,
                w.CREATE_DATE,
                w.UPDATE_DATE
            FROM GUARDIAN.WORKSPACES w
            WHERE w.WORKSPACE_ID = ${workspaceId}
        `;
        
        console.log(`✅ Updated workspace ${workspaceId}`);
        
        res.json({
            success: true,
            workspace: updatedWorkspace[0],
            message: 'Workspace updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error updating workspace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update workspace'
        });
    }
});

// DELETE /api/workspaces/:id - Soft delete workspace (role_id=6 only)
app.delete('/api/workspaces/:id', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const workspaceId = parseInt(req.params.id);
        
        console.log(`🗑️ Soft deleting workspace ${workspaceId} for company ${req.companyId}`);
        
        // Verify workspace belongs to user's company
        const workspace = await prisma.$queryRaw`
            SELECT WORKSPACE_ID, WORKSPACE_NAME, IS_DEFAULT
            FROM GUARDIAN.WORKSPACES 
            WHERE WORKSPACE_ID = ${workspaceId} AND COMPANY_ID = ${req.companyId}
        `;
        
        if (workspace.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workspace not found'
            });
        }
        
        // Prevent deletion of default workspace
        if (workspace[0].IS_DEFAULT) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete the default workspace. Please set another workspace as default first.'
            });
        }
        
        // Check if workspace has active users
        const activeUsers = await prisma.$queryRaw`
            SELECT COUNT(*) as USER_COUNT
            FROM GUARDIAN.USER_WORKSPACES 
            WHERE WORKSPACE_ID = ${workspaceId} AND IS_ACTIVE = 1
        `;
        
        if (activeUsers[0].USER_COUNT > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete workspace. It has ${activeUsers[0].USER_COUNT} active user(s). Please reassign users to other workspaces first.`
            });
        }
        
        // Soft delete the workspace
        await prisma.$queryRaw`
            UPDATE GUARDIAN.WORKSPACES 
            SET IS_ACTIVE = 0, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
            WHERE WORKSPACE_ID = ${workspaceId} AND COMPANY_ID = ${req.companyId}
        `;
        
        console.log(`✅ Soft deleted workspace ${workspaceId}: ${workspace[0].WORKSPACE_NAME}`);
        
        res.json({
            success: true,
            message: 'Workspace deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error deleting workspace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete workspace'
        });
    }
});

// ========================================
// USER-WORKSPACE ASSIGNMENT ENDPOINTS
// ========================================

// GET /api/workspaces/:id/users - Get users in specific workspace (role_id=6 only)
app.get('/api/workspaces/:id/users', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const workspaceId = parseInt(req.params.id);
        
        console.log(`👥 Fetching users for workspace ${workspaceId}`);
        
        // Verify workspace belongs to user's company
        const workspace = await prisma.$queryRaw`
            SELECT WORKSPACE_ID FROM GUARDIAN.WORKSPACES 
            WHERE WORKSPACE_ID = ${workspaceId} AND COMPANY_ID = ${req.companyId}
        `;
        
        if (workspace.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workspace not found'
            });
        }
        
        const users = await prisma.$queryRaw`
            SELECT 
                u.USER_ID,
                u.EMAIL,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.STATUS,
                uw.IS_ACTIVE as IS_ASSIGNED,
                uw.IS_DEFAULT as IS_DEFAULT_WORKSPACE,
                uw.CREATE_DATE as ASSIGNED_DATE
            FROM GUARDIAN.USERS u
            INNER JOIN GUARDIAN.USER_WORKSPACES uw ON u.USER_ID = uw.USER_ID
            WHERE uw.WORKSPACE_ID = ${workspaceId} 
            AND u.COMPANY_ID = ${req.companyId}
            AND u.STATUS = 'P'
            ORDER BY u.LAST_NAME, u.FIRST_NAME
        `;
        
        console.log(`✅ Found ${users.length} users in workspace ${workspaceId}`);
        
        res.json({
            success: true,
            users: users
        });
        
    } catch (error) {
        console.error('❌ Error fetching workspace users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workspace users'
        });
    }
});

// POST /api/workspaces/:id/users - Assign users to workspace (role_id=6 only)
app.post('/api/workspaces/:id/users', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const workspaceId = parseInt(req.params.id);
        const { userIds, isDefault = false } = req.body;
        
        console.log(`➕ Assigning users to workspace ${workspaceId}:`, { userIds, isDefault });
        
        // Validation
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'User IDs array is required'
            });
        }
        
        // Verify workspace belongs to user's company
        const workspace = await prisma.$queryRaw`
            SELECT WORKSPACE_ID FROM GUARDIAN.WORKSPACES 
            WHERE WORKSPACE_ID = ${workspaceId} AND COMPANY_ID = ${req.companyId} AND IS_ACTIVE = 1
        `;
        
        if (workspace.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workspace not found or inactive'
            });
        }
        
        // Verify all users belong to the same company
        const validUsers = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE USER_ID IN (${userIds.join(',')}) AND COMPANY_ID = ${req.companyId} AND STATUS = 'P'
        `;
        
        if (validUsers.length !== userIds.length) {
            return res.status(400).json({
                success: false,
                error: 'One or more users are invalid or not in your company'
            });
        }
        
        let assignedCount = 0;
        let skippedCount = 0;
        
        for (const userId of userIds) {
            try {
                // Check if user is already assigned to this workspace
                const existingAssignment = await prisma.$queryRaw`
                    SELECT USER_WORKSPACE_ID FROM GUARDIAN.USER_WORKSPACES 
                    WHERE USER_ID = ${userId} AND WORKSPACE_ID = ${workspaceId}
                `;
                
                if (existingAssignment.length > 0) {
                    // Update existing assignment to active
                    await prisma.$queryRaw`
                        UPDATE GUARDIAN.USER_WORKSPACES 
                        SET IS_ACTIVE = 1, IS_DEFAULT = ${isDefault ? 1 : 0}, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
                        WHERE USER_ID = ${userId} AND WORKSPACE_ID = ${workspaceId}
                    `;
                    skippedCount++;
                } else {
                    // Create new assignment
                    await prisma.$queryRaw`
                        INSERT INTO GUARDIAN.USER_WORKSPACES 
                        (USER_ID, WORKSPACE_ID, IS_ACTIVE, IS_DEFAULT, CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE)
                        VALUES (${userId}, ${workspaceId}, 1, ${isDefault ? 1 : 0}, ${req.userId}, ${req.userId}, GETDATE(), GETDATE())
                    `;
                    assignedCount++;
                }
                
                // If this is being set as default workspace, update user's active workspace
                if (isDefault) {
                    await prisma.$queryRaw`
                        UPDATE GUARDIAN.USERS 
                        SET ACTIVE_WORKSPACE_ID = ${workspaceId}
                        WHERE USER_ID = ${userId}
                    `;
                    
                    // Remove default flag from other workspaces for this user
                    await prisma.$queryRaw`
                        UPDATE GUARDIAN.USER_WORKSPACES 
                        SET IS_DEFAULT = 0, UPDATE_DATE = GETDATE()
                        WHERE USER_ID = ${userId} AND WORKSPACE_ID != ${workspaceId}
                    `;
                }
                
            } catch (error) {
                console.error(`❌ Error assigning user ${userId} to workspace ${workspaceId}:`, error);
            }
        }
        
        console.log(`✅ Assigned ${assignedCount} users to workspace ${workspaceId}, ${skippedCount} were already assigned`);
        
        res.json({
            success: true,
            message: `Successfully processed ${userIds.length} user assignments`,
            details: {
                assigned: assignedCount,
                updated: skippedCount,
                total: userIds.length
            }
        });
        
    } catch (error) {
        console.error('❌ Error assigning users to workspace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign users to workspace'
        });
    }
});

// DELETE /api/workspaces/:id/users/:userId - Remove user from workspace (role_id=6 only)
app.delete('/api/workspaces/:id/users/:userId', getAuthenticatedUserCompany, checkJafarRole, async (req, res) => {
    try {
        const workspaceId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);
        
        console.log(`➖ Removing user ${userId} from workspace ${workspaceId}`);
        
        // Verify workspace belongs to user's company
        const workspace = await prisma.$queryRaw`
            SELECT WORKSPACE_ID, IS_DEFAULT FROM GUARDIAN.WORKSPACES 
            WHERE WORKSPACE_ID = ${workspaceId} AND COMPANY_ID = ${req.companyId}
        `;
        
        if (workspace.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workspace not found'
            });
        }
        
        // Verify user belongs to the same company
        const user = await prisma.$queryRaw`
            SELECT USER_ID FROM GUARDIAN.USERS 
            WHERE USER_ID = ${userId} AND COMPANY_ID = ${req.companyId}
        `;
        
        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found or not in your company'
            });
        }
        
        // Check if this is the user's default workspace
        const userWorkspace = await prisma.$queryRaw`
            SELECT IS_DEFAULT FROM GUARDIAN.USER_WORKSPACES 
            WHERE USER_ID = ${userId} AND WORKSPACE_ID = ${workspaceId}
        `;
        
        if (userWorkspace.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User is not assigned to this workspace'
            });
        }
        
        if (userWorkspace[0].IS_DEFAULT) {
            // Check if user has other workspaces
            const otherWorkspaces = await prisma.$queryRaw`
                SELECT COUNT(*) as WORKSPACE_COUNT
                FROM GUARDIAN.USER_WORKSPACES uw
                INNER JOIN GUARDIAN.WORKSPACES w ON uw.WORKSPACE_ID = w.WORKSPACE_ID
                WHERE uw.USER_ID = ${userId} AND uw.WORKSPACE_ID != ${workspaceId} 
                AND uw.IS_ACTIVE = 1 AND w.IS_ACTIVE = 1
            `;
            
            if (otherWorkspaces[0].WORKSPACE_COUNT === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot remove user from their only workspace. Please assign them to another workspace first.'
                });
            }
            
            // Assign user to another workspace as default
            const nextWorkspace = await prisma.$queryRaw`
                SELECT TOP 1 uw.WORKSPACE_ID
                FROM GUARDIAN.USER_WORKSPACES uw
                INNER JOIN GUARDIAN.WORKSPACES w ON uw.WORKSPACE_ID = w.WORKSPACE_ID
                WHERE uw.USER_ID = ${userId} AND uw.WORKSPACE_ID != ${workspaceId} 
                AND uw.IS_ACTIVE = 1 AND w.IS_ACTIVE = 1
                ORDER BY w.IS_DEFAULT DESC, w.WORKSPACE_NAME
            `;
            
            if (nextWorkspace.length > 0) {
                await prisma.$queryRaw`
                    UPDATE GUARDIAN.USER_WORKSPACES 
                    SET IS_DEFAULT = 1, UPDATE_DATE = GETDATE()
                    WHERE USER_ID = ${userId} AND WORKSPACE_ID = ${nextWorkspace[0].WORKSPACE_ID}
                `;
                
                await prisma.$queryRaw`
                    UPDATE GUARDIAN.USERS 
                    SET ACTIVE_WORKSPACE_ID = ${nextWorkspace[0].WORKSPACE_ID}
                    WHERE USER_ID = ${userId}
                `;
            }
        }
        
        // Remove user from workspace
        await prisma.$queryRaw`
            UPDATE GUARDIAN.USER_WORKSPACES 
            SET IS_ACTIVE = 0, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = ${req.userId}
            WHERE USER_ID = ${userId} AND WORKSPACE_ID = ${workspaceId}
        `;
        
        console.log(`✅ Removed user ${userId} from workspace ${workspaceId}`);
        
        res.json({
            success: true,
            message: 'User removed from workspace successfully'
        });
        
    } catch (error) {
        console.error('❌ Error removing user from workspace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove user from workspace'
        });
    }
});

// ========================================
// WORKSPACE SWITCHING ENDPOINTS
// ========================================

// GET /api/users/workspaces - Get user's available workspaces
app.get('/api/users/workspaces', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`📋 Fetching workspaces for user ${req.userId}`);
        
        const workspaces = await prisma.$queryRaw`
            SELECT 
                w.WORKSPACE_ID,
                w.WORKSPACE_NAME,
                w.DESCRIPTION,
                w.IS_DEFAULT,
                uw.IS_DEFAULT as IS_USER_DEFAULT,
                uw.IS_ACTIVE as IS_ASSIGNED,
                CASE WHEN u.ACTIVE_WORKSPACE_ID = w.WORKSPACE_ID THEN 1 ELSE 0 END as IS_CURRENT_ACTIVE
            FROM GUARDIAN.WORKSPACES w
            INNER JOIN GUARDIAN.USER_WORKSPACES uw ON w.WORKSPACE_ID = uw.WORKSPACE_ID
            INNER JOIN GUARDIAN.USERS u ON uw.USER_ID = u.USER_ID
            WHERE uw.USER_ID = ${req.userId} 
            AND uw.IS_ACTIVE = 1 
            AND w.IS_ACTIVE = 1
            AND w.COMPANY_ID = ${req.companyId}
            ORDER BY uw.IS_DEFAULT DESC, w.IS_DEFAULT DESC, w.WORKSPACE_NAME ASC
        `;
        
        console.log(`✅ Found ${workspaces.length} workspaces for user ${req.userId}`);
        
        res.json({
            success: true,
            workspaces: workspaces
        });
        
    } catch (error) {
        // Gracefully handle case where WORKSPACES table doesn't exist yet
        const isTableMissing = error.message && (
            error.message.includes('Invalid object name') ||
            error.message.includes('does not exist') ||
            error.message.includes('WORKSPACES')
        );
        if (isTableMissing) {
            console.warn('⚠️ WORKSPACES table not found — returning empty list');
            return res.json({ success: true, workspaces: [] });
        }
        console.error('❌ Error fetching user workspaces:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user workspaces'
        });
    }
});

// POST /api/users/switch-workspace - Switch user's active workspace
app.post('/api/users/switch-workspace', getAuthenticatedUserCompany, async (req, res) => {
    try {
        const { workspaceId } = req.body;
        
        console.log(`🔄 Switching user ${req.userId} to workspace ${workspaceId}`);
        
        // Validation
        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                error: 'Workspace ID is required'
            });
        }
        
        // Verify user has access to this workspace
        const userWorkspace = await prisma.$queryRaw`
            SELECT 
                uw.USER_WORKSPACE_ID,
                w.WORKSPACE_NAME,
                w.COMPANY_ID
            FROM GUARDIAN.USER_WORKSPACES uw
            INNER JOIN GUARDIAN.WORKSPACES w ON uw.WORKSPACE_ID = w.WORKSPACE_ID
            WHERE uw.USER_ID = ${req.userId} 
            AND uw.WORKSPACE_ID = ${workspaceId}
            AND uw.IS_ACTIVE = 1 
            AND w.IS_ACTIVE = 1
            AND w.COMPANY_ID = ${req.companyId}
        `;
        
        if (userWorkspace.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workspace not found or you do not have access to this workspace'
            });
        }
        
        // Update user's active workspace
        await prisma.$queryRaw`
            UPDATE GUARDIAN.USERS 
            SET ACTIVE_WORKSPACE_ID = ${workspaceId}
            WHERE USER_ID = ${req.userId}
        `;
        
        console.log(`✅ Switched user ${req.userId} to workspace ${workspaceId}: ${userWorkspace[0].WORKSPACE_NAME}`);
        
        res.json({
            success: true,
            message: 'Workspace switched successfully',
            workspace: {
                WORKSPACE_ID: workspaceId,
                WORKSPACE_NAME: userWorkspace[0].WORKSPACE_NAME
            }
        });
        
    } catch (error) {
        console.error('❌ Error switching workspace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to switch workspace'
        });
    }
});

// Account Creator Invite Modal Completion
app.post('/api/users/complete-account-creator-invite', getAuthenticatedUserCompany, async (req, res) => {
    try {
        console.log(`🎯 Marking account creator invite as completed for user ${req.userId}`);
        
        // Update user's account creator invite completed flag
        await prisma.$queryRaw`
            UPDATE GUARDIAN.USERS 
            SET ACCOUNT_CREATOR_INVITE_COMPLETED = 1,
                UPDATE_DATE = GETDATE(),
                UPDATE_USER_ID = ${req.userId}
            WHERE USER_ID = ${req.userId}
        `;
        
        console.log(`✅ Account creator invite marked as completed for user ${req.userId}`);
        
        res.json({
            success: true,
            message: 'Account creator invite completion recorded successfully'
        });
        
    } catch (error) {
        console.error('❌ Error completing account creator invite:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete account creator invite'
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// === STATIC FILE SERVING & SPA ROUTING ===
if (isProduction) {
    // Production: Serve static files and handle SPA routing
    console.log('🏭 Production mode: Serving static files from current directory');
    app.use(express.static('.'));
    
    // SPA fallback route - must be AFTER all API routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
    console.log('🏭 Production mode: SPA routing enabled');
} else {
    // Development: Static files served by Vite dev server
    console.log('🔧 Development mode: Static files served by Vite on port 5175');
    console.log('🔧 Development mode: SPA routing handled by Vite dev server');
}

// Start server immediately, don't wait for database
console.log('🚀 Starting Express server...');

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    if (isProduction) {
        console.log(`🏭 Production mode: API + Static files + SPA routing`);
    } else {
        console.log(`🔧 Development mode: API server only`);
    }
    console.log(`🌐 Health check: /api/health`);
    console.log(`🧪 Simple test: /api/simple-test`);
    console.log('🎉 Server startup complete!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');  
    server.close(() => process.exit(0));
});

module.exports = app;
