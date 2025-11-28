import PostgresRepository from "./postgres.repository.js";
import Encrypter from "../services/encrypter.js";

class PostgresShopStoresRepository extends PostgresRepository {

    static tableName = 'stores';
    static cacheRawDataAllRows = null;
    static encrypter = null;

    constructor() {
        super();
    }

    getEncrypter() {
        if(!this.encrypter) {
            this.encrypter = new Encrypter();
        }
        return this.encrypter;
    }

    async getAllWrappedByAlias() {
        return await super.init(PostgresShopStoresRepository.tableName);
    }

    async getAll() {
        if(PostgresShopStoresRepository.cacheRawDataAllRows) {
            return PostgresShopStoresRepository.cacheRawDataAllRows;
        }

        const client = await this.init()
        const query = {
            name: 'get-all-shops-stores',
            text: `SELECT * FROM ${PostgresShopStoresRepository.tableName} WHERE true`,
            values: []
        }
        const res = await client.query(query);
        await client.end();

        const encrypter = this.getEncrypter();
        res.rows.forEach(row => {
            row.email_password = row.email_password ? encrypter.decryptData(row.email_password) : "";
            row.klaviyo_token = row.klaviyo_token ? encrypter.decryptData(row.klaviyo_token) : "";
            row.klaviyo_private_api_key = row.klaviyo_private_api_key ? encrypter.decryptData(row.klaviyo_private_api_key) : "";
            row.shopify_api_key = row.shopify_api_key ? encrypter.decryptData(row.shopify_api_key) : "";
            row.shopify_secret_key = row.shopify_secret_key ? encrypter.decryptData(row.shopify_secret_key) : "";
            row.skio_api_key = row.skio_api_key ? encrypter.decryptData(row.skio_api_key) : "";
        });

        PostgresShopStoresRepository.cacheRawDataAllRows = res.rows;

        return PostgresShopStoresRepository.cacheRawDataAllRows;
    }

    async getAllWithKey(keyName = 'url_domain') {
        const keyNames = ['url_domain', 'alias', 'color'];
        // Validamos el keyname
        if(keyNames.indexOf(keyName) === -1) {
            throw new Error(`Invalid keyName: ${keyName} is not valid. Valid keyNames: ${keyNames.join(', ')}`);
        }
        // Obtenemos los datos
        const rawData = await this.getAll();
        
        if(!rawData || rawData.length === 0) {
            return {};
        }

        const data = {};
        rawData.forEach(row => {
                data[row[keyName]] = {
                    shop: row.shopify_url,
                    shopAlias: row.alias,
                    shopName: row.shopify_name,
                    shopColor: row.color,
                    contactPage: row.shopify_contact_page_url,
                    productFakeVariantId: row.shopify_product_fake_variant_id,
                    emailSender: row.email_sender,
                    attentiveKey: undefined,
                    productSubscriptionMetafieldKey: row.shopify_product_subscription_metafield_key,
                    ...row
                }
            });
        return data;
    }

    async insertShopStore({
        url_domain,
        alias,
        color,
        email_host,
        email_password,
        email_port,
        email_sender,
        email_user,
        klaviyo_token,
        klaviyo_private_api_key,
        shopify_product_fake_variant_id,
        shopify_product_subscription_metafield_key,
        shopify_api_key,
        shopify_secret_key,
        shopify_url,
        shopify_name,
        shopify_contact_page_url,
        skio_api_key
    }) {
        // Validamos los campos obligatorios
        if(!url_domain || !alias || !color) {
            throw new Error('Falta enviar campos obligatorios (url_domain, alias o color)');
        }
        const encrypter = this.getEncrypter();
        const values = [
            url_domain,
            alias,
            color,
            email_host ?? "",
            email_password ? encrypter.encryptData(email_password) : "",
            email_port ?? "",
            email_sender ?? "",
            email_user ?? "",
            klaviyo_token ? encrypter.encryptData(klaviyo_token) : "",
            klaviyo_private_api_key ? encrypter.encryptData(klaviyo_private_api_key) : "",
            shopify_product_fake_variant_id ?? "",
            shopify_product_subscription_metafield_key ?? "",
            shopify_api_key ? encrypter.encryptData(shopify_api_key) : "",
            shopify_secret_key ? encrypter.encryptData(shopify_secret_key) : "",
            shopify_url ?? "",
            shopify_name ?? "",
            shopify_contact_page_url ?? "",
            skio_api_key ? encrypter.encryptData(skio_api_key) : "",
        ];
        const client = await this.init();
        const query = {
            name: 'save-shop-store',
            text: `
                INSERT INTO ${PostgresShopStoresRepository.tableName} (
                    url_domain,
                    alias,
                    color,
                    email_host,
                    email_password,
                    email_port,
                    email_sender,
                    email_user,
                    klaviyo_token,
                    klaviyo_private_api_key,
                    shopify_product_fake_variant_id,
                    shopify_product_subscription_metafield_key,
                    shopify_api_key,
                    shopify_secret_key,
                    shopify_url,
                    shopify_name,
                    shopify_contact_page_url,
                    skio_api_key
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                )
            `,
            values,
        }

        const res = await client.query(query);
        await client.end();
        PostgresShopStoresRepository.cacheRawDataAllRows = null;
        return res.rowCount > 0;
    }

    async updateField(alias, fieldName, value) {
        const client = await this.init();
        const encrypter = this.getEncrypter();
        const encryptableFields = ['email_password', 'klaviyo_token', 'klaviyo_private_api_key', 'shopify_api_key', 'shopify_secret_key', 'skio_api_key'];
        console.log('Encriptando valor:', value);
        if(encryptableFields.indexOf(fieldName) !== -1) {
            value = value ? encrypter.encryptData(value) : "";
        }

        const query = {
            name: 'update-field-on-stores',
            text: `
                UPDATE ${PostgresShopStoresRepository.tableName} SET ${fieldName} = $1, updated_at = now() WHERE alias = $2
            `,
            values: [value, alias]
        }
        const res = await client.query(query);
        await client.end();
        PostgresShopStoresRepository.cacheRawDataAllRows = null;
        return res.rowCount > 0;
    }
}

export default PostgresShopStoresRepository;