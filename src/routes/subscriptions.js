import { Router } from 'express';
import logger from '../../logger.js';
import ShopifyImp from '../implements/shopify.imp.js';
import handleError from '../middlewares/error-handle.js';
import SubscriptionImp from '../implements/skio.imp.js';
import DBRepository from '../repositories/postgres.repository.js';
import { SubscriptionsSchema } from '../schemas/subscriptions.js';
import MessageImp from '../implements/slack.imp.js';


const router = Router();
const dbRepository = new DBRepository();
const messageImp = new MessageImp();


/**
 *  @openapi
 *  /subscriptions:
 *    get:
 *      tags:
 *        - Subscriptions
 *      description: Get Subscriptions By Email For Subscriptions Upsells Project
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
router.get('/', handleError(SubscriptionsSchema), async (req, res) => {
  let shopAlias, email, sku = '';
  try {
    ({ shopAlias, email, sku } = req.query);
    const subscriptionImp = new SubscriptionImp(shopAlias);
    const subscriptions = await subscriptionImp.getSubscriptionsByEmail(email);

    // Si no existen suscripciones
    if (!subscriptions.length) {
      res.status(404).json({ message: 'Customer has no active subscriptions' })
    }

    let subscription = null;
    for (const sub of subscriptions) {
      for (const subLine of sub.SubscriptionLines) {
        if (subLine.ProductVariant.sku === sku) {
          subscription = sub;
          break;
        }
      }
    }

    // Si no encontró la subscripción, obtener la suscripción con el next order day más cercana
    if (!subscription) {
      subscriptions.sort((a, b) => new Date(a.nextBillingDate) - new Date(b.nextBillingDate));
      subscription = subscriptions[0];
    }

    res.json({ subscription: subscription.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'There was an error while trying to query subscriptions' })
  }
})

export default router;