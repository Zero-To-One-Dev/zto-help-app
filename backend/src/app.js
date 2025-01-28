import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import openapiSpecification from './middlewares/swagger.js';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SKIO_API_KEY = process.env.SKIO_API_KEY;
const EMAIL_SENDER = process.env.EMAIL_SENDER;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

// Use Swagger in development mode
if (NODE_ENV === 'development') { app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification)); }

export { app, PORT, EMAIL_SENDER, EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, SKIO_API_KEY };