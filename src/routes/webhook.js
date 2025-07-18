import { Router } from "express"
import express from "express"
import logger from "../../logger.js"
import app, { SHOPS_ORIGIN } from "../app.js"
import fs from "fs/promises"
import bearerToken from "express-bearer-token"
import Mailer from "../implements/nodemailer.imp.js"
import { authenticateToken } from "../middlewares/authenticate-token.js"
import SubscriptionImp from "../implements/skio.imp.js"
import GorgiasImp from "../implements/gorgias.imp.js"
import GoogleImp from "../implements/google.imp.js"
import DBRepository from "../repositories/postgres.repository.js"
import path from "node:path"
import {
  getExpiredDraftOrders,
  setDraftOrderStatus,
  deleteDraftOrder,
} from "../services/draft-orders.js"
import MessageImp from "../implements/slack.imp.js"
import ShopifyImp from "../implements/shopify.imp.js"
import KlaviyoImp from "../implements/klaviyo.imp.js"
import SlackImp from "../implements/slack.imp.js"
import {
  analyzeSurvey,
  enrichSurveyWithAI,
  parseSurveyData,
} from "../services/survey-utils.js"
import { generateExcelReport } from "../services/generate-excel.js"
import { generatePresentation } from "../services/generate-presentation.js"

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
  let shopAlias,
    draftOrderId = ""
  try {
    ;({ shopAlias, draftOrderId } = req.body)
    const {
      [`SHOP_NAME_${shopAlias}`]: shopName,
      [`SHOP_COLOR_${shopAlias}`]: shopColor,
      [`CONTACT_PAGE_${shopAlias}`]: contactPage,
      [`EMAIL_SENDER_${shopAlias}`]: emailSender,
    } = app
    const mailer = new Mailer(shopAlias)
    const subscriptionImp = new SubscriptionImp(shopAlias)
    const draftOrder = `gid://shopify/DraftOrder/${draftOrderId}`
    const draftOrderData = await dbRepository.getLastDraftOrderByDraftOrder(
      shopAlias,
      draftOrder
    )
    if (!draftOrderData) {
      res.status(404).json({ message: "Draft order not found" })
      return
    }

    const subscription = await subscriptionImp.getSubscriptionInfo(
      draftOrderData.subscription
    )
    const subscriptionCanceled = await subscriptionImp.cancelSubscription(
      draftOrderData.cancel_session_id,
      draftOrderData.subscription
    )
    if (!subscriptionCanceled) throw new Error("Subscription not cancelled")

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
          filename: "subscription_canceled.png",
          path:
            path.resolve() +
            `/public/imgs/${shopAlias}/subscription_canceled.png`,
          cid: "top_banner",
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

    const errorMessage = err.message
      .replace(/[^\w\s]/gi, "")
      .replace(/[\n\t]/g, " ")
    const errorShop = `🏪 SHOP: ${shopAlias}\\n`
    const errorData = `ℹ️ DRAFT ORDER ID: ${draftOrderId}\\n`
    const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`
    const errorRoute = `📌 ROUTE: /webhook/draft-order-paid`
    const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`
    const errorTitle =
      "🔴 ❌ ERROR: Error while trying to delete the subscription in the webhook"
    messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle)
  }
})

/**
 *  @openapi
 *  /subscription-discount:
 *    post:
 *      security:
 *        - BearerAuth:
 *      tags:
 *        - Webhook
 *      description: Subscription Discount
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                shopAlias:
 *                  type: string
 *                email:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 * */
router.post("/subscription-discount", authenticateToken, async (req, res) => {
  const { shopAlias, email } = req.body

  const subscriptionImp = new SubscriptionImp(shopAlias)
  const subscriptions = await subscriptionImp.getSubscriptionsByEmail(email)

  const slackImp = new SlackImp()
  const channelId = process.env.SUBSCRIPTION_DISCOUNT_NOTIFY_CHANNEL_ID
  const discountCode = process.env.SUBSCRIPTION_DISCOUNT_CODE

  if (!subscriptions.length) {
    await slackImp.postMessage(
      channelId,
      `❌ No active subscriptions for ${email} in ${shopAlias}`
    )
    res.status(404).json({ message: "Customer has no active subscriptions" })
    return
  }

  subscriptions.sort(
    (a, b) => new Date(a.nextBillingDate) - new Date(b.nextBillingDate)
  )
  const subscription = subscriptions[0]
  const applyDiscount = await subscriptionImp.applyDiscount(
    subscription.id,
    discountCode
  )

  if (applyDiscount.ok) {
    res.status(200).json({ message: "Discount applied successfully" })
  } else {
    await slackImp.postMessage(
      channelId,
      `❌ Error applying discount to ${email} in ${shopAlias} - Subscription ID: ${subscription.id}`
    )
    res.status(500).json({ message: "Error applying discount" })
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
router.post(
  "/draft-orders-expired-delete",
  authenticateToken,
  async (req, res) => {
    let draftOrderErrors = []
    let shopAlias = ""
    try {
      shopAlias = req.body.shopAlias
      const expiredDraftOrders = await getExpiredDraftOrders(shopAlias)
      for (const draftOrder of expiredDraftOrders) {
        try {
          await setDraftOrderStatus(draftOrder, "PROCESSING")
          const [message, draftOrderId] = await deleteDraftOrder(
            draftOrder.shop_alias,
            draftOrder.draft_order
          )
          if (!message) {
            const success_message = `Draft order ${draftOrderId} deleted successfully from DB and from Shopify`
            logger.info(success_message)
            await setDraftOrderStatus(
              draftOrder,
              "COMPLETED",
              success_message,
              draftOrder.retries + 1
            )
          } else throw Error(message)
        } catch (err) {
          draftOrderErrors.push([draftOrder.draftOrder, err.message])
          await setDraftOrderStatus(
            draftOrder,
            "ERROR",
            err.message,
            draftOrder.retries + 1
          )
          logger.error(err.message)
        }
      }

      if (draftOrderErrors.length)
        throw new Error(
          "Error while trying to delete some expired draft orders from the webhook"
        )
      res.json({
        message: `Draft orders from ${shopAlias} deleted successfully`,
      })
    } catch (err) {
      console.log(err)
      logger.error(err.message)
      res.status(200).send({ message: err.message })

      const errorMessage = err.message
        .replace(/[^\w\s]/gi, "")
        .replace(/[\n\t]/g, " ")
      const errorRoute = "📌 ROUTE: /webhook/draft-orders-expired-delete"
      const errorShop = `🏪 SHOP: ${shopAlias}\\n`

      let errorData = "ℹ️ DRAFT ORDERS ERRRORS:"
      for (const [draftOrder, message] of draftOrderErrors) {
        errorData += `\\n📃 DO ${draftOrder}: ${message}`
      }
      errorData += "\\n"

      const errorTitle =
        "🔴 ❌ ERROR: Error while trying to delete some expired draft orders from the webhook"
      const errorDescription = `📝 DESCRIPTION: ${errorMessage}\\n`
      const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`
      messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle)
    }
  }
)

/**
 *  @openapi
 *  /webhook/create-cross-discount:
 *    post:
 *      security:
 *        - BearerAuth:
 *      tags:
 *        - Webhook
 *      description: Create cross discount
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                shopAlias:
 *                  type: string
 *                title:
 *                  type: string
 *                code:
 *                  type: string
 *                percentage:
 *                  type: string
 *                collection:
 *                  type: string
 *                email:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post("/create-cross-discount", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      code,
      percentage,
      endDate,
      email,
      shopAlias,
      klaviyoShopAlias,
    } = req.body

    const shopifyImp = new ShopifyImp(shopAlias)

    let today = new Date()
    today.setHours(0, 0, 0, 0)

    const inputMutation = `{
      title: "${title}",
      code: "${code}",
      startsAt: "${today.toISOString()}",
      endsAt: "${endDate}T00:00:00.000Z",
      combinesWith: {
        productDiscounts: false,
        orderDiscounts: false,
        shippingDiscounts: false
      },
      appliesOncePerCustomer: true,
      usageLimit: 1,
      customerSelection: {
        all: true
      },
      minimumRequirement: {
        subtotal: {
          greaterThanOrEqualToSubtotal: null
        }
      },
      customerGets: {
        value: {
          percentage: ${percentage}
        },
        items: {
          all: true,
          collections: {
            add: [],
            remove: []
          },
          products: {
            productsToAdd: [],
            productsToRemove: [],
            productVariantsToAdd: [],
            productVariantsToRemove: []
          }
        },
        appliesOnOneTimePurchase: true,
        appliesOnSubscription: false
      },
      recurringCycleLimit: 1
    }`

    logger.info(`INPUT MUTATION: ${inputMutation}`)
    const codeDiscountNode = await shopifyImp.createDiscountCode(inputMutation)

    // Si ocurre un error al crear el código en Shopify
    if (!codeDiscountNode) {
      res.status(200).json({ message: "Error" })
      return
    }

    const klaviyo = new KlaviyoImp(klaviyoShopAlias)
    klaviyo.sendEvent("Cross discount", email, {
      discountCode: code,
    })
    res.json({ message: "Cross discount sent successfully to Klaviyo" })
  } catch (err) {
    console.log(err)
    logger.error(err.message)
    res.status(200).send({ message: err.message })
  }
})

/**
 *  @openapi
 *  /webhook/purchase-camihotsize-m:
 *    post:
 *      security:
 *        - BearerAuth:
 *      tags:
 *        - Webhook
 *      description: Purchase CamiHotSize M. Send a email to customers who buy CamiHotSize M.
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                email:
 *                  type: string
 *                  description: The email of the customer
 *                shortNameStore:
 *                  type: string
 *                  description: The shortname of the source store
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post("/purchase-camihotsize-m", authenticateToken, async (req, res) => {
  try {
    const { email, shortNameStore } = req.body
    const klaviyo = new KlaviyoImp(shortNameStore)
    const nameEvent = "ZTO HS CamiHotSize M"
    await klaviyo.sendEvent(nameEvent, email, {
      nameEvent: nameEvent,
    })

    res.json({
      message: "'ZTO HS CamiHotSize M' event sent successfully to Klaviyo.",
    })
  } catch (err) {
    console.log(err)
    logger.error(err.message)
    res.status(200).send({ message: err.message })
  }
})

router.post(
  "/check-influencers-mesagges",
  authenticateToken,
  async (req, res) => {
    const gorgias = new GorgiasImp()
    const ticketId = req.body.ticket_id

    try {
      const ticketDB = await dbRepository.getTicketById(ticketId)
      const ticketDBTags = ticketDB ? ticketDB.tags : null

      const ticket = await gorgias.getTicket(ticketId)
      if (!ticket) return res.status(404).json({ message: "Ticket not found" })
      const ticketTags = ticket.tags.map((tag) => tag.name).join(", ")
      console.log({ ticketId, ticketTags })

      if (ticketDB) {
        if (ticketDBTags != ticketTags) {
          await dbRepository.updateTicketTags(ticketId, ticketTags)
          console.log(`✅ Ticket ${ticketId} updated in DB`)
        }
        console.log(`ℹ️ Ticket ${ticketId} already exists in DB`)
      } else {
        await dbRepository.saveTicket(ticketId, ticketTags, "UNPROCESSED", 0)
        console.log(`✅ Ticket ${ticketId} saved as UNPROCESSED`)
      }

      return res.status(200).json({ message: "Ticket captured" })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ message: "Internal error" })
    }
  }
)

/**
 *  @openapi
 *  /webhook/slack-app:
 *    post:
 *      tags:
 *        - Webhook
 *      description: Slack App
 *      requestBody:
 *        content:
 *          application/x-www-form-urlencoded:
 *            schema:
 *              type: object
 *              properties:
 *                command:
 *                  type: string
 *                  description: The command of the webhook
 *                text:
 *                  type: string
 *                  description: The text of the webhook
 *                channel_id:
 *                  type: string
 *                  description: The channel id of the webhook
 *      responses:
 *        200:
 *          description: Returns JSON message
 * */
router.post(
  "/slack-app",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const { command, text = "", channel_id } = req.body

    if (command !== "/survey-report") {
      return res.status(200).json({ message: "Comando no reconocido." })
    }

    const parts = text.trim().split(/\s+/)

    const sheetUrl = parts.shift()
    const presentationUrl = parts.pop()
    const sheetName = parts.join(" ").replace(/\*/g, "")

    if (!sheetUrl || !sheetName || !presentationUrl) {
      return res.status(200).json({
        response_type: "ephemeral",
        text: "Uso: `/survey-report [Sheet URL] [Sheet Name] [Presentation Url]`",
      })
    }

    res.status(200).json({
      response_type: "ephemeral",
      text: `El reporte para *${sheetName}* será enviado en breve 👨🏻‍💻`,
    })

    try {
      const spreadsheetId = sheetUrl
        .replace("https://docs.google.com/spreadsheets/d/", "")
        .split("/")[0]
      if (!spreadsheetId) {
        throw new Error("Spreadsheet ID inválido.")
      }

      const presentationId = presentationUrl
        .replace("https://docs.google.com/presentation/d/", "")
        .split("/")[0]
      if (!presentationId) {
        throw new Error("Presentation ID inválido.")
      }

      const google = new GoogleImp()
      const rawData = await google.getValues(
        spreadsheetId,
        `${sheetName}!A1:HZ`
      )

      const pptxTemplateFilePath = await google.downloadFile(
        presentationId,
        "template.pptx"
      )

      const parsedData = parseSurveyData(rawData)
      const stats = analyzeSurvey(parsedData)

      const tmpDir = path.join(process.cwd(), "tmp")
      await fs.mkdir(tmpDir, { recursive: true })
      const timestamp = Date.now()
      const fileName = `survey-report-${timestamp}.xlsx`
      const excelFilePath = path.join(tmpDir, fileName)
      const pptxFilePath = path.join(tmpDir, "survey.pptx")

      const enrichedMap = await enrichSurveyWithAI(stats, parsedData)

      await generatePresentation(enrichedMap)
      await generateExcelReport(stats, enrichedMap, excelFilePath)

      const slack = new SlackImp()
      await slack.uploadFile(
        excelFilePath,
        channel_id,
        `Reporte de encuestas: *${sheetName}*`,
        fileName,
        sheetName
      )
      await slack.uploadFile(
        pptxFilePath,
        channel_id,
        ``,
        "survey.pptx",
        sheetName
      )

      await fs.unlink(excelFilePath)
      console.log(`Deleted file: ${excelFilePath}`)

      await fs.unlink(pptxFilePath)
      console.log(`Deleted file: ${pptxFilePath}`)

      await fs.unlink(pptxTemplateFilePath)
      console.log(`Deleted file: ${pptxTemplateFilePath}`)
    } catch (err) {
      console.error("Error handling /survey-report:", err)

      try {
        const slack = new SlackImp()
        await slack.postMessage(
          channel_id,
          `❌ No se pudo generar el reporte para *${sheetName}*: ${err.message}`
        )
      } catch (notifyErr) {
        console.error("Error sending failure message to Slack:", notifyErr)
      }
    }

    return null
  }
)

export default router
