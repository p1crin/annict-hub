# Vercel を使用した開発環境セットアップ

## メリット
- 🔒 自動HTTPS（無料）
- 🚀 即座にデプロイ
- 🔄 Gitプッシュで自動更新
- 🌐 実際の本番環境に近い

## セットアップ手順

### 1. GitHubにリポジトリを作成

```bash
# プロジェクトをGitで初期化（まだの場合）
cd /Users/matsuishi_t/Documents/src/new-app
git init
git add .
git commit -m "Initial commit"

# GitHubでリポジトリを作成後
git remote add origin https://github.com/YOUR_USERNAME/anime-music.git
git branch -M main
git push -u origin main
```

### 2. Vercelにデプロイ

1. https://vercel.com にサインアップ
2. "Add New Project" をクリック
3. GitHubリポジトリを選択
4. **Environment Variables** を設定:

```bash
ANNICT_CLIENT_ID=あなたのAnnict Client ID
ANNICT_CLIENT_SECRET=あなたのAnnict Client Secret
ANNICT_REDIRECT_URI=https://your-app.vercel.app/callback/annict

SPOTIFY_CLIENT_ID=あなたのSpotify Client ID
SPOTIFY_CLIENT_SECRET=あなたのSpotify Client Secret
SPOTIFY_REDIRECT_URI=https://your-app.vercel.app/callback/spotify

NEXT_PUBLIC_SUPABASE_URL=あなたのSupabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase Anon Key
SUPABASE_SERVICE_ROLE_KEY=あなたのSupabase Service Role Key

NEXTAUTH_SECRET=ランダムな文字列
NEXTAUTH_URL=https://your-app.vercel.app
```

5. "Deploy" をクリック

### 3. デプロイ後の設定

デプロイが完了すると、Vercelが自動生成したURL（例: `https://anime-music-xyz123.vercel.app`）が取得できます。

### 4. Spotify Dashboard を更新

Redirect URIを追加:
```
https://anime-music-xyz123.vercel.app/callback/spotify
```

### 5. 開発サイクル

```bash
# コードを変更
git add .
git commit -m "Update feature"
git push

# Vercelが自動的にデプロイ
# 新しいプレビューURLが生成される
```

## ローカル開発との併用

ローカルで開発し、テストはVercel Previewで行う：

1. ローカルで開発: `npm run dev`
2. 変更をコミット: `git commit -am "Fix bug"`
3. プッシュ: `git push`
4. Vercel Preview URLでテスト: `https://anime-music-git-branch-user.vercel.app`

## コスト

- **Hobby Plan**: 完全無料
- **Pro Plan**: $20/月（チームで使用する場合のみ）

**推奨**: まずはHobby Planで十分です
