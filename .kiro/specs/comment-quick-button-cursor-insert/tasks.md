# 実装計画：コメントクイックボタン カーソル位置挿入

## 概要

`RichTextCommentEditor` に `insertAtCursor` メソッドを追加し、`CallModePage` のクイックボタンがカーソル位置にテキストを挿入するよう改善する。変更対象は2ファイルのみ（フロントエンドのみ）。

## タスク

- [x] 1. `RichTextCommentEditor` に `insertAtCursor` を実装する
  - [x] 1.1 `RichTextCommentEditorHandle` インターフェースを定義してエクスポートする
    - `insertAtCursor(html: string): void` メソッドを持つ型を定義
    - `RichTextCommentEditor.tsx` の先頭付近に追加
    - _要件: 1.4_

  - [x] 1.2 `savedRangeRef` を追加し、`onBlur` でカーソル位置を保存する
    - `useRef<Range | null>(null)` で `savedRangeRef` を宣言
    - `handleBlur` 内で `window.getSelection()` の `Range` を `cloneRange()` して保存
    - _要件: 1.1, 1.5_

  - [x] 1.3 `React.forwardRef` でコンポーネントをラップし、`useImperativeHandle` で `insertAtCursor` を公開する
    - コンポーネントを `React.forwardRef<RichTextCommentEditorHandle, RichTextCommentEditorProps>` に変更
    - `useImperativeHandle` で `insertAtCursor` を実装
      - `savedRangeRef.current` がある場合: Selection API で復元し `createContextualFragment` で挿入、カーソルを挿入テキスト直後に移動
      - `savedRangeRef.current` がない場合（フォールバック）: `editor.innerHTML = html + '<br>' + editor.innerHTML`
      - `try-catch` でエラーハンドリング（フォールバックとして `innerHTML` 直接代入）
      - 挿入後に `handleInput()` を呼び出して `onChange` を発火
    - _要件: 1.1, 1.2, 1.3, 1.5_

  - [ ]* 1.4 `insertAtCursor` のプロパティテストを書く（fast-check）
    - **Property 1: カーソル位置への挿入と書式維持**
    - **Validates: 要件 1.1, 1.3, 1.5, 2.3**
    - テストファイル: `frontend/frontend/src/components/__tests__/RichTextCommentEditor.test.tsx`
    - `savedRange` が設定された状態で任意のHTML文字列を挿入し、結果のHTMLに挿入テキストが含まれることを確認

  - [ ]* 1.5 フォールバック動作のプロパティテストを書く（fast-check）
    - **Property 2: フォールバック動作（先頭挿入）**
    - **Validates: 要件 1.2**
    - `savedRange` が null の状態で `insertAtCursor` を呼び出し、結果のHTMLが挿入テキストで始まることを確認

- [x] 2. チェックポイント - `RichTextCommentEditor` の動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 3. `CallModePage` を `insertAtCursor` を使うよう更新する
  - [x] 3.1 `commentEditorRef` を追加し、`RichTextCommentEditor` に `ref` を渡す
    - `useRef<RichTextCommentEditorHandle>(null)` で `commentEditorRef` を宣言
    - `RichTextCommentEditorHandle` を `RichTextCommentEditor.tsx` からインポート
    - `<RichTextCommentEditor>` に `ref={commentEditorRef}` を追加
    - _要件: 1.4_

  - [x] 3.2 クイックボタンの `onClick` を `appendBoldText` から `insertAtCursor` に置き換える
    - 全クイックボタンの `onClick` を `commentEditorRef.current?.insertAtCursor('<b>テキスト</b>')` に変更
    - `appendBoldText` 関数を削除
    - _要件: 1.1, 1.2, 2.1, 2.2, 2.3_

  - [ ]* 3.3 クイックボタン状態管理のプロパティテストを書く（fast-check）
    - **Property 3: クイックボタン状態管理の維持**
    - **Validates: 要件 2.1**
    - 任意のボタンIDに対して `handleQuickButtonClick` 後に `pending` 状態になることを確認
    - テストファイル: `frontend/frontend/src/hooks/__tests__/useCallModeQuickButtonState.test.ts`

- [x] 4. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- タスク `*` はオプションのテストタスクです。MVPを優先する場合はスキップ可能です。
- バックエンドへの変更は不要です。
- 各タスクは前のタスクの成果物を前提としています。
