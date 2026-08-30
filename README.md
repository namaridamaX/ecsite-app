# ecsite-app

AWS実務運用ロードマップ STEP2 用の EC サイトバックエンドAPI。

## 技術スタック

- Node.js 20 / TypeScript
- Express (Webフレームワーク)
- Prisma (ORM) + PostgreSQL
- Zod (バリデーション)
- pino (構造化ロギング)
- bcryptjs (パスワードハッシュ化。STEP5でCognitoに置き換え予定)

## ディレクトリ構成

```
src/
  routes/       … ルーティング定義(URLとコントローラーの紐付けのみ)
  controllers/  … リクエスト/レスポンス処理、入力バリデーション
  services/     … ビジネスロジック、DBアクセス
  middlewares/  … エラーハンドリング等の横断的関心事
  config/       … 環境変数、ロガー設定
  db/           … Prismaクライアント
  utils/        … 共通ユーティリティ
prisma/
  schema.prisma … DBスキーマ定義(members / products / orders / order_items)
```

## ローカルでの動作確認

```bash
cp .env.example .env
docker compose up --build
```

起動後、以下で疎通確認:

```bash
curl http://localhost:3000/health
```

## 主なAPIエンドポイント

| メソッド | パス | 内容 |
|---|---|---|
| GET | /health | DB疎通込みのヘルスチェック(ALB用) |
| GET | /health/live | 生存確認のみ(軽量) |
| GET | /api/products | 商品一覧 |
| POST | /api/products | 商品登録 |
| GET | /api/products/:id | 商品詳細 |
| PATCH | /api/products/:id | 商品更新 |
| DELETE | /api/products/:id | 商品論理削除 |
| POST | /api/members | 会員登録 |
| POST | /api/members/login | 暫定ログイン(STEP5でCognitoに置き換え) |
| GET | /api/members/:id | 会員詳細 |
| POST | /api/orders | 注文作成(在庫引き当てをトランザクション処理) |
| GET | /api/orders/:id | 注文詳細 |
| PATCH | /api/orders/:id/status | 注文ステータス更新 |

## STEP2との対応

- RDS(PostgreSQL)への接続は `DATABASE_URL` 環境変数経由(本番ではSecrets Manager/Parameter Store経由でECSタスク定義に注入)
- `Dockerfile` はマルチステージビルドでECRにpushする本番イメージを想定
- `/health` はALBのターゲットグループヘルスチェックパスとして設定する
- 非rootユーザーでコンテナ実行、Graceful Shutdown対応済み(ECSのデプロイ時のリクエスト断を防止)

## 今後のSTEPでの変更予定

- STEP3: CI/CD(CodeBuild/CodeDeploy/CodePipeline)でこのDockerfileを自動ビルド
- STEP4: 注文作成処理をSQS経由の非同期処理に変更、キャッシュ層(ElastiCache)追加
- STEP5: 会員認証をCognitoに置き換え、決済連携を追加
