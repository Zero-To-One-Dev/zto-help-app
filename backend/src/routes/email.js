import { Router } from 'express';
import logger from '../../logger.js';
import emailSchema from '../schemas/email.js';
import Mailer from '../implements/nodemailer.imp.js';
import handleError from '../middlewares/errorHandle.js';
import { generateSecureToken, isExpired } from '../services/token.js';
import DBRepository from '../repositories/redis.repository.js';

const router = Router();
const dbRepository = new DBRepository();
const mailer = new Mailer();

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
 * 
 */
router.post('/send', handleError(emailSchema), async (req, res) => {
    try {
        const { email, subscription } = req.body;
        const objectToken = await dbRepository.getTokenByEmail(email);
        if (objectToken && !isExpired(objectToken.expireAt)) {
            throw new Error('Token already generated, please wait 5 minutes');
        }
        const token = generateSecureToken();
        await dbRepository.saveToken(email, token, subscription);
        await mailer.sendEmail(email, 'email-token', 'Verification Code', { token });
        res.json({ message: 'We sent you a token to verify your email, please check your inbox' })
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });
    }
})

export default router;