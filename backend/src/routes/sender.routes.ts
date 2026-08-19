import { Router } from 'express';
import { getSenders, createSender, deleteSender } from '../controllers/sender.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getSenders);
router.post('/', createSender);
router.delete('/:id', deleteSender);

export default router;
