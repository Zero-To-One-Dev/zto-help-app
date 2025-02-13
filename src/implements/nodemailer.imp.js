import path from 'node:path';
import nodemailer from 'nodemailer';
import logger from '../../logger.js';
import hbs from 'nodemailer-express-handlebars';
import { EMAIL_SENDER, EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD } from '../app.js'

class NodemailerMailerImp {

    constructor() { }

    init() {
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
        return transporter;
    }

    async sendEmail(email, template, subject, context) {
        const transporter = this.init();
        await transporter.sendMail({
            from: EMAIL_SENDER,
            to: email,  
            subject,
            template,
            context
        });

        logger.info(`Mail sent to ${email}`);
    }
}

export default NodemailerMailerImp;