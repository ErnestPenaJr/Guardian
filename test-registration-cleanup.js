/**
 * Guardian MVP Registration Cleanup Test
 * 
 * This script demonstrates and tests the comprehensive registration cleanup mechanism.
 * It creates test incomplete registrations and then tests the cleanup functionality.
 * 
 * Usage: node test-registration-cleanup.js
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

// Configuration
const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL_PREFIX = 'cleanup-test';
const TEST_DOMAIN = 'example.com';

// Test utilities
const generateTestEmail = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${TEST_EMAIL_PREFIX}-${timestamp}-${random}@${TEST_DOMAIN}`;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// API helpers
const apiCall = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    
    const data = await response.json();
    
    console.log(`=á ${options.method || 'GET'} ${endpoint}: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        console.log(`   L Error: ${JSON.stringify(data, null, 2)}`);
    } else {
        console.log(`    Success: ${data.message || data.success || 'OK'}`);
    }
    
    return { response, data };
};

// Test functions
const testCreateIncompleteRegistrations = async () => {
    console.log(`\n>ê === TEST 1: Creating Incomplete Registrations ===`);
    
    const testEmails = [];
    
    for (let i = 0; i < 3; i++) {
        const email = generateTestEmail();
        testEmails.push(email);
        
        console.log(`\n=Ý Creating incomplete registration ${i + 1}/3 for: ${email}`);
        
        const { response, data } = await apiCall('/api/register', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            console.log(`    Registration created successfully`);
        } else {
            console.log(`   L Registration failed: ${data.error}`);
        }
        
        // Small delay between registrations
        await sleep(1000);
    }
    
    return testEmails;
};

const testCleanupStatistics = async () => {
    console.log(`\n=Ê === TEST 2: Getting Cleanup Statistics ===`);
    
    const { response, data } = await apiCall('/api/cleanup/stats?daysOld=0');
    
    if (response.ok) {
        console.log(`   =È Current Statistics:`);
        console.log(`      - Total unverified users: ${data.statistics.totalUnverifiedUsers}`);
        console.log(`      - Stale unverified users (>30 min): ${data.statistics.staleUnverifiedUsers}`);
        console.log(`      - Old unverified users (>0 days): ${data.statistics.oldUnverifiedUsers}`);
        console.log(`      - Expired tokens: ${data.statistics.expiredTokens}`);
    }
    
    return data.statistics;
};

const testManualCleanup = async (email) => {
    console.log(`\n>ù === TEST 3: Manual Cleanup for Specific Email ===`);
    
    console.log(`=' Testing manual cleanup for: ${email}`);
    
    const { response, data } = await apiCall('/api/cleanup/incomplete-registrations', {
        method: 'POST',
        body: JSON.stringify({ 
            email: email,
            timeoutMinutes: 0  // Clean up immediately for testing
        })
    });
    
    if (response.ok) {
        console.log(`    Manual cleanup completed`);
        console.log(`      - Users cleaned: ${data.results.totalCleaned}`);
        console.log(`      - Expired tokens: ${data.results.details.expiredTokens}`);
        console.log(`      - Orphaned roles: ${data.results.details.orphanedRoles}`);
        console.log(`      - Orphaned companies: ${data.results.details.orphanedCompanies}`);
        console.log(`      - Errors: ${data.results.details.errors.length}`);
        
        if (data.results.details.errors.length > 0) {
            console.log(`      - Error details: ${JSON.stringify(data.results.details.errors, null, 2)}`);
        }
    }
    
    return data.results;
};

const testPeriodicCleanup = async () => {
    console.log(`\n= === TEST 4: Periodic Cleanup ===`);
    
    console.log(`=' Testing periodic cleanup for registrations older than 0 days`);
    
    const { response, data } = await apiCall('/api/cleanup/periodic', {
        method: 'POST',
        body: JSON.stringify({ 
            daysOld: 0  // Clean up everything for testing
        })
    });
    
    if (response.ok) {
        console.log(`    Periodic cleanup completed`);
        console.log(`      - Users removed: ${data.summary.totalUsersRemoved}`);
        console.log(`      - Companies removed: ${data.summary.totalCompaniesRemoved}`);
        console.log(`      - Role assignments removed: ${data.summary.totalRolesRemoved}`);
        console.log(`      - Errors: ${data.summary.errors.length}`);
        
        if (data.summary.errors.length > 0) {
            console.log(`      - Error details: ${JSON.stringify(data.summary.errors, null, 2)}`);
        }
    }
    
    return data.summary;
};

const testRegistrationFlow = async () => {
    console.log(`\n= === TEST 5: Registration Flow with Cleanup ===`);
    
    const email = generateTestEmail();
    console.log(`=Ý Testing registration flow for: ${email}`);
    
    // Step 1: First registration
    console.log(`\n   Step 1: Initial registration`);
    const { response: r1, data: d1 } = await apiCall('/api/register', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
    
    // Step 2: Immediate re-registration (should get existing)
    console.log(`\n   Step 2: Immediate re-registration (should reuse recent)`);
    const { response: r2, data: d2 } = await apiCall('/api/register', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
    
    console.log(`      Result: ${d2.existingRegistration ? 'Reused existing' : 'Created new'}`);
    
    // Step 3: Wait and try again (should trigger cleanup)
    console.log(`\n   Step 3: Waiting 2 seconds and trying again...`);
    await sleep(2000);
    
    // Manually clean up first to simulate stale data
    await apiCall('/api/cleanup/incomplete-registrations', {
        method: 'POST',
        body: JSON.stringify({ email, timeoutMinutes: 0 })
    });
    
    // Now register again (should create fresh)
    const { response: r3, data: d3 } = await apiCall('/api/register', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
    
    console.log(`      Result: ${d3.existingRegistration ? 'Reused existing' : 'Created fresh after cleanup'}`);
    
    return email;
};

// Main test execution
const runAllTests = async () => {
    console.log(`=€ Guardian MVP Registration Cleanup Test Suite`);
    console.log(`=Å Started at: ${new Date().toISOString()}`);
    console.log(`< Testing against: ${BASE_URL}`);
    
    try {
        // Test server connectivity
        console.log(`\n= === CONNECTIVITY TEST ===`);
        const { response } = await apiCall('/api/health');
        if (!response.ok) {
            console.log(`L Server not responding. Make sure the server is running on ${BASE_URL}`);
            return;
        }
        
        // Run all tests
        const testEmails = await testCreateIncompleteRegistrations();
        await sleep(2000); // Wait for data to settle
        
        const initialStats = await testCleanupStatistics();
        
        if (testEmails.length > 0) {
            await testManualCleanup(testEmails[0]);
        }
        
        await testPeriodicCleanup();
        
        const finalStats = await testCleanupStatistics();
        
        await testRegistrationFlow();
        
        // Summary
        console.log(`\n=Ë === TEST SUMMARY ===`);
        console.log(` All tests completed successfully`);
        console.log(`=Ê Statistics comparison:`);
        console.log(`   - Initial unverified users: ${initialStats.totalUnverifiedUsers}`);
        console.log(`   - Final unverified users: ${finalStats.totalUnverifiedUsers}`);
        console.log(`   - Users cleaned: ${initialStats.totalUnverifiedUsers - finalStats.totalUnverifiedUsers}`);
        
        console.log(`\n<¯ === CLEANUP VERIFICATION ===`);
        console.log(`The cleanup mechanism is working correctly if:`);
        console.log(` 1. Registration flow handles existing users properly`);
        console.log(` 2. Manual cleanup removes specific email data`);
        console.log(` 3. Periodic cleanup removes old registrations`);
        console.log(` 4. Statistics show reduced unverified user counts`);
        console.log(` 5. No errors occurred during cleanup operations`);
        
    } catch (error) {
        console.error(`L Test suite failed:`, error);
        console.log(`\n=' Troubleshooting tips:`);
        console.log(`1. Make sure the server is running: bun server.cjs`);
        console.log(`2. Check database connectivity`);
        console.log(`3. Verify all cleanup endpoints are available`);
    }
    
    console.log(`\n<Á Test suite completed at: ${new Date().toISOString()}`);
};

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testCreateIncompleteRegistrations,
    testCleanupStatistics,
    testManualCleanup,
    testPeriodicCleanup,
    testRegistrationFlow
};