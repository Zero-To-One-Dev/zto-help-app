import { Router } from 'express';
import bearerToken from 'express-bearer-token';
import { authenticateToken } from '../middlewares/authenticate-token.js';
import SubscriptionImp from '../implements/skio.imp.js';
import DBRepository from '../repositories/postgres.repository.js';

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
    const subscriptionImp = new SubscriptionImp(shop, shopAlias);
    const rows = await dbRepository.getSubscriptionByDraftOrder(shopAlias, draftOrder)
    if (!rows.length) throw new Error('Draft order not found');
    const subscriptionCanceled = await subscriptionImp.cancelSubscription(rows[0].subscription);
    if (!subscriptionCanceled) throw new Error('Subscription not cancelled');    
    await dbRepository.deleteDraftOrder(shopAlias, draftOrder)
    res.json({ message: 'Subscription cancelled and draft order deleted from database' })
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err.message })
  }
})

export default router;