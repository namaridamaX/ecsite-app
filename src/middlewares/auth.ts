import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Cognitoが発行したIDトークンの署名・有効期限・発行元を検証する。
// 公開鍵(JWKS)は初回の検証時にCognitoから取得され、以後はキャッシュされる。
const verifier = CognitoJwtVerifier.create({
  userPoolId: env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: env.COGNITO_CLIENT_ID,
});

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'ログインが必要です' } });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = await verifier.verify(token);
    res.locals.auth = payload;
    next();
  } catch (err: unknown) {
    logger.warn({ err }, 'JWTの検証に失敗しました');
    res.status(401).json({ error: { message: 'ログインの有効期限が切れました。再度ログインしてください' } });
  }
}