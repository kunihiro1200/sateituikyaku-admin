# タスクリスト

## タスク

- [x] 1. バックエンド：`decryptSeller` に `situation_company` マッピングを追加
  - [x] 1.1 `backend/src/services/SellerService.supabase.ts` の `decryptSeller` 返却オブジェクトに `situation_company: seller.situation_company` を追加する
  - [x] 1.2 `getDiagnostics` でコンパイルエラーがないことを確認する

- [x] 2. フロントエンド：「専任（他決）決定日」の条件表示
  - [x] 2.1 `frontend/frontend/src/pages/SellerDetailPage.tsx` のステータスセクションに `seller.situation_company === '一般媒介'` の場合のみ「専任（他決）決定日」フィールドを表示するJSXを追加する
  - [x] 2.2 `contractYearMonth` が null/空の場合は「未設定」と表示する
  - [x] 2.3 `getDiagnostics` でコンパイルエラーがないことを確認する

- [x] 3. フロントエンド：「一般媒介通知」ボタンの条件付き強調スタイル
  - [x] 3.1 `frontend/frontend/src/pages/SellerDetailPage.tsx` の「Google Chat通知」セクション内の「一般媒介通知」ボタンに、`seller.situation_company === '一般媒介'` の場合にオレンジ系強調スタイル（`variant="contained"`, 背景色 `#FF6D00`）を適用する
  - [x] 3.2 `situation_company !== '一般媒介'` の場合は既存の `variant="outlined"` スタイルを維持する
  - [x] 3.3 `getDiagnostics` でコンパイルエラーがないことを確認する
