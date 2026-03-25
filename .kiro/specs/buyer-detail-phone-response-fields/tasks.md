# 実装計画: buyer-detail-phone-response-fields

## 概要

買主詳細画面（`BuyerDetailPage.tsx`）および新規登録画面（`NewBuyerPage.tsx`）に2つのフィールドを追加する。

1. `vendor_survey`（業者向けアンケート）: 常時表示のボタン選択UI
2. `three_calls_confirmed`（3回架電確認済み）: `inquiry_email_phone === '不通'` のときのみ表示する条件付き必須フィールド

## タスク

- [x] 1. DBマイグレーション: `vendor_survey` カラム追加
  - `buyers` テーブルに `vendor_survey TEXT` カラムを追加するSQLを実行する
  - `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS vendor_survey TEXT;`
  - _Requirements: 3.3_

- [x] 2. `buyer-column-mapping.json` にマッピングを追加
  - [x] 2.1 `spreadsheetToDatabaseExtended` セクションに `"業者向けアンケート": "vendor_survey"` を追加する
    - ファイル: `backend/src/config/buyer-column-mapping.json`
    - _Requirements: 2.5, 2.8_
  - [ ]* 2.2 マッピングの存在を確認するユニットテストを書く
    - `buyer-column-mapping.json` に `"業者向けアンケート": "vendor_survey"` が存在すること
    - `buyer-column-mapping.json` に `"3回架電確認済み": "three_calls_confirmed"` が存在すること
    - _Requirements: 1.6, 2.5, 2.8_

- [x] 3. `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` を更新する
  - [x] 3.1 `vendor_survey` フィールドを `inquiry_hearing` の直前に追加する
    - `{ key: 'vendor_survey', label: '業者向けアンケート', inlineEditable: true, fieldType: 'buttonSelect' }` を追加
    - `three_calls_confirmed` の `fieldType` を `'dropdown'` から `'buttonSelect'` に変更する
    - ファイル: `frontend/frontend/src/pages/BuyerDetailPage.tsx`
    - _Requirements: 2.1, 2.2_
  - [ ]* 3.2 `BUYER_FIELD_SECTIONS` の配置を確認するプロパティテストを書く
    - **Property 5: BUYER_FIELD_SECTIONS における vendor_survey の配置**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. `BuyerDetailPage.tsx` に `vendor_survey` フィールドのレンダリングを実装する
  - [x] 4.1 `vendor_survey` のボタン選択UIを実装する
    - `button-select-layout-rule.md` に従ったレイアウト（ラベルとボタン群の横並び・均等幅）
    - 選択肢: `['確認済み', '未']`
    - ボタンクリック時: `setBuyer` で楽観的更新 → `handleFieldChange` → `handleInlineFieldSave`
    - ファイル: `frontend/frontend/src/pages/BuyerDetailPage.tsx`
    - _Requirements: 2.1, 2.2, 2.3, 2.6_
  - [ ]* 4.2 ボタンクリック時に `handleInlineFieldSave` が呼ばれることを確認するプロパティテストを書く
    - **Property 2: ボタンクリック時に handleInlineFieldSave が呼ばれる（vendor_survey）**
    - **Validates: Requirements 2.3**

- [x] 5. `BuyerDetailPage.tsx` の `three_calls_confirmed` フィールドのレンダリングを変更する
  - [x] 5.1 `three_calls_confirmed` の条件付き表示ロジックを実装する
    - `buyer.inquiry_email_phone !== '不通'` のとき `null` を返す（非表示）
    - 表示時: 選択肢 `['確認済み', '未']`、ラベルに赤色の必須マーク（`*`）を付与
    - ボタンクリック時: `setBuyer` で楽観的更新 → `handleFieldChange` → `handleInlineFieldSave`
    - ファイル: `frontend/frontend/src/pages/BuyerDetailPage.tsx`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8_
  - [ ]* 5.2 `inquiry_email_phone` の値による表示制御を確認するプロパティテストを書く
    - **Property 1: inquiry_email_phone の値による three_calls_confirmed の表示制御**
    - **Validates: Requirements 1.1, 1.2, 1.8**
  - [ ]* 5.3 ボタンクリック時に `handleInlineFieldSave` が呼ばれることを確認するプロパティテストを書く
    - **Property 2: ボタンクリック時に handleInlineFieldSave が呼ばれる（three_calls_confirmed）**
    - **Validates: Requirements 1.4**

- [x] 6. チェックポイント - ここまでのテストが全て通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 7. `NewBuyerPage.tsx` に `vendor_survey` フィールドを追加する
  - [x] 7.1 `vendor_survey` フィールドを `inquiry_hearing` の直前に追加する
    - ボタン選択UI（「確認済み」「未」の2択）で実装
    - `button-select-layout-rule.md` に従ったレイアウト
    - ファイル: `frontend/frontend/src/pages/NewBuyerPage.tsx`
    - _Requirements: 2.7_
  - [x] 7.2 `NewBuyerPage.tsx` の `three_calls_confirmed` の選択肢を「確認済み」「未」の2択に変更する
    - 既存の条件付き表示ロジック（`inquiry_email_phone === '不通'` のとき表示）はそのまま維持
    - ファイル: `frontend/frontend/src/pages/NewBuyerPage.tsx`
    - _Requirements: 1.9_

- [x] 8. セクション保存時のスプレッドシート同期を確認する
  - [x] 8.1 `handleSectionSave` が `vendor_survey` と `three_calls_confirmed` を `sync: true` で送信することを確認する
    - 既存の `handleSectionSave` → `buyerApi.update({ sync: true })` → `BuyerWriteService.updateFields` のフローで対応済みであることを確認
    - _Requirements: 1.5, 2.4_
  - [ ]* 8.2 セクション保存時に `BuyerWriteService` が呼ばれることを確認するプロパティテストを書く
    - **Property 3: セクション保存時に BuyerWriteService が呼ばれる**
    - **Validates: Requirements 1.5, 2.4**

- [x] 9. `vendor_survey` のラウンドトリップ保存を確認する
  - [ ]* 9.1 `vendor_survey` のラウンドトリップ保存を確認するプロパティテストを書く
    - **Property 4: vendor_survey のラウンドトリップ保存**
    - **Validates: Requirements 3.1, 3.2**

- [x] 10. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- 各タスクは前のタスクの成果物を前提とする
- `three_calls_confirmed` は既存カラム・既存マッピング済みのため、DBマイグレーションは不要
- `vendor_survey` のみ新規カラム追加が必要（タスク1）
- ファイルエンコーディング保護ルールに従い、日本語を含むファイルの編集はPythonスクリプト経由で行うこと
