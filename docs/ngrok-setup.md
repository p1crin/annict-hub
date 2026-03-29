# ngrok を使用したHTTPS開発環境のセットアップ

## ngrokとは
ローカルサーバーにHTTPSトンネルを作成し、外部からアクセス可能にするツール

## インストール

```bash
# Homebrewを使用（Mac）
brew install ngrok

# または公式サイトからダウンロード
# https://ngrok.com/download
```

## セットアップ手順

### 1. ngrokアカウント作成（無料）
https://dashboard.ngrok.com/signup

### 2. Authtokenを取得
```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

### 3. Next.jsサーバーを起動
```bash
npm run dev
# → http://localhost:3000 で起動
```

### 4. 別のターミナルでngrokを起動
```bash
ngrok http 3000
```

### 5. ngrokが生成したHTTPS URLを取得
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### 6. Spotify Dashboardに登録
```
https://abc123.ngrok.io/callback/spotify
```

### 7. .envファイルを更新
```bash
# 一時的にngrok URLを使用
SPOTIFY_REDIRECT_URI=https://abc123.ngrok.io/callback/spotify
NEXT_PUBLIC_BASE_URL=https://abc123.ngrok.io
```

## 注意点

- **無料プランの制限**: ngrokのURLは毎回変わる
- **固定URL**: 有料プラン（$8/月）で固定URLが使える
- **開発時のみ**: 本番はVercelを使用

## より良い方法: mkcert

ローカルで信頼されたHTTPS証明書を使用する方法もあります：

```bash
# mkcertをインストール
brew install mkcert
brew install nss # Firefox用

# ローカルCA証明書を作成
mkcert -install

# localhost用の証明書を作成
mkcert localhost

# Next.jsをHTTPSで起動
# package.jsonにスクリプトを追加:
# "dev:https": "next dev --experimental-https"
```
