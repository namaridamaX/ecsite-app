import { Router } from 'express';
import { prisma } from '../db/prisma';

export const healthRouter = Router();

// ALBのターゲットグループヘルスチェック、ECSのコンテナヘルスチェックの両方で利用する想定。
// DBへの疎通確認まで行う「深い」ヘルスチェックにしている(実務での定番構成)。
healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'ng', db: 'ng' });
  }
});

// 単純な生存確認用(DBを見ないぶん軽量)
healthRouter.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
