# 実装計画: 物件リスト買付情報修正・機能追加

## 概要

物件リスト詳細画面（PropertyListingDetailPage）の買付情報セクションに関する4件の修正・機能追加を実装する。
バックエンド（`backend/src/`）とフロントエンド（`frontend/frontend/src/`）の変更を順番に実施し、最後にデプロイする。

## タスク

- [x] 1. バックエンド: 買付フィールドの空文字列→null変換（500エラー修正）
  - [x] 1.1 `backend/src/routes/propertyListings.ts` の PUT `/:propertyNumber` ハンドラに、`OFFER_FIELDS`（offer_date, offer_status, offer_amount, offer_comment）の空文字列を `null` に変換するロジックを追加する
    - 変換は `propertyListingService.update()` 呼び出しの前に行う
    - _要件: 1.1, 1.2_
  - [ ]* 1.2 空文字列→null変換のプロパティテストを作成する
    - **プロパティ1: 空文字列フィールドはnullに変換される**
    - **検証: 要件 1.2**
    - `convertEmptyStringsToNull` 関数を抽出してテスト可能にする
    - fast-check を使用し、任意の買付フィールド値の組み合わせで検証する

- [x] 2. バックエンド: Google Chat 通知機能の追加
  - [x] 2.1 `backend/src/routes/propertyListings.ts` に `notifyGoogleChatOfferSaved()` ヘルパー関数を追加する
    - Webhook URL: `https://chat.googleapis.com/v1/spaces/AAAA6iEDkiU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=azlyf21pENCpLLUdJPjnRNXOzsIAP550xebOMVxYRMQ`
    - メッセージ形式: `【買付情報更新】\n物件番号: {propertyNumber}\n買付日: {offer_date ?? '未設定'}\n状況: {offer_status ?? '未設定'}\n買付コメント: {offer_comment ?? '未設定'}`
    - 失敗時は `console.error` でログ記録のみ（例外を外部に伝播させない）
    - _要件: 4.1, 4.2, 4.3_
  - [x] 2.2 PUT `/:propertyNumber` ハンドラの保存成功後に `notifyGoogleChatOfferSaved()` を非同期で呼び出す（`await` しない）
    - _要件: 4.4_
  - [ ]* 2.3 通知メッセージに必須情報が含まれることのプロパティテストを作成する
    - **プロパティ5: 通知メッセージには必須情報が含まれる**
    - **検証: 要件 4.2**
    - fast-check を使用し、任意の物件番号・買付日・状況・コメントの組み合わせで検証する

- [x] 3. バックエンドチェックポイント
  - すべてのバックエンドテストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 4. フロントエンド: バリデーション機能の追加
  - [x] 4.1 `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` に `offerErrors` state（offer_date / offer_status / offer_comment のエラーメッセージ）を追加する
    - _要件: 2.4_
  - [x] 4.2 `validateOfferFields()` 関数を実装する
    - `offer_amount` が空欄の場合は `null` を返す（エラーなし）
    - `offer_amount` に値がある場合は未入力フィールドに `"必須項目です"` を設定して返す
    - _要件: 2.1, 2.2_
  - [ ]* 4.3 `validateOfferFields()` のプロパティテストを作成する
    - **プロパティ2: offer_amount が非空のとき未入力フィールドはエラーになる**
    - **検証: 要件 2.1**
    - **プロパティ3: offer_amount が空のときバリデーションエラーは発生しない**
    - **検証: 要件 2.2**
    - fast-check を使用し、各プロパティを独立したテストケースとして実装する
  - [x] 4.4 `handleSaveOffer()` を修正する
    - 保存前に `validateOfferFields()` を呼び出し、エラーがあれば `setOfferErrors()` をセットしてAPIを呼び出さずに返る
    - バリデーション通過時は `setOfferErrors({})` でエラーをクリアしてからAPI呼び出しを行う
    - _要件: 2.1, 2.2, 2.3_
  - [x] 4.5 各エラーフィールドの下に「必須項目です」エラーメッセージを表示するUIを追加する
    - offer_date・offer_status・offer_comment の各入力欄の下に `offerErrors` の値を表示する
    - _要件: 2.4_
  - [x] 4.6 ユーザーがエラーフィールドに値を入力したとき、そのフィールドのエラーを即時消去する onChange ハンドラを追加する
    - _要件: 2.5_
  - [ ]* 4.7 エラーフィールドに値を入力するとエラーが消えることのプロパティテストを作成する
    - **プロパティ4: エラーフィールドに値を入力するとエラーが消える**
    - **検証: 要件 2.5**

- [x] 5. フロントエンド: 全空欄保存時のバッジ消去
  - [x] 5.1 `handleSaveOffer()` の保存成功後に `fetchPropertyData()` を呼び出し、`offer_status` が null になった場合に PurchaseStatusBadge が自動的に非表示になることを確認する
    - 既存の `fetchPropertyData()` 呼び出しで対応できる場合はそのまま利用する
    - _要件: 2.6_

- [x] 6. フロントエンド: 買付日カレンダーのクリック領域拡大
  - [x] 6.1 `PropertyListingDetailPage.tsx` の買付日フィールドを `type="date"` の `<input>` 要素（または MUI TextField の `type="date"`）に変更し、フィールド全体をクリックしたときに `showPicker()` を呼び出す onClick ハンドラを追加する
    - `inputProps={{ style: { cursor: 'pointer' } }}` でカーソルをポインターに設定する
    - _要件: 3.1, 3.2, 3.3_

- [x] 7. フロントエンドチェックポイント
  - すべてのフロントエンドテストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 8. デプロイ: バックエンド
  - [x] 8.1 バックエンドの変更ファイルを git add してコミットする
    - 対象: `backend/src/routes/propertyListings.ts`
    - コミットメッセージ例: `fix: convert empty offer fields to null and add Google Chat notification`
  - [x] 8.2 バックエンドリポジトリを git push してVercelへデプロイする
    - Vercelプロジェクト: `sateituikyaku-admin-backend`

- [x] 9. デプロイ: フロントエンド
  - [x] 9.1 フロントエンドの変更ファイルを git add してコミットする
    - 対象: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`
    - コミットメッセージ例: `feat: add offer validation, calendar click area, and badge clear on empty save`
  - [x] 9.2 フロントエンドリポジトリを git push してVercelへデプロイする
    - Vercelプロジェクト: `sateituikyaku-admin-frontend`

- [x] 10. 最終チェックポイント
  - デプロイ後、本番環境で以下を確認する（自動テストで代替可能な場合はそちらを優先）:
    - 全空欄保存で500エラーが出ないこと（要件1）
    - offer_amount 入力時に必須バリデーションが表示されること（要件2）
    - 買付日フィールドのどこをクリックしてもカレンダーが開くこと（要件3）
    - 保存成功後に Google Chat に通知が届くこと（要件4）

## 備考

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照しているため、トレーサビリティを確保している
- バックエンドとフロントエンドのデプロイは独立して実施可能
- プロパティテストには fast-check を使用し、最低100回のイテレーションを実行する
