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
const mailer = new Mailer();

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
    try {
        let shopOrigin = req.get('origin');
        let shopDomain = SHOPS_ORIGIN[shopOrigin !== 'null' ? shopOrigin : 'https://hotshapers.com'];
        const { shop, shopAlias, shopName, shopColor, contactPage } = shopDomain;
        const subscriptionImp = new SubscriptionImp(shop, shopAlias);
        const shopifyImp = new ShopifyImp(shop, shopAlias);
        const { email, token, id, address1, address2, provinceCode, province, city, zip } = req.body;
        const objectToken = await dbRepository.validateToken(shopAlias, email, token);
        if (!objectToken) throw new Error('Email or Token Not Found');
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shop, email, token);
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

        await mailer.sendEmail(email, 'update-address-confirm', 'Your Shipping Address Has Been Updated',
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
    }
})

export default router;