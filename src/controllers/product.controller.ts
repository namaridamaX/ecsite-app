import { Request, Response } from 'express';
import { z } from 'zod';
import { productService } from '../services/product.service';

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
  imageUrl: z.string().url().optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const productController = {
  async list(req: Request, res: Response) {
    const { page, pageSize } = listQuerySchema.parse(req.query);
    const result = await productService.list({ page, pageSize });
    res.status(200).json(result);
  },

  async getById(req: Request, res: Response) {
    const product = await productService.getById(req.params.id);
    res.status(200).json(product);
  },

  async create(req: Request, res: Response) {
    const input = createProductSchema.parse(req.body);
    const product = await productService.create(input);
    res.status(201).json(product);
  },

  async update(req: Request, res: Response) {
    const input = updateProductSchema.parse(req.body);
    const product = await productService.update(req.params.id, input);
    res.status(200).json(product);
  },

  async remove(req: Request, res: Response) {
    await productService.remove(req.params.id);
    res.status(204).send();
  },
};
