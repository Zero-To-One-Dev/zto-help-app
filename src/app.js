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
export const PGSSL = process.env.PGSSL === 'true';

// HS
export const SECRET_HS = process.env.SECRET_HS;
const SHOP_NAME_HS = process.env.SHOP_NAME_HS;
const CONTACT_PAGE_HS = process.env.CONTACT_PAGE_HS;
const SHOPIFY_ALIAS_HS = process.env.SHOPIFY_ALIAS_HS;
const SHOPIFY_URL_HS = process.env.SHOPIFY_URL_HS;
const SHOPIFY_API_KEY_HS = process.env.SHOPIFY_API_KEY_HS;
const SHOPIFY_API_SECRET_KEY_HS = process.env.SHOPIFY_API_SECRET_KEY_HS;
const SKIO_API_KEY_HS = process.env.SKIO_API_KEY_HS;
const PRODUCT_FAKE_VARIANT_ID_HS = process.env.PRODUCT_FAKE_VARIANT_ID_HS;

// CS
export const SECRET_CS = process.env.SECRET_CS;
const SHOP_NAME_CS = process.env.SHOP_NAME_CS;
const CONTACT_PAGE_CS = process.env.CONTACT_PAGE_CS;
const SHOPIFY_ALIAS_CS = process.env.SHOPIFY_ALIAS_CS;
const SHOPIFY_URL_CS = process.env.SHOPIFY_URL_CS;
const SHOPIFY_API_KEY_CS = process.env.SHOPIFY_API_KEY_CS;
const SHOPIFY_API_SECRET_KEY_CS = process.env.SHOPIFY_API_SECRET_KEY_CS;
const SKIO_API_KEY_CS = process.env.SKIO_API_KEY_CS;
const PRODUCT_FAKE_VARIANT_ID_CS = process.env.PRODUCT_FAKE_VARIANT_ID_CS;

// RS
export const SECRET_RS = process.env.SECRET_RS;
const SHOP_NAME_RS = process.env.SHOP_NAME_RS;
const CONTACT_PAGE_RS = process.env.CONTACT_PAGE_RS;
const SHOPIFY_ALIAS_RS = process.env.SHOPIFY_ALIAS_RS;
const SHOPIFY_URL_RS = process.env.SHOPIFY_URL_RS;
const SHOPIFY_API_KEY_RS = process.env.SHOPIFY_API_KEY_RS;
const SHOPIFY_API_SECRET_KEY_RS = process.env.SHOPIFY_API_SECRET_KEY_RS;
const SKIO_API_KEY_RS = process.env.SKIO_API_KEY_RS;
const PRODUCT_FAKE_VARIANT_ID_RS = process.env.PRODUCT_FAKE_VARIANT_ID_RS;

// VS
export const SECRET_VS = process.env.SECRET_VS;
const SHOP_NAME_VS = process.env.SHOP_NAME_VS;
const CONTACT_PAGE_VS = process.env.CONTACT_PAGE_VS;
const SHOPIFY_ALIAS_VS = process.env.SHOPIFY_ALIAS_VS;
const SHOPIFY_URL_VS = process.env.SHOPIFY_URL_VS;
const SHOPIFY_API_KEY_VS = process.env.SHOPIFY_API_KEY_VS;
const SHOPIFY_API_SECRET_KEY_VS = process.env.SHOPIFY_API_SECRET_KEY_VS;
const SKIO_API_KEY_VS = process.env.SKIO_API_KEY_VS;
const PRODUCT_FAKE_VARIANT_ID_VS = process.env.PRODUCT_FAKE_VARIANT_ID_VS;

// DM
export const SECRET_DM = process.env.SECRET_DM;
const SHOP_NAME_DM = process.env.SHOP_NAME_DM;
const CONTACT_PAGE_DM = process.env.CONTACT_PAGE_DM;
const SHOPIFY_ALIAS_DM = process.env.SHOPIFY_ALIAS_DM;
const SHOPIFY_URL_DM = process.env.SHOPIFY_URL_DM;
const SHOPIFY_API_KEY_DM = process.env.SHOPIFY_API_KEY_DM;
const SHOPIFY_API_SECRET_KEY_DM = process.env.SHOPIFY_API_SECRET_KEY_DM;
const SKIO_API_KEY_DM = process.env.SKIO_API_KEY_DM;
const PRODUCT_FAKE_VARIANT_ID_DM = process.env.PRODUCT_FAKE_VARIANT_ID_DM;

// MW
export const SECRET_MW = process.env.SECRET_MW;
const SHOP_NAME_MW = process.env.SHOP_NAME_MW;
const CONTACT_PAGE_MW = process.env.CONTACT_PAGE_MW;
const SHOPIFY_ALIAS_MW = process.env.SHOPIFY_ALIAS_MW;
const SHOPIFY_URL_MW = process.env.SHOPIFY_URL_MW;
const SHOPIFY_API_KEY_MW = process.env.SHOPIFY_API_KEY_MW;
const SHOPIFY_API_SECRET_KEY_MW = process.env.SHOPIFY_API_SECRET_KEY_MW;
const SKIO_API_KEY_MW = process.env.SKIO_API_KEY_MW;
const PRODUCT_FAKE_VARIANT_ID_MW = process.env.PRODUCT_FAKE_VARIANT_ID_MW;

if (NODE_ENV === 'development') app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));

export const SHOPS_ORIGIN = {
    'https://hotshapers.com': {
        shop: SHOPIFY_URL_HS,
        shopAlias: SHOPIFY_ALIAS_HS,
        shopName: SHOP_NAME_HS,
        shopColor: '#FFF533',
        contactPage: CONTACT_PAGE_HS,
        productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_HS
    },
    'https://copperslim.com': {
        shop: SHOPIFY_URL_CS,
        shopAlias: SHOPIFY_ALIAS_CS,
        shopName: SHOP_NAME_CS,
        shopColor: '#CB8370',
        contactPage: CONTACT_PAGE_CS,
        productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_CS
    },
    'https://redusculpt.com': {
        shop: SHOPIFY_URL_RS,
        shopAlias: SHOPIFY_ALIAS_RS,
        shopName: SHOP_NAME_RS,
        shopColor: '#FF605F',
        contactPage: CONTACT_PAGE_RS,
        productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_RS
    },
    'https://mywayhairdna.com': {
        shop: SHOPIFY_URL_MW,
        shopAlias: SHOPIFY_ALIAS_MW,
        shopName: SHOP_NAME_MW,
        shopColor: '#FF605F',
        contactPage: CONTACT_PAGE_MW,
        productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_MW
    },
    'https://drmingtea.com': {
        shop: SHOPIFY_URL_DM,
        shopAlias: SHOPIFY_ALIAS_DM,
        shopName: SHOP_NAME_DM,
        shopColor: '#FF605F',
        contactPage: CONTACT_PAGE_DM,
        productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_DM
    },
    'https://vibrosculpt.com': {
        shop: SHOPIFY_URL_VS,
        shopAlias: SHOPIFY_ALIAS_VS,
        shopName: SHOP_NAME_VS,
        shopColor: '#5B7793',
        contactPage: CONTACT_PAGE_VS,
        productFakeVariantId: PRODUCT_FAKE_VARIANT_ID_VS
    }
};

export default {
    SHOPIFY_API_KEY_HS, SHOPIFY_API_SECRET_KEY_HS, SKIO_API_KEY_HS,
    SHOPIFY_API_KEY_CS, SHOPIFY_API_SECRET_KEY_CS, SKIO_API_KEY_CS,
    SHOPIFY_API_KEY_RS, SHOPIFY_API_SECRET_KEY_RS, SKIO_API_KEY_RS,
    SHOPIFY_API_KEY_VS, SHOPIFY_API_SECRET_KEY_VS, SKIO_API_KEY_VS,
    SHOPIFY_API_KEY_DM, SHOPIFY_API_SECRET_KEY_DM, SKIO_API_KEY_DM,
    SHOPIFY_API_KEY_MW, SHOPIFY_API_SECRET_KEY_MW, SKIO_API_KEY_MW
}