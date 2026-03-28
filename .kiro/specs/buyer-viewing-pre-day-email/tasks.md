# タスクリスト: buyer-viewing-pre-day-email

## タスク

- [x] 1. PreDayEmailButton コンポーネントの新規作成
  - [x] 1.1 `frontend/frontend/src/components/PreDayEmailButton.tsx` を作成する
  - [x] 1.2 `GET /api/email-templates` を呼び出し `★内覧前日通知メール` のみにフィルタリングするロジックを実装する
  - [x] 1.3 テンプレートが見つからない場合のエラー Snackbar を実装する
  - [x] 1.4 `POST /api/email-templates/:id/mergeMultiple` を呼び出して `BuyerEmailCompositionModal` を開くロジックを実装する
  - [x] 1.5 `selectedPropertyIds.size === 0` の場合にボタンを disabled にする
  - [x] 1.6 `POST /api/gmail/send` による送信処理と成功/失敗 Snackbar を実装する

- [x] 2. BuyerViewingResultPage への PreDayEmailButton 組み込み
  - [x] 2.1 `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` に `PreDayEmailButton` をインポートする
  - [x] 2.2 `buyer.calculated_status === '内覧日前日'` の場合のみ `PreDayEmailButton` を表示する条件分岐を追加する

- [x] 3. プロパティテストの作成
  - [x] 3.1 `calculated_status` によるボタン表示/非表示のプロパティテストを作成する（Property 1）
  - [x] 3.2 テンプレートフィルタリングのプロパティテストを作成する（Property 2）
  - [x] 3.3 物件未選択時のボタン無効化プロパティテストを作成する（Property 3）
  - [x] 3.4 テンプレート不在時のエラー表示プロパティテストを作成する（Property 4）
