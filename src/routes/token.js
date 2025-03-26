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
        const subscriptionData = await subscriptionImp.getSubscription(email, subscription);
        if (!subscriptionData) throw new Error('It is not possible to cancel the subscription');
        if (subscriptionData.cyclesCompleted > 1) throw new Error('The subscription have more than 1 cycle completed');

        // Si el estado en la dirección de la orden es de CALIFORNIA, cancelar normal
        if (subscriptionData.ShippingAddress.province.toUpperCase() === 'CALIFORNIA') {
            const subscriptionCancelled = await subscriptionImp.cancelSubscription(cancelSessionId, subscription);
            if (!subscriptionCancelled) throw new Error('It is not possible to cancel the subscription');
            await dbRepository.deleteToken(shopAlias, email);
            res.json({ message: 'Subscription successfully cancelled' })
            return;
        }

        // Si el estado en la dirección de la orden es diferente de CALIFORNIA, crear draft order
        const variantsQuery = ((subscriptionData.SubscriptionLines
            .map(subs => subs.ProductVariant.platformId.split('/').pop()))
            .map(variantId => `variant_id:${variantId}`))
            .join(' OR ');
        const productsSubQuery = (await shopifyImp
            .productsIdsByVariant(variantsQuery))
            .map(product => product.node.id.split('/').pop())
            .map(id => `metafields.custom.${productSubscriptionMetafieldKey}:${id} AND price:>0 AND -product_type:Gift`)
            .join(' OR ');
        let quantity = (await shopifyImp
            .oneTimesBySubscriptions(productSubscriptionMetafieldKey, productsSubQuery))
        quantity = quantity.map(product => Math.floor(
            product.node.variants.edges[0].node.price -
            product.node.metafields.edges[0].node.reference.variants.edges[0].node.price))
            .reduce((sum, a) => sum + a, 0);

        // Si la cantidad es igual a 0, es porque el producto no cuenta con producto One time
        // por ende se debe optar por calcular con el descuento del sellign plan
        // if (quantity == 0) {

        // }

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
        await shopifyImp.sendDraftOrderInvoice(draftOrderId)
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
