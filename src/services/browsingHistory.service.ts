import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from '../db/dynamodb';
import { env } from '../config/env';

const HISTORY_TTL_SECONDS = 30 * 24 * 60 * 60; // 30日で自動削除(TTL)

export interface BrowsingHistoryItem {
  memberId: string;
  viewedAt: string;
  productId: string;
  expiresAt: number;
}

export const browsingHistoryService = {
  async record(memberId: string, productId: string): Promise<BrowsingHistoryItem> {
    const item: BrowsingHistoryItem = {
      memberId,
      viewedAt: new Date().toISOString(),
      productId,
      expiresAt: Math.floor(Date.now() / 1000) + HISTORY_TTL_SECONDS,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: env.BROWSING_HISTORY_TABLE_NAME,
        Item: item,
      })
    );

    return item;
  },

  async list(memberId: string, limit = 20): Promise<BrowsingHistoryItem[]> {
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: env.BROWSING_HISTORY_TABLE_NAME,
        KeyConditionExpression: 'memberId = :memberId',
        ExpressionAttributeValues: { ':memberId': memberId },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return (result.Items ?? []) as BrowsingHistoryItem[];
  },
};