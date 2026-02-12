/**
 * WhatsApp webhook routes: GET verify, POST inbound.
 */

import { Router } from 'express';
import { handleWebhookVerify, handleWebhookPost } from '../whatsapp';

const router = Router();

router.get('/webhook/whatsapp', (req, res) => handleWebhookVerify(req, res));
router.post('/webhook/whatsapp', (req, res) => handleWebhookPost(req, res));

export default router;
