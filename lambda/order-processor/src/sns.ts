import { SNSClient } from '@aws-sdk/client-sns';

// SQSクライアントと同様、Lambda実行ロールの権限で認証される
export const snsClient = new SNSClient({});