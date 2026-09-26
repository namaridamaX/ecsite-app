import { Router } from 'express';
import { cartController } from '../controllers/cart.controller';

export const cartRouter = Router();

cartRouter.get('/:memberId', cartController.list);
cartRouter.post('/:memberId', cartController.addItem);
cartRouter.delete('/:memberId/:productId', cartController.removeItem);