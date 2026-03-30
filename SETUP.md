# 🚀 セットアップガイド

このガイドに従って、AnimeHubアプリを起動します。

## ✅ 前提条件

- Node.js 18.x 以上
- npm または yarn
- Annictアカウント
- Spotifyアカウント

---

## 📦 Step 1: Supabase プロジェクトの作成

### 1.1 Supabaseにサインアップ

https://supabase.com にアクセスし、アカウントを作成してください。

### 1.2 新しいプロジェクトを作成

1. "New Project" をクリック
2. プロジェクト名: `annict-hub`（任意）
3. Database Password: 安全なパスワードを設定
4. Region: **Northeast Asia (Tokyo)** を選択（日本から最速）
5. "Create new project" をクリック

⏳ プロジェクトの作成には1-2分かかります。

### 1.3 接続情報を取得

プロジェクトが作成されたら：

1. **Settings** タブをクリック
2. **API** セクションを選択
3. 以下をコピー：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIs...`
   - **service_role**: `eyJhbGciOiJIUzI1NiIs...` （⚠️ 秘密情報！）

### 1.4 データベーステーブルを作成

1. Supabase Dashboard で **SQL Editor** をクリック
2. **New query** をクリック
3. 以下のファイルの内容を**すべてコピー**：
   ```
   supabase/migrations/001_initial_schema.sql
   ```
4. SQL Editorに**ペースト**
5. **Run** をクリック

✅ 成功すると、6つのテーブルが作成されます：
- users
- anime_cache
- theme_songs
- spotify_matches
- rankings
- ranking_items

---

## 🔑 Step 2: Annict OAuth アプリの作成

### 2.1 Annictにログイン

https://annict.com にアクセスし、ログインしてください。

### 2.2 OAuth アプリケーションを作成

1. https://annict.com/oauth/applications にアクセス
2. **新しいアプリケーションを登録** をクリック
3. 以下を入力：
   - **アプリケーション名**: `AnimeHub`（任意）
   - **リダイレクトURI**: `http://localhost:3000/callback/annict`
   - **スコープ**: `read` にチェック
4. **登録** をクリック

### 2.3 認証情報を取得

作成したアプリをクリックして、以下をコピー：
- **Application ID**（Client ID）
- **Secret**（Client Secret）

---

## 🎵 Step 3: Spotify アプリの作成

### 3.1 Spotify Developer Dashboardにアクセス

https://developer.spotify.com/dashboard にアクセスし、ログインしてください。

### 3.2 アプリケーションを作成

1. **Create app** をクリック
2. 以下を入力：
   - **App name**: `AnimeHub`（任意）
   - **App description**: アプリの説明
   - **Website**: `http://localhost:3000`
   - **Redirect URIs**: `http://localhost:3000/callback/spotify` ⚠️ 重要！
   - **Which API/SDKs are you planning to use?**: Web API にチェック
3. 利用規約に同意
4. **Save** をクリック

### 3.3 Redirect URIを追加（重要）

1. 作成したアプリの **Settings** をクリック
2. **Redirect URIs** セクションまでスクロール
3. 以下を入力：
   ```
   http://localhost:3000/callback/spotify
   ```
4. **Add** をクリック
5. **Save** をクリック（必須！）

### 3.4 認証情報を取得

1. **Settings** タブで以下をコピー：
   - **Client ID**
   - **Client Secret**（"View client secret" をクリック）

---

## 📝 Step 4: 環境変数の設定

`.env` ファイルを開いて、以下の値を実際の値に**置き換えてください**：

```bash
# ======================================
# Annict API
# ======================================
ANNICT_CLIENT_ID=あなたのAnnict_Application_ID
ANNICT_CLIENT_SECRET=あなたのAnnict_Secret
ANNICT_REDIRECT_URI=http://localhost:3000/callback/annict

# ======================================
# Spotify API
# ======================================
SPOTIFY_CLIENT_ID=あなたのSpotify_Client_ID
SPOTIFY_CLIENT_SECRET=あなたのSpotify_Client_Secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback/spotify

# ======================================
# Supabase
# ======================================
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabase_Project_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=あなたのSupabase_service_role_key

# ======================================
# Next.js
# ======================================
NEXTAUTH_SECRET=ランダムな文字列（そのままでもOK）
NEXTAUTH_URL=http://localhost:3000
```

---

## 🚀 Step 5: アプリの起動

### 5.1 依存関係のインストール（初回のみ）

```bash
npm install
```

### 5.2 開発サーバーの起動

```bash
npm run dev
```

✅ 成功すると、以下のように表示されます：
```
✓ Ready in 296ms
- Local:   http://localhost:3000
```

### 5.3 ブラウザでアクセス

http://localhost:3000 を開いてください。

---

## 🎯 Step 6: 動作確認

### 6.1 Annictでログイン

1. **Annictでログイン** ボタンをクリック
2. Annictの認証画面が表示される
3. **許可する** をクリック
4. ダッシュボードにリダイレクトされる

### 6.2 アニメライブラリの表示

ダッシュボードで、Annictの視聴履歴が表示されます。

### 6.3 Spotify連携

1. **Spotify連携** ボタンをクリック
2. Spotifyの認証画面が表示される
3. **同意する** をクリック
4. ダッシュボードに戻る

### 6.4 プレイリスト作成

1. アニメを選択
2. **プレイリスト作成** ボタンをクリック
3. 主題歌が自動で取得される
4. Spotifyでマッチング
5. プレイリストが作成される

---

## 🐛 トラブルシューティング

### ❌ "Missing Supabase environment variables"

**原因**: `.env` ファイルの設定が不完全

**解決方法**:
1. `.env` ファイルを開く
2. `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を実際の値に変更
3. サーバーを再起動: `Ctrl+C` → `npm run dev`

---

### ❌ "Failed to create user in database"

**原因**: Supabaseのテーブルが作成されていない

**解決方法**:
1. Supabase Dashboard → SQL Editor
2. `supabase/migrations/001_initial_schema.sql` の内容を実行
3. テーブルが作成されたか確認: Table Editor で `users` テーブルが表示される

---

### ❌ "Invalid redirect URI" (Spotify)

**原因**: Spotify Dashboard の Redirect URI 設定が間違っている

**解決方法**:
1. Spotify Developer Dashboard → あなたのアプリ → Settings
2. Redirect URIs に `http://localhost:3000/callback/spotify` があるか確認
3. **完全一致**が必要（スラッシュ、プロトコル等）
4. **Save** ボタンをクリック（必須！）

---

### ❌ CSS エラー

**原因**: Tailwind CSS のキャッシュ

**解決方法**:
```bash
rm -rf .next
npm run dev
```

---

## 📚 次のステップ

- [ ] 本番環境へのデプロイ（Vercel）
- [ ] カスタムドメインの設定
- [ ] Spotify アプリの Redirect URI に本番URLを追加

セットアップ完了です！🎉
