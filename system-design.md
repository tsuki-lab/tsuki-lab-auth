# システム構成概要

## 1. 技術スタック

| 項目         | 選定技術                      |
|--------------|-------------------------------|
| 認証方式     | パスワード＋JWT               |
| データベース | Cloudflare D1                |
| ORM          | Drizzle                      |
| セッション管理 | Cloudflare KV               |
| APIフレームワーク | Hono                      |
| 言語         | TypeScript                   |
| デプロイ環境 | Cloudflare Workers + Pages   |

## 2. 認証・セッション管理設計

### 2.1 認証フロー（パスワード＋JWT）
#### 1.	サインアップ
* エンドポイント: POST /auth/signup
* フロー:
  1.	メールアドレスの存在確認
  2.	パスワードのハッシュ化（bcrypt）
  3.	ユーザー情報をD1に保存
  4.	JWT発行（アクセストークン＋リフレッシュトークン）
  5.	Cloudflare KVにリフレッシュトークンを保存
#### 2.	ログイン
* エンドポイント: POST /auth/login
* フロー:
  1.	メール・パスワードの検証
  2.	JWT発行
  3.	Cloudflare KVにセッションを格納
#### 3.	トークンのリフレッシュ
* エンドポイント: POST /auth/refresh
* フロー:
  1. KVからリフレッシュトークンを取得
  2. 有効であれば新しいJWTを発行
  3. 既存のトークンを失効させる
#### 4.	ログアウト
* エンドポイント: POST /auth/logout
* フロー:
  1. Cloudflare KVのセッションを削除
  2. クライアント側でトークンを破棄

### 2.2 JWTトークン設計
* アクセストークン（短命、15分）
* ヘッダー: alg: HS256
* ペイロード:

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "iat": 1700000000,
  "exp": 1700000900,
  "role": "user"
}
```

* リフレッシュトークン（長命、7日）
* セキュアストレージ（Cloudflare KV）に保存
* クライアントには保存させない

## 3. APIエンドポイント設計

| HTTP | メソッド | エンドポイント | 説明 | 認証要件 |
| --- | --- | --- | --- | --- |
| POST | /auth/signup | ユーザー登録 | なし |
| POST | /auth/login | ログイン処理 | なし |
| POST | /auth/logout | ログアウト | アクセストークン必須 |
| POST | /auth/refresh | トークンの更新 | リフレッシュトークン |
| GET | /users/me | 自分のユーザー情報を取得 | アクセストークン必須 |

## 4. データベース設計（Cloudflare D1）

テーブル: users（ユーザー情報）

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

テーブル: sessions（セッション管理）

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

## 5. Drizzle ORM 設計

モデル定義（TypeScript）

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey().autoincrement(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});
```

## 6. セッション管理設計（Cloudflare KV）
* キーの構造: session:<user_id>:<token_id>
* 保存データフォーマット:

```json
{
  "userId": "123",
  "refreshToken": "abcdef123456",
  "expiresAt": "2025-02-01T00:00:00Z"
}
```

* 有効期限管理:
* アクセストークンの短命化（15分）
* リフレッシュトークンは7日間（ローテーション時に再保存）

## 7. セキュリティ対策
1.	パスワードのハッシュ化
  * bcrypt を使用（コストファクター: 12）
2.	トークンのセキュア保存
  * アクセストークンをHTTPOnlyクッキーで保存
  * リフレッシュトークンはCloudflare KVに保存
3.	レートリミット
  * ログインエンドポイントに対してIP制限（Cloudflare Rate Limiting）
4.	CORS設定
  * セキュアオリジンのみ許可

## 8. CI/CD戦略
1. GitHub Actions
   * Lint/テストの自動化（ESLint + Vitest）
   * D1スキーマの自動マイグレーション
   * Cloudflare Workersへの自動デプロイ
2. 監視・ロギング
   * Cloudflare Logsを用いてリクエスト監視

## 9. 開発の次のステップ
1. Honoを使ったAPIプロトタイプの作成
2. Drizzle ORMのセットアップと基本CRUD実装
3. JWTの発行と検証ロジックの実装
4. Cloudflare KVによるセッション管理機能の実装
5. フロントエンド連携（SPAとの統合）

この構成で進めていきます。質問や追加要件があればお知らせください。