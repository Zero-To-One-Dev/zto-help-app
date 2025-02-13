import { Router } from "express";
import logger from '../../logger.js';
import { SHOPS_ORIGIN, APP_TOKEN } from '../app.js';
import { ProvinceCountrySchema } from '../schemas/locations.js';
import handleError from '../middlewares/errorHandle.js';
import SubscriptionImp from '../implements/skio.imp.js';
import ShopifyImp from '../implements/shopify.imp.js';

const router = Router();

router.post('/provinces-country', handleError(ProvinceCountrySchema), async (req, res) => {
    try {
        let shopOrigin = req.get('origin');
        let shopDomain = SHOPS_ORIGIN[shopOrigin !== 'null' ? shopOrigin : 'https://hotshapers.com'];
        const { shop, shopAlias } = shopDomain;

        const shopifyImp = new ShopifyImp(shop, shopAlias);
        
        
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });
    }
})
