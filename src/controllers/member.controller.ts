import { Request, Response } from 'express';
import { z } from 'zod';
import { memberService } from '../services/member.service';
import { AppError } from '../utils/AppError';

const createMemberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const memberController = {
  async list(req: Request, res: Response) {
    const { page, pageSize } = listQuerySchema.parse(req.query);
    const result = await memberService.list({ page, pageSize });
    res.status(200).json(result);
  },

  async getById(req: Request, res: Response) {
    const member = await memberService.getById(req.params.id);
    res.status(200).json(member);
  },

  async create(req: Request, res: Response) {
    const input = createMemberSchema.parse(req.body);
    const member = await memberService.create(input);
    res.status(201).json(member);
  },

  // 暫定ログイン(STEP5でCognitoトークン検証に置き換え)
  async login(req: Request, res: Response) {
    const { email, password } = loginSchema.parse(req.body);
    const member = await memberService.verifyPassword(email, password);
    if (!member) {
      throw new AppError('メールアドレスまたはパスワードが正しくありません', 401);
    }
    res.status(200).json(member);
  },
};
