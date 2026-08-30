import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { PrismaClient, Prisma } from '@prisma/client';
import { getDatabaseUrl } from './secrets';

interface OrderMessage {
  orderId: string;
}

// Lambda実行環境間で使い回すため、ハンドラの外でシングルトンとして保持する。
// ただしDATABASE_URLは非同期取得のため、初回呼び出し時に遅延生成する。
let prisma: PrismaClient | undefined;

async function getPrismaClient(): Promise<PrismaClient> {
  if (prisma) {
    return prisma;
  }
  const databaseUrl = await getDatabaseUrl();
  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  return prisma;
}

/**
 * SQS経由で受け取った「注文確定」メッセージを処理する。
 * 注文APIは事前にステータス PENDING で注文レコードを作成済みという前提で、
 * ここでは実際の在庫確認・減算・ステータス更新のみを行う。
 *
 * バッチ処理に対応: 一部のメッセージだけ失敗した場合、失敗したメッセージのみを
 * SQSに戻す(batchItemFailures)ことで、成功済みメッセージの再処理を防ぐ。
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];
  const db = await getPrismaClient();

  for (const record of event.Records) {
    try {
      const message: OrderMessage = JSON.parse(record.body);
      await processOrder(db, message.orderId);
    } catch (err) {
      console.error(`注文処理に失敗しました (messageId=${record.messageId}):`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

async function processOrder(db: PrismaClient, orderId: string): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      // 注文自体が見つからない場合は再試行しても解決しないため、エラーを投げてDLQに送る
      throw new Error(`注文が見つかりません: ${orderId}`);
    }

    if (order.status !== 'PENDING') {
      // すでに処理済み(重複メッセージ配信への対策。SQSは "at least once" 配信のため)
      console.log(`注文 ${orderId} はすでに ${order.status} のため処理をスキップします`);
      return;
    }

    // 在庫確認・減算
    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product || product.stock < item.quantity) {
        // 在庫不足の場合は注文をCANCELLEDにして処理を終える(再試行しても解消しないため)
        await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
        console.warn(`在庫不足のため注文 ${orderId} をキャンセルしました`);
        return;
      }
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 注文を確定(PAID)状態に更新
    await tx.order.update({ where: { id: orderId }, data: { status: 'PAID' } });
    console.log(`注文 ${orderId} の処理が完了しました`);
  });
}
