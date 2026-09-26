import Redis from 'ioredis';
import { env } from '../config/env';

export const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  // 接続できない場合でもアプリ全体を落とさない設定
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});

redisClient.on('error', (err) => {
  console.error('Redis connection error', err);
});