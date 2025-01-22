import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import express from 'express';
import redis from './redisSetup.js';
import nodemailer from 'nodemailer';
import swaggerUi from 'swagger-ui-express';
import hbs from 'nodemailer-express-handlebars';
import openapiSpecification from './swaggerSetup.js';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const EMAIL_HOST = process.env.EMAIL_HOST
const EMAIL_PORT = process.env.EMAIL_PORT
const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD

// Use Swagger in development mode
if ((NODE_ENV) === 'development') { app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification)); }

// Setup Nodemailer
const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: true, // true for port 465, false for other ports
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
});

// Handlebars config
transporter.use('compile', hbs({
    viewEngine: { layoutsDir: './src/templates/' },
    viewPath: path.resolve('./src/templates/')
}));

export { app, PORT, redis, transporter }