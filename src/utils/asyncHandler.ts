import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * async関数内で発生した例外を自動的に next(err) に渡す。
 * Express 4系ではasync関数のthrowを自動キャッチしないため、実務でよく使われるパターン。
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
