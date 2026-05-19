export function forbid(res, action) {
    return res.status(403).json({ error: `You do not have permission to ${action}.` });
}
