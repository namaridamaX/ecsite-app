import { z } from 'zod';

// 環境変数のスキーマ定義。
// 実務では Secrets Manager / Parameter Store から注入された値を
// ECSタスク定義の environment / secrets 経由でここに渡す想定。
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
  // STEP4: 注文確定処理を非同期化するためのSQSキューURL
  ORDER_QUEUE_URL: z.string().min(1, 'ORDER_QUEUE_URL is required'),
  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT: z.coerce.number().default(6379),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // 起動時に不正な環境変数を検知して即座に落とす(実務での定石)
    console.error('環境変数の検証に失敗しました:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
