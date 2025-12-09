import PostgresShopStoresRepository from "../repositories/postgresshopstores.repository.js";

/**
 * Execute a command to insert a new store into the database.
 * @param {string[]} args - The arguments to the command. The first argument is the name of the command and the second argument is the JSON string of the row to be inserted.
 * @returns {void}
 * @example
 * node index.js console create-shop-store "{\"url_domain\": \"https://copperslim.com\",\"alias\": \"XYZ\",\"color\": \"#CB8370\",\"email_host\": \"smtp-mail.outlook.com\",\"email_password\": \"123456789\",\"email_port\": \"587\",\"email_sender\": \"Copper Slim <customercare@copperslim.com>\",\"email_user\": \"customercare@copperslim.com\",\"klaviyo_token\": \"A12ABC\",\"klaviyo_private_api_key\": \"\",\"shopify_product_fake_variant_id\": \"gid://shopify/ProductVariant/51029007827128\",\"shopify_product_subscription_metafield_key\": \"product-subscription\",\"shopify_api_key\": \"1234567qwertydfgh234567fgh\",\"shopify_secret_key\": \"shpat_01234567890asdfghjkl;\",\"shopify_url\": \"9988ab-5.myshopify.com\",\"shopify_name\": \"Copper Slim\",\"shopify_contact_page_url\": \"https://copperslim.com/pages/contact\",\"skio_api_key\": \"13h3h391-1234-5678-a1s2-ef0bkalsd2e0\"}"
 */
export async function execute(args) {
    let row = null;
    try {
        row = JSON.parse(args[2]);
    } catch(jsonError) {
        console.error("Error parsing JSON:", jsonError);
        return;
    }

    const repository = new PostgresShopStoresRepository();
    console.log("Insertando:", row);
    const res = await repository.insertShopStore(row);
    console.log("Inserción correcta:", res);
}
