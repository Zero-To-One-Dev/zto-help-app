import { transporter } from '../app.js'
import logger from '../../logger.js';

async function sendMail(email, template, context) {
    await transporter.sendMail({
      from: '"Juan Diego Cobo Cabal" <juandiego14012003@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Verification Code", // Subject line
      template,
      context
    });
  
    logger.info(`Mail sent to ${email}`);
  }


export { sendMail }