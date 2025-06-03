import { Router } from "express"
import express from "express"
import logger from "../../logger.js"
import app, { SHOPS_ORIGIN } from "../app.js"
import fs from "fs"
import bearerToken from "express-bearer-token"
import Mailer from "../implements/nodemailer.imp.js"
import { authenticateToken } from "../middlewares/authenticate-token.js"
import SubscriptionImp from "../implements/skio.imp.js"
import GorgiasImp from "../implements/gorgias.imp.js"
import GoogleImp from "../implements/google.imp.js"
import OpenAIImp from "../implements/openai.imp.js"
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
  generateExcelReport,
  parseSurveyData,
} from "../services/survey-utils.js"

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
    //classes
    const gorgias = new GorgiasImp()
    const openAI = new OpenAIImp()
    const google = new GoogleImp()
    //utils
    const emailSender = gorgias.emailSender
    const spreadsheetId = process.env.SHEET_ID
    const createMessagePromt = `
    You are a professional customer service assistant specialized in responding to influencer collaboration messages. You always respond with kindness, professionalism, and clarity.

    Your tasks:
    1. Respond to the customer based on the conversation history provided.
    2. Always reply in the **same language** as the customer. If the last customer message is in English, you must respond in English. If in Spanish, respond in Spanish.
    3. Always capitalize the **first letter of each sentence**.
    4. Do NOT include labels like "Sender:" or "Message:" in your reply.
    5. Never mention that you are an AI, assistant, or bot.
    6. If the customer has already provided a name and at least one social media (Instagram or TikTok), thank them and confirm that the info was received. Do NOT ask for more info.
    7. If the customer has not provided that, ask politely and concisely for the missing info (name and at least one social media), dont forget to ask about their email or phone number too but keep in mind that email and phone number are optional.
    8. Keep your response short and friendly, and never sign with a name or role.

    Now write the appropriate response to the customer based on this conversation:
  `
    const extractDataPromt = `
    Your task is to extract structured data from influencer/customer messages. Return the information as a single JSON object with the following keys: "name", "email", "instagram", "tiktok", "phone", and "notes".
    If any field is not present, set its value to ''.
    If the same information appears more than once in the message history (e.g., the same email or Instagram), and it is clearly the same user, return only one JSON object, not duplicates.
    If the user provides the same social media twice (e.g., two Instagram accounts), return only the last one.
    If the user has provided a name and at least one social media (Instagram or TikTok), create a key called "confirmed" with a value of true as a boolean not string, otherwise is false.
    The data that you extract has to be only one object and it's keys values most be strings strings values, not arrays or objects.
  `
    try {
      //getting ticket data
      const ticketId = req.body.ticket_id
      const ticket = await gorgias.getTicket(ticketId)
      if (!ticket) return res.status(404).json({ message: "Ticket not found" })

      const ticketTags = ticket.tags.map((tag) => tag.name).join(", ")
      const ticketMessages = ticket.messages
      let ticketMessagesStr = ""
      if (ticketMessages.length > 0) {
        ticketMessagesStr = ticketMessages
          .map((message, index) => {
            if (index == 0) {
              return gorgias.cleanMessage(
                `Customer: ${ticket.customer.name}.\nMessage: ${message.body_text}.`
              )
            } else if (ticket.customer.name == message.sender.name) {
              return gorgias.cleanMessage(
                `Customer: ${message.sender.name}.\nMessage: ${message.body_text}.`
              )
            } else {
              return gorgias.cleanMessage(`${message.body_text}.`)
            }
          })
          .join("\n")
      }
      const lastSender =
        ticketMessages[ticketMessages.length - 1].sender.email || ""
      const firstMessage = ticketMessages[0]
      const ticketChannel = ticket.channel
      const ticketSource = {
        from: {
          name: firstMessage.source.to[0].name,
          address: firstMessage.source.to[0].address,
        },
        type: `${ticketChannel}`,
        to: [
          {
            name: firstMessage.source.from.name,
            address: firstMessage.source.from.address,
          },
        ],
      }
      const reciever = {
        id: ticket.customer.id,
        name: ticket.customer.name,
      }

      console.log({ ticketId, ticketTags })
      //COMIENZA EL PROCESO
      // 1. Consultar ticket en base de datos
      const dbTicket = await dbRepository.getTicketById(ticketId)

      if (dbTicket) {
        // 1.1 Ya existe: validar si puede continuar
        if (dbTicket.status === "COMPLETED") {
          return res.status(200).json({
            message: `Ticket ${ticketId} is already ${dbTicket.status}. Skipping.`,
          })
        } else if (dbTicket.status === "ERROR" && dbTicket.retries >= 3) {
          return res.status(200).json({
            message: `Ticket ${ticketId} failed too many times. Skipping.`,
          })
        }

        // 1.2 Si viene sin el tag de test juanma, no lo procesamos
        if (!ticketTags.toLowerCase().includes("test juanma")) {
          return res.status(200).json({
            message: "Ticket already exists but does not match tag. Skipping.",
          })
        }
        // 1.3 Pasa ticket a processing
        await dbRepository.updateTicketStatus(ticketId, "PROCESSING")
      } else {
        // 1.4 No existe aún: guardar como UNPROCESSED
        await dbRepository.saveTicket(ticketId, ticketTags, "UNPROCESSED", 0)
        // 1.5 Si aún no tiene el tag, se ignora
        if (!ticketTags.toLowerCase().includes("test juanma")) {
          return res.status(200).json({
            message: "Ticket saved as UNPROCESSED. Tag not matched yet.",
          })
        }
      }

      // 2. Procesar ticket
      // 2.1 Responder automáticamente si el último mensaje no fue del bot
      if (lastSender !== emailSender) {
        const messageReply = await openAI.openAIMessage(
          createMessagePromt,
          ticketMessagesStr
        )
        await gorgias.sendMessageTicket(
          ticketId,
          messageReply,
          ticketChannel,
          ticketSource,
          reciever
        )
      }
      // 2.2 Extraer datos del cliente
      const customerData = await openAI.extractInfluencerData(
        extractDataPromt,
        ticketMessagesStr
      )
      console.log(customerData)
      // 2.3 Validar y guardar en Google Sheets
      if (
        customerData.confirmed === true ||
        customerData.confirmed === "true"
      ) {
        await google.appendValues(spreadsheetId, "Hoja 2", [
          [
            ticketTags,
            customerData.instagram,
            customerData.tiktok,
            customerData.name,
            customerData.email,
            customerData.phone,
            customerData.notes,
          ],
        ])
        // 2.4 Actualizar estado a COMPLETED
        await dbRepository.updateTicketStatus(ticketId, "COMPLETED")
        return res.json({
          message: "Influencer ticket successfully processed.",
        })
      }
    } catch (err) {
      console.error(err)
      logger.error(err.message)

      // fallback: marcar como ERROR y sumar retries
      try {
        const dbTicket = await dbRepository.getTicketById(req.body.ticket_id)
        if (dbTicket) {
          await dbRepository.updateTicketStatus(dbTicket.ticket_id, "ERROR")
          await dbRepository.incrementRetries(dbTicket.ticket_id)
        }
      } catch (dbErr) {
        logger.error(`Retry handling failed: ${dbErr.message}`)
      }

      return res.status(200).json({ message: err.message })
    }
  }
)

/**
 *  @openapi
 *  /slack-app:
 *    post:
 *      tags:
 *        - Webhook
 *      description: Slack App. Send a email to customers who buy CamiHotSize M.
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
 */
router.post(
  "/slack-app",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const { command, text, channel_id } = req.body

    if (command === "/survey-report") {
      const google = new GoogleImp()
      const slack = new SlackImp()

      let [sheetUrl, sheetName] = text.split(" ")
      const spreadsheetId = sheetUrl
        .replace("https://docs.google.com/spreadsheets/d/", "")
        .split("/")[0]

      sheetName = sheetName.replace("*", "")

      res.status(200).json({
        response_type: "ephemeral",
        text: `El reporte para ${sheetName} será enviado en breve 👨🏻‍💻`,
      })

      const rawData = await google.getValues(
        spreadsheetId,
        `${sheetName}!A1:HZ`
      )

      const parsedData = parseSurveyData(rawData)
      const stats = analyzeSurvey(parsedData)

      const filePath = await generateExcelReport(stats, parsedData)

      await slack.uploadFile(
        filePath,
        channel_id,
        "Aqui tienes tu reporte de encuestas ✅",
        "survey-report.xlsx",
        sheetName
      )

      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filePath}:`, err)
        } else {
          console.log(`Deleted file: ${filePath}`)
        }
      })

      return null
    }

    return res.status(200).json({ message: "Comando no reconocido." })
  }
)

export default router
