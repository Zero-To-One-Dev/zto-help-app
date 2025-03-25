import { Router } from "express"
import logger from "../../logger.js"
import app, { SHOPS_ORIGIN } from "../app.js"
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
  let shopAlias, draftOrderId = '';
  try {
    ({ shopAlias, draftOrderId } = req.body);
    const {
      [`SHOP_NAME_${shopAlias}`]: shopName,
      [`SHOP_COLOR_${shopAlias}`]: shopColor,
      [`CONTACT_PAGE_${shopAlias}`]: contactPage,
      [`EMAIL_SENDER_${shopAlias}`]: emailSender
    } = app;
    const mailer = new Mailer(shopAlias)
    const subscriptionImp = new SubscriptionImp(shopAlias)
    const draftOrder = `gid://shopify/DraftOrder/${draftOrderId}`
    const draftOrderData = await dbRepository.getLastDraftOrderByDraftOrder(
      shopAlias,
      draftOrder
    )
    if (!draftOrderData) {
      res.status(404).json({ message: 'Draft order not found' })
      return;
    }

    const subscription = await subscriptionImp.getSubscriptionInfo(
      draftOrderData.subscription
    )
    const subscriptionCanceled = await subscriptionImp.cancelSubscription(
      draftOrderData.cancel_session_id,
      draftOrderData.subscription
    )
    if (!subscriptionCanceled) throw new Error('Subscription not cancelled')

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
    res.status(200).send({ message: err.message })

    const errorMessage = err.message.replace(/[^\w\s]/gi, '').replace(/[\n\t]/g, ' ');
    const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
    const errorData = `ℹ️ DRAFT ORDER ID: ${draftOrderId}\\n`;
    const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`
    const errorRoute = `📌 ROUTE: /webhook/draft-order-paid`;
    const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
    const errorTitle = '🔴 ❌ ERROR: Error while trying to delete the subscription in the webhook';
    messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
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
 *                shopAlias:
 *                  type: string
 *                nameApp:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post("/draft-orders-expired-delete", authenticateToken, async (req, res) => {
  let draftOrderErrors = [];
  let shopAlias = '';
  try {
    shopAlias = req.body.shopAlias;
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
            draftOrderErrors.push([draftOrder.draftOrder, err.message])
            await setDraftOrderStatus(draftOrder, 'ERROR', err.message, draftOrder.retries+1);
            logger.error(err.message);
        }
    }

    if (draftOrderErrors.length) throw new Error('Error while trying to delete some expired draft orders from the webhook')
    res.json({ message: `Draft orders from ${shopAlias} deleted successfully` })
  } catch (err) {
    console.log(err)
    logger.error(err.message)
    res.status(200).send({ message: err.message })

    const errorMessage = err.message.replace(/[^\w\s]/gi, '').replace(/[\n\t]/g, ' ');
    const errorRoute = '📌 ROUTE: /webhook/draft-orders-expired-delete';
    const errorShop = `🏪 SHOP: ${shopAlias}\\n`;

    let errorData = 'ℹ️ DRAFT ORDERS ERRRORS:'
    for (const [draftOrder, message] of draftOrderErrors) {
      errorData += `\\n📃 DO ${draftOrder}: ${message}`;
    }
    errorData += '\\n';

    const errorTitle = '🔴 ❌ ERROR: Error while trying to delete some expired draft orders from the webhook';
    const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`;
    const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
    messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
  }
})


export default router
