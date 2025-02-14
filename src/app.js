import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import openapiSpecification from './middlewares/swagger.js';

dotenv.config();

export const app = express();

app.use(express.json());
app.use(cors());

export const HOSTNAME = process.env.HOSTNAME;
export const PORT = parseInt(process.env.PORT) || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const APP_TOKEN = process.env.APP_TOKEN;

// Email
export const EMAIL_SENDER = process.env.EMAIL_SENDER;
export const EMAIL_HOST = process.env.EMAIL_HOST;
export const EMAIL_PORT = process.env.EMAIL_PORT;
export const EMAIL_USER = process.env.EMAIL_USER;
export const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

// Databases
export const REDIS_URL = process.env.REDIS_URL;
export const PGUSER = process.env.PGUSER;
export const PGPASSWORD = process.env.PGPASSWORD;
export const PGHOST = process.env.PGHOST;
export const PGPORT = parseInt(process.env.PGPORT);
export const PGDATABASE = process.env.PGDATABASE;

// HS
export const SECRET_HS = process.env.SECRET_HS;
const SHOPIFY_ALIAS_HS = process.env.SHOPIFY_ALIAS_HS;
const SHOPIFY_URL_HS = process.env.SHOPIFY_URL_HS;
const SHOPIFY_API_KEY_HS = process.env.SHOPIFY_API_KEY_HS;
const SHOPIFY_API_SECRET_KEY_HS = process.env.SHOPIFY_API_SECRET_KEY_HS;
const SKIO_API_KEY_HS = process.env.SKIO_API_KEY_HS;

// CS
export const SECRET_CS = process.env.SECRET_CS;
const SHOPIFY_ALIAS_CS = process.env.SHOPIFY_ALIAS_CS;
const SHOPIFY_URL_CS = process.env.SHOPIFY_URL_CS;
const SHOPIFY_API_KEY_CS = process.env.SHOPIFY_API_KEY_CS;
const SHOPIFY_API_SECRET_KEY_CS = process.env.SHOPIFY_API_SECRET_KEY_CS;
const SKIO_API_KEY_CS = process.env.SKIO_API_KEY_CS;

// RS
export const SECRET_RS = process.env.SECRET_RS;
const SHOPIFY_ALIAS_RS = process.env.SHOPIFY_ALIAS_RS;
const SHOPIFY_URL_RS = process.env.SHOPIFY_URL_RS;
const SHOPIFY_API_KEY_RS = process.env.SHOPIFY_API_KEY_RS;
const SHOPIFY_API_SECRET_KEY_RS = process.env.SHOPIFY_API_SECRET_KEY_RS;
const SKIO_API_KEY_RS = process.env.SKIO_API_KEY_RS;

// VS
export const SECRET_VS = process.env.SECRET_VS;
const SHOPIFY_ALIAS_VS = process.env.SHOPIFY_ALIAS_VS;
const SHOPIFY_URL_VS = process.env.SHOPIFY_URL_VS;
const SHOPIFY_API_KEY_VS = process.env.SHOPIFY_API_KEY_VS;
const SHOPIFY_API_SECRET_KEY_VS = process.env.SHOPIFY_API_SECRET_KEY_VS;
const SKIO_API_KEY_VS = process.env.SKIO_API_KEY_VS;

// DM
export const SECRET_DM = process.env.SECRET_DM;
const SHOPIFY_ALIAS_DM = process.env.SHOPIFY_ALIAS_DM;
const SHOPIFY_URL_DM = process.env.SHOPIFY_URL_DM;
const SHOPIFY_API_KEY_DM = process.env.SHOPIFY_API_KEY_DM;
const SHOPIFY_API_SECRET_KEY_DM = process.env.SHOPIFY_API_SECRET_KEY_DM;
const SKIO_API_KEY_DM = process.env.SKIO_API_KEY_DM;

// MY
export const SECRET_MY = process.env.SECRET_MY;
const SHOPIFY_ALIAS_MY = process.env.SHOPIFY_ALIAS_MY;
const SHOPIFY_URL_MY = process.env.SHOPIFY_URL_MY;
const SHOPIFY_API_KEY_MY = process.env.SHOPIFY_API_KEY_MY;
const SHOPIFY_API_SECRET_KEY_MY = process.env.SHOPIFY_API_SECRET_KEY_MY;
const SKIO_API_KEY_MY = process.env.SKIO_API_KEY_MY;

if (NODE_ENV === 'development') app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));

export const SHOPS_ORIGIN = {
    'https://hotshapers.com': {
        shop: SHOPIFY_URL_HS,
        shopAlias: SHOPIFY_ALIAS_HS
    },
    'https://copperslim.com': {
        shop: SHOPIFY_URL_CS,
        shopAlias: SHOPIFY_ALIAS_CS
    },
    'https://redusculpt.com': {
        shop: SHOPIFY_URL_RS,
        shopAlias: SHOPIFY_ALIAS_RS
    },
    'https://mywayhairdna.com': {
        shop: SHOPIFY_URL_MY,
        shopAlias: SHOPIFY_ALIAS_MY
    },
    'https://drmingtea.com': {
        shop: SHOPIFY_URL_DM,
        shopAlias: SHOPIFY_ALIAS_DM
    },
    'https://vibrosculpt.com': {
        shop: SHOPIFY_URL_VS,
        shopAlias: SHOPIFY_ALIAS_VS
    }
};

export default {
    SECRET_HS, SHOPIFY_API_KEY_HS, SHOPIFY_API_SECRET_KEY_HS, SKIO_API_KEY_HS,
    SECRET_CS, SHOPIFY_API_KEY_CS, SHOPIFY_API_SECRET_KEY_CS, SKIO_API_KEY_CS,
    SECRET_RS, SHOPIFY_API_KEY_RS, SHOPIFY_API_SECRET_KEY_RS, SKIO_API_KEY_RS,
    SECRET_VS, SHOPIFY_API_KEY_VS, SHOPIFY_API_SECRET_KEY_VS, SKIO_API_KEY_VS,
    SECRET_DM, SHOPIFY_API_KEY_DM, SHOPIFY_API_SECRET_KEY_DM, SKIO_API_KEY_DM,
    SECRET_MY, SHOPIFY_API_KEY_MY, SHOPIFY_API_SECRET_KEY_MY, SKIO_API_KEY_MY
}