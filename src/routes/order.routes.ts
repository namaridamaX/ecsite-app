import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const orderRouter = Router();

orderRouter.get('/orders', asyncHandler(orderController.list));
orderRouter.get('/orders/:id', asyncHandler(orderController.getById));
orderRouter.post('/orders', asyncHandler(orderController.create));
orderRouter.patch('/orders/:id/status', asyncHandler(orderController.updateStatus));
