import express from 'express';
import { Resend } from 'resend';
import * as crypto from 'crypto';
import { requireAuth } from '../auth.js';
import { isAdmin } from '../middleware/isAdmin.js';

import prisma from "../prisma-client.js";
const router = express.Router();

// Initialize Resend client
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'support@shieldlytics.com';
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://shieldlytics.com/logo.png';
const resend = new Resend(RESEND_API_KEY);

// GET /api/invites - Get all invites for admin's company
router.get('/', requireAuth, isAdmin, async (req: any, res) => {
  try {
    // Get admin's company ID from JWT token
    const adminCompanyId = req.user.COMPANY_ID;

    if (adminCompanyId === null) {
      return res.status(403).json({ error: 'Admin user is not associated with a company' });
    }

    // Get all invites for the same company
    const invites = await prisma.iNVITES.findMany({
      where: {
        COMPANY_ID: adminCompanyId
      }
    });
    
    // Get roles separately
    const roles = await prisma.rOLES.findMany();
    
    // Create a map of role IDs to role objects for quick lookup
    const roleMap = roles.reduce((map, role) => {
      map[role.ROLE_ID] = role;
      return map;
    }, {} as Record<number, any>);

    // Format the response to match what the frontend expects
    const formattedInvites = invites.map(invite => {
      const role = roleMap[invite.ROLE_ID];
      return {
        id: invite.INVITE_ID,
        email: invite.EMAIL,
        roleId: invite.ROLE_ID,
        roleName: role?.NAME || 'Unknown',
        status: invite.STATUS,
        expiresAt: invite.EXPIRES_AT,
        createdAt: invite.CREATED_AT,
        usedAt: invite.USED_AT,
        companyId: invite.COMPANY_ID
      };
    });

    res.json(formattedInvites);
  } catch (err) {
    console.error('[GET INVITES]', err);
    res.status(500).json({ error: 'Server error while fetching invites' });
  }
});

// POST /api/invites/send - Send invites
router.post('/send', requireAuth, isAdmin, async (req, res) => {
  try {
    const { invites } = req.body; // [{ email, roleId }]
    const adminUserId = (req.user as any).id;
    const adminUser = await prisma.uSERS.findUnique({ where: { USER_ID: adminUserId } });
    if (!adminUser || !adminUser.COMPANY_ID) {
      return res.status(400).json({ error: 'Admin user does not have a company_id' });
    }
    const companyId = adminUser.COMPANY_ID;
    console.log('[SEND INVITES] Invites:', invites, 'adminUserId:', adminUserId, 'companyId:', companyId);
    if (!Array.isArray(invites) || invites.length === 0) {
      return res.status(400).json({ error: 'No invites provided' });
    }
    const results: { email: string; inviteUrl: string }[] = [];
    for (const invite of invites) {
      const token = crypto.randomBytes(32).toString('hex');
      // Use admin's companyId for all invites
      await prisma.iNVITES.create({
        data: {
          EMAIL: invite.email,
          ROLE_ID: invite.roleId,
          COMPANY_ID: companyId,
          TOKEN: token,
          STATUS: 'P', // Pending
          EXPIRES_AT: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
          CREATED_AT: new Date()
        }
      });
      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept?token=${token}`;
      // Log email preparation
      console.log('[SEND INVITES] About to send email for', invite.email);
      // Attempt email send, but don't block on failure
      try {
        const { data, error } = await resend.emails.send({
          from: `Shieldlytics <${EMAIL_FROM}>`,
          to: [invite.email],
          subject: 'You have been invited to Guardian!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${EMAIL_LOGO_URL}" alt="Shieldlytics" style="height:40px;">
              </div>
              <h2 style="color: #333;">You have been invited to Guardian!</h2>
              <p>Hello,</p>
              <p>You have been invited to join Guardian, a modern security and compliance platform designed to protect your organization and streamline your workflows.</p>
              <p>Please click the button below to accept your invitation and set up your account:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${inviteUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Your Invitation</a>
              </div>
              <p>If you have any questions or did not expect this, please contact our support team at support@shieldlytics.com.</p>
              <p>Best regards,<br>The Shieldlytics Team</p>
              <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
              <p style="font-size: 12px; color: #777; text-align: center;">
                If you're having trouble with the button above, copy and paste this link into your browser:<br>
                ${inviteUrl}
              </p>
            </div>
          `,
        });

        if (error) {
          console.error('[RESEND] Error sending email:', error);
          throw error;
        }

        console.log('[RESEND] Email sent successfully:', data);
      } catch (emailErr: any) {
        console.error('[SEND INVITES] Failed to send email:', emailErr);
        console.error('[SEND INVITES] Error details:', emailErr.response?.body?.errors || emailErr.message);
        // Continue execution even if email fails
      }
      results.push({ email: invite.email, inviteUrl });
    }
    return res.json({ success: true, invites: results });
  } catch (err) {
    console.error('[SEND INVITES]', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// POST /api/invites/resend - Resend invite
router.post('/resend', requireAuth, isAdmin, async (req, res) => {
  try {
    const { inviteId, INVITE_ID } = req.body;
    const id = inviteId || INVITE_ID;
    
    if (!id) {
      return res.status(400).json({ error: 'Invite ID is required' });
    }

    const invite = await prisma.iNVITES.findUnique({
      where: { INVITE_ID: id }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Update the invite with a new expiration date
    const updatedInvite = await prisma.iNVITES.update({
      where: { INVITE_ID: id },
      data: {
        EXPIRES_AT: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        STATUS: 'P' // Set status back to pending
      }
    });

    // TODO: Send email with invite link (implement this based on your email sending logic)

    res.json({ success: true, invite: updatedInvite });
  } catch (err) {
    console.error('[RESEND INVITE]', err);
    res.status(500).json({ error: 'Server error while resending invite' });
  }
});

// DELETE /api/invites/:id - Delete invite
router.delete('/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid invite ID' });
    }

    const invite = await prisma.iNVITES.findUnique({
      where: { INVITE_ID: id }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    await prisma.iNVITES.delete({
      where: { INVITE_ID: id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE INVITE]', err);
    res.status(500).json({ error: 'Server error while deleting invite' });
  }
});

export default router;