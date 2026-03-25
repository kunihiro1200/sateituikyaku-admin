# 実装タスク: 物件公開日フィールド追加 & 売買契約完了通知フォールバック修正

## 概要

2つの独立した機能改善を実装します。
1. `PropertyListingDetailPage` の物件概要セクションに `distribution_date`（公開日）フィールドを追加
2. `notify-contract-completed` エンドポイントのフォールバックロジックを修正

## タスク

- [x] 1. 日付フォーマットユーティリティの実装
  - [x] 1.1 `formatDisplayDate` 関数を `PropertyListingDetailPage.tsx` 内に実装する
    - `null` / `undefined` / 空文字 → `-` を返す
    - `YYYY-MM-DD` 形式 → `YYYY/MM/DD` 形式に変換して返す
    - _Requirements: 1.2_
  - [ ]* 1.2 `formatDisplayDate` のプロパティテストを書く
    - **Property 1: 日付フォーマット**
    - **Validates: Requirements 1.2**

- [x] 2. 物件概要セクションへの「公開日」フィールド追加
  - [x] 2.1 `PropertyListingDetailPage.tsx` の物件概要セクション（`isHeaderEditMode` で制御される `<Paper>` ブロック）に表示モードの「公開日」フィールドを追加する
    - `formatDisplayDate(data.distribution_date)` を使って `YYYY/MM/DD` 形式で表示
    - 値がない場合は `-` を表示
    - 既存フィールドのレイアウトパターンに合わせる
    - _Requirements: 1.1, 1.2_
  - [x] 2.2 同セクションの編集モードに `distribution_date` の日付入力フィールドを追加する
    - `type="date"` の `<TextField>` を使用
    - `handleFieldChange('distribution_date', ...)` で変更を追跡
    - _Requirements: 1.3_
  - [ ]* 2.3 保存ラウンドトリップの動作確認テストを書く
    - **Property 2: 公開日フィールドの保存ラウンドトリップ**
    - **Validates: Requirements 1.4**

- [x] 3. チェックポイント - フロントエンド動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. `notify-contract-completed` エンドポイントのフォールバックロジック修正
  - [x] 4.1 `backend/src/routes/propertyListings.ts` の `notify-contract-completed` エンドポイントを修正する
    - `sales_assignee` が未設定の場合: `console.log` でログを出力し、`DEFAULT_WEBHOOK_URL` を使用
    - `sales_assignee` が設定済みで Webhook 取得成功: `console.log` でログを出力し、担当者 URL を使用
    - `sales_assignee` が設定済みで Webhook 取得失敗: `console.warn` でログを出力し、`DEFAULT_WEBHOOK_URL` にフォールバック
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 4.2 フォールバックURL使用条件のプロパティテストを書く
    - **Property 4: フォールバックURL使用条件**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 4.3 担当者Webhook成功時の送信先プロパティテストを書く
    - **Property 5: 担当者Webhook成功時の送信先**
    - **Validates: Requirements 2.3**
  - [ ]* 4.4 メッセージ形式一貫性のプロパティテストを書く
    - **Property 6: メッセージ形式の一貫性**
    - **Validates: Requirements 2.4**

- [x] 5. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたサブタスクはオプションであり、MVP向けにスキップ可能
- 各タスクは対応する要件番号を参照
- フロントエンドの変更は `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` のみ
- バックエンドの変更は `backend/src/routes/propertyListings.ts` のみ
- DBカラム・スプシマッピングは既存のため変更不要
