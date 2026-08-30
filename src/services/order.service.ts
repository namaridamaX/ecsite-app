import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { prisma } from '../db/prisma';
import { sqsClient } from '../db/sqs';
import { env } from '../config/env';
import { AppError, NotFoundError } from '../utils/AppError';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  memberId: string;
  items: CreateOrderItemInput[];
}

export const orderService = {
  async list(params: { page: number; pageSize: number; memberId?: string }) {
    const { page, pageSize, memberId } = params;
    const where = memberId ? { memberId } : {};
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  async getById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new NotFoundError('注文');
    return order;
  },

  /**
   * 注文作成(STEP4: 非同期化対応版)。
   *
   * 以前は在庫チェック・減算・注文作成を1つの同期トランザクションで行っていたが、
   * ここでは以下の流れに変更する:
   *   1. 注文を PENDING 状態でDBに即座に作成する(在庫チェック・減算はまだ行わない)
   *   2. SQSに「orderId」を含むメッセージを送信する
   *   3. クライアントには即座にレスポンスを返す
   *
   * 実際の在庫確認・減算・ステータス確定(PAID/CANCELLED)は、
   * SQSをトリガーに起動するLambda(ecsite-dev-lambda-order-processor)が非同期に行う。
   *
   * 単価はDBから取得した最新値をサーバー側で計算し、クライアント指定の金額は信用しない。
   */
  async create(input: CreateOrderInput) {
    if (input.items.length === 0) {
      throw new AppError('注文明細が空です', 400);
    }

    const member = await prisma.member.findUnique({ where: { id: input.memberId } });
    if (!member) throw new NotFoundError('会員');

    let totalCents = 0;
    const itemsData: { productId: string; quantity: number; priceCents: number }[] = [];

    for (const item of input.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        throw new NotFoundError(`商品(ID: ${item.productId})`);
      }
      // この時点では在庫の「参考チェック」のみ行い、実際の確定判定・減算はLambda側で行う。
      // (フロントに早期エラーを返すためのチェックであり、確定的な在庫保証ではない)
      if (product.stock < item.quantity) {
        throw new AppError(`在庫不足です: ${product.name}(残り${product.stock}点)`, 409);
      }

      totalCents += product.priceCents * item.quantity;
      itemsData.push({
        productId: product.id,
        quantity: item.quantity,
        priceCents: product.priceCents,
      });
    }

    const order = await prisma.order.create({
      data: {
        memberId: input.memberId,
        status: 'PENDING',
        totalCents,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    // SQSへメッセージを送信。ここで失敗した場合は注文自体をエラーとして扱う
    // (PENDINGのまま放置される事故を防ぐため、送信失敗を握りつぶさない)
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: env.ORDER_QUEUE_URL,
        MessageBody: JSON.stringify({ orderId: order.id }),
      })
    );

    return order;
  },

  async updateStatus(id: string, status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED') {
    await this.getById(id);
    return prisma.order.update({ where: { id }, data: { status } });
  },
};
