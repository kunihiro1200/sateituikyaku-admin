# 設計ドキュメント：コメントクイックボタン カーソル位置挿入

## 概要

通話モードページ（`CallModePage`）のコメントセクションに配置されたクイックボタンを押したとき、テキストをコメントエディタの**カーソル位置（キャレット位置）**に挿入するよう機能を改善する。

現状の実装では `appendBoldText` 関数がコメントの先頭に常にテキストを追加している。本改善では、`RichTextCommentEditor` コンポーネントに `insertAtCursor` メソッドを追加し、`ref` 経由で `CallModePage` から呼び出せるようにする。カーソル位置が未設定の場合は先頭に挿入するフォールバック動作を維持する。

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/components/RichTextCommentEditor.tsx` | `insertAtCursor` メソッドを `ref` 経由で公開する |
| `frontend/frontend/src/pages/CallModePage.tsx` | `appendBoldText` の代わりに `commentEditorRef.current.insertAtCursor` を呼び出す |

### 変更しないファイル

| ファイル | 理由 |
|---------|------|
| `frontend/frontend/src/hooks/useCallModeQuickButtonState.ts` | クイックボタン状態管理は変更不要 |
| バックエンド全般 | フロントエンドのみの変更 |

### データフロー

```
ユーザーがコメントエディタをクリック
  ↓
contentEditable div にフォーカス・カーソル位置が確定
  ↓
ユーザーがクイックボタンをクリック
  ↓
CallModePage: handleQuickButtonClick(buttonId) → 状態管理
CallModePage: commentEditorRef.current.insertAtCursor(boldText) → 挿入
  ↓
RichTextCommentEditor: 保存済みの Selection を使ってカーソル位置に挿入
  ↓
onChange コールバックで editableComments を更新
```

---

## コンポーネントとインターフェース

### RichTextCommentEditor の拡張

#### 公開するハンドル型

```typescript
export interface RichTextCommentEditorHandle {
  /**
   * カーソル位置にHTMLテキストを挿入する。
   * カーソル位置が未設定の場合は先頭に挿入する。
   * @param html 挿入するHTML文字列（例: "<b>不通</b>"）
   */
  insertAtCursor: (html: string) => void;
}
```

#### 変更後のコンポーネントシグネチャ

```typescript
const RichTextCommentEditor = React.forwardRef<
  RichTextCommentEditorHandle,
  RichTextCommentEditorProps
>((props, ref) => { ... });
```

#### カーソル位置の保存戦略

`contentEditable` div はボタンクリック時にフォーカスを失う。そのため、`onBlur` イベントで `window.getSelection()` の `Range` オブジェクトを保存しておき、`insertAtCursor` 呼び出し時に復元して使用する。

```typescript
// onBlur 時に保存
const savedRangeRef = useRef<Range | null>(null);

const handleBlur = () => {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }
  setIsFocused(false);
};
```

#### insertAtCursor の実装方針

1. `savedRangeRef.current` が存在する場合 → Selection API で復元して挿入
2. 存在しない場合（フォールバック）→ コンテンツの先頭に挿入

```typescript
useImperativeHandle(ref, () => ({
  insertAtCursor: (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    if (savedRangeRef.current) {
      // カーソル位置に挿入
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRangeRef.current);

      const range = savedRangeRef.current;
      range.deleteContents();

      const fragment = range.createContextualFragment(html);
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);

      // カーソルを挿入テキストの直後に移動
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        savedRangeRef.current = range.cloneRange();
      }
    } else {
      // フォールバック: 先頭に挿入
      editor.innerHTML = html + (editor.innerHTML ? '<br>' + editor.innerHTML : '');
    }

    handleInput();
  },
}));
```

### CallModePage の変更

#### commentEditorRef の追加

```typescript
const commentEditorRef = useRef<RichTextCommentEditorHandle>(null);
```

#### appendBoldText の置き換え

既存の `appendBoldText` 関数を削除し、クイックボタンの `onClick` を以下のパターンに変更する：

```typescript
// 変更前
onClick={() => {
  handleQuickButtonClick('call-memo-unreachable');
  appendBoldText('不通');
}}

// 変更後
onClick={() => {
  handleQuickButtonClick('call-memo-unreachable');
  commentEditorRef.current?.insertAtCursor('<b>不通</b>');
}}
```

#### RichTextCommentEditor への ref 渡し

```typescript
<RichTextCommentEditor
  ref={commentEditorRef}
  value={editableComments}
  onChange={(html) => setEditableComments(html)}
  placeholder="コメントを入力してください..."
/>
```

---

## データモデル

### 新規追加の型定義

```typescript
// RichTextCommentEditor.tsx に追加
export interface RichTextCommentEditorHandle {
  insertAtCursor: (html: string) => void;
}
```

### 既存の状態管理（変更なし）

| 状態 | 型 | 説明 |
|------|-----|------|
| `editableComments` | `string` | コメントのHTML文字列 |
| `disabledButtons` | `Map<string, ButtonState>` | クイックボタンの無効化状態 |

### 新規追加の内部状態（RichTextCommentEditor）

| 状態 | 型 | 説明 |
|------|-----|------|
| `savedRangeRef` | `React.MutableRefObject<Range \| null>` | onBlur 時に保存したカーソル位置 |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*


### Property 1: カーソル位置への挿入と書式維持

*任意の* コメント内容と任意のカーソル位置に対して、`insertAtCursor('<b>テキスト</b>')` を呼び出した場合、エディタのHTMLはカーソル位置に `<b>テキスト</b>` が挿入された状態になり、かつ挿入後のカーソルは挿入テキストの直後に位置する。

**Validates: Requirements 1.1, 1.3, 1.5, 2.3**

### Property 2: フォールバック動作（先頭挿入）

*任意の* コメント内容に対して、カーソル位置が未設定の状態（`savedRange` が null）で `insertAtCursor('<b>テキスト</b>')` を呼び出した場合、挿入されたHTMLはコメントの先頭に `<b>テキスト</b>` を含む。

**Validates: Requirements 1.2**

### Property 3: クイックボタン状態管理の維持

*任意の* ボタンIDに対して、クイックボタンをクリックした後は `pending` 状態になり、保存操作後は `persisted` 状態になる。この動作は `insertAtCursor` の追加後も変わらない。

**Validates: Requirements 2.1**

---

## エラーハンドリング

### editorRef が null の場合

`insertAtCursor` 呼び出し時に `editorRef.current` が null の場合は何もしない（早期リターン）。コンポーネントがアンマウントされた後の呼び出しを安全に無視する。

### createContextualFragment が失敗する場合

不正なHTML文字列が渡された場合、`createContextualFragment` が例外をスローする可能性がある。`try-catch` でラップし、フォールバックとして `innerHTML` への直接代入を行う。

### Selection API が利用できない場合

`window.getSelection()` が null を返す古いブラウザ環境では、フォールバック動作（先頭挿入）を使用する。

---

## テスト戦略

### デュアルテストアプローチ

- **ユニットテスト**: 特定の例・エッジケース・エラー条件を検証
- **プロパティテスト**: 全入力に対して成立する普遍的プロパティを検証

### ユニットテスト（具体例）

- `insertAtCursor` メソッドが `ref` 経由で公開されていることを確認（要件 1.4）
- 空のコメントに対してテキストを挿入した場合の動作確認
- `savedRange` が null の場合のフォールバック動作確認

### プロパティテスト

**使用ライブラリ**: `fast-check`（TypeScript/JavaScript 向け PBT ライブラリ）

**最小実行回数**: 各プロパティテストは 100 回以上実行する

**タグ形式**: `// Feature: comment-quick-button-cursor-insert, Property {番号}: {プロパティ内容}`

#### Property 1 のテスト実装方針

```typescript
// Feature: comment-quick-button-cursor-insert, Property 1: カーソル位置への挿入と書式維持
fc.assert(
  fc.property(
    fc.string(), // 任意のコメント内容
    fc.string(), // 任意の挿入テキスト
    (existingContent, insertText) => {
      // コンポーネントをレンダリングし、savedRangeを設定した状態で
      // insertAtCursor('<b>' + insertText + '</b>') を呼び出す
      // 結果のHTMLに '<b>' + insertText + '</b>' が含まれることを確認
    }
  ),
  { numRuns: 100 }
);
```

#### Property 2 のテスト実装方針

```typescript
// Feature: comment-quick-button-cursor-insert, Property 2: フォールバック動作（先頭挿入）
fc.assert(
  fc.property(
    fc.string(), // 任意のコメント内容
    fc.string(), // 任意の挿入テキスト
    (existingContent, insertText) => {
      // savedRange が null の状態で insertAtCursor を呼び出す
      // 結果のHTMLが '<b>' + insertText + '</b>' で始まることを確認
    }
  ),
  { numRuns: 100 }
);
```

#### Property 3 のテスト実装方針

```typescript
// Feature: comment-quick-button-cursor-insert, Property 3: クイックボタン状態管理の維持
fc.assert(
  fc.property(
    fc.string(), // 任意のボタンID
    (buttonId) => {
      // handleQuickButtonClick(buttonId) を呼び出す
      // getButtonState(buttonId) === 'pending' を確認
      // handleSave() を呼び出す
      // getButtonState(buttonId) === 'persisted' を確認
    }
  ),
  { numRuns: 100 }
);
```
