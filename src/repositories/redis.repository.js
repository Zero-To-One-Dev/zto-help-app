import { createClient } from 'redis';
import { REDIS_URL } from '../app.js';

class RedisRepository {
    async connection() {
        const redis = createClient({
            url: REDIS_URL
        });
        await redis.connect();
        return redis;
    }

    async saveToken(shopAlias, email, token, data = {}) {
        const createdAt = new Date().getTime();
        const expireAt = new Date(createdAt + 5 * 60 * 1000).getTime();
        const client = await this.connection();
        await client.hSet(`${shopAlias}_${email}`, 'token', token);
        await client.hSet(`${shopAlias}_${email}`, 'created_at', createdAt);
        await client.hSet(`${shopAlias}_${email}`, 'expire_at', expireAt);
        await client.hSet(`${shopAlias}_${email}`, 'data', data);
        await client.expire(`${shopAlias}_${email}`, 5 * 60); // La llave expira en 5 minutos
        await client.disconnect();
    }

    async validateTokenExists(shopAlias, email) {
        const client = await this.connection();
        const data = await client.hGetAll(`${shopAlias}_${email}`);
        await client.disconnect();
        if (data.token === token) return null;
        return Object.keys(data).length === 0 ? null : data;
    }

    async validateToken(shopAlias, email, token) {
        const client = await this.connection();
        const data = await client.hGetAll(`${shopAlias}_${email}`);
        await client.disconnect();
        if (data.token === token) return null;
        return Object.keys(data).length === 0 ? null : data;
    }

    async deleteToken(shopAlias, email) {
        const client = await this.connection();
        await client.del(`${shopAlias}_${email}`);
        await client.disconnect();
    }
}

export default RedisRepository;