import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from '../db/dynamodb';
import { env } from '../config/env';

export interface CartItem {
  memberId: string;
  productId: string;
  quantity: number;
  addedAt: string;
}

export const cartService = {
  async list(memberId: string): Promise<CartItem[]> {
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: env.CART_TABLE_NAME,
        KeyConditionExpression: 'memberId = :memberId',
        ExpressionAttributeValues: { ':memberId': memberId },
      })
    );
    return (result.Items ?? []) as CartItem[];
  },

  async addItem(memberId: string, productId: string, quantity: number): Promise<CartItem> {
    const existing = await dynamoDb.send(
      new GetCommand({
        TableName: env.CART_TABLE_NAME,
        Key: { memberId, productId },
      })
    );
    const newQuantity = (existing.Item?.quantity ?? 0) + quantity;

    const item: CartItem = {
      memberId,
      productId,
      quantity: newQuantity,
      addedAt: new Date().toISOString(),
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: env.CART_TABLE_NAME,
        Item: item,
      })
    );

    return item;
  },

  async removeItem(memberId: string, productId: string): Promise<void> {
    await dynamoDb.send(
      new DeleteCommand({
        TableName: env.CART_TABLE_NAME,
        Key: { memberId, productId },
      })
    );
  },
};