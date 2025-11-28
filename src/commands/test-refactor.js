import KlaviyoImp from '../implements/klaviyo.imp.js';
import NodemailerMailerImp from '../implements/nodemailer.imp.js';
import ConfigStores from '../services/config-stores.js';
import ShopifyImp from '../implements/shopify.imp.js';
import path from 'node:path';
import fs from 'fs';

export async function execute(args) {
    const shopAlias = args[2];
    const email = args[3];

    // Obtenemos información de las tiendas
    const STORES_INFORMATION = await ConfigStores.getStoresInformation();
    const { emailSender, shopColor } = STORES_INFORMATION[shopAlias];
    //console.log(`Mostrando variables...`);
    //console.log(STORES_INFORMATION[shopAlias]);

    // Enviamos evento a Klaviyo
    console.log(`Ejecutando evento de Klaviyo...`);
    if(STORES_INFORMATION[shopAlias].klaviyo_token){
        try{
            const klv = new KlaviyoImp(shopAlias);
            await klv.sendEvent('test', 'test@test.com', { test: 'test' });
        } catch(err){
            console.log('-------------------------------------');
            console.log('ERROR ENVIANDO EVENTO A KLAVIYO');
            console.log('-------------------------------------');
            console.log(err);
            console.log('-------------------------------------');
        }
    } else {
        console.log('-------------------------------------');
        console.log('TOKEN DE KLAVIYO NO CONFIGURADO');
        console.log('-------------------------------------');
    }

    // Enviamos un email desde la tienda
    console.log(`Enviando email desde la tienda a ${email}...`);
    if(emailSender && emailSender) {

        const mailer = new NodemailerMailerImp(shopAlias);
        let pngFilePath = path.resolve(`public/imgs/${shopAlias}/shipping_address_updated.png`);
        fs.existsSync(pngFilePath) || (pngFilePath = path.resolve(`public/imgs/CS/shipping_address_updated.png`));

        try{
            await mailer.sendEmail(
                emailSender,
                email,
                'test-email',
                'Your test has been sent',
                {
                    color: shopColor,
                    message: 'This is a test',
                },
                [
                    {
                        filename: 'shipping_address_updated.png',
                        path: pngFilePath,
                        cid: 'shipping_address_updated'
                    }
                ]
            );
        } catch(err){
            console.log('-------------------------------------');
            console.log('ERROR ENVIANDO EMAIL');
            console.log('-------------------------------------');
            console.log('EMAIL_HOST= ',STORES_INFORMATION[shopAlias].email_host);
            console.log('EMAIL_USER=',STORES_INFORMATION[shopAlias].email_user);
            console.log('EMAIL_PASSWORD=',STORES_INFORMATION[shopAlias].email_password);
            console.log('EMAIL_PORT= ',STORES_INFORMATION[shopAlias].email_port);
            console.log(err);
            console.log('-------------------------------------');
        }
    } else {
        console.log('-------------------------------------');
        console.log('EMAIL NO CONFIURADO');
        console.log('-------------------------------------');
    }

    // Verificamos funcionamiento en Shopify
    console.log(`Ejecutando API de Shopify...`);
    if(STORES_INFORMATION[shopAlias].shopify_api_key && STORES_INFORMATION[shopAlias].shopify_secret_key && STORES_INFORMATION[shopAlias].shopify_url){
        try {
            const shopify = new ShopifyImp(shopAlias);
            const orders = await shopify.getFirst10Orders();
            console.log(`Orders: ${orders.length}`);
            if(orders.length > 0){
                console.log(`La última orden encontrada es....`);
                console.log(orders.reverse()[0]);
                console.log(`Orden 1: ${orders[0].node.name}`);
            }
        } catch(err){
            console.log('-------------------------------------');
            console.log('ERROR USANDO CONFIGURACIÓN DE SHOPIFY');
            console.log('-------------------------------------');
            console.log(err);
            console.log('-------------------------------------');

        }
    } else {
        console.log('-------------------------------------');
        console.log('CONFIGURACIÓN DE SHOPIFY INCOMPLETA');
        console.log('-------------------------------------');
    }
}

