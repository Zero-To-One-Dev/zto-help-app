import logger from '../logger.js';
import { createClient } from 'redis'

const redis = createClient();

// Redis Events
redis.on('connect', err => logger.info('Redis Client Connecting', err));
redis.on('ready', err => logger.info('Redis Client Connected', err));
redis.on('error', err => logger.error('Redis Client Error', err));
redis.on('end', err => logger.info('Redis Client Connection End', err));

await redis.connect();

export default redis;