import ConfigStores from '../services/config-stores.js';
import path from 'node:path';
import nodemailer from 'nodemailer';
import logger from '../../logger.js';
import hbs from 'nodemailer-express-handlebars';

class NodemailerMailerImp {

    constructor(shopAlias) {
        this.shopAlias = shopAlias
    }

    async init() {
        const STORES_INFORMATION = await ConfigStores.getStoresInformation();
        const EMAIL_HOST = STORES_INFORMATION[this.shopAlias].email_host;
        const EMAIL_USER = STORES_INFORMATION[this.shopAlias].email_user;
        const EMAIL_PASSWORD = STORES_INFORMATION[this.shopAlias].email_password;
        const EMAIL_PORT = STORES_INFORMATION[this.shopAlias].email_port;

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

    /**
     * Send an email using nodemailer
     * @param {string} sender - The sender of the email. It is usually the email_sender of shop store (view table in DB). You can get this field of ConfigStores.getShopsOrigin() global constant.
     * @param {string} email - The recipient of the email. Example: "WtEjw@example.com".
     * @param {string} template - The name of the file (without extension) who content the template of the email. The should be in the templates folder "src/templates/" and have the extension ".handlebars".
     * @param {string} subject - The subject of the email.
     * @param {object} context - The context to use for the email body. this object contains all the data used in the template of the email.
     * @param {array} attachments - An array of attachments to include in the email.
     * Every object in the array should have the following structure: **{ path: "path/to/file", filename: "file_name", cid: "cid" }**.
     * 
     * - **path**: Absolute path to the file. You can use a code like **"path.resolve(`public/imgs/CS/top_banner.png`)"**.
     * - **filename**: Name that will be displayed to the recipient. Unicode is allowed.
     * - **cid**: Content‑ID for embedding the attachment inline in the HTML body (&lt;img src="cid:my-logo"/&gt;).
     * 
     */
    async sendEmail(sender, email, template, subject, context, attachments = []) {
        const transporter = await this.init();
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