import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { isExpired } from '../services/token.js';
import ShopifyImp from '../implements/shopify.imp.js';
import handleError from '../middlewares/error-handle.js';
import SubscriptionImp from '../implements/skio.imp.js';
import DBRepository from '../repositories/postgres.repository.js';
import { SubscriptionSchema, AddressSchema } from '../schemas/token.js';

const router = Router();
const dbRepository = new DBRepository();

/**
 *  @openapi
 *  /token/subscription/validate:
 *    post:
 *      tags:
 *        - Token
 *      description: Validate Token
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                email:
 *                  type: string
 *                token:
 *                  type: string
 *                subscription:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post('/subscription/validate', handleError(SubscriptionSchema), async (req, res) => {
    try {
        let shopOrigin = req.get('origin');
        let shopDomain = SHOPS_ORIGIN[shopOrigin !== 'null' ? shopOrigin : 'https://hotshapers.com'];
        const { shop, shopAlias } = shopDomain;

        const subscriptionImp = new SubscriptionImp(shop, shopAlias);
        const shopifyImp = new ShopifyImp(shop, shopAlias);

        const { email, token, subscription } = req.body;
        const objectToken = await dbRepository.validateToken(shopAlias, email, token);

        if (!objectToken) throw new Error('Email or Token Not Found');
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shopAlias, email);
            throw new Error('Email or Token Not Found');
        }
        if (objectToken.token !== token) throw new Error('Email or Token Not Found');

        const subscriptionData = await subscriptionImp.getSubscription(email, subscription);
        if (!subscriptionData) throw new Error('It is not possible to cancel the subscription');

        // Si el estado en la dirección de la orden es de CALIFORNIA, cancelar normal
        if (subscriptionData.ShippingAddress.province.toUpperCase() === 'CALIFORNIA') {
            const subscriptionCancelled = await subscriptionImp.cancelSubscription(subscription);
            if (!subscriptionCancelled) throw new Error('It is not possible to cancel the subscription');
            await dbRepository.deleteToken(shopAlias, email);
            res.json({ message: 'Subscription successfully cancelled' })
            return;
        }

        // Si el estado en la dirección de la orden es diferente de CALIFORNIA, crear draft order.
        // Primero se debe verificar si ya existe una draft order. Si existe, enviar invoice.
        const { draft_order: draftOrder  } = await dbRepository.getDraftOrder(shopAlias, subscription);
        if (draftOrder) {
            const result = await shopifyImp.sendDraftOrderInvoice(draftOrder);
            res.json({ message: 'The invoice of the order was resent to continue with the cancellation of the subscription.' })
        } else {
            const productSubscription = subscriptionData['SubscriptionLines'][0]['OrderLineItems'][0]['ProductVariant'];
            const variantId = productSubscription['platformId'].split('/').pop();
            const subscriptionId = await shopifyImp.productIdByVariant(variantId);
            const productOneTime = await shopifyImp.oneTimeBySubscription(subscriptionId);
            const quantity = Math.floor(productOneTime.price - productSubscription.price);
            const draftOrderInput = {
                email,
                shippingAddress: {
                    address1: subscriptionData.ShippingAddress.address1,
                    city: subscriptionData.ShippingAddress.city,
                    province: subscriptionData.ShippingAddress.province,
                    country: subscriptionData.ShippingAddress.country,
                    zip: subscriptionData.ShippingAddress.zip,
                },
                lineItems: [
                    {
                        variantId: 'gid://shopify/ProductVariant/50336271302937', // ID de la variante de 1 dólar
                        quantity
                    }
                ]
            };
            const result = await shopifyImp.createDraftOrder(draftOrderInput);
            res.json({ message: 'To finalize the subscription cancellation process please pay the draft order that has been created.' })
        }
    } catch (err) {
        console.log(err);
        logger.error(err.message);
        res.status(500).json({ message: err.message })
    }
})

/**
 *  @openapi
 *  /token/address/validate:
 *    post:
 *      tags:
 *        - Token
 *      description: Validate Token And Return Orders To Update Addresses
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                email:
 *                  type: string
 *                token:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON with Orders
 */
router.post('/address/validate', handleError(AddressSchema), async (req, res) => {
    try {
        let shopOrigin = req.get('origin');
        let shopDomain = SHOPS_ORIGIN[shopOrigin !== 'null' ? shopOrigin : 'https://hotshapers.com'];
        const { shop, shopAlias } = shopDomain;
        const shopifyImp = new ShopifyImp(shop, shopAlias);
        const { email, token } = req.body;
        const objectToken = await dbRepository.validateToken(shopAlias, email, token);
        if (!objectToken) throw new Error('Email or Token Not Found');
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shopAlias, email);
            throw new Error('Email or Token Not Found');
        }
        if (objectToken.token !== token) throw new Error('Email or Token Not Found');
        const orders = await shopifyImp.getActiveOrders(email);
        res.json({ orders })
    } catch (err) {
        console.log(err);
        logger.error(err.message);
        res.status(500).json({ message: err.message })
    }
})

export default router;