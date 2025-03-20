import path from 'node:path';
import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { isExpired } from '../services/token.js';
import Mailer from '../implements/nodemailer.imp.js';
import ShopifyImp from '../implements/shopify.imp.js';
import { AddressSchema } from '../schemas/address.js';
import SubscriptionImp from '../implements/skio.imp.js';
import handleError from '../middlewares/error-handle.js';
import DBRepository from '../repositories/postgres.repository.js';

const router = Router();
const dbRepository = new DBRepository();

/**
 *  @openapi
 *  /address/update:
 *    post:
 *      tags:
 *        - Address
 *      description: Update Address
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
router.post('/update', handleError(AddressSchema), async (req, res) => {
    let shopAlias, shopName, shopColor, emailSender, email, token, id, address1, address2, provinceCode, province, city, zip = '';
    try {
        ({ shopAlias, shopName, shopColor, contactPage, emailSender } = SHOPS_ORIGIN[req.get('origin')]);
        ({ email, token, id, address1, address2, provinceCode, province, city, zip } = req.body);
        const mailer = new Mailer(shopAlias);
        const subscriptionImp = new SubscriptionImp(shopAlias);
        const shopifyImp = new ShopifyImp(shopAlias);

        const objectToken = await dbRepository.validateToken(shopAlias, email, token);
        if (!objectToken) throw new Error('Email or Token Not Found');
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shopAlias, email);
            throw new Error('Token expired');
        }

        // Actualizar la fecha de caducidad del token
        const expirationDateUpdated = await dbRepository.updateTokenExpirationDate(shopAlias, email, token);
        if (expirationDateUpdated) logger.info('Token expiration date updated');
        else logger.error('Token expiration date not updated');

        const order = await shopifyImp.getOrderById(id);
        const ordersUpdated = await shopifyImp.updateAddress(id, address1, address2, provinceCode, city, zip);
        if (ordersUpdated.userErrors.length) {
            res.status(400).json(
                {
                    message: 'There was an error with the information provided',
                    errors: ordersUpdated.userErrors
                }
            );
            return;
        }

        const subscriptions = await subscriptionImp.subscriptionsByOrder(id)
        let allSubscriptionsOk = true;
        for (const subscriptionId of subscriptions) {
            const subscriptionUpdated = await subscriptionImp.updateSubscriptionAddress(
                subscriptionId, address1, address2, province, city, zip);
            allSubscriptionsOk = allSubscriptionsOk && subscriptionUpdated.ok;
            // Aqui pensaría en almacenar las subscripciones que por alguna razón no fueron actualizadas correctamente
        }        
            
        if (!allSubscriptionsOk) throw new Error('There were one or more products in the order that could not be updated, please confirm with technical support.');

        let newAddress = `${address1}, ` 
        if (address2) newAddress += `${address2}, `;
        newAddress += `${city}, ${province}, ${order.shippingAddress.country}`;

        await mailer.sendEmail(emailSender, email, 'update-address-confirm', 'Your Shipping Address Has Been Updated',
            {
                customerName: order.shippingAddress.name,
                orderName: order.name,
                newAddress,
                contactPage,
                shopName,
                shopColor
            },
            [
                {
                    filename: 'top_banner.png',
                    path: path.resolve() + `/public/imgs/${shopAlias}/top_banner.png`,
                    cid: 'top_banner'
                }
            ]
            );
        res.json({ message: 'The address has been successfully updated' })
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });

        const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
        let errorData = `ℹ️ EMAIL: ${email}\\n`;
        errorData += `ℹ️ ORDER ID: ${id}\\n`;
        errorData += `ℹ️ ADDRESS1: ${address1}\\n`;
        errorData += `ℹ️ ADDRESS2: ${address2}\\n`;
        errorData += `ℹ️ PROVINCE: ${province}\\n`;
        errorData += `ℹ️ CITY: ${city}\\n`;
        errorData += `ℹ️ ZIP: ${zip}\\n`;
        const errorMessage = `📝 DESCRIPTION: ${err.message}\\n`;
        const errorRoute = `📌 ROUTE: /token/address/validate`;
        const errorFullMessage = `${errorShop}${errorData}${errorMessage}${errorRoute}`;
        const errorTitle = "🔴 ❌ ERROR: Error while trying to validate token to update address";
        messageImp.toUpdateAddressErrors(errorFullMessage, errorTitle);
    }
})

export default router;