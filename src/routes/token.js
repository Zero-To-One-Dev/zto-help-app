import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { isExpired } from '../services/token.js';
import ShopifyImp from '../implements/shopify.imp.js';
import handleError from '../middlewares/error-handle.js';
import DBRepository from '../repositories/postgres.repository.js';
import { TokenSchema } from '../schemas/token.js';

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
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post('/subscription/validate', handleError(TokenSchema), async (req, res) => {
    try {
        let shopOrigin = req.get('origin');
        let shopDomain = SHOPS_ORIGIN[shopOrigin !== 'null' ? shopOrigin : 'https://hotshapers.com'];
        const { shopAlias } = shopDomain;

        const { email, token } = req.body;
        const objectToken = await dbRepository.validateToken(shopAlias, email, token);

        if (!objectToken) throw new Error('Email or Token Not Found');
        if (isExpired(objectToken.expire_at)) {
            await dbRepository.deleteToken(shopAlias, email);
            throw new Error('Email or Token Not Found');
        }
        if (objectToken.token !== token) throw new Error('Email or Token Not Found');
        res.json({ message: 'Token confirmed' });
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