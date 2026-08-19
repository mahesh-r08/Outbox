import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getSingleEmail,
  cancelEmail,
  getMetrics,
} from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/schedule', scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/metrics', getMetrics);
router.get('/:id', getSingleEmail);
router.post('/:id/cancel', cancelEmail);

export default router;
