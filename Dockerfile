# ---- Stage 1: 依存インストール & ビルド ----
FROM node:20-bookworm-slim AS builder

# Prismaはビルド時にOpenSSLのバージョンを検出してエンジンバイナリを選択する。
# opensslコマンドが無いと検出に失敗し誤ったバイナリを組み込んでしまうため、
# 明示的にインストールしておく(実行環境と同じDebian bookworm = OpenSSL 3.x系)。
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# package.json / package-lock.json / prisma schema のみ先にコピーし
# レイヤーキャッシュを効かせる(ソース変更のたびにnpm installが走るのを防ぐ)
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# 本番用の依存だけに絞り込む(devDependenciesを除去してイメージを軽量化)
RUN npm prune --omit=dev

# ---- Stage 2: 実行用の最小イメージ ----
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production

# Prismaの実行エンジン(.so.node)がlibsslに動的リンクするため、実行環境側にも必要。
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 実務での定石: rootではなく非特権ユーザーでコンテナを実行する
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

WORKDIR /app

COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

USER appuser

EXPOSE 3000

# ECSのコンテナヘルスチェック(タスク定義側のhealthCheckと合わせて二重に設定してもよい)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health/live', (r) => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
