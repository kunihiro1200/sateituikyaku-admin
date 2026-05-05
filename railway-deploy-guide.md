# Railwayにスクレイピングサーバーをデプロイする手順

## 概要

Railwayにデプロイすると、**24時間365日稼働**し、**誰でもアクセス可能**になります。

---

## 手順

### ステップ1: Railwayアカウントを作成

1. https://railway.app/ にアクセス
2. 「Start a New Project」をクリック
3. GitHubアカウントでサインアップ

---

### ステップ2: 新しいプロジェクトを作成

1. Railwayダッシュボードで「New Project」をクリック
2. 「Deploy from GitHub repo」を選択
3. `sateituikyaku-admin`リポジトリを選択

---

### ステップ3: 環境変数を設定

Railwayダッシュボードで以下の環境変数を設定：

```
SUPABASE_URL=<Supabaseの URL>
SUPABASE_SERVICE_KEY=<Supabaseのサービスキー>
PORT=8765
```

**取得方法**:
- `backend/.env`ファイルから`SUPABASE_URL`と`SUPABASE_SERVICE_KEY`をコピー

---

### ステップ4: デプロイ設定

1. **Root Directory**: `/` (プロジェクトルート)
2. **Start Command**: `python scrape_server.py`
3. **Install Command**: `pip install -r requirements.txt && playwright install chromium`

---

### ステップ5: デプロイ

1. 「Deploy」をクリック
2. デプロイが完了するまで待つ（5-10分）

---

### ステップ6: 公開URLを取得

1. Railwayダッシュボードで「Settings」→「Networking」
2. 「Generate Domain」をクリック
3. 生成されたURL（例: `https://scrape-server-production.up.railway.app`）をコピー

---

### ステップ7: フロントエンドを更新

生成されたURLをフロントエンドの環境変数に設定：

**Vercel環境変数**:
```
VITE_SCRAPE_SERVER_URL=https://scrape-server-production.up.railway.app
```

**フロントエンドコード**:
```typescript
// frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx
const scrapeServerUrl = import.meta.env.VITE_SCRAPE_SERVER_URL || 'http://localhost:8765';
```

---

## 料金

### 無料枠
- $5/月のクレジット（約500時間の稼働）
- クレジットカード登録不要

### 有料プラン
- $5/月〜
- 無制限の稼働時間

---

## トラブルシューティング

### デプロイが失敗する

**原因**: Playwrightのインストールに失敗

**解決方法**:
1. `nixpacks.toml`を作成：

```toml
[phases.setup]
nixPkgs = ["python39", "chromium"]

[phases.install]
cmds = ["pip install -r requirements.txt", "playwright install chromium"]

[start]
cmd = "python scrape_server.py"
```

### メモリ不足エラー

**原因**: Chromiumのメモリ使用量が多い

**解決方法**:
1. Railwayの「Settings」→「Resources」でメモリを増やす（512MB → 1GB）

---

## 代替案: Render

Railwayが使えない場合は、Renderを使用：

1. https://render.com/ にアクセス
2. 「New Web Service」を選択
3. GitHubリポジトリを接続
4. 以下を設定：
   - **Build Command**: `pip install -r requirements.txt && playwright install chromium`
   - **Start Command**: `python scrape_server.py`
   - **Environment**: Python 3

---

## まとめ

- ✅ **24時間365日稼働**
- ✅ **誰でもアクセス可能**
- ✅ **PCを起動する必要なし**
- ✅ **無料枠で十分使える**

---

**最終更新日**: 2026年5月6日
