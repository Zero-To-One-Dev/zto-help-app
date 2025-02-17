import pg from 'pg'
import { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } from '../app.js'

class PostgreSQLRepository {
    async init() {
        const client = new pg.Client({
            user: PGUSER,
            password: PGPASSWORD,
            host: PGHOST,
            port: parseInt(PGPORT),
            database: PGDATABASE,
            ssl: !(PGHOST === 'localhost')
        })
        await client.connect()
        return client;
    }

    async saveToken(shopAlias, email, token, data = {}) {
        const client = await this.init();
        const createdAt = new Date();
        const expireAt = new Date(createdAt.getTime() + (30 * 60 * 1000));
        const query = {
            name: 'save-token',
            text: 'INSERT INTO tokens (shop_alias, email, token, created_at, expire_at, metadata) VALUES($1, $2, $3, $4, $5, $6)',
            values: [shopAlias, email, token, createdAt, expireAt, JSON.stringify(data)],
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async validateTokenExists(shopAlias, email) {
        const client = await this.init();
        const query = {
            name: 'validate-token-exists',
            text: 'SELECT * FROM tokens WHERE shop_alias = $1 AND email = $2 LIMIT 1',
            values: [shopAlias, email],
        }
        const res = await client.query(query)
        await client.end()
        return res.rows[0];
    }

    async validateToken(shopAlias, email, token) {
        const client = await this.init();
        const query = {
            name: 'validate-token',
            text: 'SELECT * FROM tokens WHERE shop_alias = $1 AND email = $2 AND token = $3 LIMIT 1',
            values: [shopAlias, email, token],
        }
        const res = await client.query(query)
        await client.end()
        return res.rows[0];
    }

    async deleteToken(shopAlias, email) {
        const client = await this.init()
        const query = {
            name: 'delete-token',
            text: 'DELETE FROM tokens WHERE shop_alias = $1 AND email = $2',
            values: [shopAlias, email],
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async saveDraftOrder(shopAlias, draftOrder, subscription) {
        const client = await this.init()
        let todayDate = new Date(); todayDate.setHours(0, 0, 0, 0); // Se toma la fecha de hoy a las 12 PM
        const paymentDue = new Date(todayDate.getTime() + 864E5 * 3);
        const query = {
            name: 'save-draft-order',
            text: 'INSERT INTO draft_orders (shop_alias, draft_order, subscription) VALUES ($1, $2, $3, $4)',
            values: [shopAlias, draftOrder, subscription, paymentDue]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async getDraftOrder(shopAlias, subscription) {
        const client = await this.init()
        const query = {
            name: 'get-draft-order',
            text: 'SELECT * FROM draft_orders WHERE shop_alias = $1 AND subscription = $2 LIMIT 1',
            values: [shopAlias, subscription]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows[0];
    }

    async deleteDraftOrder(shopAlias, draftOrder) {
        const client = await this.init()
        const query = {
            name: 'delete-draft-order',
            text: 'DELETE FROM draft_orders WHERE shop_alias = $1 AND draft_order = $2 LIMIT 1',
            values: [shopAlias, draftOrder]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async getSubscriptionByDraftOrder(shopAlias, draftOrder) {
        const client = await this.init()
        const query = {
            name: 'get-subscription-by-draft-order',
            text: 'SELECT * FROM draft_orders WHERE shop_alias = $1 AND draft_order = $2 LIMIT 1',
            values: [shopAlias, draftOrder]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows
    }

    async updatePaymentDueDraftOrder(shopAlias, draftOrder, subscription) {
        const client = await this.init()
        let todayDate = new Date(); todayDate.setHours(0, 0, 0, 0); // Se toma la fecha de hoy a las 12 PM
        const paymentDue = new Date(todayDate.getTime() + 864E5 * 3);
        const query = {
            name: 'update-draft-order',
            text: `UPDATE FROM draft_orders
                SET paymentDue = $4
                WHERE shop_alias = $1
                AND draft_order = $2
                AND subscription = $3`,
            values: [shopAlias, draftOrder, subscription, paymentDue]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async saveHashApiToken(nameApp, hashApiToken, suffixApiToken) {
        const client = await this.init();
        const tenYearsDueDate = new Date(new Date().getTime() + 3650 * 24 * 60 * 60 * 1000);
        const query = {
            name: 'save-api-token',
            text: `
                    INSERT INTO app_tokens (name_app, hash_api_token, status, due_date, suffix_api_token)
                    VALUES($1, $2, $3, $4, $5)
                `,
            values: [nameApp, hashApiToken, 'ACTIVE', tenYearsDueDate, suffixApiToken],
        }
        const res = await client.query(query);
        await client.end();
    }

    async validateApiToken(hashedApiToken) {
        const client = await this.init()
        const query = {
            name: 'validate-api-token',
            text: `
                SELECT name_app FROM app_tokens WHERE hash_api_token = $1
            `,
            values: [hashedApiToken]
        }
        const res = await client.query(query)
        await client.end()
        return res;
    }
}

export default PostgreSQLRepository;