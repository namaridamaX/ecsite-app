import { Router } from 'express';
import { memberController } from '../controllers/member.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const memberRouter = Router();

memberRouter.get('/members', asyncHandler(memberController.list));
memberRouter.get('/members/:id', asyncHandler(memberController.getById));
memberRouter.post('/members', asyncHandler(memberController.create));
memberRouter.post('/members/login', asyncHandler(memberController.login));
