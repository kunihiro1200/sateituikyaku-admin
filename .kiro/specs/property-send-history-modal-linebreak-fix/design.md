# 売主・物件の送信履歴モーダル 改行表示バグ デザインドキュメント

## Overview

「売主・物件の送信履歴」モーダル（`SellerSendHistoryDetailModal.tsx`）において、
メール本文中の `<br>` タグがHTMLとして解釈されず、プレーンテキストとして
そのまま画面に表示されるバグを修正する。

修正方針は、本文表示部分に `dangerouslySetInnerHTML` を使用してHTMLとしてレンダリングし、
DOMPurify によるサニタイズでXSSリスクを防ぐ。

## Glossary

- **Bug_Condition (C)**: `<br>` タグを含むメール本文が、HTMLとして解釈されずプレーンテキストとして表示される条件
- **Property (P)**: `<br>` タグが改行としてレンダリングされ、メール本文が正しく表示される期待動作
- **Preservation**: モーダルの他の表示要素（件名・送信者・送信日時）および送信機能が変更されないこと
- **SellerSendHistoryDetailModal**: `frontend/frontend/src/components/SellerSendHistoryDetailModal.tsx` にある送信履歴詳細モーダルコンポーネント
- **item.message**: DBから取得したメール本文文字列。`<br>` タグを含む場合がある
- **dangerouslySetInnerHTML**: ReactでHTML文字列をDOMとしてレンダリングするためのプロパティ
- **DOMPurify**: XSS攻撃を防ぐためのHTMLサニタイズライブラリ

## Bug Details

### Bug Condition

本文表示部分が `{item.message}` というReactのテキストノードとして描画されているため、
`<br>` などのHTMLタグが文字列としてそのまま表示される。
`whiteSpace: 'pre-wrap'` が設定されているが、これはHTMLタグを解釈しない。

**Formal Specification:**
```
FUNCTION isBugCondition(message)
  INPUT: message of type string
  OUTPUT: boolean

  RETURN message CONTAINS '<br>'
         AND message IS RENDERED AS plain text node (NOT innerHTML)
         AND '<br>' IS NOT interpreted as HTML line break
END FUNCTION
```

### Examples

- **例1（バグあり）**: `item.message = "村尾和彦様<br><br>お世話になっております。<br>株式会社いふうです。"`
  - 現在の表示: `村尾和彦様<br><br>お世話になっております。<br>株式会社いふうです。`（タグがそのまま表示）
  - 期待する表示: 「村尾和彦様」の後に2行の空行、「お世話になっております。」が次の行に表示

- **例2（バグあり）**: `item.message = "物件番号: P001<br>価格: 3,000万円"`
  - 現在の表示: `物件番号: P001<br>価格: 3,000万円`
  - 期待する表示: 2行に分かれて表示

- **例3（バグなし）**: `item.message = "改行なしのメッセージ"`
  - 現在の表示: `改行なしのメッセージ`（正常）
  - 期待する表示: `改行なしのメッセージ`（変化なし）

- **エッジケース**: `item.message = "<script>alert('xss')</script>本文"`
  - 期待する表示: スクリプトタグはサニタイズされ、`本文` のみ表示（XSS防止）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 件名（`item.subject`）の表示は変更しない
- 送信者名（`item.sender_name`）の表示は変更しない
- 送信日時（`item.sent_at`）の表示は変更しない
- 実際のメール送信機能は影響を受けない
- モーダルの開閉動作は変更しない
- `<br>` を含まないメッセージの表示は変更しない

**スコープ:**
`<br>` タグを含まないメッセージ、およびモーダル内の本文以外の全要素は
このバグ修正の影響を受けない。

## Hypothesized Root Cause

`SellerSendHistoryDetailModal.tsx` の本文表示部分（約100行目付近）:

```tsx
<Box sx={{ mt: 0.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap', ... }}>
  {item.message}
</Box>
```

Reactは `{item.message}` をテキストノードとして描画するため、
`<br>` などのHTMLタグは文字列としてエスケープされる。

1. **Reactのデフォルト動作**: Reactは XSS 防止のため、JSX内の文字列を自動的にエスケープする。`{item.message}` は常にプレーンテキストとして扱われる。

2. **`whiteSpace: 'pre-wrap'` の限界**: このCSSプロパティは `\n`（改行文字）を改行として表示するが、`<br>` HTMLタグは解釈しない。

3. **DBに保存されたデータ形式**: メール送信時に `<br>` タグを含む形式でDBに保存されているが、表示側でHTMLとして解釈する処理がない。

## Correctness Properties

Property 1: Bug Condition - `<br>` タグのHTML解釈

_For any_ `item.message` where the bug condition holds (isBugCondition returns true, i.e., message contains `<br>`), the fixed `SellerSendHistoryDetailModal` SHALL render `<br>` as an HTML line break, displaying the text on separate lines instead of showing the literal `<br>` string.

**Validates: Requirements 2.1**

Property 2: Preservation - 非バグ条件の入力の動作保全

_For any_ `item.message` where the bug condition does NOT hold (isBugCondition returns false, i.e., message does NOT contain `<br>`), the fixed component SHALL produce the same rendered output as the original component, preserving all existing display behavior for messages without HTML tags.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/SellerSendHistoryDetailModal.tsx`

**Function/Component**: `SellerSendHistoryDetailModal`（本文表示部分）

**Specific Changes**:

1. **DOMPurify のインストール・インポート**:
   - `dompurify` パッケージを追加（`npm install dompurify @types/dompurify`）
   - コンポーネント先頭で `import DOMPurify from 'dompurify'` を追加

2. **サニタイズ関数の追加**:
   ```typescript
   // <br> タグのみ許可し、その他の危険なタグはサニタイズする
   const sanitizeMessage = (message: string): string => {
     return DOMPurify.sanitize(message, {
       ALLOWED_TAGS: ['br'],
       ALLOWED_ATTR: [],
     });
   };
   ```

3. **本文表示部分の変更**:
   ```tsx
   // 変更前
   <Box sx={{ mt: 0.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap', ... }}>
     {item.message}
   </Box>

   // 変更後
   <Box
     sx={{ mt: 0.5, wordBreak: 'break-word', backgroundColor: '#f5f5f5', ... }}
     dangerouslySetInnerHTML={{ __html: sanitizeMessage(item.message) }}
   />
   ```
   - `whiteSpace: 'pre-wrap'` は `dangerouslySetInnerHTML` と組み合わせると `<br>` と `\n` が二重に改行されるため削除する

4. **子要素の削除**: `dangerouslySetInnerHTML` を使用する場合、子要素を持てないため `{item.message}` テキストノードを削除する

5. **DOMPurify の設定**: `ALLOWED_TAGS: ['br']` により `<br>` のみ許可し、`<script>`・`<img>`・`<a>` などの危険なタグは除去する

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを再現するカウンターサンプルを確認し、
次に修正後のコードでバグが解消され、既存動作が保全されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `<br>` タグがプレーンテキストとして表示されることを確認し、根本原因を検証する。

**Test Plan**: `SellerSendHistoryDetailModal` に `<br>` を含む `item.message` を渡してレンダリングし、
DOMに `<br>` 文字列がテキストとして存在することを確認する。未修正コードで実行してバグを証明する。

**Test Cases**:
1. **基本的な `<br>` タグ**: `"村尾和彦様<br>お世話になっております。"` を渡し、`<br>` がテキストとして表示されることを確認（未修正コードで PASS）
2. **複数の `<br>` タグ**: `"行1<br><br>行3"` を渡し、`<br><br>` がテキストとして表示されることを確認（未修正コードで PASS）
3. **`<br>` なしのメッセージ**: `"改行なし"` を渡し、正常に表示されることを確認（未修正・修正後ともに PASS）
4. **XSSタグ**: `"<script>alert('xss')</script>本文"` を渡し、スクリプトが実行されないことを確認

**Expected Counterexamples**:
- `<br>` タグがHTMLとして解釈されず、`<br>` という文字列がそのまま表示される
- 原因: Reactの `{item.message}` テキストノードによる自動エスケープ

### Fix Checking

**Goal**: 修正後のコードで `<br>` タグが改行としてレンダリングされることを検証する。

**Pseudocode:**
```
FOR ALL message WHERE isBugCondition(message) DO
  result := render SellerSendHistoryDetailModal_fixed({ message })
  ASSERT DOM contains <br> element (not text "<br>")
  ASSERT text is split across multiple lines
END FOR
```

### Preservation Checking

**Goal**: `<br>` を含まないメッセージおよびモーダルの他の要素が変更されないことを検証する。

**Pseudocode:**
```
FOR ALL message WHERE NOT isBugCondition(message) DO
  ASSERT render(original, message) = render(fixed, message)
END FOR
```

**Testing Approach**: プロパティベーステストにより多様な入力パターンを自動生成し、
`<br>` を含まないメッセージの表示が変わらないことを保証する。

**Test Cases**:
1. **`<br>` なしメッセージの保全**: `<br>` を含まない任意の文字列で表示が変わらないことを確認
2. **件名・送信者・日時の保全**: `item.subject`・`item.sender_name`・`item.sent_at` の表示が変わらないことを確認
3. **XSSサニタイズの保全**: `<script>` タグが除去されることを確認（3.4の要件）
4. **空文字列の保全**: `item.message = ""` の場合に正常に表示されることを確認

### Unit Tests

- `<br>` タグを含むメッセージが改行としてレンダリングされることをテスト
- `<script>` タグがサニタイズされることをテスト
- `<br>` を含まないメッセージの表示が変わらないことをテスト
- `sanitizeMessage` 関数の単体テスト（許可タグ・禁止タグの検証）

### Property-Based Tests

- ランダムな文字列（`<br>` なし）を生成し、修正前後で表示が同一であることを検証
- ランダムな `<br>` 含有メッセージを生成し、DOMに `<br>` 要素が存在することを検証
- ランダムなHTMLタグを含む文字列を生成し、`<br>` 以外のタグが除去されることを検証

### Integration Tests

- 物件詳細ページ（`/properties/:id`）で送信履歴モーダルを開き、`<br>` が改行として表示されることを確認
- モーダルの開閉が正常に動作することを確認
- 件名・送信者・日時が正しく表示されることを確認
