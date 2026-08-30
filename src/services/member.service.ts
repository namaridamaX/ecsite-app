import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { AppError, NotFoundError } from '../utils/AppError';

export interface CreateMemberInput {
  email: string;
  password: string;
  name: string;
}

const SALT_ROUNDS = 10;

// 注意: この会員登録/パスワード認証は STEP5 で Amazon Cognito に置き換える前提の
// 暫定実装。本番でのパスワード管理を自前で長期運用する想定ではない。
export const memberService = {
  async list(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const [items, total] = await Promise.all([
      prisma.member.findMany({
        select: { id: true, email: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.member.count(),
    ]);
    return { items, total, page, pageSize };
  },

  async getById(id: string) {
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!member) throw new NotFoundError('会員');
    return member;
  },

  async create(input: CreateMemberInput) {
    const existing = await prisma.member.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('このメールアドレスは既に登録されています', 409);
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const member = await prisma.member.create({
      data: { email: input.email, passwordHash, name: input.name },
    });
    // passwordHash はレスポンスに含めない
    const { passwordHash: _omit, ...safe } = member;
    return safe;
  },

  async verifyPassword(email: string, password: string) {
    const member = await prisma.member.findUnique({ where: { email } });
    if (!member) return null;
    const valid = await bcrypt.compare(password, member.passwordHash);
    if (!valid) return null;
    const { passwordHash: _omit, ...safe } = member;
    return safe;
  },
};
