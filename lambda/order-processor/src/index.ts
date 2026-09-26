import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { PublishCommand } from '@aws-sdk/client-sns';
import { getDatabaseUrl } from './secrets';
import { snsClient } from './sns';

let prisma: PrismaClient | undefined;

async function getPrismaClient(): Promise<PrismaClient> {
  if (!prisma) {
    const databaseUrl = await getDatabaseUrl();
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
  }
  return prisma;
}

type ProcessResult = {
  orderId: string;
  status: 'PAID' | 'CANCELLED' | 'SKIPPED';
};

async function processOrder(db: PrismaClient, orderId: string): Promise<ProcessResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status !== 'PENDING') {
      return { orderId, status: 'SKIPPED' };
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product || product.stock < item.quantity) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' },
        });
        return { orderId, status: 'CANCELLED' };
      }
    }

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });

    return { orderId, status: 'PAID' };
  });
}

async function publishOrderNotification(result: ProcessResult): Promise<void> {
  const topicArn = process.env.ORDER_NOTIFICATION_TOPIC_ARN;
  if (!topicArn) return;

  const subject = result.status === 'PAID' ? '注文が確定しました' : '注文がキャンセルされました';
  const message =
    result.status === 'PAID'
      ? `注文 ${result.orderId} の決済が完了し、在庫が確保されました。`
      : `注文 ${result.orderId} は在庫不足のためキャンセルされました。`;

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message,
    })
  );
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const db = await getPrismaClient();
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const { orderId } = JSON.parse(record.body) as { orderId: string };
      const result = await processOrder(db, orderId);

      if (result.status === 'PAID' || result.status === 'CANCELLED') {
        try {
          await publishOrderNotification(result);
        } catch (notifyErr) {
          console.error('SNS publish failed', notifyErr);
        }
      }
    } catch (err) {
      console.error('Order processing failed', record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};