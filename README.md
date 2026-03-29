# 🎵 AnnictHub

あなたが見たアニメの主題歌で Spotify プレイリストを自動作成する Web アプリケーション

## ✨ 機能

- **Annict 連携**: Annict アカウントでログインし、視聴履歴を取得
- **自動主題歌検索**: AnimeThemes.moe と MyAnimeList から主題歌情報を自動取得
- **Spotify マッチング**: 高精度な楽曲マッチングアルゴリズムで Spotify 上の楽曲を検索
- **プレイリスト作成**: ワンクリックで Spotify にプレイリストを作成
- **カワイイデザイン**: ソフトパステルカラーと Framer Motion によるアニメーション

## 🚀 セットアップ

### 1. 必要なもの

- Node.js 18.x 以上
- npm または yarn
- Supabase プロジェクト
- Annict API アクセストークン
- Spotify Developer アカウント

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして、各値を設定してください:

```bash
cp .env.example .env
```

#### Annict OAuth 設定

1. [Annict OAuth Applications](https://annict.com/oauth/applications) にアクセス
2. 新しいアプリケーションを作成
3. **Redirect URI**: `http://localhost:3000/callback/annict` (開発環境)
4. Client ID と Client Secret を `.env` に設定

#### Spotify OAuth 設定

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) にアクセス
2. 新しいアプリケーションを作成
3. **Redirect URI**: `http://localhost:3000/callback/spotify` を追加
4. Client ID と Client Secret を `.env` に設定

#### Supabase 設定

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. Project URL と Anon Key を `.env` に設定
3. データベースマイグレーションを実行 (後述)

### 3. 依存関係のインストール

```bash
npm install
```

### 4. データベースマイグレーション

Supabase ダッシュボードの SQL Editor で、以下のファイルを実行:

```sql
-- supabase/migrations/001_initial_schema.sql の内容をコピーして実行
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 📁 プロジェクト構造

```
new-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 認証関連ページ
│   │   ├── callback/             # OAuth コールバック
│   │   └── login/                # ログインページ
│   ├── api/                      # API Routes
│   │   ├── annict/               # Annict API
│   │   ├── auth/                 # 認証 API
│   │   ├── spotify/              # Spotify API
│   │   └── themes/               # 主題歌 API
│   ├── dashboard/                # ダッシュボード
│   ├── playlist/                 # プレイリスト作成
│   └── page.tsx                  # ランディングページ
├── components/                   # React コンポーネント
│   ├── anime/                    # アニメ関連コンポーネント
│   ├── layout/                   # レイアウトコンポーネント
│   ├── playlist/                 # プレイリスト関連
│   └── shared/                   # 共有コンポーネント
├── lib/                          # ライブラリとユーティリティ
│   ├── api/                      # API クライアント
│   ├── auth/                     # 認証ロジック
│   ├── db/                       # データベース
│   ├── matching/                 # マッチングアルゴリズム
│   └── utils/                    # ユーティリティ
├── types/                        # TypeScript 型定義
└── supabase/                     # Supabase マイグレーション
```

## 🎨 技術スタック

### フロントエンド

- **Next.js 15**: React フレームワーク (App Router)
- **TypeScript**: 型安全な開発
- **Tailwind CSS 4.0**: スタイリング (カスタムテーマ)
- **Framer Motion**: アニメーション
- **React Query**: データフェッチング

### バックエンド

- **Next.js API Routes**: サーバーレス API
- **Supabase**: PostgreSQL データベース
- **Zod**: バリデーション

### 外部 API

- **Annict GraphQL API**: アニメ視聴履歴
- **AnimeThemes.moe API**: 主題歌情報
- **MyAnimeList (Jikan) API**: アニメ画像フォールバック
- **Spotify Web API**: 楽曲検索とプレイリスト作成

## 🔧 主要機能の実装

### 認証フロー

1. **Annict OAuth**: ユーザーログインとアニメ視聴履歴へのアクセス
2. **Spotify OAuth**: プレイリスト作成権限
3. **セッション管理**: Cookie ベースのセッション (HTTP-only)

### マッチングロジック

#### アニメ → 主題歌

1. **MAL ID マッチング**: Annict の MAL ID を使用して AnimeThemes.moe で検索
2. **タイトル + 年度マッチング**: MAL ID がない場合、タイトルと年度で検索
3. **ファジーマッチング**: 類似度スコアリングによる曖昧検索
4. **Jikan フォールバック**: AnimeThemes.moe で見つからない場合、MyAnimeList から主題歌情報を取得

#### 主題歌 → Spotify トラック

多要素スコアリングアルゴリズム:
- **タイトルマッチ (50%)**: Levenshtein 距離による類似度
- **アーティストマッチ (30%)**: アーティスト名の一致度
- **人気度 (10%)**: Spotify の人気度スコア
- **年度マッチ (10%)**: リリース年の一致

### キャッシュ戦略

- **Supabase キャッシュ**: アニメ情報、主題歌情報、マッチング結果を永続化
- **再取得制御**: `forceRefresh` パラメータでキャッシュをバイパス
- **有効期限管理**: `synced_at` タイムスタンプで鮮度を管理

### レート制限

- **Jikan API**: 3 req/sec, 60 req/min
- **AnimeThemes.moe API**: 60 req/min
- **Spotify API**: 標準レート制限に準拠
- **実装**: Token Bucket, Sliding Window, Queue ベース

## 📝 開発メモ

### 画像の扱い

- Annict から画像 URL を優先的に取得
- 画像がない場合、Jikan API (MyAnimeList) から取得
- フォールバックとして `/placeholder-anime.png` を使用

### エラーハンドリング

- すべての API 呼び出しで try-catch を使用
- エラー時のユーザーフレンドリーなメッセージ
- リトライロジック: Exponential backoff + Circuit breaker

### パフォーマンス

- バッチ処理による並列リクエスト
- 無限スクロールによる遅延ロード
- Next.js のサーバーコンポーネントで初期レンダリングを最適化

## 🎯 今後の機能追加アイデア

- [ ] プレイリストの編集・削除機能
- [ ] 手動での楽曲選択・置換機能
- [ ] お気に入りプレイリストの保存
- [ ] プレイリストのシェア機能
- [ ] 季節・年度別の自動プレイリスト生成
- [ ] 楽曲プレビュー機能
- [ ] ダークモード対応
- [ ] 英語版の提供

## 📄 ライセンス

MIT License

## 🙏 謝辞

- [Annict](https://annict.com) - アニメ視聴記録サービス
- [AnimeThemes.moe](https://animethemes.moe) - アニメ主題歌データベース
- [MyAnimeList](https://myanimelist.net) - アニメ情報データベース
- [Spotify](https://spotify.com) - 音楽ストリーミングサービス
