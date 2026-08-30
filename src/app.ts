import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { healthRouter } from './routes/health.routes';
import { productRouter } from './routes/product.routes';
import { memberRouter } from './routes/member.routes';
import { orderRouter } from './routes/order.routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

export function createApp(): Application {
  const app = express();

  // セキュリティ関連の標準HTTPヘッダーを設定(実務での必須対応)
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  // リクエスト単位の構造化ログ(CloudWatch Logs Insightsでのクエリを想定)
  app.use(pinoHttp({ logger }));

  // ヘルスチェックはprefixなしのルート直下(ALBのヘルスチェックパス設定を単純にするため)
  app.use(healthRouter);

  // APIは /api プレフィックスに統一
  const apiRouter = express.Router();
  apiRouter.use(productRouter);
  apiRouter.use(memberRouter);
  apiRouter.use(orderRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
