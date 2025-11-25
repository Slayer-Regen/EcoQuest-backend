import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Admin routes - require authentication
router.use(authenticate);

router.post('/', (req, res) => {
    res.json({ message: 'Create partner - not yet implemented' });
});

router.get('/', (req, res) => {
    res.json({ message: 'List partners - not yet implemented' });
});

router.get('/:id', (req, res) => {
    res.json({ message: 'Get partner - not yet implemented' });
});

router.patch('/:id', (req, res) => {
    res.json({ message: 'Update partner - not yet implemented' });
});

export default router;
