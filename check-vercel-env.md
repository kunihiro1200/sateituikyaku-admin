# Vercel環境変数の確認と修正手順

## 問題
フロントエンドが間違ったバックエンドURL（`sateituikyaku-admin-backend.vercel.app`）にリクエストを送信している。

## 原因
Vercelのフロントエンドプロジェクト（`sateituikyaku-admin-frontend`）の環境変数が古いURLを指している。

## 修正手順

### 1. Vercelダッシュボードにアクセス
https://vercel.com/dashboard

### 2. フロントエンドプロジェクトを選択
`sateituikyaku-admin-frontend`プロジェクトを選択

### 3. Settings → Environment Variables
左メニューから「Settings」→「Environment Variables」を選択

### 4. VITE_API_URLを確認
現在の値: `https://sateituikyaku-admin-backend.vercel.app`
正しい値: `https://baikyaku-property-site3.vercel.app`

### 5. VITE_API_URLを更新
1. 既存の`VITE_API_URL`の右側にある「Edit」ボタンをクリック
2. 値を`https://baikyaku-property-site3.vercel.app`に変更
3. 「Save」をクリック

### 6. 再デプロイ
1. 「Deployments」タブに移動
2. 最新のデプロイメントの右側にある「...」メニューをクリック
3. 「Redeploy」を選択
4. 「Redeploy」ボタンをクリック

### 7. 確認
再デプロイが完了したら（2-3分後）、BB14の案件で6752の買主にメールを再送信して確認

## 注意
`.env.production`ファイルを修正しただけでは不十分です。Vercelの環境変数も更新する必要があります。
