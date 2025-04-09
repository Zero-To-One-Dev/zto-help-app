import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { isExpired } from '../services/token.js';
import ShopifyImp from '../implements/shopify.imp.js';
import handleError from '../middlewares/error-handle.js';
import SubscriptionImp from '../implements/skio.imp.js';
import DBRepository from '../repositories/postgres.repository.js';
import { TokenSchema } from '../schemas/token.js';
import MessageImp from '../implements/slack.imp.js';


const router = Router();
const dbRepository = new DBRepository();
const messageImp = new MessageImp();


const getPriceDifference = (oneTimePrice, subPrice) => {
    oneTimePrice = Number(oneTimePrice);
    subPrice = Number(subPrice);
    return Math.floor(Math.round((oneTimePrice - subPrice) * 100) / 100);
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
    let shopAlias, productFakeVariantId, productSubscriptionMetafieldKey, email, token, subscription, cancelSessionId = '';
    try {
        ({ shopAlias, productFakeVariantId, productSubscriptionMetafieldKey } = SHOPS_ORIGIN[req.get('origin')]);
        ({ email, token, subscription, cancelSessionId } = req.body);

        const objectToken = await dbRepository.validateToken(shopAlias, email, token);
        if (!objectToken) throw new Error('Email or Token Not Found');
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shopAlias, email);
            logger.error('Email or Token Not Found');
            res.status(500).json({ message: 'Email or Token Not Found' });
            return;
        }
        if (objectToken.token !== token) {
            logger.error('Email or Token Not Found');
            res.status(500).json({ message: 'Email or Token Not Found' });
            return;
        }

        const subscriptionImp = new SubscriptionImp(shopAlias);
        const shopifyImp = new ShopifyImp(shopAlias);

        let subscriptionData = await subscriptionImp.getSubscription(email, subscription, true);;
        if (!subscriptionData) throw new Error('It is not possible to cancel the subscription');
        if (subscriptionData.cyclesCompleted > 1) throw new Error('The subscription have more than 1 cycle completed');
        if (!subscriptionData.SubscriptionLines.length) {
            subscriptionData = await subscriptionImp.getSubscription(email, subscription, false);
        }

        // Si el estado en la dirección de la orden es de CALIFORNIA, cancelar normal
        if (subscriptionData.ShippingAddress.province.toUpperCase() === 'CALIFORNIA') {
            const subscriptionCancelled = await subscriptionImp.cancelSubscription(cancelSessionId, subscription);
            if (!subscriptionCancelled) throw new Error('It is not possible to cancel the subscription');
            await dbRepository.deleteToken(shopAlias, email);
            res.json({ message: 'Subscription successfully cancelled' })
            return;
        }

        // Si el estado en la dirección de la suscripción es diferente de CALIFORNIA, crear draft order
        const subscriptionVariantsQuery = subscriptionData.SubscriptionLines
            .map(e => e.ProductVariant.platformId.split('/').pop())
            .map(variantId => `id:${variantId}`)
            .join(' OR ');
        const subscriptionProducts = (await shopifyImp.subscriptionProductsIdsBySubscriptionVariant(subscriptionVariantsQuery))
            .map(e => ({
                productId: e.node.product.id.split('/').pop(),
                variant: {
                    id: e.node.id.split('/').pop(),
                    title: e.node.title
                }
            }))
        const oneTimeBySubscriptionMetafieldQuery = subscriptionProducts
            .map(e => `(metafields.custom.${productSubscriptionMetafieldKey}:${e.productId} AND price:>0 AND -product_type:Gift)`)
            .join(' OR ');
        const oneTimeProducts = (await shopifyImp
            .oneTimesBySubscriptionMetafield(productSubscriptionMetafieldKey, oneTimeBySubscriptionMetafieldQuery))
            .map(e => ({
                subscriptionProductId: e.node.metafields.edges[0].node.jsonValue.split('/').pop(),
                variants: e.node.variants.edges.map(i => i.node)
            }))

        // Si no contiene un producto one time, es porque es un upsell,
        // y por lo tanto el producto no cuenta con producto One time,
        // por ende se debe optar por calcular con el descuento del sellign plan.
        let quantity = 0;
        for (let { productId, variant } of subscriptionProducts) {
            const oneTimeData = oneTimeProducts.find(e => e.subscriptionProductId === productId);
            const productSub = subscriptionData.SubscriptionLines.find(e => e.ProductVariant.platformId.split('/').pop() === variant.id);
            if (!oneTimeData) {
                quantity += getPriceDifference(productSub.ProductVariant.price, productSub.priceWithoutDiscount)*productSub.quantity;
            } else {
                const productOneTime = oneTimeData.variants.find(e => e.title === variant.title);
                quantity += getPriceDifference(
                    productOneTime.price,
                    productSub.ProductVariant.price
                )*productSub.quantity;
            }
        }

        if (quantity <= 0) throw new Error('It was not possible to calculate the price difference');

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
        await dbRepository.saveDraftOrder(shopAlias, draftOrderId, subscription, cancelSessionId);
        await shopifyImp.sendDraftOrderInvoice(draftOrderId);
        res.json({ message: 'To finalize the subscription cancellation process please pay the draft order that has been created' })
    } catch (err) {
        console.log(err);
        logger.error(err.message);
        res.status(500).json({ message: err.message });

        const errorMessage = err.message.replace(/[^\w\s]/gi, '').replace(/[\n\t]/g, ' ');
        const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
        let errorData = `ℹ️ EMAIL: ${email}\\n`;
        errorData += `ℹ️ SUBSCRIPTION: ${subscription}\\n`;
        errorData += `ℹ️ CANCEL SESSION ID: ${cancelSessionId}\\n`;
        const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`;
        const errorRoute = `📌 ROUTE: /token/subscription/validate`;
        const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
        const errorTitle = "🔴 ❌ ERROR: Error while trying to create the draft order or delete the subscription";
        messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
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
    let shopAlias, email, token = '';
    try {
        (shopAlias = SHOPS_ORIGIN[req.get('origin')]);
        ({ email, token } = req.body);
        const shopifyImp = new ShopifyImp(shopAlias);
        const objectToken = await dbRepository.validateToken(shopAlias, email, token);
        if (!objectToken) {
            logger.error('Email or Token Not Found');
            res.status(500).json({ message: 'Email or Token Not Found' });
            return;
        };
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shopAlias, email);
            logger.error('Email or Token Not Found');
            res.status(500).json({ message: 'Email or Token Not Found' });
            return;
        }

        // Actualizar la fecha de caducidad del token
        const expirationDateUpdated = await dbRepository.updateTokenExpirationDate(shopAlias, email, token);
        if (expirationDateUpdated) logger.info('Token expiration date updated');
        else logger.error('Token expiration date not updated');

        if (objectToken.token !== token) {
            logger.error('Email or Token Not Found');
            res.status(500).json({ message: 'Email or Token Not Found' });
            return;
        };
        const customerName = await shopifyImp.getCustomerNameByEmail(email);
        if (!customerName) throw new Error('Customer with given email not found')
        const orders = await shopifyImp.getActiveOrders(email);
        res.json({ customerName, orders })
    } catch (err) {
        console.log(err);
        logger.error(err.message);
        res.status(500).json({ message: err.message })

        const errorMessage = err.message.replace(/[^\w\s]/gi, '').replace(/[\n\t]/g, ' ');
        const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
        let errorData = `ℹ️ EMAIL: ${email}\\n`;
        const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`;
        const errorRoute = `📌 ROUTE: /token/address/validate`;
        const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
        const errorTitle = "🔴 ❌ ERROR: Error while trying to validate token to update address";
        messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
    }
})


export default router;
