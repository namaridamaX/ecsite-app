import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

/**
 * 全ルートで共通のエラーハンドリング。
 * - AppError由来: 想定内のエラーとして4xxを返す
 * - ZodError: バリデーションエラーとして422を返す
 * - それ以外: 想定外のエラーとして500を返す(詳細はログのみに出し、レスポンスには漏らさない)
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        message: '入力値が不正です',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, '想定外のエラーが発生しました');
  res.status(500).json({ error: { message: 'サーバー内部でエラーが発生しました' } });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { message: `ルートが見つかりません: ${req.method} ${req.path}` } });
}
