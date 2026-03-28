# 実装計画: valuation-email-template-selector

## 概要

`CallModePage.tsx` の査定計算セクションにある「査定メール送信」ボタンを、テンプレート選択ドロップダウンに置き換える。`seller.valuationReason` に基づいて表示テンプレートを自動フィルタリングし、既存の `handleEmailTemplateSelect` を再利用する。

## タスク

- [x] 1. `getValuationEmailTemplates` 関数を実装する
  - `CallModePage.tsx` に `useCallback` でメモ化した `getValuationEmailTemplates` 関数を追加する
  - `seller?.valuationReason` に「相続」が含まれる場合は「査定額案内メール（相続）」のみを返す
  - 含まれない場合は「査定額案内メール（相続以外）」のみを返す
  - フィルタリング後0件の場合は `sellerEmailTemplates` 全体をフォールバックとして返す
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.1 `getValuationEmailTemplates` のプロパティベーステストを作成する
    - **Property 1: valuationReasonによるテンプレートフィルタリング**
    - **Validates: Requirements 2.1, 2.2**
    - `frontend/frontend/src/__tests__/valuation-email-template-selector.pbt.test.ts` を新規作成
    - fast-check を使用し、「相続」を含む任意の文字列に対して相続テンプレートのみが返されることを検証（numRuns: 100）

  - [ ]* 1.2 フォールバック動作のプロパティベーステストを作成する
    - **Property 2: フィルタリング結果0件時のフォールバック**
    - **Validates: Requirements 2.4**
    - 対象テンプレートが存在しない場合に全テンプレートが返されることを検証（numRuns: 100）

- [x] 2. 査定計算セクションのボタンを Select ドロップダウンに置き換える
  - `handleShowValuationEmailConfirm` の `onClick` ボタンを `FormControl` + `Select` に変更する
  - `onChange` で `handleEmailTemplateSelect(e.target.value)` を呼び出す
  - `disabled` 条件: `!seller?.email || sendingTemplate || sellerEmailTemplatesLoading`
  - `getValuationEmailTemplates()` の結果を `MenuItem` としてレンダリングする
  - `startAdornment` に `<Email />` アイコンを追加する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [ ] 4. `replaceEmailPlaceholders` のプロパティベーステストを作成する
  - [ ]* 4.1 プレースホルダー置換の完全性テストを作成する
    - **Property 3: プレースホルダー置換の完全性**
    - **Validates: Requirements 3.4**
    - `frontend/frontend/src/__tests__/valuation-email-template-selector.pbt.test.ts` に追加
    - 任意のテンプレート本文に対して `replaceEmailPlaceholders` 適用後に `<<...>>` が残らないことを検証（numRuns: 100）

- [x] 5. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## Notes

- タスク `*` はオプションであり、MVP優先の場合はスキップ可能
- 変更対象は `frontend/frontend/src/pages/CallModePage.tsx` の1ファイルのみ
- バックエンド変更は不要
- デプロイは `git push origin main` で自動デプロイされる
