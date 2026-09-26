import express, { Application } from 'express';
import path from 'path';
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
import { cartRouter } from './routes/cart.routes';
import { browsingHistoryRouter } from './routes/browsingHistory.routes';

export function createApp(): Application {
  const app = express();

  // 管理画面(public/)は同一オリジンから配信するため、CSPで自ホストのスクリプト/スタイルのみ許可する
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
        },
      },
    })
  );
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

  app.use('/api/cart', cartRouter);
  app.use('/api/browsing-history', browsingHistoryRouter);

  // 動作確認用の管理ダッシュボード(静的ファイル)。実行時のカレントは dist/ なので一つ上の public/ を指す。
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
