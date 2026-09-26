import { Router } from 'express';
import { browsingHistoryController } from '../controllers/browsingHistory.controller';

export const browsingHistoryRouter = Router();

browsingHistoryRouter.post('/:memberId', browsingHistoryController.record);
browsingHistoryRouter.get('/:memberId', browsingHistoryController.list);