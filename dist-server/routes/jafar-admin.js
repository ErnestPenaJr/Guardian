import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { requireJafar } from '../middleware/requireJafar.js';
import { getJafarCompanies, getJafarUsers, previewCompanyPurge, previewUserPurge, purgeCompany, purgeUser } from '../services/jafarPurge.js';
const router = Router();
const getActorUserId = (req) => {
    const authUser = req.user;
    return Number(authUser?.id ?? authUser?.userId);
};
router.use(requireAuth, requireJafar);
router.get('/users', async (req, res) => {
    try {
        const query = typeof req.query.q === 'string' ? req.query.q : undefined;
        const users = await getJafarUsers(query);
        res.json({ success: true, data: users });
    }
    catch (error) {
        console.error('[JAFAR ADMIN] Failed to load users:', error);
        res.status(500).json({ error: 'Failed to load users' });
    }
});
router.get('/companies', async (req, res) => {
    try {
        const query = typeof req.query.q === 'string' ? req.query.q : undefined;
        const companies = await getJafarCompanies(query);
        res.json({
            success: true,
            data: companies.map((company) => ({
                ...company,
                USER_COUNT: Number(company.USER_COUNT)
            }))
        });
    }
    catch (error) {
        console.error('[JAFAR ADMIN] Failed to load companies:', error);
        res.status(500).json({ error: 'Failed to load companies' });
    }
});
router.get('/purge/user/:userId/preview', async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        const preview = await previewUserPurge(userId, getActorUserId(req));
        res.json(preview);
    }
    catch (error) {
        console.error('[JAFAR ADMIN] Failed to preview user purge:', error);
        res.status(String(error).includes('not found') ? 404 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to preview user purge'
        });
    }
});
router.post('/purge/user/:userId', async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const confirmation = String(req.body?.confirmation || '');
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        if (confirmation !== 'DELETE') {
            return res.status(400).json({ error: 'Confirmation phrase must be DELETE' });
        }
        const result = await purgeUser(userId, getActorUserId(req));
        res.json(result);
    }
    catch (error) {
        console.error('[JAFAR ADMIN] Failed to purge user:', error);
        res.status(String(error).includes('not found') ? 404 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to purge user'
        });
    }
});
router.get('/purge/company/:companyId/preview', async (req, res) => {
    try {
        const companyId = Number(req.params.companyId);
        if (!Number.isInteger(companyId) || companyId <= 0) {
            return res.status(400).json({ error: 'Invalid company id' });
        }
        const preview = await previewCompanyPurge(companyId, getActorUserId(req));
        res.json(preview);
    }
    catch (error) {
        console.error('[JAFAR ADMIN] Failed to preview company purge:', error);
        res.status(String(error).includes('not found') ? 404 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to preview company purge'
        });
    }
});
router.post('/purge/company/:companyId', async (req, res) => {
    try {
        const companyId = Number(req.params.companyId);
        const confirmation = String(req.body?.confirmation || '');
        if (!Number.isInteger(companyId) || companyId <= 0) {
            return res.status(400).json({ error: 'Invalid company id' });
        }
        if (confirmation !== 'DELETE') {
            return res.status(400).json({ error: 'Confirmation phrase must be DELETE' });
        }
        const result = await purgeCompany(companyId, getActorUserId(req));
        res.json(result);
    }
    catch (error) {
        console.error('[JAFAR ADMIN] Failed to purge company:', error);
        res.status(String(error).includes('not found') ? 404 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to purge company'
        });
    }
});
export default router;
