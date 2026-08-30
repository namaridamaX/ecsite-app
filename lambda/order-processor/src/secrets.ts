import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

// Lambdaの実行環境(コンテナ)は複数回のinvokeで再利用されるため、
// 一度取得したシークレットをモジュールスコープでキャッシュしておく。
// 毎回Secrets Manager APIを呼ぶとレイテンシとコストが無駄にかかるため。
let cachedDatabaseUrl: string | undefined;

export async function getDatabaseUrl(): Promise<string> {
  if (cachedDatabaseUrl) {
    return cachedDatabaseUrl;
  }

  const secretArn = process.env.DATABASE_URL_SECRET_ARN;
  if (!secretArn) {
    throw new Error('環境変数 DATABASE_URL_SECRET_ARN が設定されていません');
  }

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  if (!response.SecretString) {
    throw new Error('Secrets Managerからシークレット文字列を取得できませんでした');
  }

  cachedDatabaseUrl = response.SecretString;
  return cachedDatabaseUrl;
}
