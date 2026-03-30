# 実装計画：買主リスト「初動担当」条件付き必須機能

## 概要

受付日が2026/3/30以降の買主レコードで、`inquiry_email_phone` または `inquiry_hearing` が変更された場合に `initial_assignee` を必須とする機能を実装する。変更前の値を `useRef` で保持し、保存時に条件判定を行う。

## タスク

- [x] 1. BuyerDetailPage に変更前の値を保持する ref を追加する
  - `initialInquiryEmailPhoneRef` と `initialInquiryHearingRef` を `useRef<string>('')` で宣言する
  - `fetchBuyer()` 完了時に両 ref に初期値を記録する処理を追加する
  - 既存の `fetchBuyer` 内の初期値セット処理（`setHearingEditValue` 等）の直後に追記する
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 2. 条件付き必須判定ヘルパー関数を実装する
  - [x] 2.1 `isInitialAssigneeConditionallyRequired` 関数を BuyerDetailPage に追加する
    - 受付日が `2026-03-30` 未満なら `false` を返す
    - `inquiry_email_phone` が変更されていれば `true` を返す
    - `inquiry_hearing` が変更されかつ空でなければ `true` を返す
    - `changedFields` と両 ref の値を比較して「変更あり」を判定する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 `isInitialAssigneeConditionallyRequired` のプロパティテストを書く（fast-check）
    - **Property 1: 受付日カットオフ前は条件付き必須が発動しない**
    - **Validates: Requirements 1.3, 4.3**

  - [ ]* 2.3 `isInitialAssigneeConditionallyRequired` のプロパティテストを書く（fast-check）
    - **Property 2: inquiry_email_phone 変更時の必須発動**
    - **Validates: Requirements 1.1, 2.1, 2.3**

  - [ ]* 2.4 `isInitialAssigneeConditionallyRequired` のプロパティテストを書く（fast-check）
    - **Property 3: inquiry_hearing 変更かつ空でない場合の必須発動**
    - **Validates: Requirements 1.2, 2.2, 2.4**

  - [ ]* 2.5 `isInitialAssigneeConditionallyRequired` のプロパティテストを書く（fast-check）
    - **Property 4: inquiry_hearing が空に変更された場合は発動しない**
    - **Validates: Requirements 1.2**

  - [ ]* 2.6 `isInitialAssigneeConditionallyRequired` のプロパティテストを書く（fast-check）
    - **Property 5: 変更なしの場合は発動しない**
    - **Validates: Requirements 1.4, 2.3, 2.4**

- [x] 3. checkMissingFields を拡張して条件付き必須チェックを統合する
  - [x] 3.1 `checkMissingFields` 内の `initial_assignee` チェックを拡張する
    - 既存の常時必須チェック（`!buyer.initial_assignee`）と条件付き必須チェックを1つの `if` ブロックに統合する
    - `sectionChangedFields` を集約した `allChangedFields` を生成して `isInitialAssigneeConditionallyRequired` に渡す
    - `initial_assignee` が `missingKeys` に2回追加されないことを保証する
    - _Requirements: 1.5, 3.1, 3.2, 3.3, 5.1, 5.2_

  - [ ]* 3.2 `checkMissingFields` の重複追加なしプロパティテストを書く（fast-check）
    - **Property 6: initial_assignee の重複追加なし**
    - **Validates: Requirements 5.2**

  - [ ]* 3.3 既存の必須フィールドバリデーション保護のプロパティテストを書く（fast-check）
    - **Property 9: 既存の必須フィールドバリデーションの保護**
    - **Validates: Requirements 5.1, 5.3**

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 5. BuyerDetailPage の変更を Pythonスクリプトで適用する
  - [x] 5.1 `fix_buyer_initial_assignee_detail.py` を作成する
    - `BuyerDetailPage.tsx` を UTF-8 で読み込み、以下の変更を適用して UTF-8 で書き戻す
    - ref 宣言（`initialInquiryEmailPhoneRef`, `initialInquiryHearingRef`）を追加する
    - `fetchBuyer` 内に初期値記録処理を追加する
    - `isInitialAssigneeConditionallyRequired` 関数を追加する
    - `checkMissingFields` の `initial_assignee` チェックを拡張する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 6.2_

  - [x] 5.2 `getDiagnostics` でエンコーディングエラーがないことを確認する
    - _Requirements: 6.3_

- [x] 6. NewBuyerPage に条件付き必須バリデーションを追加する
  - [x] 6.1 `fix_buyer_initial_assignee_new.py` を作成する
    - `NewBuyerPage.tsx` を UTF-8 で読み込み、以下の変更を適用して UTF-8 で書き戻す
    - `handleSubmit` 内の既存バリデーション（`!name` チェック）の直後に条件付き必須チェックを追加する
    - 受付日が `2026-03-30` 以降かつ `inquiryEmailPhone` または `inquiryHearing` が入力済みかつ `initialAssignee` が空の場合にエラーを設定して `return` する
    - エラーメッセージ: `「初動担当は必須です（受付日2026/3/30以降かつ問合メール電話対応または問合時ヒアリングが入力されている場合）」`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2_

  - [x] 6.2 `getDiagnostics` でエンコーディングエラーがないことを確認する
    - _Requirements: 6.3_

  - [ ]* 6.3 NewBuyerPage バリデーションのプロパティテストを書く（fast-check）
    - **Property 7: 新規登録画面での条件付き必須**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 6.4 NewBuyerPage カットオフ前スキップのプロパティテストを書く（fast-check）
    - **Property 8: 新規登録画面でのカットオフ前スキップ**
    - **Validates: Requirements 4.3**

- [x] 7. 最終チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプション（スキップ可能）
- 日本語を含む `.tsx` ファイルの編集は必ず Pythonスクリプト経由で行う（`strReplace` 直接編集禁止）
- デプロイは `git add . && git commit -m "..." && git push origin main` のみ
- `buyer_number` が主キー（`id` や `buyer_id` は存在しない）
- プロパティテストは fast-check を使用し、各テストに `// Feature: buyer-initial-assignee-required, Property N: ...` タグコメントを付与する
