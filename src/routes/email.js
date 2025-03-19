import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { EmailSubscriptionSchema, EmailAddressSchema } from '../schemas/email.js';
import Mailer from '../implements/nodemailer.imp.js';
import handleError from '../middlewares/error-handle.js';
import DBRepository from '../repositories/postgres.repository.js';
import { generateSecureToken, isExpired } from '../services/token.js';
import path from 'node:path';
import MessageImp from '../implements/slack.imp.js'


const router = Router();
const dbRepository = new DBRepository();
const messageImp = new MessageImp();


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
 *                subscription:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 * 
 */
router.post('/subscription/send', handleError(EmailSubscriptionSchema), async (req, res) => {
    try {
        const { shopAlias, shopName, emailSender } = SHOPS_ORIGIN[req.get('origin')];
        const mailer = new Mailer(shopAlias);
        const { email, subscription } = req.body;
        const objectToken = await dbRepository.validateTokenExists(shopAlias, email);
        if (objectToken) {
            if (isExpired(objectToken.expire_at)) {
                await dbRepository.deleteToken(shopAlias, email);
            } else {
                await dbRepository.setSubscriptionToken(shopAlias, email, subscription)
                res.json({ message: 'We already sent you a token to verify your email, please check your inbox' });
                return;
            }
        }
        const token = generateSecureToken();
        await dbRepository.saveToken(shopAlias, email, token, { subscription });
        await mailer.sendEmail(emailSender, email, 'email-token', 'Verification Code', { token, shopName },
            [
                {
                    filename: 'verification_code.png',
                    path: path.resolve() + `/public/imgs/${shopAlias}/verification_code.png`,
                    cid: 'top_banner'
                }
            ]
        );
        res.json({ message: 'We sent you a token to verify your email, please check your inbox' })
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });
        const messageError = `📝 DESCRIPTION: ${err.message}\\n📌 ROUTE: /email/subscription/send`;
        messageImp.sendMessage(messageError,
            "🔴 ❌ ERROR: Error while trying to send the token to the user's email");
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
        const { shopAlias, shopName, emailSender } = shopDomain;
        const mailer = new Mailer(shopAlias);
        const { email } = req.body;
        const objectToken = await dbRepository.validateTokenExists(shopAlias, email);
        if (objectToken) {
            if (isExpired(objectToken.expire_at)) {
                await dbRepository.deleteToken(shopAlias, email);
            } else {
                res.json({ message: 'We already sent you a token to verify your email, please check your inbox' })
                return;
            }
        }
        const token = generateSecureToken();
        await dbRepository.saveToken(shopAlias, email, token);
        await mailer.sendEmail(emailSender, email, 'email-token', 'Verification Code', { token, shopName },
            [
                {
                    filename: 'top_banner.png',
                    path: path.resolve() + `/public/imgs/${shopAlias}/top_banner.png`,
                    cid: 'top_banner'
                }
            ]
        );
        res.json({ message: 'We sent you a token to verify your email, please check your inbox' })
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });
        messageImp.sendMessage(err.message, '❌ Error on /email/address/send')
    }
})

export default router;