import { prisma } from '../db/prisma';
import { NotFoundError } from '../utils/AppError';

export interface CreateProductInput {
  name: string;
  description?: string;
  priceCents: number;
  stock: number;
  imageUrl?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  priceCents?: number;
  stock?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export const productService = {
  async list(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);
    return { items, total, page, pageSize };
  },

  async getById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('商品');
    return product;
  },

  async create(input: CreateProductInput) {
    return prisma.product.create({ data: input });
  },

  async update(id: string, input: UpdateProductInput) {
    await this.getById(id); // 存在確認(404を明示的に返すため)
    return prisma.product.update({ where: { id }, data: input });
  },

  async remove(id: string) {
    await this.getById(id);
    // 物理削除ではなく論理削除にする(注文履歴の整合性を保つ実務パターン)
    return prisma.product.update({ where: { id }, data: { isActive: false } });
  },
};
