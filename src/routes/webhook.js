import { Router } from 'express';
import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import bearerToken from 'express-bearer-token';
import Mailer from '../implements/nodemailer.imp.js';
import { authenticateToken } from '../middlewares/authenticate-token.js';
import SubscriptionImp from '../implements/skio.imp.js';
import DBRepository from '../repositories/postgres.repository.js';
import path from 'node:path'

const router = Router();
const dbRepository = new DBRepository();

router.use(bearerToken({
  bodyKey: 'access_token',
  queryKey: 'access_token',
  headerKey: 'Bearer',
  reqKey: 'token',
  cookie: false,
}));

/**
 *  @openapi
 *  /webhook/draft-order-paid:
 *    post:
 *      security:
 *        - BearerAuth:
 *      tags:
 *        - Webhook
 *      description: Paid Draft Order
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                shop:
 *                  type: string
 *                shopAlias:
 *                  type: string
 *                draftOrderId:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post('/draft-order-paid', authenticateToken, async (req, res) => {
  try {
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
    const { shop, shopAlias, draftOrderId } = req.body;
    const mailer = new Mailer(shopAlias);
    let shopDomain = SHOPS_ORIGIN[shop];
    const { shopName, shopColor, contactPage, emailSender } = shopDomain;
    const subscriptionImp = new SubscriptionImp(shop, shopAlias);
    
    const draftOrder = `gid://shopify/DraftOrder/${draftOrderId}`;
    const draftOrderData = await dbRepository.getLastDraftOrderByDraftOrder(shopAlias, draftOrder);
    if (!draftOrderData) throw new Error('Draft order not found');

    const subscription = await subscriptionImp.getSubscriptionInfo(draftOrderData.subscription);
    const subscriptionCanceled = await subscriptionImp.cancelSubscription(draftOrderData.subscription);
    if (!subscriptionCanceled) throw new Error('Subscription not cancelled');

    // Se debería eliminar la Draft Order en Shopify?
    await dbRepository.deleteDraftOrder(shopAlias, draftOrder);
    await mailer.sendEmail(emailSender, subscription.StorefrontUser.email,
      'cancel-subscription-confirm', 'Your Subscription Has Been Canceled',
      {
        shopColor,
        customerName: subscription.StorefrontUser.firstName,
        orderEndDate: new Date(subscription.nextBillingDate).toLocaleString(),
        contactPage,
        shopName
      },
      [
        {
          filename: 'top_banner_subscription_canceled.png',
          path: path.resolve() + `/public/imgs/${shopAlias}/top_banner_subscription_canceled.png`,
          cid: 'top_banner_subscription_canceled'
        }
      ]
    );
    res.json({ message: 'Subscription cancelled and draft order deleted from database' })
  } catch (err) {
    console.log(err);
    logger.error(err.message);
    res.status(500).send({ message: err.message })
  }
})

export default router;