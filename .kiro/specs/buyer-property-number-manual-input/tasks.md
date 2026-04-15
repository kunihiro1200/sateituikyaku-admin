# 実装計画: 買主物件番号手動入力機能

## 概要

買主詳細画面（BuyerDetailPage）に、物件番号が未設定の場合の手動入力フォーム（ManualInputForm）と他社物件情報セクション（OtherCompanyPropertySection）を追加する。バックエンドには物件番号バリデーションエンドポイントと `other_company_property_info` カラムのDBマイグレーションを実装する。

## タスク

- [x] 1. DBマイグレーションファイルの作成
  - `backend/add-other-company-property-info.sql` を新規作成する
  - `buyers` テーブルに `other_company_property_info TEXT` カラムを追加する（NULL許容）
  - `IF NOT EXISTS` を使用して冪等性を確保する
  - _Requirements: 6.9_

- [x] 2. BuyerService に validatePropertyNumber メソッドを追加
  - [x] 2.1 `backend/src/services/BuyerService.ts` に `validatePropertyNumber` メソッドを実装する
    - `property_listings` テーブルで `property_number` の存在確認を行う
    - `maybeSingle()` を使用して結果が null かどうかで存在判定する
    - エラー時は例外をスローする
    - _Requirements: 2.2_

  - [ ]* 2.2 validatePropertyNumber のユニットテストを作成する
    - 存在する物件番号の場合 `true` を返すことを確認する
    - 存在しない物件番号の場合 `false` を返すことを確認する
    - _Requirements: 2.2_

- [x] 3. バックエンドに物件番号バリデーションエンドポイントを追加
  - [x] 3.1 `backend/src/routes/buyers.ts` に `GET /api/buyers/validate-property-number` エンドポイントを追加する
    - `number` クエリパラメータを受け取る
    - パラメータ未指定時は 400 エラーを返す
    - `buyerService.validatePropertyNumber()` を呼び出して `{ exists: boolean }` を返す
    - **注意**: 動的ルート（`/:id`）より前に配置すること
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]* 3.2 バリデーションエンドポイントの統合テストを作成する
    - 存在する物件番号で `{ exists: true }` が返ることを確認する
    - 存在しない物件番号で `{ exists: false }` が返ることを確認する
    - `number` パラメータ未指定で 400 が返ることを確認する
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 4. PUT /api/buyers/:id で other_company_property_info を受け付けるよう更新
  - `backend/src/routes/buyers.ts` の `PUT /api/buyers/:id` ハンドラで `other_company_property_info` フィールドを受け付けるよう更新する
  - `backend/src/services/BuyerService.ts` の更新メソッドで `other_company_property_info` を許可フィールドに追加する
  - _Requirements: 6.4_

- [x] 5. チェックポイント - バックエンドの動作確認
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 6. フロントエンド: BuyerDetailPage に状態とハンドラを追加
  - [x] 6.1 `frontend/frontend/src/pages/BuyerDetailPage.tsx` に ManualInputForm 用のローカル状態を追加する
    - `manualPropertyNumber`、`manualPropertyNumberError`、`isSavingPropertyNumber` の3つの状態を追加する
    - _Requirements: 1.3, 2.1, 4.1, 4.2_

  - [x] 6.2 `handleSavePropertyNumber` ハンドラを実装する
    - 空文字バリデーション（クライアントサイド）を実装する
    - `GET /api/buyers/validate-property-number` を呼び出して物件番号の存在確認を行う
    - 存在確認後に `PUT /api/buyers/:id` で `property_number` を保存する
    - 保存成功後に `fetchLinkedProperties()` を再実行し、`buyer` 状態を更新する
    - `isSavingPropertyNumber` で保存中フラグを管理する
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

  - [ ]* 6.3 handleSavePropertyNumber のプロパティテストを作成する
    - **Property 2: 空白文字列の物件番号バリデーション**
    - **Validates: Requirements 2.1**

  - [ ]* 6.4 handleSavePropertyNumber のプロパティテストを作成する
    - **Property 3: 存在しない物件番号のエラーメッセージフォーマット**
    - **Validates: Requirements 2.3**

- [x] 7. フロントエンド: OtherCompanyPropertySection の状態とハンドラを追加
  - [x] 7.1 `frontend/frontend/src/pages/BuyerDetailPage.tsx` に OtherCompanyPropertySection 用のローカル状態を追加する
    - `otherCompanyPropertyInfo`、`isSavingOtherCompanyInfo`、`otherCompanyInfoSaveStatus` の3つの状態を追加する
    - BuyerDetailPage 初期化時に `buyer.other_company_property_info` で初期値をセットする
    - _Requirements: 6.3, 6.7, 6.8_

  - [x] 7.2 `handleSaveOtherCompanyPropertyInfo` ハンドラを実装する
    - `PUT /api/buyers/:id` で `other_company_property_info` を保存する
    - 保存成功後に `otherCompanyInfoSaveStatus` を `'success'` にセットする
    - 保存失敗時に `otherCompanyInfoSaveStatus` を `'error'` にセットする
    - `isSavingOtherCompanyInfo` で保存中フラグを管理する
    - _Requirements: 6.4, 6.5, 6.6, 6.7_

- [x] 8. フロントエンド: ManualInputForm の JSX を実装する
  - [x] 8.1 `BuyerDetailPage.tsx` の物件詳細カードエリアに ManualInputForm の JSX ブロックを追加する
    - `property_number` が空/未設定の場合のみ表示する条件分岐を実装する
    - テキスト入力フィールド（プレースホルダー: 「物件番号を入力（例：AA1234）」）を追加する
    - 保存ボタンを追加する（`isSavingPropertyNumber` 中は disabled かつラベル「保存中...」）
    - エラーメッセージ表示エリアを追加する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3_

  - [x] 8.2 既存の「紐づいた物件はありません」メッセージを ManualInputForm に置き換える
    - `property_number` が未設定の場合は ManualInputForm を表示し、既存メッセージを非表示にする
    - 両方が同時に表示されないことを確認する
    - _Requirements: 5.1, 5.2_

  - [ ]* 8.3 ManualInputForm 表示制御のプロパティテストを作成する
    - **Property 1: 物件番号の有無によるフォーム表示の排他性**
    - **Validates: Requirements 1.1, 1.2, 5.1, 5.2**

  - [ ]* 8.4 ManualInputForm 保存ボタン状態のプロパティテストを作成する
    - **Property 4: 保存中のボタン状態制御（ManualInputForm）**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 9. フロントエンド: OtherCompanyPropertySection の JSX を実装する
  - [x] 9.1 `BuyerDetailPage.tsx` の物件詳細カードの下に OtherCompanyPropertySection の JSX ブロックを追加する
    - `property_number` が空/未設定の場合のみ表示する条件分岐を実装する
    - 「他社物件情報」ラベル付きのテキストエリアを追加する
    - 保存ボタンを追加する（`isSavingOtherCompanyInfo` 中は disabled かつラベル「保存中...」）
    - 保存成功・失敗のフィードバック表示を追加する
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7_

  - [ ]* 9.2 OtherCompanyPropertySection 表示制御のプロパティテストを作成する
    - **Property 5: property_number の有無による OtherCompanyPropertySection 表示制御**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 9.3 OtherCompanyPropertySection 初期値表示のプロパティテストを作成する
    - **Property 6: OtherCompanyPropertyInfo の初期値表示**
    - **Validates: Requirements 6.8**

  - [ ]* 9.4 OtherCompanyPropertySection 保存ボタン状態のプロパティテストを作成する
    - **Property 4: 保存中のボタン状態制御（OtherCompanyPropertySection）**
    - **Validates: Requirements 6.7**

- [x] 10. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- バックエンドは `backend/src/` 配下（社内管理システム用）のみ編集すること
- `GET /api/buyers/validate-property-number` エンドポイントは `/:id` より前に定義すること（ルーティング競合防止）
- 日本語を含むファイルの編集は Pythonスクリプト経由で UTF-8 書き込みを行うこと
