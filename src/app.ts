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
import { requireAuth } from './middlewares/auth';
import { cartRouter } from './routes/cart.routes';
import { browsingHistoryRouter } from './routes/browsingHistory.routes';

export function createApp(): Application {
  const app = express();

  // 管理画面(public/)は同一オリジンから配信するため、CSPで自ホストのスクリプト/スタイルのみ許可する。
  // ログイン時にブラウザからCognitoのトークンエンドポイントを呼ぶため、connect-srcにCognitoドメインを追加している。
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'connect-src': ["'self'", env.COGNITO_DOMAIN],
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

  // 画面(public/app.js)がログイン先を知るための公開設定。秘密情報は含まない。
  app.get('/auth-config', (_req, res) => {
    res.json({ domain: env.COGNITO_DOMAIN, clientId: env.COGNITO_CLIENT_ID });
  });

  // APIは /api プレフィックスに統一
  const apiRouter = express.Router();
  apiRouter.use(productRouter);
  apiRouter.use(memberRouter);
  apiRouter.use(orderRouter);
  app.use('/api', apiRouter);

  // カートと閲覧履歴はログイン必須
  app.use('/api/cart', requireAuth, cartRouter);
  app.use('/api/browsing-history', requireAuth, browsingHistoryRouter);

  // 動作確認用の管理ダッシュボード(静的ファイル)。実行時のカレントは dist/ なので一つ上の public/ を指す。
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}