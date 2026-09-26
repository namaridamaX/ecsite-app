import { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service';

export const cartController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await cartService.list(req.params.memberId);
      res.json(items);
    } catch (err) {
      next(err);
    }
  },

  async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, quantity } = req.body as { productId: string; quantity: number };
      const item = await cartService.addItem(req.params.memberId, productId, quantity);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },

  async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      await cartService.removeItem(req.params.memberId, req.params.productId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};