import { Router } from "express"
import logger from "../../logger.js"
import { SHOPS_ORIGIN } from "../app.js"
import bearerToken from "express-bearer-token"
import Mailer from "../implements/nodemailer.imp.js"
import { authenticateToken } from "../middlewares/authenticate-token.js"
import SubscriptionImp from "../implements/skio.imp.js"
import DBRepository from "../repositories/postgres.repository.js"
import path from "node:path"
import { getExpiredDraftOrders, setDraftOrderStatus, deleteDraftOrder } from "../services/draft-orders.js";
import MessageImp from '../implements/slack.imp.js'


const router = Router()
const dbRepository = new DBRepository()
const messageImp = new MessageImp()


router.use(
  bearerToken({
    bodyKey: "access_token",
    queryKey: "access_token",
    headerKey: "Bearer",
    reqKey: "token",
    cookie: false,
  })
)

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
 *                shopAlias:
 *                  type: string
 *                draftOrderId:
 *                  type: string
 *                nameApp:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post("/draft-order-paid", authenticateToken, async (req, res) => {
  try {
    const { shop, shopAlias, draftOrderId } = req.body
    const mailer = new Mailer(shopAlias)
    let shopDomain = SHOPS_ORIGIN[shop]
    const { shopName, shopColor, contactPage, emailSender } = shopDomain
    const subscriptionImp = new SubscriptionImp(shopAlias)

    const draftOrder = `gid://shopify/DraftOrder/${draftOrderId}`
    const draftOrderData = await dbRepository.getLastDraftOrderByDraftOrder(
      shopAlias,
      draftOrder
    )
    if (!draftOrderData) throw new Error('Draft order not found')

    const subscription = await subscriptionImp.getSubscriptionInfo(
      draftOrderData.subscription
    )
    const subscriptionCanceled = await subscriptionImp.cancelSubscription(
      draftOrderData.subscription
    )
    if (!subscriptionCanceled) throw new Error('Subscription not cancelled')

    // Se debería eliminar la Draft Order en Shopify?
    await dbRepository.deleteDraftOrder(shopAlias, draftOrder)
    await mailer.sendEmail(
      emailSender,
      subscription.StorefrontUser.email,
      "cancel-subscription-confirm",
      "Your Subscription Has Been Canceled",
      {
        shopColor,
        customerName: subscription.StorefrontUser.firstName,
        orderEndDate: new Date(subscription.nextBillingDate).toLocaleString(),
        contactPage,
        shopName,
      },
      [
        {
          filename: 'subscription_canceled.png',
          path:
            path.resolve() +
            `/public/imgs/${shopAlias}/subscription_canceled.png`,
          cid: 'top_banner',
        },
      ]
    )
    res.json({
      message: "Subscription cancelled and draft order deleted from database",
    })
  } catch (err) {
    console.log(err)
    logger.error(err.message)
    res.status(500).send({ message: err.message })
    const messageError = `📝 DESCRIPTION: ${err.message}\\n📌 ROUTE: /webhook/draft-order-paid`;
    messageImp.sendMessage(messageError,
      "🔴 ❌ ERROR: Error while trying to delete the subscription in the webhook");
  }
})


router.post("/attentive-custom-event", authenticateToken, async (req, res) => {
  try {
    const { shop, subscriptionId, event } = req.body
    const { attentiveKey, shopAlias } = SHOPS_ORIGIN[shop]
    const subscriptionImp = new SubscriptionImp(shopAlias)
    const subscription = await subscriptionImp.getSubscriptionByContract(
      subscriptionId
    )

    if (!subscription) throw new Error("Subscription not found")

    const eventData = {
      type: event,
      user: {
        email: subscription.StorefrontUser.email,
      },
      properties: {
        subscription_id: subscription.id,
        subscription_status: subscription.status,
      },
    }

    logger.info(`Sending event to Attentive: ${JSON.stringify(eventData)}`)
    logger.info(`Attentive key: ${attentiveKey}`)

    const response = await fetch(
      "https://api.attentivemobile.com/v1/events/custom",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attentiveKey}`,
        },
        body: JSON.stringify(eventData),
      }
    )

    if (!response.ok) {
      logger.error(JSON.stringify(response))
      throw new Error(`Error en la API: ${response.statusText}`)
    }

    console.log("Evento enviado con éxito a Attentive")

    res.json({ message: `Attentive event sent (${event})` })
  } catch (err) {
    console.log(err)
    logger.error(err.message)
    res.status(500).send({ message: err.message })
  }
})


/**
 *  @openapi
 *  /webhook/draft-orders-expired-delete:
 *    post:
 *      security:
 *        - BearerAuth:
 *      tags:
 *        - Webhook
 *      description: Delete Expired Draft Orders
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                nameApp:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post("/draft-orders-expired-delete", authenticateToken, async (req, res) => {
  try {
    const { shopAlias } = req.body;
    const expiredDraftOrders = await getExpiredDraftOrders(shopAlias);
    for (const draftOrder of expiredDraftOrders) {
        try {
            await setDraftOrderStatus(draftOrder, 'PROCESSING');
            const [message, draftOrderId] = await deleteDraftOrder(draftOrder.shop_alias, draftOrder.draft_order);
            if (!message) {
                const success_message = `Draft order ${draftOrderId} deleted successfully from DB and from Shopify`;
                logger.info(success_message);
                await setDraftOrderStatus(draftOrder, 'COMPLETED', success_message, draftOrder.retries+1);
            } else throw Error(message);
        } catch (err) {
            await setDraftOrderStatus(draftOrder, 'ERROR', err.message, draftOrder.retries+1);
            logger.error(err.message);
        }
    }

    res.json({ message: `Draft orders from ${shopAlias} deleted successfully` })
  } catch (err) {
    console.log(err)
    logger.error(err.message)
    res.status(500).send({ message: err.message })
    const messageError = `📝 DESCRIPTION: ${err.message}\\n📌 ROUTE: /webhook/draft-orders-expired-delete`;
    messageImp.sendMessage(messageError,
      "🔴 ❌ ERROR: Error while trying to delete some expired draft orders from the webhook");
  }
})


export default router
