# 実装計画：buyer-pinrich-auto-set-second-inquiry

## 概要

`inquiry_source` が `'2件目以降'` の場合に `pinrich` を `'登録不要（不可）'` で自動セットし、編集不可にする機能を実装する。フロントエンド（BuyerDetailPage / NewBuyerPage）、バックエンド（BuyerService / BuyerWriteService）、スプレッドシート同期（BuyerSyncService）の4レイヤーに適用する。

## タスク

- [x] 1. PINRICH_OPTIONS に '登録不要（不可）' を追加
  - `frontend/frontend/src/utils/buyerDetailFieldOptions.ts` の `PINRICH_OPTIONS` 配列に `{ value: '登録不要（不可）', label: '登録不要（不可）' }` を追加する
  - ⚠️ 日本語を含む `.ts` ファイルのため Python スクリプト経由で UTF-8 書き込みを行うこと
  - _Requirements: 1.1, 1.3_

- [x] 2. ヘルパー関数を作成（isSecondInquiry / resolvePinrichValue）
  - [x] 2.1 `frontend/frontend/src/utils/buyerPinrichHelper.ts` を新規作成する
    - `isSecondInquiry(inquirySource)` 関数を実装する
    - `resolvePinrichValue(inquirySource, currentPinrich)` 関数を実装する
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [ ]* 2.2 isSecondInquiry / resolvePinrichValue のユニットテストを作成する
    - `'2件目以降'`、null、undefined、空文字、他の値の各ケースをテストする
    - _Requirements: 1.1, 1.2_

- [x] 3. BuyerDetailPage に inquiry_source 連動ロジックを追加
  - [x] 3.1 `frontend/frontend/src/pages/BuyerDetailPage.tsx` を修正する
    - `isSecondInquiry` / `resolvePinrichValue` をインポートする
    - 初期表示時（useEffect）に `inquiry_source` を確認して `pinrich` を補完するロジックを追加する
    - `inquiry_source` の onChange ハンドラに `pinrich` 自動セットロジックを追加する
    - `pinrich` ドロップダウンの `disabled` 属性を `isSecondInquiry(inquiry_source)` で動的に制御する
    - ⚠️ 日本語を含む `.tsx` ファイルのため Python スクリプト経由で UTF-8 書き込みを行うこと（`strReplace` 禁止）
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 4.1, 4.3_

  - [ ]* 3.2 BuyerDetailPage の pinrich 連動動作のプロパティテストを作成する
    - **Property 1: フロントエンドでの inquiry_source='2件目以降' 時の pinrich 自動セット**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 3.3 BuyerDetailPage の pinrich 編集可能状態のプロパティテストを作成する
    - **Property 2: フロントエンドでの inquiry_source≠'2件目以降' 時の pinrich 編集可能**
    - **Validates: Requirements 1.5, 1.6**

- [x] 4. NewBuyerPage に inquiry_source 連動ロジックを追加
  - [x] 4.1 `frontend/src/pages/NewBuyerPage.tsx` を修正する
    - `isSecondInquiry` / `resolvePinrichValue` をインポートする
    - `inquiry_source` の onChange ハンドラに `pinrich` 自動セットロジックを追加する
    - `pinrich` フィールドの `disabled` 属性を `isSecondInquiry(inquiry_source)` で動的に制御する
    - ⚠️ 日本語を含む `.tsx` ファイルのため Python スクリプト経由で UTF-8 書き込みを行うこと（`strReplace` 禁止）
    - _Requirements: 1.3, 1.4, 1.6, 2.4, 2.5_

  - [ ]* 4.2 NewBuyerPage の pinrich 連動動作のプロパティテストを作成する
    - **Property 3: inquiry_source 変更時のリアルタイム連動**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 5. チェックポイント - フロントエンド動作確認
  - 全テストが通ることを確認し、不明点があればユーザーに確認する。

- [x] 6. BuyerService に applySecondInquiryRule を追加
  - [x] 6.1 `backend/src/services/BuyerService.ts` の `create` メソッドに `applySecondInquiryRule` を適用する
    - DB保存前に `applySecondInquiryRule(newBuyer)` を呼び出す
    - _Requirements: 3.1, 4.2_

  - [x] 6.2 `backend/src/services/BuyerService.ts` の `update` / `updateWithSync` メソッドに `applySecondInquiryRule` を適用する
    - `allowedData` 構築後、DB保存前に `applySecondInquiryRule(allowedData)` を呼び出す
    - _Requirements: 3.2, 3.4_

  - [ ]* 6.3 BuyerService.applySecondInquiryRule のプロパティテストを作成する
    - **Property 4: バックエンドでの pinrich 強制セット（作成・更新）**
    - **Validates: Requirements 3.1, 3.2, 3.4**
    - fast-check を使用し、`inquiry_source = '2件目以降'` の場合に `pinrich` が常に `'登録不要（不可）'` になることを検証する

  - [ ]* 6.4 BuyerService.applySecondInquiryRule の非干渉プロパティテストを作成する
    - **Property 5: バックエンドでの pinrich 非干渉（inquiry_source≠'2件目以降'）**
    - **Validates: Requirements 3.3**
    - fast-check を使用し、`inquiry_source ≠ '2件目以降'` の場合に `pinrich` がリクエスト値のままになることを検証する

- [x] 7. BuyerWriteService に applySecondInquiryRule を追加
  - [x] 7.1 `backend/src/services/BuyerWriteService.ts` の `updateFields` メソッドに `applySecondInquiryRule` を適用する
    - スプレッドシート書き込み前に `applySecondInquiryRule(updates)` を呼び出す
    - _Requirements: 6.1, 6.3_

  - [x] 7.2 `backend/src/services/BuyerWriteService.ts` の `appendNewBuyer` メソッドに `applySecondInquiryRule` を適用する
    - `mapDatabaseToSpreadsheet` 呼び出し前に `applySecondInquiryRule(buyerData)` を呼び出す
    - _Requirements: 6.1, 6.3_

  - [ ]* 7.3 BuyerWriteService.applySecondInquiryRule のプロパティテストを作成する
    - **Property 7: DB→スプシ同期時の pinrich 強制セット**
    - **Validates: Requirements 6.1, 6.3**

- [x] 8. BuyerSyncService（スプシ→DB同期）に applySecondInquiryRule を追加
  - [x] 8.1 `backend/src/services/BuyerSyncService.ts` のスプレッドシート行→DBレコード変換処理に `applySecondInquiryRule` を適用する
    - `BuyerColumnMapper.mapSpreadsheetToDatabase` の結果に対して `applySecondInquiryRule` を呼び出す
    - _Requirements: 5.1, 5.3_

  - [ ]* 8.2 BuyerSyncService の pinrich 強制セットのプロパティテストを作成する
    - **Property 6: スプシ→DB同期時の pinrich 強制セット**
    - **Validates: Requirements 5.1, 5.3**

- [x] 9. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、不明点があればユーザーに確認する。

## 注意事項

- タスク `*` 付きはオプション（スキップ可能）
- 日本語を含む `.tsx` / `.ts` ファイルの編集は必ず Python スクリプト経由で UTF-8 書き込みを行うこと（`strReplace` 禁止）
- バックエンドは `backend/src/` 配下のみ編集すること（`backend/api/` は触らない）
- デプロイは git commit & push で Vercel 自動デプロイを使用する
