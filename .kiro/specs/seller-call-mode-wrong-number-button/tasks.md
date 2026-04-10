# 実装計画: 電話番号間違いボタン（seller-call-mode-wrong-number-button）

## 概要

`frontend/frontend/src/pages/CallModePage.tsx` に「電話番号間違い」ボタンを追加する。
バックエンド変更なし。純粋関数3つ・state1つ・ハンドラー1つ・JSX追加のみ。

## タスク

- [x] 1. 純粋関数の実装
  - `isTargetTemplateForWrongNumber(label: string): boolean` を実装する
  - `generateWrongNumberText(phoneNumber: string | null | undefined): string` を実装する
  - `insertWrongNumberText(body: string, insertionText: string): string` を実装する
  - CallModePage.tsx 内にエクスポート関数として追加する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [ ]* 1.1 プロパティテスト: 対象テンプレート判定の正確性（Property 1）
    - **Property 1: 対象テンプレート判定の正確性**
    - fast-check で任意のラベル文字列に対して `isTargetTemplateForWrongNumber` の結果を検証する
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 1.2 プロパティテスト: 挿入文の電話番号置換（Property 2）
    - **Property 2: 挿入文の電話番号置換**
    - fast-check で任意の非空電話番号に対して `generateWrongNumberText` が電話番号を含み「●●●●～」を含まないことを検証する
    - **Validates: Requirements 2.2**

  - [ ]* 1.3 プロパティテスト: 未設定電話番号のフォールバック（Property 3）
    - **Property 3: 未設定電話番号のフォールバック**
    - fast-check で空文字・null・undefined に対して `generateWrongNumberText` が「（電話番号未登録）」を含むことを検証する
    - **Validates: Requirements 2.3**

  - [ ]* 1.4 プロパティテスト: トリガー直後への挿入（Property 4）
    - **Property 4: トリガー直後への挿入**
    - fast-check で任意のトリガーを含む本文に対して `insertWrongNumberText` がトリガー直後に `<br>` + 挿入文を追加することを検証する
    - **Validates: Requirements 2.1, 2.7**

  - [ ]* 1.5 プロパティテスト: トリガー不在時の末尾挿入（Property 6）
    - **Property 6: トリガー不在時の末尾挿入**
    - fast-check でトリガーを含まない本文に対して `insertWrongNumberText` が末尾に挿入することを検証する
    - **Validates: Requirements 2.5**

- [x] 2. state・ハンドラーの追加とJSX実装
  - `wrongNumberButtonDisabled` state（boolean）を追加する
  - ダイアログを閉じる処理（`handleCancelSend` および送信完了後）で `setWrongNumberButtonDisabled(false)` を呼び出す
  - `handleWrongNumberButtonClick` ハンドラーを実装する
  - 「電話番号間違い」ボタンを「画像を添付」ボタンの下・Alertの上に配置する
  - 対象テンプレートの場合のみボタンを表示する（`isTargetTemplateForWrongNumber` を使用）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.6, 3.1, 3.2_

  - [ ]* 2.1 ユニットテスト: ボタンの表示・非表示
    - 対象テンプレート選択時にボタンが表示されること
    - 非対象テンプレート選択時にボタンが表示されないこと
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.2 ユニットテスト: ボタンクリック後の動作
    - ボタンクリック後に `disabled` になること（要件2.6）
    - ボタンクリック後に `editableEmailBody` が更新されること（要件3.1）
    - 送信先・件名が変更されないこと（要件3.2）
    - _Requirements: 2.6, 3.1, 3.2_

- [x] 3. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` 付きのサブタスクはオプション（スキップ可能）
- 日本語を含むファイルの編集は Pythonスクリプトを使用してUTF-8安全に行うこと（file-encoding-protection.md 参照）
- 変更対象ファイルは `frontend/frontend/src/pages/CallModePage.tsx` のみ
- バックエンド変更は不要
