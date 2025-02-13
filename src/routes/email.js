import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { EmailSubscriptionSchema, EmailAddressSchema } from '../schemas/email.js';
import Mailer from '../implements/nodemailer.imp.js';
import handleError from '../middlewares/errorHandle.js';
import DBRepository from '../repositories/postgres.repository.js';
import { generateSecureToken, isExpired } from '../services/token.js';

const router = Router();
const dbRepository = new DBRepository();
const mailer = new Mailer();

/**
 *  @openapi
 *  /email/subscription/send:
 *    post:
 *      tags:
 *        - Email
 *      description: Send Email For Cancel Subscription
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
router.post('/subscription/send', handleError(EmailSubscriptionSchema), async (req, res) => {
    try {
        const { shopAlias } = SHOPS_ORIGIN[req.get('origin')];
        const { email, subscription } = req.body;
        const objectToken = await dbRepository.validateTokenExists(shopAlias, email);
        if (objectToken) {
            if (isExpired(objectToken.expire_at)) {
                await dbRepository.deleteToken(shopAlias, email);
            } else throw new Error('Token already generated, please wait 5 minutes');
        }
        const token = generateSecureToken();
        await dbRepository.saveToken(shopAlias, email, token, { subscription });
        // await mailer.sendEmail(email, 'email-token', 'Verification Code', { token });
        logger.info(`Token: ${token}`)
        res.json({ message: 'We sent you a token to verify your email, please check your inbox' })
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });
    }
})

/**
 *  @openapi
 *  /email/address/send:
 *    post:
 *      tags:
 *        - Email
 *      description: Send Email For Change Address
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
router.post('/address/send', handleError(EmailAddressSchema), async (req, res) => {
    try {
        let shopOrigin = req.get('origin');
        let shopDomain = SHOPS_ORIGIN[shopOrigin !== 'null' ? shopOrigin : 'https://hotshapers.com'];
        const { shopAlias } = shopDomain;
        const { email } = req.body;
        const objectToken = await dbRepository.validateTokenExists(shopAlias, email);
        if (objectToken) {
            if (isExpired(objectToken.expire_at)) {
                await dbRepository.deleteToken(shopAlias, email);
            } else throw new Error('Token already generated, please wait 5 minutes');
        }
        const token = generateSecureToken();
        await dbRepository.saveToken(shopAlias, email, token);
        await mailer.sendEmail(email, 'email-token', 'Verification Code', { token });
        res.json({ message: 'We sent you a token to verify your email, please check your inbox' })
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });
    }
})

export default router;