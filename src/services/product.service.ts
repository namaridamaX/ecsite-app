import { prisma } from '../db/prisma';
import { redisClient } from '../db/redis';
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

const LIST_CACHE_TTL_SECONDS = 30; // 一覧は更新頻度に対して短めのTTL
const DETAIL_CACHE_TTL_SECONDS = 300; // 詳細は個別キー削除で即時反映するため長めでOK

function listCacheKey(page: number, pageSize: number) {
  return `products:list:${page}:${pageSize}`;
}

function detailCacheKey(id: string) {
  return `products:detail:${id}`;
}

// 一覧系のキャッシュは全ページ分まとめて無効化する(page/pageSizeの組み合わせが
// 多いため、個別キーではなくパターンで削除する)。学習用の小規模データなので
// KEYSコマンドを使うが、本番環境で件数が多い場合はSCANを使うのが望ましい。
async function invalidateListCache() {
  try {
    const keys = await redisClient.keys('products:list:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    console.error('Failed to invalidate product list cache', err);
  }
}

export const productService = {
  async list(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const cacheKey = listCacheKey(page, pageSize);

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis get failed (list)', err);
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);
    const result = { items, total, page, pageSize };

    try {
      await redisClient.set(cacheKey, JSON.stringify(result), 'EX', LIST_CACHE_TTL_SECONDS);
    } catch (err) {
      console.error('Redis set failed (list)', err);
    }

    return result;
  },

  async getById(id: string) {
    const cacheKey = detailCacheKey(id);

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis get failed (detail)', err);
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('商品');

    try {
      await redisClient.set(cacheKey, JSON.stringify(product), 'EX', DETAIL_CACHE_TTL_SECONDS);
    } catch (err) {
      console.error('Redis set failed (detail)', err);
    }

    return product;
  },

  async create(input: CreateProductInput) {
    const product = await prisma.product.create({ data: input });
    await invalidateListCache();
    return product;
  },

  async update(id: string, input: UpdateProductInput) {
    await this.getById(id); // 存在確認(404を明示的に返すため)
    const product = await prisma.product.update({ where: { id }, data: input });
    await Promise.all([
      redisClient.del(detailCacheKey(id)).catch((err) => console.error('Redis del failed', err)),
      invalidateListCache(),
    ]);
    return product;
  },

  async remove(id: string) {
    await this.getById(id);
    // 物理削除ではなく論理削除にする(注文履歴の整合性を保つ実務パターン)
    const product = await prisma.product.update({ where: { id }, data: { isActive: false } });
    await Promise.all([
      redisClient.del(detailCacheKey(id)).catch((err) => console.error('Redis del failed', err)),
      invalidateListCache(),
    ]);
    return product;
  },
};