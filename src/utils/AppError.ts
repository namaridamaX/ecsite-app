/**
 * アプリケーション内で意図的に投げるエラー。
 * HTTPステータスコードを持たせ、errorHandler で一元的にレスポンス整形する。
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} が見つかりません`, 404);
  }
}
