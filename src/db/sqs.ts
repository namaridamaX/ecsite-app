import { SQSClient } from '@aws-sdk/client-sqs';

// ECSタスクにはIAMロール(タスクロール)経由で権限が付与される想定のため、
// アクセスキー等の明示的な認証情報は不要(SDKのデフォルト認証情報チェーンに任せる)。
export const sqsClient = new SQSClient({});
