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

        let lineItems = (await shopifyImp.getLineItemsByOrder(subscriptionData.originOrder.platformId))
            .map(e => e.node);

        // Si no contiene un producto one time, es porque es un upsell,
        // y por lo tanto el producto no cuenta con producto One time,
        // por ende se debe optar por calcular con el descuento del sellign plan.
        // Adicionalmente se ignoran los Fake Products.
        let noUpsells = [];
        let upsells = [];
        let productType = '';
        let quantity = 0;
        const time_ms = new Date().getTime();

        console.log(`${time_ms} - URL /subscription/validate`);
        console.log(`${time_ms} - LineItems: ${lineItems.length}`);
        console.log(`${time_ms} - LineItems: ${JSON.stringify(lineItems)}`);

        for (let lineItem of lineItems) {
            productType = lineItem.product.productType.replace(/\s/g, '').toLowerCase();
            lineItem.variant.title = lineItem.variant.title.replace(/\s/g, '').toLowerCase();
            if (productType.includes('fake')) { continue }
            if (!productType.includes('gift')) {
                if (productType.includes('upsell')) {
                    upsells.push(lineItem);
                } else {
                    noUpsells.push(lineItem);
                }
            }
        }

        console.log(`${time_ms} - Upsells: ${JSON.stringify(upsells)}`);
        console.log(`${time_ms} - NoUpsells: ${JSON.stringify(noUpsells)}`);

        let eachUpsell = null;
        for (let upsell of upsells) {
            eachUpsell = subscriptionData.SubscriptionLines.find(
                e => e.ProductVariant.platformId === upsell.variant.id);

            if (!eachUpsell) continue;
            console.log(`Upsell: Price ${eachUpsell.ProductVariant.title} - PriceWithoutDiscount ${eachUpsell.priceWithoutDiscount} - Quantity${eachUpsell.quantity}`);
            quantity += getPriceDifference(eachUpsell.ProductVariant.price,
                eachUpsell.priceWithoutDiscount) * eachUpsell.quantity;

            console.log(`${time_ms} - EachUpsell: ${JSON.stringify(eachUpsell)}`);
            console.log(`${time_ms} - Quantity: ${eachUpsell.ProductVariant.price}, ${eachUpsell.priceWithoutDiscount}, ${eachUpsell.quantity}, ${quantity}`);
        }

        const oneTimeBySubscriptionMetafieldQuery = noUpsells
            .map(e => `(metafields.custom.${productSubscriptionMetafieldKey}:${e.product.id.split('/').pop()} AND price:>0 AND -product_type:Gift)`)
            .join(' OR ');
        const oneTimeProducts = (await shopifyImp
            .oneTimesBySubscriptionMetafield(productSubscriptionMetafieldKey, oneTimeBySubscriptionMetafieldQuery))
            .map(e => ({
                subscriptionProductId: e.node.metafields.edges[0].node.jsonValue,
                variants: e.node.variants.edges
                    .map(i => i.node)
                    .map(i => { i.title = i.title.replace(/\s/g, '').toLowerCase(); return i })
            }));
        
        console.log(`${time_ms} - oneTimeProducts: ${JSON.stringify(oneTimeProducts)}`);

        let productSub = null;
        let productOneTime = null;
        for (let oneTime of oneTimeProducts) {
            productSub = lineItems.find(e => e.product.id === oneTime.subscriptionProductId)

            if (!productSub) continue;
            if (oneTime.variants.length === 1) {
                productOneTime = oneTime.variants[0];
            } else {
                productOneTime = oneTime.variants.find(e => e.title === productSub.variant.title);

                if (!productOneTime) {
                    productOneTime = oneTime.variants.find(e => {
                        if (productSub.variant.title.length > e.title.length) {
                            return productSub.variant.title.includes(e.title);
                        } else {
                            return e.title.includes(productSub.variant.title);
                        }
                    });
                }
            }
            console.log(`OneTime: Price ${productOneTime.price} - Quantity ${productSub.quantity}`);
            quantity += getPriceDifference(productOneTime.price, productSub.variant.price) * productSub.quantity;
            console.log(`${time_ms} - EachOneTime: ${JSON.stringify(productOneTime)}`);
            console.log(`${time_ms} - Quantity: ${quantity}, ${productOneTime.price}, ${productSub.variant.price}, ${productSub.quantity}`);
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
