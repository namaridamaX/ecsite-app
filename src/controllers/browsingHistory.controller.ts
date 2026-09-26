import { Request, Response, NextFunction } from 'express';
import { browsingHistoryService } from '../services/browsingHistory.service';

export const browsingHistoryController = {
  async record(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.body as { productId: string };
      const item = await browsingHistoryService.record(req.params.memberId, productId);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await browsingHistoryService.list(req.params.memberId);
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
};