import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
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
   * 注文作成。
   * 実務ではここが最も事故の起きやすい箇所(在庫の二重引き当て、金額改ざん等)なので:
   * - 単価はDBから取得した最新値をサーバー側で計算(クライアント指定の金額を信用しない)
   * - 在庫チェックと減算、注文作成をひとつのトランザクションにまとめて整合性を保つ
   * - 手順書STEP4で SQS 経由の非同期処理に置き換える前提の同期実装
   */
  async create(input: CreateOrderInput) {
    if (input.items.length === 0) {
      throw new AppError('注文明細が空です', 400);
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const member = await tx.member.findUnique({ where: { id: input.memberId } });
      if (!member) throw new NotFoundError('会員');

      let totalCents = 0;
      const itemsData: { productId: string; quantity: number; priceCents: number }[] = [];

      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.isActive) {
          throw new NotFoundError(`商品(ID: ${item.productId})`);
        }
        if (product.stock < item.quantity) {
          throw new AppError(`在庫不足です: ${product.name}(残り${product.stock}点)`, 409);
        }

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: item.quantity } },
        });

        totalCents += product.priceCents * item.quantity;
        itemsData.push({
          productId: product.id,
          quantity: item.quantity,
          priceCents: product.priceCents,
        });
      }

      const order = await tx.order.create({
        data: {
          memberId: input.memberId,
          totalCents,
          items: { create: itemsData },
        },
        include: { items: true },
      });

      return order;
    });
  },

  async updateStatus(id: string, status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED') {
    await this.getById(id);
    return prisma.order.update({ where: { id }, data: { status } });
  },
};
