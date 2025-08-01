import PostgresRepository from "./postgres.repository.js";
class PostgresRequestRepository extends PostgresRepository {

    constructor() {
        super()
    }


    async saveRequest(tag, headers, body, responseStatus, responseBody) {
        const client = await this.init();
        const query = {
            name: 'save-request',
            text: 'INSERT INTO webhook_requests (tag, headers, body, response_status, response_body) VALUES ($1, $2, $3, $4, $5)',
            values: [tag, headers, body, responseStatus, responseBody],
        }
        const res = await client.query(query)
        await client.end()
        return res.rowCount > 0;
    }
}

export default PostgresRequestRepository;