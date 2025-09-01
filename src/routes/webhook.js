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
import { getModalView } from "../services/modal-views.js"
import { parseSlackViewState } from "../services/parse-slack-data.js"
import { validateCreateProfilePayload } from "../services/validate-create-profile-payload.js"

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
  try {
    const { shopAlias, email } = req.body

    if (!shopAlias || !email) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const lowerEmail = email.toLowerCase()

    const subscriptionImp = new SubscriptionImp(shopAlias)
    const subscriptions = await subscriptionImp.getSubscriptionsByEmail(
      lowerEmail
    )

    const slackImp = new SlackImp()
    const channelId = process.env.SUBSCRIPTION_DISCOUNT_NOTIFY_CHANNEL_ID
    const discountCode = process.env.SUBSCRIPTION_DISCOUNT_CODE

    if (!subscriptions.length) {
      await slackImp.postMessage(
        channelId,
        `❌ No active subscriptions for ${lowerEmail} in ${shopAlias}`
      )
      return res
        .status(404)
        .json({ message: "Customer has no active subscriptions" })
    }

    // Ordenar por fecha más cercana
    const sortedSubscriptions = subscriptions.sort(
      (a, b) => new Date(a.nextBillingDate) - new Date(b.nextBillingDate)
    )
    const subscription = sortedSubscriptions[0]

    const applyDiscount = await subscriptionImp.applyDiscount(
      subscription.id,
      discountCode
    )

    if (applyDiscount.ok) {
      return res.status(200).json({ message: "Discount applied successfully" })
    } else {
      await slackImp.postMessage(
        channelId,
        `❌ Error applying discount to ${lowerEmail} in ${shopAlias} - Subscription ID: ${subscription.id}`
      )
      return res.status(500).json({ message: "Error applying discount" })
    }
  } catch (error) {
    console.error("Unexpected error:", error)
    return res.status(500).json({ message: "Internal server error" })
  }
})

router.post("/pause-subscription", authenticateToken, async (req, res) => {
  try {
    const { shopAlias, subscriptionContract } = req.body

    if (!shopAlias || !subscriptionContract) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const subscriptionImp = new SubscriptionImp(shopAlias)
    const subscriptions = await subscriptionImp.subscriptionsByContract(
      subscriptionContract
    )

    if (!subscriptions.length) {
      return res
        .status(404)
        .json({ message: "Customer has no active subscriptions" })
    }

    const results = await Promise.all(
      subscriptions.map((subscriptionId) =>
        subscriptionImp.pauseSubscription(subscriptionId)
      )
    )

    const allOk = results.every((result) => result.ok)

    if (allOk) {
      return res
        .status(200)
        .json({ message: "Subscription paused successfully" })
    } else {
      return res
        .status(400)
        .json({ message: `Error pausing subscription: ${results[0].message}` })
    }
  } catch (error) {
    console.error("Unexpected error:", error)
    return res.status(500).json({ message: "Internal server error" })
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

/**
 * @openapi
 * /interactivity-slack-app:
 *   post:
 *     tags:
 *       - Webhook
 *     description: Interactivity Slack App
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               payload:
 *                 type: string
 *                 description: The payload of the webhook
 *     responses:
 *       200:
 *         description: Returns JSON message
 */
router.post(
  "/interactivity-slack-app",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const payload = JSON.parse(req.body.payload)

    if (payload.type === "view_submission") {
      const callback = payload.view.callback_id
      const data = parseSlackViewState(payload.view.state.values)
      const slack = new SlackImp()
      const google = new GoogleImp()

      switch (callback) {
        case "intelligems_test":
          const values = Object.values(data)
          const [description, dates, store] = values
          const [start, end] = dates

          const startDate = start.split("-")
          const [startYear, startMonth, startDay] = startDate
          const startDateFormat = `${startDay}/${startMonth}/${startYear}`

          const endDate = end.split("-")
          const [endYear, endMonth, endDay] = endDate
          const endDateFormat = `${endDay}/${endMonth}/${endYear}`

          let dateRange = `🚀 ${store} - (${startDateFormat} - ${endDateFormat})`
          if (startDateFormat === endDateFormat) {
            dateRange = `🚨 ${store} - ${endDateFormat}`
          }

          const blocks = [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${description}`,
              },
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${dateRange}`,
              },
            },
          ]

          google.updateRowByCellValue(
            process.env.REPORTS_SHEET_ID,
            process.env.REPORTS_SHEET_NAME,
            0, // Column A (Index 0)
            store,
            [[store, startDateFormat, endDateFormat]]
          )

          let channelsToNotify = process.env.TEST_CHANNELS
          channelsToNotify = channelsToNotify.split(",")

          for (const channel of channelsToNotify) {
            await slack.postMessage(channel, description, blocks)
          }

          break
      }
    }

    if (payload.type === "shortcut" || payload.type === "block_actions") {
      const triggerId = payload.trigger_id
      const modalView = getModalView(payload.callback_id)

      try {
        const response = await fetch("https://slack.com/api/views.open", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trigger_id: triggerId,
            view: modalView,
          }),
        })

        const data = await response.json()

        if (!data.ok) {
          console.error("Slack error:", data)
          return res.status(500).send("Slack API error")
        }

        return res.status(200).send()
      } catch (err) {
        console.error("Fetch error:", err)
        return res.status(500).send("Server error")
      }
    }

    return res.status(200).send()
  }
)

/**
 * POST /add-profile-to-klaviyo-list
 *
 * Creates a Klaviyo profile. If "addToList" is true, also adds it to the given Klaviyo list.
 * If a duplicate profile exists (409), behavior depends on "addIfDuplicate":
 *  - true  -> use "meta.duplicate_profile_id" returned by Klaviyo and add THAT profile to the list.
 *  - false -> return 200 with a message saying the profile already exists (no list addition).
 *
 * Request body (JSON):
 * {
 *   "profile": {
 *     "email": "george.washington@klaviyo.com",
 *     "phone_number": "+13239169023",
 *     "first_name": "Sarah",
 *     "last_name": "Mason",
 *     "locale": "en-US"
 *   },
 *   "addToList": true,
 *   "listId": "YOUR_LIST_ID",
 *   "addIfDuplicate": false
 * }
 *
 * Responses:
 *  - 201 Created: profile created (and optionally added to list).
 *  - 200 OK     : duplicate profile encountered and client chose not to add; or already in list.
 *  - 4xx/5xx    : validation or upstream errors, with structured JSON.
 */
router.post("/add-profile-to-klaviyo-list", async (req, res) => {
  const klaviyo = new KlaviyoImp()
  const { klaviyoToken } = req.body

  try {
    if (!klaviyoToken) {
      return res.status(500).json({
        error: {
          code: "server_misconfig",
          message: "Klaviyo API key is not configured.",
        },
      })
    }

    const { errors, listId, addToList, addIfDuplicate, profile } =
      validateCreateProfilePayload(req.body)
    if (errors.length) {
      return res
        .status(400)
        .json({ error: { code: "invalid_request", details: errors } })
    }

    // 1) Create profile (idempotency key reduces accidental duplicates on retries)
    let profileId = null
    let createdFresh = false

    try {
      const createBody = {
        data: {
          type: "profile",
          attributes: {
            ...(profile.email ? { email: profile.email } : {}),
            ...(profile.phone_number
              ? { phone_number: profile.phone_number }
              : {}),
            ...(profile.first_name ? { first_name: profile.first_name } : {}),
            ...(profile.last_name ? { last_name: profile.last_name } : {}),
            ...(profile.locale ? { locale: profile.locale } : {}),
          },
        },
      }

      const createRes = await klaviyo.klaviyoFetch(
        "/profiles",
        {
          method: "POST",
          body: createBody,
        },
        klaviyoToken
      )

      profileId = createRes.data?.data?.id
      createdFresh = true
    } catch (err) {
      // Handle duplicate profile (409)
      if (
        err.status === 409 &&
        err.data?.errors?.[0]?.code === "duplicate_profile"
      ) {
        const duplicateId = err.data?.errors?.[0]?.meta?.duplicate_profile_id
        if (!duplicateId) {
          // Defensive: Klaviyo should send this, but don't assume
          return res.status(502).json({
            error: {
              code: "upstream_incomplete_duplicate_payload",
              message:
                'Duplicate profile detected but no "duplicate_profile_id" was provided by Klaviyo.',
              upstream: err.data,
            },
          })
        }

        if (!addIfDuplicate) {
          // As requested: return 200 and *do not* add to list
          return res.status(200).json({
            message:
              'Profile already exists. Not added to list because "addIfDuplicate" is false.',
            profileId: duplicateId,
          })
        }

        // Use duplicate id for downstream "add to list"
        profileId = duplicateId
        createdFresh = false
      } else {
        // Any other upstream error
        return res.status(err.status || 502).json({
          error: {
            code: "klaviyo_create_profile_failed",
            message: "Failed to create Klaviyo profile.",
            upstream: err.data || err.message,
          },
        })
      }
    }

    // 2) Optionally add the profile to the list
    if (addToList && listId && profileId) {
      try {
        const addRes = await klaviyo.klaviyoFetch(
          `/lists/${encodeURIComponent(listId)}/relationships/profiles`,
          {
            method: "POST",
            body: {
              data: [{ type: "profile", id: profileId }],
            },
          },
          klaviyoToken
        )

        // Klaviyo returns 204 No Content on success
        if (addRes.status === 204) {
          return res.status(createdFresh ? 201 : 200).json({
            message: createdFresh
              ? "Profile created and added to list."
              : "Existing profile added to list.",
            profileId,
            listId,
          })
        }

        // Defensive: unexpected success code
        return res.status(200).json({
          message:
            "Profile processed. Unexpected status when adding to list, but no error returned.",
          status: addRes.status,
          profileId,
          listId,
        })
      } catch (err) {
        // If the profile is already in the list, Klaviyo may return a 409 or 400 depending on API behavior.
        // You asked to respond 200 saying it’s already in the list if not adding in duplicate case.
        // Here, if Klaviyo indicates "already in relationship", we normalize to 200.
        const upstream = err.data || {}
        const maybeAlreadyInList =
          err.status === 409 ||
          (Array.isArray(upstream.errors) &&
            upstream.errors.some((e) =>
              String(e?.detail || "")
                .toLowerCase()
                .includes("already")
            ))

        if (maybeAlreadyInList) {
          return res.status(200).json({
            message: "Profile is already in the list.",
            profileId,
            listId,
          })
        }

        return res.status(err.status || 502).json({
          error: {
            code: "klaviyo_add_to_list_failed",
            message: "Failed to add profile to list.",
            upstream: upstream || err.message,
          },
          profileId,
          listId,
        })
      }
    }

    // 3) If not adding to list, just return the profile result
    return res.status(createdFresh ? 201 : 200).json({
      message: createdFresh
        ? "Profile created."
        : "Profile exists (duplicate).",
      profileId,
    })
  } catch (err) {
    return res.status(500).json({
      error: {
        code: "unhandled_error",
        message: err?.message || "Unexpected server error.",
      },
    })
  }
})

/**
 * @openapi
 * /report:
 *   post:
 *     tags:
 *       - Webhook
 *     description: Insert order created data into Google Sheets
 *     responses:
 *       200:
 *         description: Returns JSON message
 */
router.post("/counterdelivery/report", async (req, res) => {
  try {
    const google = new GoogleImp()
    const orderPayload = req.body

    const ORDER_STATUS = {
      default: "SIN CONFIRMAR",
      confirmed: "CONFIRMADA",
      canceled: "CANCELADA",
      create_again: "CREAR DE NUEVO",
    }
    const DELIVERY_STATUS = {
      default: "SIN CONFIRMAR",
      delivered: "ENTREGADA",
      in_transit: "EN TRANSITO",
    }

    const orderNumber = orderPayload.order || ""
    const customerName = orderPayload.customer
    const rawCreatedAt = orderPayload.created_at || null

    const createdAtForSheets = rawCreatedAt
      ? new Date(rawCreatedAt)
          .toLocaleString("en-CA", {
            timeZone: "America/Bogota",
            hour12: false,
          })
          .replace(",", "")
      : ""

    // A1 notation: hoja y columnas destino
    const spreadsheetId = orderPayload.sheet_id
    const sheetName = orderPayload.sheet_name
    const range = `${sheetName}!A:C`

    // Fila a insertar
    const values = [
      [
        orderNumber,
        customerName,
        createdAtForSheets,
        ORDER_STATUS.default,
        DELIVERY_STATUS.default,
      ],
    ]

    await google.appendValues(spreadsheetId, range, values)

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

/**
 * @apiapi
 * Updates an existing order report.
 */
router.put("/counterdelivery/report", async (req, res) => {
  try {
    const google = new GoogleImp()
    const {
      order,
      sheet_id: spreadsheetId,
      sheet_name: sheetName,
      notes,
      order_action,
      delivery_action,
    } = req.body

    if (!order || !spreadsheetId || !sheetName) {
      return res.status(400).json({
        ok: false,
        error: "order, sheet_id y sheet_name son requeridos",
      })
    }

    // Order status mapping
    const ORDER_STATUS = {
      default: "SIN CONFIRMAR",
      confirmed: "CONFIRMADA",
      canceled: "CANCELADA",
      create_again: "CREAR DE NUEVO",
    }

    // Delivery status mapping
    const DELIVERY_STATUS = {
      default: "SIN CONFIRMAR",
      pending: "SIN DESPACHAR",
      canceled: "CANCELADA",
      rejected: "RECHAZADA",
      in_transit: "EN TRANSITO",
      delivered: "ENTREGADA",
    }

    // 1) Read the entire sheet
    const values = await google.getValues(spreadsheetId, `${sheetName}`);
    if (!values || values.length === 0) {
      return res.status(404).json({ ok: false, error: "Hoja sin datos" })
    }

    // 2) Search for row by order number in col A
    const rowIndex = values.findIndex((row) => row[0] === order);
    if (rowIndex === -1) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    const currentRow = values[rowIndex] || []
    const currentEstado = currentRow[3] || "" // Col D
    const currentDelivery = currentRow[4] || "" // Col E
    const currentNotes = currentRow[5] || "" // Col F

    // 3) Decide to update
    const newEstado =
      order_action &&
      Object.prototype.hasOwnProperty.call(ORDER_STATUS, order_action)
        ? ORDER_STATUS[order_action]
        : currentEstado

    const newDelivery =
      delivery_action &&
      Object.prototype.hasOwnProperty.call(DELIVERY_STATUS, delivery_action)
        ? DELIVERY_STATUS[delivery_action]
        : currentDelivery

    const newNotes = typeof notes === "string" ? notes : currentNotes

    // 4) Update D:F in that row
    await google.updateRowByCellValue(
      spreadsheetId,
      sheetName,
      0,       // searchColumn (A)
      order,   // value to search
      [[newEstado, newDelivery, newNotes]],
      "D",
      "D"      // endColumn recalculated with newValues
    );

    res.json({
      ok: true,
      message: "Fila actualizada",
      data: {
        order,
        estado: newEstado,
        delivery: newDelivery,
        notes: newNotes,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

/**
 * @apiapi
 * Sets up a dropdown with colors in a specific sheet/range.
 * Body:
 *  - sheet_id (string)       [required]
 *  - sheet_name (string)     [required]
 *  - start_col (string)      [required]  e.g. "D"
 *  - end_col (string)        [required]  e.g. "D"
 *  - start_row (number)      [optional]  default 2
 *  - options (array)         [required]  [{ value, bgColor?, textColor? }]
 */
router.post("/sheetsconfig/dropwdown", async (req, res) => {
  try {
    const {
      sheet_id: spreadsheetId,
      sheet_name: sheetName,
      start_col: startColLetter,
      end_col: endColLetter,
      start_row: startRowIndex = 2,
      options,
    } = req.body || {}

    if (
      !spreadsheetId ||
      !sheetName ||
      !startColLetter ||
      !endColLetter ||
      !Array.isArray(options) ||
      options.length === 0
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Parámetros requeridos: sheet_id, sheet_name, start_col, end_col, options[]",
      })
    }

    const google = new GoogleImp()
    await google.setDropdownWithColors({
      spreadsheetId,
      sheetName,
      startColLetter,
      endColLetter,
      startRowIndex: Number(startRowIndex) || 2,
      options,
    })

    res.json({ ok: true, message: "Dropdown configurado correctamente." })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

/**
 * @openapi
 * /create-order:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Create a Shopify order
 *     description: Creates an order in the shop identified by `shopAlias`. The `variables` object is passed through to ShopifyImp.createOrder(...). If Shopify returns userErrors, the endpoint responds with 400 and surfaces those errors.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shopAlias
 *               - variables
 *             properties:
 *               shopAlias:
 *                 type: string
 *                 description: Alias/identifier for the target Shopify shop.
 *                 example: acme-us
 *               variables:
 *                 type: object
 *                 description: Free-form payload forwarded to ShopifyImp.createOrder(...).
 *                 additionalProperties: true
 */
router.post("/create-order", async (req, res) => {
  try {
    const { shopAlias, variables } = req.body

    if (!shopAlias || !variables) {
      return res
        .status(400)
        .json({ ok: false, message: "Missing required fields" })
    }

    const shopifyImp = new ShopifyImp(shopAlias)
    const response = await shopifyImp.createOrder(variables)

    if (response.userErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "There was an error with the information provided",
        errors: response.userErrors,
      })
    } else {
      return res.status(200).json({
        ok: true,
        message: "Order created successfully",
        data: response,
      })
    }
  } catch (err) {
    console.error(err)
    res.status(400).json({ ok: false, error: err.message })
  }
})

export default router
