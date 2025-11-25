import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/week/:week_start', (req, res) => {
    res.json({ message: 'Get weekly dashboard - not yet implemented' });
});

router.get('/month/:year/:month', (req, res) => {
    res.json({ message: 'Get monthly dashboard - not yet implemented' });
});

router.get('/leaderboard', (req, res) => {
    res.json({ message: 'Get leaderboard - not yet implemented' });
});

export default router;
