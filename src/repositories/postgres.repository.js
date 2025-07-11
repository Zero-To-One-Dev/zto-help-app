import pg from 'pg'
import { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE, PGSSL } from '../app.js'

class PostgreSQLRepository {
    async init() {
        const client = new pg.Client({
            user: PGUSER,
            password: PGPASSWORD,
            host: PGHOST,
            port: parseInt(PGPORT),
            database: PGDATABASE,
            ssl: PGSSL ? { rejectUnauthorized: false } : false
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

    async setSubscriptionToken(shopAlias, email, subscription) {
        const client = await this.init();
        const metadata = JSON.stringify({ subscription })
        const query = {
            name: 'set-subscription-token',
            text: 'UPDATE tokens SET metadata = $1 WHERE shop_alias = $2 AND email = $3',
            values: [metadata, shopAlias, email]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
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

    async saveDraftOrder(shopAlias, draftOrder, subscription, cancelSessionId) {
        const client = await this.init()
        let todayDate = new Date(); todayDate.setHours(0, 0, 0, 0); // Se toma la fecha de hoy a las 12 PM
        const paymentDue = new Date(todayDate.getTime() + 864E5 * 3);
        const query = {
            name: 'save-draft-order',
            text: 'INSERT INTO draft_orders (shop_alias, draft_order, subscription, payment_due, cancel_session_id) VALUES ($1, $2, $3, $4, $5)',
            values: [shopAlias, draftOrder, subscription, paymentDue, cancelSessionId]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async saveTicket(ticketId, ticketTags, status, retries) {
        const client = await this.init()
        const query = {
            name: 'save-ticket',
            text: 'INSERT INTO gorgias_tickets (ticket_id, tags, status, retries) VALUES ($1, $2, $3, $4) ON CONFLICT (ticket_id) DO NOTHING',
            values: [ticketId, ticketTags, status, retries]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async getTicketById(ticketId) {
        const client = await this.init()
        const query = {
            name: 'get-ticket-by-id',
            text: 'SELECT * FROM gorgias_tickets WHERE ticket_id = $1 LIMIT 1',
            values: [ticketId]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows.length ? res.rows[0] : null;
    }

    async getTicketByStatus(status) {
        const client = await this.init()
        const query = {
            name: 'get-ticket-by-id',
            text: 'SELECT * FROM gorgias_tickets WHERE status = $1 LIMIT 1',
            values: [status]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows.length ? res.rows[0] : null;
    }

    async updateTicketStatus(ticketId, status) {
        const client = await this.init()
        const query = {
            name: 'update-ticket-status',
            text: 'UPDATE gorgias_tickets SET status = $1 WHERE ticket_id = $2',
            values: [status, ticketId]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async updateTicketTags(ticketId, tags) {
        const client = await this.init()
        const query = {
          name: 'update-ticket-tags',
          text: 'UPDATE gorgias_tickets SET tags = $1 WHERE ticket_id = $2',
          values: [tags, ticketId]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0
      }

    async incrementRetries(ticketId) {
        const client = await this.init()
        const query = {
          name: 'increment-ticket-retries',
          text: 'UPDATE gorgias_tickets SET retries = retries + 1 WHERE ticket_id = $1',
          values: [ticketId]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async getTicketsByStatus(statuses = []) {
        const client = await this.init();
        const placeholders = statuses.map((_, i) => `$${i + 1}`).join(', ');
        const query = {
          name: 'get-tickets-by-status-list',
          text: `SELECT * FROM gorgias_tickets WHERE status IN (${placeholders})`,
          values: statuses
        };
        const res = await client.query(query);
        await client.end();
        return res.rows;
    }

    async getTicketsByStatusAndTags(statuses = [], tags = []) {
        const client = await this.init();

        // Generar placeholders para status
        const statusPlaceholders = statuses.map((_, i) => `$${i + 1}`).join(', ');

        // Generar condiciones para tags usando ILIKE
        const tagConditions = tags.map((_, i) => `tags ILIKE $${i + 1 + statuses.length}`).join(' OR ');

        const whereClause = `
            status IN (${statusPlaceholders})
            ${tags.length ? `AND (${tagConditions})` : ''}
        `;

        const query = {
            name: 'get-tickets-by-status-and-tags',
            text: `SELECT * FROM gorgias_tickets WHERE ${whereClause}`,
            values: [...statuses, ...tags.map(tag => `%${tag}%`)]
        };

        const res = await client.query(query);
        await client.end();
        return res.rows;
    }

    async saveRequest(ticketId, request) {
        const client = await this.init();

        const query = {
            name: 'chatgpt_requests',
            text: `INSERT INTO chatgpt_requests (ticket, request) VALUES( $1, $2);`,
            values: [ticketId, request]
        };

        const res = await client.query(query);
        await client.end();
        return res.rows;
    }

    async getErroredTicketsToRetry(maxRetries = 3) {
        const client = await this.init()
        const query = {
          name: 'get-errored-tickets-to-retry',
          text: 'SELECT * FROM gorgias_tickets WHERE status = $1 AND retries < $2',
          values: ['ERROR', maxRetries]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows;
    }

    async getLastDraftOrderBySubscription(shopAlias, subscription) {
        const client = await this.init()
        const query = {
            name: 'get-last-draft-order',
            text: 'SELECT * FROM draft_orders WHERE shop_alias = $1 AND subscription = $2 ORDER BY payment_due DESC LIMIT 1',
            values: [shopAlias, subscription]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows.length ? res.rows[0] : null;
    }

    async deleteDraftOrder(shopAlias, draftOrder) {
        const client = await this.init()
        const query = {
            name: 'delete-draft-order',
            text: 'DELETE FROM draft_orders WHERE shop_alias = $1 AND draft_order = $2',
            values: [shopAlias, draftOrder]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async getLastDraftOrderByDraftOrder(shopAlias, draftOrder) {
        const client = await this.init()
        const query = {
            name: 'get-subscription-by-draft-order',
            text: 'SELECT * FROM draft_orders WHERE shop_alias = $1 AND draft_order = $2 LIMIT 1',
            values: [shopAlias, draftOrder]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows.length ? res.rows[0] : null;
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

    async validateApiToken(hashedApiToken, nameApp) {
        const client = await this.init()
        const query = {
            name: 'validate-api-token',
            text: `
                SELECT name_app FROM app_tokens WHERE hash_api_token = $1 AND name_app = $2
            `,
            values: [hashedApiToken, nameApp]
        }
        const res = await client.query(query)
        await client.end()
        return res;
    }

    /**
     * Actualiza la fecha de expiración de un token cuando este es usado.
     * @param {*} shopAlias 
     * @param {*} email 
     * @param {*} token 
     */
    async updateTokenExpirationDate(shopAlias, email, token) {
        const client = await this.init()
        const expireAt = new Date(new Date().getTime() + (30 * 60 * 1000));
        const query = {
            name: 'update-expiration-date-token',
            text: `
                UPDATE tokens SET expire_at = $1 WHERE shop_alias = $2 AND email = $3 AND token = $4
            `,
            values: [expireAt, shopAlias, email, token]
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }

    async getExpiredDraftOrders(shopAlias) {
        const client = await this.init()
        const query = {
            name: 'get-expired-draft-orders',
            text: `
                SELECT * FROM draft_orders WHERE shop_alias = $1 AND status IN ('UNPROCESSED', 'ERROR', 'COMPLETED') AND payment_due < $2
            `,
            values: [shopAlias, new Date()]
        }
        const res = await client.query(query)
        await client.end()
        return res.rows
    }

    async setDraftOrderStatus(draftOrder, status, message = null, retries = null) {
        const client = await this.init();
        const query = {
            name: 'set-draft-order-status',
            text: `
                UPDATE draft_orders SET status = $1, message = $2, retries = $3 WHERE shop_alias = $4 AND draft_order = $5
            `,
            values: [status, message, retries, draftOrder.shop_alias, draftOrder.draft_order]
        }
        const res = await client.query(query)
        await client.end();
        return res.rowCount > 0;
    }
}

export default PostgreSQLRepository;