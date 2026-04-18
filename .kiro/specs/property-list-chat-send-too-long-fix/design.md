# 物件リストCHAT送信メッセージ長すぎエラー修正 Bugfix Design

## Overview

物件リスト画面の「物件担当へCHAT送信」機能において、Google Chat APIの4096文字制限を超えるメッセージを送信するとHTTP 400エラーが発生するバグを修正する。

現在のコード（`a50d38ad`コミット）では `fullText.length > 4000` で切り捨てているが、`'...'` を追加すると4003文字になる可能性があり、また画像URLを追加した後に制限を超えるケースも残っている。

修正方針：`chatMessageBody`（本文）と `imageUrlLine`（画像URL行）を結合した `fullText` 全体を、確実に4096文字以内に収まるよう切り捨てる。

対象ファイル：`frontend/frontend/src/components/PriceSection.tsx`
対象関数：`handleSendPriceReductionChat`

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `fullText`（本文＋画像URL）が4096文字を超える場合
- **Property (P)**: 期待される正しい動作 — 送信前に `fullText` を確実に4096文字以内に切り捨て、HTTP 400エラーなく送信できること
- **Preservation**: 修正によって変えてはいけない既存の動作 — 4096文字以内のメッセージはそのまま送信されること、その他の送信成功・失敗フローが変わらないこと
- **fullText**: `chatMessageBody`（本文）と `imageUrlLine`（画像URL行）を結合した最終送信テキスト
- **GOOGLE_CHAT_LIMIT**: Google Chat APIの文字数制限 = 4096文字
- **TRUNCATE_SUFFIX**: 切り捨て時に末尾に付加する文字列 = `'...'`（3文字）
- **SAFE_LIMIT**: 切り捨て後に `'...'` を付加しても4096文字以内に収まる最大文字数 = 4093文字

## Bug Details

### Bug Condition

バグは `handleSendPriceReductionChat` 関数内で、`fullText`（本文＋画像URL）が4096文字を超えるときに発生する。現在の切り捨てロジックは以下の問題を持つ：

1. `fullText.length > 4000` で切り捨て後に `'...'` を追加すると最大4003文字になる（4096文字制限内だが意図が不明確）
2. `chatMessageBody` 単体が4000文字を超えている場合、`imageUrlLine` を追加した後の `fullText` が4096文字を超える可能性がある
3. 切り捨て基準が `fullText` 全体ではなく `chatMessageBody` のみを対象にしていた（旧コードの名残）

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input = { chatMessageBody: string, selectedImageUrl: string | undefined }
  OUTPUT: boolean

  imageUrlLine := selectedImageUrl ? '\n📷 ' + selectedImageUrl : ''
  fullText := chatMessageBody + imageUrlLine

  RETURN fullText.length > 4096
         AND truncatedText.length > 4096
         // truncatedText = fullText.length > 4000 ? fullText.substring(0, 4000) + '...' : fullText
END FUNCTION
```

### Examples

- **例1（バグあり）**: `chatMessageBody` が4001文字 → `fullText.substring(0, 4000) + '...'` = 4003文字 → 4096文字以内なので送信成功（ただし意図しない動作）
- **例2（バグあり）**: `chatMessageBody` が3990文字 + `imageUrlLine` が110文字 → `fullText` = 4100文字 → 切り捨て後4003文字 → 4096文字以内なので送信成功（ただし画像URLが途中で切れる）
- **例3（バグあり・HTTP 400）**: `chatMessageBody` が4090文字 + `imageUrlLine` が10文字 → `fullText` = 4100文字 → `fullText.length > 4000` なので `fullText.substring(0, 4000) + '...'` = 4003文字 → 送信成功（ただし画像URLが消える）
- **例4（バグあり・HTTP 400の可能性）**: `chatMessageBody` が4094文字（画像URLなし）→ `fullText.length > 4000` → `fullText.substring(0, 4000) + '...'` = 4003文字 → 送信成功（ただし4096文字制限内）
- **実際のHTTP 400ケース**: `chatMessageBody` が4094文字 + `imageUrlLine` が5文字 → `fullText` = 4099文字 → 切り捨て後4003文字 → 送信成功（このケースは実は問題ない）
- **真のHTTP 400ケース**: 切り捨てロジックが `fullText` ではなく `chatMessageBody` のみに適用されていた旧コードや、`'...'` 追加後に4096文字を超えるケース

## Expected Behavior

### Preservation Requirements

**変えてはいけない動作：**
- `fullText`（本文＋画像URL）が4096文字以内の場合、メッセージを切り捨てなしにそのまま送信する
- 値下げ履歴が存在しない場合、「値下げ履歴が見つかりません」エラーを表示し送信しない
- 画像が添付されていない場合、テキストのみのメッセージを送信する
- 送信が成功した場合、「値下げ通知を送信しました」の成功メッセージを表示する
- 送信後に `selectedImageUrl` と `chatMessageBody` をリセットする

**スコープ：**
`fullText` が4096文字以内のすべての入力は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

バグの根本原因として以下が考えられる：

1. **切り捨て基準の誤り**: `fullText.length > 4000` という閾値が不正確。`'...'`（3文字）を追加することを考慮すると、切り捨て基準は `fullText.length > 4093` であるべき（4093文字で切り捨て + `'...'` = 4096文字）

2. **切り捨て後の文字数保証がない**: `fullText.substring(0, 4000) + '...'` は最大4003文字になるが、これが4096文字制限内に収まることは偶然であり、意図的な設計ではない

3. **画像URL追加後の再チェックがない**: `chatMessageBody` を切り捨てた後に `imageUrlLine` を追加するフローだった場合、追加後に4096文字を超える可能性がある（現在のコードでは `fullText` を先に作ってから切り捨てているため、このケースは修正済みだが切り捨て基準が不正確）

4. **定数化されていない**: `4000`、`4096` などのマジックナンバーが散在しており、意図が不明確

## Correctness Properties

Property 1: Bug Condition - 送信テキストが確実に4096文字以内に収まる

_For any_ 入力において `fullText`（本文＋画像URL）が4096文字を超える場合、修正後の `handleSendPriceReductionChat` 関数は送信テキストを確実に4096文字以内に切り捨て（末尾に `'...'` を付加する場合は4093文字で切り捨て）、HTTP 400エラーなくGoogle Chat APIへの送信を完了する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 4096文字以内のメッセージは切り捨てなし

_For any_ 入力において `fullText`（本文＋画像URL）が4096文字以内の場合、修正後の関数は元の `fullText` をそのまま送信テキストとして使用し、切り捨てや文字の変更を一切行わない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/PriceSection.tsx`

**Function**: `handleSendPriceReductionChat`

**Specific Changes**:

1. **定数の定義**: マジックナンバーを定数化して意図を明確にする
   - `GOOGLE_CHAT_LIMIT = 4096`
   - `TRUNCATE_SUFFIX = '...'`
   - `SAFE_LIMIT = GOOGLE_CHAT_LIMIT - TRUNCATE_SUFFIX.length` (= 4093)

2. **切り捨てロジックの修正**: `fullText.length > 4000` を `fullText.length > GOOGLE_CHAT_LIMIT` に変更し、切り捨て後の文字数が確実に4096文字以内になるよう修正
   ```typescript
   const GOOGLE_CHAT_LIMIT = 4096;
   const TRUNCATE_SUFFIX = '...';
   const SAFE_LIMIT = GOOGLE_CHAT_LIMIT - TRUNCATE_SUFFIX.length; // 4093

   const imageUrlLine = selectedImageUrl ? `\n📷 ${selectedImageUrl}` : '';
   const fullText = `${chatMessageBody}${imageUrlLine}`;
   const truncatedText = fullText.length > GOOGLE_CHAT_LIMIT
     ? fullText.substring(0, SAFE_LIMIT) + TRUNCATE_SUFFIX
     : fullText;
   ```

3. **切り捨て後の文字数保証**: `fullText.substring(0, SAFE_LIMIT) + TRUNCATE_SUFFIX` により、切り捨て後は必ず `SAFE_LIMIT + 3 = 4096` 文字以内になる

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず未修正コードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグが発生することを確認し、根本原因を特定する。

**Test Plan**: `handleSendPriceReductionChat` 関数の切り捨てロジックを直接テストし、4096文字を超えるケースで正しく切り捨てられないことを確認する。

**Test Cases**:
1. **4097文字テスト**: `fullText` が4097文字の場合、現在のコードでは `fullText.substring(0, 4000) + '...'` = 4003文字になり、4096文字制限内に収まるが切り捨て基準が不正確（will demonstrate incorrect threshold）
2. **4094文字テスト**: `fullText` が4094文字の場合、現在のコードでは切り捨てなし（4000文字以下ではないため）→ 4094文字のまま送信 → 4096文字制限内なので成功するが、境界値が不明確
3. **4096文字テスト**: `fullText` がちょうど4096文字の場合、現在のコードでは切り捨てなし → 4096文字のまま送信 → 制限ちょうどなので成功
4. **4097文字テスト（境界値）**: `fullText` が4097文字の場合、現在のコードでは `fullText.substring(0, 4000) + '...'` = 4003文字 → 送信成功するが、97文字が失われる

**Expected Counterexamples**:
- 現在のコードは `> 4000` という閾値を使用しており、4001〜4096文字の範囲で不必要な切り捨てが発生する
- `'...'` を追加した後の文字数が4096文字を超えないことは偶然であり、保証されていない

### Fix Checking

**Goal**: 修正後のコードで、`fullText` が4096文字を超えるすべての入力に対して正しく切り捨てられることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  imageUrlLine := input.selectedImageUrl ? '\n📷 ' + input.selectedImageUrl : ''
  fullText := input.chatMessageBody + imageUrlLine
  truncatedText := fixedTruncateLogic(fullText)
  ASSERT truncatedText.length <= 4096
  ASSERT truncatedText.endsWith('...')
  ASSERT truncatedText.length == 4096  // 4093文字 + '...' = 4096文字
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、`fullText` が4096文字以内のすべての入力に対して元のテキストがそのまま使用されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  imageUrlLine := input.selectedImageUrl ? '\n📷 ' + input.selectedImageUrl : ''
  fullText := input.chatMessageBody + imageUrlLine
  ASSERT fullText.length <= 4096
  truncatedText_original := originalTruncateLogic(fullText)
  truncatedText_fixed := fixedTruncateLogic(fullText)
  ASSERT truncatedText_original == truncatedText_fixed == fullText
END FOR
```

**Testing Approach**: プロパティベーステストが保持チェックに推奨される理由：
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストが見逃すエッジケースを検出できる
- 非バグ入力に対して動作が変わらないことを強く保証できる

**Test Cases**:
1. **短いメッセージの保持**: 100文字のメッセージが切り捨てなしにそのまま送信されることを確認
2. **4096文字ちょうどの保持**: 4096文字のメッセージが切り捨てなしにそのまま送信されることを確認
3. **画像URLなしの保持**: 画像URLなしのメッセージが正しく処理されることを確認
4. **画像URLありの保持**: 画像URLを含む4096文字以内のメッセージが切り捨てなしに送信されることを確認

### Unit Tests

- 4097文字の `fullText` が4096文字以内に切り捨てられることをテスト
- 4096文字の `fullText` が切り捨てなしにそのまま使用されることをテスト
- 切り捨て後のテキストが `'...'` で終わることをテスト
- 切り捨て後のテキストがちょうど4096文字であることをテスト
- 画像URLを含む `fullText` が正しく切り捨てられることをテスト

### Property-Based Tests

- ランダムな長さの `chatMessageBody` と `selectedImageUrl` を生成し、`truncatedText.length <= 4096` が常に成立することを検証
- `fullText.length <= 4096` の場合、`truncatedText === fullText` が常に成立することを検証
- `fullText.length > 4096` の場合、`truncatedText.endsWith('...')` が常に成立することを検証

### Integration Tests

- 実際のダイアログUIで長いメッセージを入力し、送信ボタンを押してHTTP 400エラーが発生しないことを確認
- 画像URLを添付した状態で長いメッセージを送信し、エラーが発生しないことを確認
- 短いメッセージ（4096文字以内）が切り捨てなしに送信されることを確認
