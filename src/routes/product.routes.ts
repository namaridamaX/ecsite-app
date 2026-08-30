import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const productRouter = Router();

productRouter.get('/products', asyncHandler(productController.list));
productRouter.get('/products/:id', asyncHandler(productController.getById));
productRouter.post('/products', asyncHandler(productController.create));
productRouter.patch('/products/:id', asyncHandler(productController.update));
productRouter.delete('/products/:id', asyncHandler(productController.remove));
