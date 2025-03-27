import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import swaggerUi from "swagger-ui-express"
import { rateLimit } from 'express-rate-limit'
import { rateLimitHandler } from "./services/rate-limit.js"
import openapiSpecification from "./middlewares/swagger.js"

dotenv.config()

export const app = express()

const limiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 1 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: async (req, res, next, options) => await rateLimitHandler(req, res),
  statusCode: 500
})

app.use(express.json())
app.use(cors())
app.use(limiter);

export const HOSTNAME = process.env.HOSTNAME
export const PORT = parseInt(process.env.PORT) || 3000
export const NODE_ENV = process.env.NODE_ENV || "development"
export const APP_TOKEN = process.env.APP_TOKEN

// Email
export const EMAIL_SENDER = process.env.EMAIL_SENDER
export const EMAIL_HOST = process.env.EMAIL_HOST
export const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || 465)
export const EMAIL_USER = process.env.EMAIL_USER
export const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD

// Databases
export const REDIS_URL = process.env.REDIS_URL
export const PGUSER = process.env.PGUSER
export const PGPASSWORD = process.env.PGPASSWORD
export const PGHOST = process.env.PGHOST
export const PGPORT = parseInt(process.env.PGPORT || 5432)
export const PGDATABASE = process.env.PGDATABASE
export const PGSSL = process.env.PGSSL === "true"

// HS
export const SECRET_HS = process.env.SECRET_HS
const SHOP_NAME_HS = process.env.SHOP_NAME_HS
const SHOP_COLOR_HS = process.env.SHOP_COLOR_HS
const CONTACT_PAGE_HS = process.env.CONTACT_PAGE_HS
const SHOPIFY_ALIAS_HS = process.env.SHOPIFY_ALIAS_HS
export const SHOPIFY_URL_HS = process.env.SHOPIFY_URL_HS
const SHOPIFY_API_KEY_HS = process.env.SHOPIFY_API_KEY_HS
const SHOPIFY_API_SECRET_KEY_HS = process.env.SHOPIFY_API_SECRET_KEY_HS
const SKIO_API_KEY_HS = process.env.SKIO_API_KEY_HS
const ATTENTIVE_API_KEY_HS = process.env.ATTENTIVE_API_KEY_HS
const PRODUCT_FAKE_VARIANT_ID_HS = process.env.PRODUCT_FAKE_VARIANT_ID_HS
const PRODUCT_SUBSCRIPTION_METAFIELD_KEY_HS = process.env.PRODUCT_SUBSCRIPTION_METAFIELD_KEY_HS
const EMAIL_SENDER_HS = process.env.EMAIL_SENDER_HS
const EMAIL_HOST_HS = process.env.EMAIL_HOST_HS
const EMAIL_USER_HS = process.env.EMAIL_USER_HS
const EMAIL_PASSWORD_HS = process.env.EMAIL_PASSWORD_HS
const EMAIL_PORT_HS = parseInt(process.env.EMAIL_PORT_HS || 587)

// CS
export const SECRET_CS = process.env.SECRET_CS
const SHOP_NAME_CS = process.env.SHOP_NAME_CS
const SHOP_COLOR_CS = process.env.SHOP_COLOR_CS
const CONTACT_PAGE_CS = process.env.CONTACT_PAGE_CS
const SHOPIFY_ALIAS_CS = process.env.SHOPIFY_ALIAS_CS
export const SHOPIFY_URL_CS = process.env.SHOPIFY_URL_CS
const SHOPIFY_API_KEY_CS = process.env.SHOPIFY_API_KEY_CS
const SHOPIFY_API_SECRET_KEY_CS = process.env.SHOPIFY_API_SECRET_KEY_CS
const SKIO_API_KEY_CS = process.env.SKIO_API_KEY_CS
const ATTENTIVE_API_KEY_CS = process.env.ATTENTIVE_API_KEY_CS
const PRODUCT_FAKE_VARIANT_ID_CS = process.env.PRODUCT_FAKE_VARIANT_ID_CS
const PRODUCT_SUBSCRIPTION_METAFIELD_KEY_CS = process.env.PRODUCT_SUBSCRIPTION_METAFIELD_KEY_CS
const EMAIL_SENDER_CS = process.env.EMAIL_SENDER_CS
const EMAIL_HOST_CS = process.env.EMAIL_HOST_CS
const EMAIL_USER_CS = process.env.EMAIL_USER_CS
const EMAIL_PASSWORD_CS = process.env.EMAIL_PASSWORD_CS
const EMAIL_PORT_CS = parseInt(process.env.EMAIL_PORT_CS || 587)

// RS
export const SECRET_RS = process.env.SECRET_RS
const SHOP_NAME_RS = process.env.SHOP_NAME_RS
const SHOP_COLOR_RS = process.env.SHOP_COLOR_RS
const CONTACT_PAGE_RS = process.env.CONTACT_PAGE_RS
const SHOPIFY_ALIAS_RS = process.env.SHOPIFY_ALIAS_RS
export const SHOPIFY_URL_RS = process.env.SHOPIFY_URL_RS
const SHOPIFY_API_KEY_RS = process.env.SHOPIFY_API_KEY_RS
const SHOPIFY_API_SECRET_KEY_RS = process.env.SHOPIFY_API_SECRET_KEY_RS
const SKIO_API_KEY_RS = process.env.SKIO_API_KEY_RS
const ATTENTIVE_API_KEY_RS = process.env.ATTENTIVE_API_KEY_RS
const PRODUCT_FAKE_VARIANT_ID_RS = process.env.PRODUCT_FAKE_VARIANT_ID_RS
const PRODUCT_SUBSCRIPTION_METAFIELD_KEY_RS = process.env.PRODUCT_SUBSCRIPTION_METAFIELD_KEY_RS
const EMAIL_SENDER_RS = process.env.EMAIL_SENDER_RS
const EMAIL_HOST_RS = process.env.EMAIL_HOST_RS
const EMAIL_USER_RS = process.env.EMAIL_USER_RS
const EMAIL_PASSWORD_RS = process.env.EMAIL_PASSWORD_RS
const EMAIL_PORT_RS = parseInt(process.env.EMAIL_PORT_RS || 587)

// VS
export const SECRET_VS = process.env.SECRET_VS
const SHOP_NAME_VS = process.env.SHOP_NAME_VS
const SHOP_COLOR_VS = process.env.SHOP_COLOR_VS
const CONTACT_PAGE_VS = process.env.CONTACT_PAGE_VS
const SHOPIFY_ALIAS_VS = process.env.SHOPIFY_ALIAS_VS
export const SHOPIFY_URL_VS = process.env.SHOPIFY_URL_VS
const SHOPIFY_API_KEY_VS = process.env.SHOPIFY_API_KEY_VS
const SHOPIFY_API_SECRET_KEY_VS = process.env.SHOPIFY_API_SECRET_KEY_VS
const SKIO_API_KEY_VS = process.env.SKIO_API_KEY_VS
const ATTENTIVE_API_KEY_VS = process.env.ATTENTIVE_API_KEY_VS
const PRODUCT_FAKE_VARIANT_ID_VS = process.env.PRODUCT_FAKE_VARIANT_ID_VS
const PRODUCT_SUBSCRIPTION_METAFIELD_KEY_VS = process.env.PRODUCT_SUBSCRIPTION_METAFIELD_KEY_VS
const EMAIL_SENDER_VS = process.env.EMAIL_SENDER_VS
const EMAIL_HOST_VS = process.env.EMAIL_HOST_VS
const EMAIL_USER_VS = process.env.EMAIL_USER_VS
const EMAIL_PASSWORD_VS = process.env.EMAIL_PASSWORD_VS
const EMAIL_PORT_VS = parseInt(process.env.EMAIL_PORT_VS || 587)

// DM
export const SECRET_DM = process.env.SECRET_DM
const SHOP_NAME_DM = process.env.SHOP_NAME_DM
const SHOP_COLOR_DM = process.env.SHOP_COLOR_DM
const CONTACT_PAGE_DM = process.env.CONTACT_PAGE_DM
const SHOPIFY_ALIAS_DM = process.env.SHOPIFY_ALIAS_DM
export const SHOPIFY_URL_DM = process.env.SHOPIFY_URL_DM
const SHOPIFY_API_KEY_DM = process.env.SHOPIFY_API_KEY_DM
const SHOPIFY_API_SECRET_KEY_DM = process.env.SHOPIFY_API_SECRET_KEY_DM
const SKIO_API_KEY_DM = process.env.SKIO_API_KEY_DM
const ATTENTIVE_API_KEY_DM = process.env.ATTENTIVE_API_KEY_DM
const PRODUCT_FAKE_VARIANT_ID_DM = process.env.PRODUCT_FAKE_VARIANT_ID_DM
const PRODUCT_SUBSCRIPTION_METAFIELD_KEY_DM = process.env.PRODUCT_SUBSCRIPTION_METAFIELD_KEY_DM
const EMAIL_SENDER_DM = process.env.EMAIL_SENDER_DM
const EMAIL_HOST_DM = process.env.EMAIL_HOST_DM
const EMAIL_USER_DM = process.env.EMAIL_USER_DM
const EMAIL_PASSWORD_DM = process.env.EMAIL_PASSWORD_DM
const EMAIL_PORT_DM = parseInt(process.env.EMAIL_PORT_DM || 587)

// MW
export const SECRET_MW = process.env.SECRET_MW
const SHOP_NAME_MW = process.env.SHOP_NAME_MW
const SHOP_COLOR_MW = process.env.SHOP_COLOR_MW
const CONTACT_PAGE_MW = process.env.CONTACT_PAGE_MW
const SHOPIFY_ALIAS_MW = process.env.SHOPIFY_ALIAS_MW
export const SHOPIFY_URL_MW = process.env.SHOPIFY_URL_MW
const SHOPIFY_API_KEY_MW = process.env.SHOPIFY_API_KEY_MW
const SHOPIFY_API_SECRET_KEY_MW = process.env.SHOPIFY_API_SECRET_KEY_MW
const SKIO_API_KEY_MW = process.env.SKIO_API_KEY_MW
const ATTENTIVE_API_KEY_MW = process.env.ATTENTIVE_API_KEY_MW
const PRODUCT_FAKE_VARIANT_ID_MW = process.env.PRODUCT_FAKE_VARIANT_ID_MW
const PRODUCT_SUBSCRIPTION_METAFIELD_KEY_MW = process.env.PRODUCT_SUBSCRIPTION_METAFIELD_KEY_MW
const EMAIL_SENDER_MW = process.env.EMAIL_SENDER_MW
const EMAIL_HOST_MW = process.env.EMAIL_HOST_MW
const EMAIL_USER_MW = process.env.EMAIL_USER_MW
const EMAIL_PASSWORD_MW = process.env.EMAIL_PASSWORD_MW
const EMAIL_PORT_MW = parseInt(process.env.EMAIL_PORT_MW || 587)

// Cancel Subscription Channels To Notify
export const CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS = process.env.CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS;

// Update Address Channels To Notify
export const UPDATE_ADDRESS_NOTIFY_CHANNELS = process.env.UPDATE_ADDRESS_NOTIFY_CHANNELS;


if (NODE_ENV === "development")
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpecification))

export const SHOPS_ORIGIN = {
  "https://hotshapers.com": {
    shop: SHOPIFY_URL_HS,
    shopAlias: SHOPIFY_ALIAS_HS,
    shopName: SHOP_NAME_HS,
    shopColor: SHOP_COLOR_HS,
    contactPage: CONTACT_PAGE_HS,
    productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_HS,
    emailSender: EMAIL_SENDER_HS,
    attentiveKey: ATTENTIVE_API_KEY_HS,
    productSubscriptionMetafieldKey: PRODUCT_SUBSCRIPTION_METAFIELD_KEY_HS
  },
  "https://copperslim.com": {
    shop: SHOPIFY_URL_CS,
    shopAlias: SHOPIFY_ALIAS_CS,
    shopName: SHOP_NAME_CS,
    shopColor: SHOP_COLOR_CS,
    contactPage: CONTACT_PAGE_CS,
    productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_CS,
    emailSender: EMAIL_SENDER_CS,
    attentiveKey: ATTENTIVE_API_KEY_CS,
    productSubscriptionMetafieldKey: PRODUCT_SUBSCRIPTION_METAFIELD_KEY_CS
  },
  "https://redusculpt.com": {
    shop: SHOPIFY_URL_RS,
    shopAlias: SHOPIFY_ALIAS_RS,
    shopName: SHOP_NAME_RS,
    shopColor: SHOP_COLOR_RS,
    contactPage: CONTACT_PAGE_RS,
    productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_RS,
    emailSender: EMAIL_SENDER_RS,
    attentiveKey: ATTENTIVE_API_KEY_RS,
    productSubscriptionMetafieldKey: PRODUCT_SUBSCRIPTION_METAFIELD_KEY_RS
  },
  "https://vibrosculpt.com": {
    shop: SHOPIFY_URL_VS,
    shopAlias: SHOPIFY_ALIAS_VS,
    shopName: SHOP_NAME_VS,
    shopColor: SHOP_COLOR_VS,
    contactPage: CONTACT_PAGE_VS,
    productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_VS,
    emailSender: EMAIL_SENDER_VS,
    attentiveKey: ATTENTIVE_API_KEY_VS,
    productSubscriptionMetafieldKey: PRODUCT_SUBSCRIPTION_METAFIELD_KEY_VS
  },
  "https://drmingtea.com": {
    shop: SHOPIFY_URL_DM,
    shopAlias: SHOPIFY_ALIAS_DM,
    shopName: SHOP_NAME_DM,
    shopColor: SHOP_COLOR_DM,
    contactPage: CONTACT_PAGE_DM,
    productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_DM,
    emailSender: EMAIL_SENDER_DM,
    attentiveKey: ATTENTIVE_API_KEY_DM,
    productSubscriptionMetafieldKey: PRODUCT_SUBSCRIPTION_METAFIELD_KEY_DM
  },
  "https://mywayhairdna.com": {
    shop: SHOPIFY_URL_MW,
    shopAlias: SHOPIFY_ALIAS_MW,
    shopName: SHOP_NAME_MW,
    shopColor: SHOP_COLOR_MW,
    contactPage: CONTACT_PAGE_MW,
    productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_MW,
    emailSender: EMAIL_SENDER_MW,
    attentiveKey: ATTENTIVE_API_KEY_MW,
    productSubscriptionMetafieldKey: PRODUCT_SUBSCRIPTION_METAFIELD_KEY_MW
  }
}

export default {
  SHOPIFY_URL_HS,
  SHOPIFY_URL_CS,
  SHOPIFY_URL_RS,
  SHOPIFY_URL_MW,
  SHOPIFY_URL_DM,
  SHOPIFY_URL_VS,
  SHOP_NAME_HS,
  SHOP_NAME_CS,
  SHOP_NAME_RS,
  SHOP_NAME_VS,
  SHOP_NAME_DM,
  SHOP_NAME_MW,
  SHOP_COLOR_HS,
  SHOP_COLOR_CS,
  SHOP_COLOR_RS,
  SHOP_COLOR_VS,
  SHOP_COLOR_DM,
  SHOP_COLOR_MW,
  CONTACT_PAGE_HS,
  CONTACT_PAGE_CS,
  CONTACT_PAGE_RS,
  CONTACT_PAGE_VS,
  CONTACT_PAGE_DM,
  CONTACT_PAGE_MW,
  SHOPIFY_API_KEY_HS,
  SHOPIFY_API_SECRET_KEY_HS,
  SKIO_API_KEY_HS,
  EMAIL_SENDER_HS,
  EMAIL_HOST_HS,
  EMAIL_USER_HS,
  EMAIL_PASSWORD_HS,
  EMAIL_PORT_HS,
  SHOPIFY_API_KEY_CS,
  SHOPIFY_API_SECRET_KEY_CS,
  SKIO_API_KEY_CS,
  EMAIL_SENDER_CS,
  EMAIL_HOST_CS,
  EMAIL_USER_CS,
  EMAIL_PASSWORD_CS,
  EMAIL_PORT_CS,
  SHOPIFY_API_KEY_RS,
  SHOPIFY_API_SECRET_KEY_RS,
  SKIO_API_KEY_RS,
  EMAIL_SENDER_RS,
  EMAIL_HOST_RS,
  EMAIL_USER_RS,
  EMAIL_PASSWORD_RS,
  EMAIL_PORT_RS,
  SHOPIFY_API_KEY_VS,
  SHOPIFY_API_SECRET_KEY_VS,
  SKIO_API_KEY_VS,
  EMAIL_SENDER_VS,
  EMAIL_HOST_VS,
  EMAIL_USER_VS,
  EMAIL_PASSWORD_VS,
  EMAIL_PORT_VS,
  SHOPIFY_API_KEY_DM,
  SHOPIFY_API_SECRET_KEY_DM,
  SKIO_API_KEY_DM,
  EMAIL_SENDER_DM,
  EMAIL_HOST_DM,
  EMAIL_USER_DM,
  EMAIL_PASSWORD_DM,
  EMAIL_PORT_DM,
  SHOPIFY_API_KEY_MW,
  SHOPIFY_API_SECRET_KEY_MW,
  SKIO_API_KEY_MW,
  EMAIL_SENDER_MW,
  EMAIL_HOST_MW,
  EMAIL_USER_MW,
  EMAIL_PASSWORD_MW,
  EMAIL_PORT_MW,
}
