import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import swaggerUi from "swagger-ui-express"
import { rateLimit } from "express-rate-limit"
import { rateLimitHandler } from "./services/rate-limit.js"
import openapiSpecification from "./middlewares/swagger.js"

dotenv.config()

export const app = express()

if (process.env.NODE_ENV !== "production") {
  // Habilitar proxy para loopback y redes locales (RFC4193)
  app.set("trust proxy", ["loopback", "uniquelocal"])
}

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 40, // Limit each IP to 40 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: async (req, res, next, options) => await rateLimitHandler(req, res),
  statusCode: 500,
})

app.use(express.json())
app.use(cors())
app.use(limiter)

export const HOSTNAME = process.env.HOSTNAME
export const PORT = parseInt(process.env.PORT) || 3000
export const NODE_ENV = process.env.NODE_ENV || "development"
export const APP_TOKEN = process.env.APP_TOKEN

// Crypt
export const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
export const ENCRYPTION_SECRET_IV = process.env.ENCRYPTION_SECRET_IV;
export const ENCRYPTION_METHOD = process.env.ENCRYPTION_METHOD;

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

// Cancel Subscription Channels To Notify
export const CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS =
  process.env.CANCEL_SUBSCRIPTION_NOTIFY_CHANNELS
export const CANCEL_SUBSCRIPTION_NOTIFY_CHANNEL_IDS =
  process.env.CANCEL_SUBSCRIPTION_NOTIFY_CHANNEL_IDS

// Update Address Channels To Notify
export const UPDATE_ADDRESS_NOTIFY_CHANNELS =
  process.env.UPDATE_ADDRESS_NOTIFY_CHANNELS
export const UPDATE_ADDRESS_NOTIFY_CHANNEL_IDS =
  process.env.UPDATE_ADDRESS_NOTIFY_CHANNEL_IDS

if (NODE_ENV === "development")
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpecification))

