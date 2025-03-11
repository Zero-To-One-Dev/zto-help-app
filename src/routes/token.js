import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { isExpired } from '../services/token.js';
import ShopifyImp from '../implements/shopify.imp.js';
import handleError from '../middlewares/error-handle.js';
import SubscriptionImp from '../implements/skio.imp.js';
import DBRepository from '../repositories/postgres.repository.js';
import { TokenSchema } from '../schemas/token.js';

const router = Router();
const dbRepository = new DBRepository();

async function getActiveDraftOrder(shopAlias, subscription) {
    const draftOrder = await dbRepository.getLastDraftOrderBySubscription(shopAlias, subscription);
    return draftOrder && draftOrder.payment_due > new Date() ? draftOrder : null;
}

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
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post('/subscription/validate', handleError(TokenSchema), async (req, res) => {
    try {
        let shopOrigin = req.get('origin');
        let shopDomain = SHOPS_ORIGIN[shopOrigin !== 'null' ? shopOrigin : 'https://hotshapers.com'];
        const { shop, shopAlias, productFakeVariantId } = shopDomain;
        
        const { email, token, subscription } = req.body;
        const objectToken = await dbRepository.validateToken(shopAlias, email, token);
        
        if (!objectToken) throw new Error('Email or Token Not Found');
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shopAlias, email);
            throw new Error('Email or Token Not Found');
        }
        if (objectToken.token !== token) throw new Error('Email or Token Not Found');
        
        const subscriptionImp = new SubscriptionImp(shop, shopAlias);
        const shopifyImp = new ShopifyImp(shop, shopAlias);
        
        const subscriptionData = await subscriptionImp.getSubscription(email, subscription);
        if (!subscriptionData) throw new Error('It is not possible to cancel the subscription');
        if (subscriptionData.cyclesCompleted > 1) throw new Error('The subscription have more than 1 cycle completed');

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
        const draftOrderExists = await getActiveDraftOrder(shopAlias, subscription);
        if (draftOrderExists) {
            await shopifyImp.sendDraftOrderInvoice(draftOrderExists.draft_order);
            res.json({ message: 'The invoice of the order was resent to continue with the cancellation of the subscription' })
        } else {
            const variantsQuery = ((subscriptionData.SubscriptionLines
                .map(subs => subs.ProductVariant.platformId.split('/').pop()))
                .map(variantId => `variant_id:${variantId}`))
                .join(' OR ');
            const productsSubQuery = (await shopifyImp
                .productsIdsByVariant(variantsQuery))
                .map(product => product.node.id.split('/').pop())
                .map(id => `metafields.custom.product-subscription:${id}`)
                .join(' OR ');
            const quantity = (await shopifyImp
                .oneTimesBySubscriptions(productsSubQuery))
                .map(product => Math.floor(
                    product.node.variants.edges[0].node.price -
                    product.node.metafields.edges[0].node.reference.variants.edges[0].node.price))
                .reduce((sum, a) => sum + a, 0);
            const draftOrderInput = {
                acceptAutomaticDiscounts: false,
                allowDiscountCodesInCheckout: false,
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
                        variantId: productFakeVariantId, // ID de la variante de 1 dólar
                        quantity
                    }
                ]
            };
            const draftOrderId = await shopifyImp.createDraftOrder(draftOrderInput);
            await dbRepository.saveDraftOrder(shopAlias, draftOrderId, subscription);
            await shopifyImp.sendDraftOrderInvoice(draftOrderId)
            res.json({ message: 'To finalize the subscription cancellation process please pay the draft order that has been created' })
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
router.post('/address/validate', handleError(TokenSchema), async (req, res) => {
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

        // Actualizar la fecha de caducidad del token
        const expirationDateUpdated = await dbRepository.updateTokenExpirationDate(shopAlias, email, token);
        if (expirationDateUpdated) logger.info('Token expiration date updated');
        else logger.error('Token expiration date not updated');

        if (objectToken.token !== token) throw new Error('Email or Token Not Found');
        const customerName = await shopifyImp.getCustomerNameByEmail(email);
        if (!customerName) throw new Error('Customer with given email not found')
        const orders = await shopifyImp.getActiveOrders(email);
        res.json({ customerName, orders })
    } catch (err) {
        console.log(err);
        logger.error(err.message);
        res.status(500).json({ message: err.message })
    }
})

export default router;