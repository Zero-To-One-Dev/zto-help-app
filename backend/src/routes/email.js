import { Router } from 'express';
import logger from '../../logger.js';
import redis from '../redisSetup.js';
import emailSchema from '../schemas/email.js';
import { sendMail } from '../services/email.js';
import handleError from '../middlewares/errorHandle.js';
import { generateSecureToken } from '../services/token.js';

const router = Router();

/**
 *  @openapi
 *  /email/send:
 *    post:
 *      tags:
 *        - Email
 *      description: Send Email
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                email:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post('/send', handleError(emailSchema), async (req, res) => {
    try {
        const { email } = req.body;
        const token = generateSecureToken();
        // Guardar token con email en base de datos
        redis.set(email, token);
        // Enviar el token por correo
        await sendMail(email, 'email-token', { token });
        res.json({'message': `Token sent successfully`})
    } catch (err) {
        logger.error(err);
        res.status(500).json({ message: err });
    }
})

export default router;