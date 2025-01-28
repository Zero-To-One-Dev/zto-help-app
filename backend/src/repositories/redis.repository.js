import logger from '../../logger.js';
import { createClient } from 'redis';

class RedisRepository {
    async connection() {
        const redis = createClient();
        await redis.connect();
        return redis;
    }

    async saveToken(email, token, subscription) {
        const createdAt = new Date().getTime();
        const expireAt = new Date(createdAt + 5 * 60 * 1000).getTime();
        const client = await this.connection();
        await client.hSet(email, 'token', token);
        await client.hSet(email, 'createdAt', createdAt);
        await client.hSet(email, 'expireAt', expireAt);
        await client.hSet(email, 'subscription', subscription);
        await client.expire(email, 5 * 60); // La llave expira en 5 minutos
        await client.disconnect();
    }

    async getTokenByEmail(email) {
        const client = await this.connection();
        const data = await client.hGetAll(email);
        await client.disconnect();
        return Object.keys(data).length === 0 ? null : data;
    }
}

export default RedisRepository;