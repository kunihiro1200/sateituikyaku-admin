# Bugfix Requirements Document

## Introduction

買主詳細画面（BuyerDetailPage）で通話履歴を持つ買主（例：買主番号7359）をクリックすると、2つのバグが同時に発生してエラー画面が表示される。

1. **`isSms is not defined`**: `frontend/frontend/src/pages/BuyerDetailPage.tsx` の1550行目、通話履歴セクション（`action === 'call'` フィルタ内）で `isSms` 変数が未定義のまま参照されるJavaScriptエラー。`isSms` は1604行目のメール・SMS履歴セクションで定義されているが、通話履歴セクションには存在しない。
2. **404エラー**: `backend/src/routes/buyers.ts` の668行目、`fetchRelatedBuyersCount` が呼び出す `/api/buyers/:buyer_number/related` エンドポイントで `getByBuyerNumber(id)` が `deleted_at IS NULL` でフィルタするため、論理削除済み買主の場合にnullが返り404になる。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 通話履歴（`action === 'call'` または `action === 'phone_call'`）が存在する買主の詳細画面を開いたとき THEN 通話履歴セクションのレンダリング中に `isSms is not defined` JavaScriptエラーが発生し、画面がクラッシュする（`BuyerDetailPage.tsx` 1550行目: `const hasBody = !isSms && !!metadata.body` で `isSms` が未定義）

1.2 WHEN 論理削除済み（`deleted_at IS NOT NULL`）の買主番号で詳細画面にアクセスしたとき THEN `fetchRelatedBuyersCount` が `/api/buyers/${buyer_number}/related` を呼び出し、`getByBuyerNumber(id)` がnullを返すため404エラーが発生する（`backend/src/routes/buyers.ts` 668行目）

### Expected Behavior (Correct)

2.1 WHEN 通話履歴が存在する買主の詳細画面を開いたとき THEN 通話履歴セクションが正常にレンダリングされる（通話履歴セクション内では `isSms` は常に `false` であるため、`const hasBody = !!metadata.body` に変更する）

2.2 WHEN 論理削除済みの買主番号で詳細画面にアクセスしたとき THEN `/api/buyers/${buyer_number}/related` が正常に200を返し、関連買主数が取得される（`getByBuyerNumber(id)` を `getByBuyerNumber(id, true)` に変更して削除済みも含めて検索する）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN メール・SMS送信履歴セクションを表示したとき THEN `isSms` 変数が正しく定義され、SMS履歴とメール履歴が正常に区別して表示される

3.2 WHEN 通話履歴が存在しない買主の詳細画面を開いたとき THEN 画面が引き続き正常に表示される

3.3 WHEN 論理削除されていない（アクティブな）買主番号で詳細画面にアクセスしたとき THEN 関連買主数取得APIが引き続き正常に動作する

3.4 WHEN 通話履歴セクションで `metadata.body` が存在する場合 THEN クリックでメール本文モーダルが開く動作が維持される

3.5 WHEN 関連買主が存在する買主の詳細画面を開いたとき THEN RelatedBuyerNotificationBadgeに正しい件数が表示される
