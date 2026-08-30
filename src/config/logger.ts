import pino from 'pino';
import { env } from './env';

// CloudWatch Logs / Logs Insights でクエリしやすいよう JSON構造化ログを出力する。
// ECSタスク定義の awslogs ドライバでそのまま拾える想定。
export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
