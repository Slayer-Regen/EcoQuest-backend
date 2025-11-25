import { Router } from 'express';

const router = Router();

// Webhook routes don't use JWT auth - they use HMAC signature verification
router.post('/partner-purchase', (req, res) => {
    res.json({ message: 'Partner purchase webhook - not yet implemented' });
});

export default router;
