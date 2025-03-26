import { Router } from "express";
import { DraftOrderSchema } from '../schemas/draft-order.js';
import DBRepository from '../repositories/postgres.repository.js';
import { getActiveDraftOrder } from '../services/draft-orders.js';
import handleError from '../middlewares/error-handle.js';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import { isExpired } from '../services/token.js';
import ShopifyImp from '../implements/shopify.imp.js';


const router = Router();
const dbRepository = new DBRepository();


/**
 *  @openapi
 *  /draft-order/exists:
 *    post:
 *      tags:
 *        - Draft Order
 *      description: Validate If A Draft Order Exists
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
 *          description: Returns Message Or Only Stauts If The Draft Order Exists Or Not Exists
 */
router.post('/exists', handleError(DraftOrderSchema), async (req, res) => {
  let shopAlias, email, token, subscription = '';
  try {
    ({ shopAlias } = SHOPS_ORIGIN[req.get('origin')]);
    ({ email, token, subscription } = req.body);

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

    const shopifyImp = new ShopifyImp(shopAlias);

    const draftOrderExists = await getActiveDraftOrder(shopAlias, subscription);
    let message = '';
    if (draftOrderExists) {
      await shopifyImp.sendDraftOrderInvoice(draftOrderExists.draft_order);
      message = 'The invoice of the order was resent to continue with the cancellation of the subscription'
    }
    res.json({ message });
  } catch (err) {
    console.log(err);
    logger.error(err.message);
    res.status(500).json({ message: err.message });

    const errorMessage = err.message.replace(/[^\w\s]/gi, '').replace(/[\n\t]/g, ' ');
    const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
    let errorData = `ℹ️ EMAIL: ${email}\\n`;
    errorData += `ℹ️ SUBSCRIPTION: ${subscription}\\n`;
    const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`;
    const errorRoute = `📌 ROUTE: /draft-order/exists`;
    const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
    const errorTitle = "🔴 ❌ ERROR: Error while trying to verify if a draft order exists";
    messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
  }
})

export default router;
