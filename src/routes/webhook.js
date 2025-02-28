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
const mailer = new Mailer();

router.use(bearerToken({
  bodyKey: 'access_token',
  queryKey: 'access_token',
  headerKey: 'Bearer',
  reqKey: 'token',
  cookie: false,
}));

/**
 *  @openapi
 *  /webhook/paid:
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
 *                draftOrder:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post('/paid', authenticateToken, async (req, res) => {
  try {
    const { shop, shopAlias, draftOrder } = req.body;
    let shopDomain = SHOPS_ORIGIN[shop];
    const { shopName, shopColor, contactPage } = shopDomain;
    const subscriptionImp = new SubscriptionImp(shop, shopAlias);
    const rows = await dbRepository.getSubscriptionByDraftOrder(shopAlias, draftOrder);
    const subscriptionId = rows[0].subscription;
    const subscription = await subscriptionImp.getSubscriptionInfo(subscriptionId);
    const email = subscription.StorefrontUser.email;
    const customerName = subscription.StorefrontUser.firstName;
    const orderEndDate = new Date(subscription.nextBillingDate).toLocaleString();
    if (!rows.length) throw new Error('Draft order not found');
    const subscriptionCanceled = await subscriptionImp.cancelSubscription(subscriptionId);
    if (!subscriptionCanceled) throw new Error('Subscription not cancelled');
    await dbRepository.deleteDraftOrder(shopAlias, draftOrder);
    await mailer.sendEmail(email, 'cancel-subscription-confirm', 'Your Subscription Has Been Canceled',
      {
        shopColor,
        customerName,
        orderEndDate,
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