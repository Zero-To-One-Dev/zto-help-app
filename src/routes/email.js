import express from 'express';
import logger from '../../logger.js';
import ConfigStores from '../services/config-stores.js';
import { EmailSubscriptionSchema, EmailAddressSchema } from '../schemas/email.js';
import Mailer from '../implements/nodemailer.imp.js';
import handleError from '../middlewares/error-handle.js';
import DBRepository from '../repositories/postgres.repository.js';
import { generateSecureToken, isExpired } from '../services/token.js';
import path from 'node:path';
import MessageImp from '../implements/slack.imp.js'


const router = express.Router();


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
    let shopAlias, email, subscription, shopName, emailSender = '';
    const SHOPS_ORIGIN = await ConfigStores.getShopsOrigin();
    try {
        ({ shopAlias, shopName, emailSender } = SHOPS_ORIGIN[req.get('origin')]);
        ({ email, subscription } = req.body);
        const mailer = new Mailer(shopAlias);

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

        const errorMessage = err.message.replace(/[^\w\s]/gi, '').replace(/[\n\t]/g, ' ');
        const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
        let errorData = `ℹ️ EMAIL: ${email}\\n`;
        errorData += `ℹ️ SUBSCRIPTION: ${subscription}\\n`;
        const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`;
        const errorRoute = `📌 ROUTE: /email/subscription/send`;
        const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
        const errorTitle = "🔴 ❌ ERROR: Error while trying to send the token to the user's email";
        messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
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
    let shopAlias, email, shopName, emailSender = '';
    const SHOPS_ORIGIN = await ConfigStores.getShopsOrigin();
    try {
        ({ shopAlias, shopName, emailSender } = SHOPS_ORIGIN[req.get('origin')]);
        ({ email } = req.body);
        const mailer = new Mailer(shopAlias);

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

        const errorMessage = err.message.replace(/[^\w\s]/gi, '').replace(/[\n\t]/g, ' ');
        const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
        const errorData = `ℹ️ EMAIL: ${email}\\n`;
        const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`;
        const errorRoute = `📌 ROUTE: /email/address/send`;
        const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
        const errorTitle = "🔴 ❌ ERROR: Error while trying to send the token to the user's email";
        messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
    }
})

export default router;