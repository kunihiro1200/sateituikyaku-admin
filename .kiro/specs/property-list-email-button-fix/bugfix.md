# Bugfix Requirements Document

## Introduction

物件詳細ページの「公開前、値下げメール配信」ボタンに2つの問題がある。

1. **ボタンラベルの変更**: 現在のラベル「公開前、値下げメール配信」を「公開前、値下げメール」に変更する
2. **404エラーバグ**: ボタンを押すと `GET /api/property-listings/{propertyNumber}/scheduled-notifications` が404エラーになり、「配信対象の買主が見つかりませんでした」と表示される

コードを調査した結果、以下が判明した：

- ボタンは `frontend/frontend/src/components/GmailDistributionButton.tsx` に実装されており、ラベルはすでに「公開前、値下げメール配信」になっている（「公開前、値下げメール」への変更が必要）
- `frontend/frontend/src/components/PriceSection.tsx` が `useEffect` 内で `/api/property-listings/${propertyNumber}/scheduled-notifications` を呼び出しているが、このエンドポイントは `backend/src/routes/propertyListings.ts` に存在しない
- `PriceSection.tsx` は `scheduledNotifications` の状態を `GmailDistributionButton` のスタイル制御（ボタン色のアニメーション）に使用しているが、404エラーが発生してもボタン自体の動作には直接影響しない
- ただし、コンソールエラーが発生し続けることで、ユーザーが「ボタンが壊れている」と誤解する原因になっている

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件詳細ページ（`PropertyListingDetailPage`）が表示される THEN `PriceSection` コンポーネントが `GET /api/property-listings/{propertyNumber}/scheduled-notifications` を呼び出し、バックエンドにこのエンドポイントが存在しないため 404 エラーが発生する

1.2 WHEN 404 エラーが発生する THEN コンソールに `Failed to fetch scheduled notifications: AxiosError: Request failed with status code 404` が出力され続ける

1.3 WHEN `GmailDistributionButton` のラベルが「公開前、値下げメール配信」である THEN ユーザーが期待する「公開前、値下げメール」というラベルと一致しない

### Expected Behavior (Correct)

2.1 WHEN 物件詳細ページが表示される THEN `scheduled-notifications` の API 呼び出しが 404 エラーを発生させずに正常に完了する（エンドポイントを実装するか、不要な呼び出しを除去する）

2.2 WHEN `scheduled-notifications` の取得に失敗する THEN コンソールエラーが出力されず、`scheduledNotifications` は空配列として扱われる

2.3 WHEN `GmailDistributionButton` が表示される THEN ラベルが「公開前、値下げメール」と表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「公開前、値下げメール」ボタンをクリックする THEN テンプレート選択モーダルが開き、メール配信フローが正常に動作する

3.2 WHEN 配信対象の買主が存在する THEN `distribution-buyers-enhanced` API が正常に呼び出され、買主データが取得される

3.3 WHEN メール配信が完了する THEN 成功・失敗のスナックバーメッセージが正しく表示される

3.4 WHEN `PriceSection` の値下げ価格が変更されている THEN Chat送信ボタンのスタイル（アニメーション）が正しく動作する
