import { Request, Response } from 'express';
import { z } from 'zod';
import { orderService } from '../services/order.service';

const createOrderSchema = z.object({
  memberId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'SHIPPED', 'CANCELLED']),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  memberId: z.string().uuid().optional(),
});

export const orderController = {
  async list(req: Request, res: Response) {
    const { page, pageSize, memberId } = listQuerySchema.parse(req.query);
    const result = await orderService.list({ page, pageSize, memberId });
    res.status(200).json(result);
  },

  async getById(req: Request, res: Response) {
    const order = await orderService.getById(req.params.id);
    res.status(200).json(order);
  },

  async create(req: Request, res: Response) {
    const input = createOrderSchema.parse(req.body);
    const order = await orderService.create(input);
    // 202 Accepted: 注文は受け付けたが、確定処理(在庫減算等)は非同期で進行中であることを示す
    res.status(202).json(order);
  },

  async updateStatus(req: Request, res: Response) {
    const { status } = updateStatusSchema.parse(req.body);
    const order = await orderService.updateStatus(req.params.id, status);
    res.status(200).json(order);
  },
};
