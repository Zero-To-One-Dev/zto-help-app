import app from '../app.js';
import path from 'node:path';
import nodemailer from 'nodemailer';
import logger from '../../logger.js';
import hbs from 'nodemailer-express-handlebars';

class NodemailerMailerImp {

    constructor(shopAlias) {
        this.shopAlias = shopAlias
    }

    init() {
        const {
              [`EMAIL_HOST_${this.shopAlias}`]: EMAIL_HOST,
              [`EMAIL_USER_${this.shopAlias}`]: EMAIL_USER,
              [`EMAIL_PASSWORD_${this.shopAlias}`]: EMAIL_PASSWORD,
              [`EMAIL_PORT_${this.shopAlias}`]: EMAIL_PORT
            } = app;
    
        // Setup Nodemailer
        const transporter = nodemailer.createTransport({
            name: EMAIL_HOST,
            host: EMAIL_HOST,
            port: EMAIL_PORT,
            secure: EMAIL_PORT === 465, // true for port 465, false for other ports
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

    async sendEmail(sender, email, template, subject, context, attachments = []) {
        const transporter = this.init();
        await transporter.sendMail({
            from: sender,
            to: email,  
            subject,
            template,
            context,
            attachments
        });

        logger.info(`Mail sent to ${email}`);
    }
}

export default NodemailerMailerImp;