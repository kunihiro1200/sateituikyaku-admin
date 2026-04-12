# 実装計画: 依頼前に確認ポップアップ

## 概要

`WorkTaskDetailModal.tsx` 内の `ContractSettlementSection` にある `EditableMultilineField label="依頼前に確認"` を、`PreRequestCheckButton` + `PreRequestCheckPopup` に置き換える。変更対象ファイルは1つのみ。

## タスク

- [x] 1. `WorkTaskDetailModal.tsx` の現在の実装を確認し、`PreRequestCheckPopup` コンポーネントを追加する
  - `WorkTaskDetailModal.tsx` を読み込み、`EditableMultilineField` の定義箇所と `ContractSettlementSection` の構造を確認する
  - `PreRequestCheckPopupProps` インターフェースを定義する（`open: boolean`, `text: string`, `onClose: () => void`）
  - `PreRequestCheckPopup` コンポーネントをインラインで実装する（MUI `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions` 使用）
  - `DialogContent` に `maxHeight: '60vh'`, `overflowY: 'auto'` を設定してスクロール対応
  - `Typography` に `whiteSpace: 'pre-wrap'`, `wordBreak: 'break-word'` を設定して改行・長文対応
  - 「閉じる」ボタンと `onClose` prop によるバックドロップクリックでダイアログを閉じる
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 2. `PreRequestCheckButton` コンポーネントを実装し、`EditableMultilineField` を置き換える
  - [x] 2.1 `PreRequestCheckButton` コンポーネントを実装する
    - `useState<boolean>` でポップアップ開閉状態（`popupOpen`）を管理する
    - `Grid` コンテナ内に「依頼前に確認」ラベルと「確認する」ボタンを配置する
    - `disabled={!getValue('pre_request_check')}` でボタンの有効/無効を制御する（null/undefined/空文字列で無効化）
    - ボタンクリックで `setPopupOpen(true)`、`PreRequestCheckPopup` の `onClose` で `setPopupOpen(false)`
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.2 `PreRequestCheckButton` のボタン有効/無効ロジックのプロパティテストを書く
    - **Property 1: 空値でボタンが無効化される**
    - **Validates: Requirements 1.2**
    - **Property 2: 非空値でボタンが有効化される**
    - **Validates: Requirements 1.3**

  - [x] 2.3 `ContractSettlementSection` 内の `EditableMultilineField label="依頼前に確認" field="pre_request_check"` を `PreRequestCheckButton` に置き換える
    - 他のフィールド（「重説・契約書入力納期*」「コメント（売買契約）」等）のレイアウトに影響がないことを確認する
    - _Requirements: 1.4, 3.3_

  - [ ]* 2.4 テキスト表示のプロパティテストを書く
    - **Property 3: テキスト内容がポップアップに表示される**
    - **Validates: Requirements 2.2**
    - **Property 4: 改行が正しく表示される**
    - **Validates: Requirements 2.4**

- [x] 3. チェックポイント - ビルドエラーがないことを確認する
  - `getDiagnostics` で型エラー・構文エラーがないことを確認する。問題があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- `pre_request_check` フィールドの編集機能はポップアップ内では提供しない（読み取り専用表示のみ）
- バックエンド変更なし、`WorkTaskDetailModal.tsx` のみを変更する
