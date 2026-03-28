# 買主Gmail・SMS内覧前伝達事項バグ修正 設計ドキュメント

## Overview

買主リストのGmail送信・SMS送信機能において、「内覧前伝達事項」（`<<内覧前伝達事項v>>`プレースホルダー）のテキストが送信内容に含まれないバグを修正する。

バグは2箇所に独立して存在する：
1. **Gmail送信**: `EmailTemplateService.mergeAngleBracketPlaceholders()` が `<<内覧前伝達事項v>>` を無条件に空文字へ置換している
2. **SMS送信**: `SmsDropdownButton.tsx` のメッセージテンプレートに内覧前伝達事項の差し込みロジックが存在しない

修正方針は最小限の変更に留め、既存の他プレースホルダー処理・SMS履歴記録ロジックへの影響を排除する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 買主の内覧前伝達事項フィールドに値が入力されているにもかかわらず、送信内容に含まれない状態
- **Property (P)**: 期待される正しい動作 — 内覧前伝達事項の値が送信内容の適切な位置に含まれること
- **Preservation**: 修正によって変更してはならない既存動作 — 他プレースホルダーの置換処理、SMS履歴記録ロジック、SUUMO URL空文字置換
- **mergeAngleBracketPlaceholders**: `backend/src/services/EmailTemplateService.ts` 内の関数。`<<>>` 形式のプレースホルダーを実際のデータで置換する
- **SmsDropdownButton**: `frontend/frontend/src/components/SmsDropdownButton.tsx` 内のコンポーネント。SMSテンプレートを選択して送信するUI
- **pre_viewing_notes**: 買主テーブルの内覧前伝達事項カラム（DBカラム名）
- **内覧前伝達事項v**: メールテンプレート・SMSテンプレートで使用するプレースホルダー名

## Bug Details

### Bug Condition

バグは以下の2つの独立した箇所で発現する。

**バグ1（Gmail）**: `mergeAngleBracketPlaceholders()` の末尾で `<<内覧前伝達事項v>>` が無条件に空文字へ置換されている。買主の内覧前伝達事項に値が入力されていても、その値を参照せずに空文字で上書きする。

**バグ2（SMS）**: `SmsDropdownButton` コンポーネントが `pre_viewing_notes` を props として受け取っておらず、メッセージテンプレート文字列にも差し込みロジックが存在しない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input = { channel: 'gmail' | 'sms', pre_viewing_notes: string }
  OUTPUT: boolean

  IF input.channel = 'gmail' THEN
    RETURN input.pre_viewing_notes IS NOT EMPTY
           AND mergeAngleBracketPlaceholders が <<内覧前伝達事項v>> を空文字に置換する
  END IF

  IF input.channel = 'sms' THEN
    RETURN input.pre_viewing_notes IS NOT EMPTY
           AND SmsDropdownButton が pre_viewing_notes を受け取っていない
  END IF

  RETURN false
END FUNCTION
```

### Examples

- **Gmail（バグあり）**: 内覧前伝達事項 = "駐車場は右側をご利用ください" → メール本文の `<<内覧前伝達事項v>>` が空文字に置換され、内容が消える
- **Gmail（バグあり）**: 内覧前伝達事項 = "玄関の暗証番号は1234です" → 同様に空文字になる
- **SMS（バグあり）**: 内覧前伝達事項 = "内覧時は担当者同行必須" → SMSメッセージに内容が含まれない
- **Gmail（バグなし）**: 内覧前伝達事項 = "" → 空文字置換は正しい動作（バグ条件に該当しない）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `<<氏名>>`、`<<●氏名・会社名>>`、`<<住居表示>>`、`<<GoogleMap>>`、`<<athome URL>>`、`<<物件詳細URL>>` 等の既存プレースホルダー置換は引き続き正常に動作すること
- `<<SUUMO　URLの表示>>` は引き続き空文字に置換されること
- SMS履歴記録ロジック（`/api/buyers/${buyerNumber}/sms-history` へのPOST）は変更しないこと
- 内覧前伝達事項が空の場合、`<<内覧前伝達事項v>>` は空文字に置換されること（既存動作の維持）
- SMS送信時、内覧前伝達事項が空の場合は既存のメッセージ内容を変更しないこと

**スコープ:**
内覧前伝達事項フィールドに関係しない全ての入力（他プレースホルダー、SMS履歴記録、他テンプレート）は本修正の影響を受けない。

## Hypothesized Root Cause

根本原因は要件フェーズで特定済み：

1. **Gmail（直接的原因）**: `EmailTemplateService.mergeAngleBracketPlaceholders()` の末尾（約340行目）に以下のコードが存在する
   ```typescript
   result = result.replace(/<<SUUMO　URLの表示>>/g, '');
   result = result.replace(/<<内覧前伝達事項v>>/g, '');  // ← 無条件に空文字
   ```
   `buyer` オブジェクトから `pre_viewing_notes` を参照する処理が実装されていない。

2. **SMS（直接的原因）**: `SmsDropdownButton` コンポーネントの `SmsDropdownButtonProps` インターフェースに `preViewingNotes` フィールドが存在せず、各テンプレートのメッセージ文字列にも差し込み処理がない。

3. **共通の背景**: 内覧前伝達事項機能が後から追加された際に、Gmail側は「未置換プレースホルダーを空文字にする」処理に誤って含まれ、SMS側は実装が漏れた可能性がある。

## Correctness Properties

Property 1: Bug Condition - 内覧前伝達事項がGmailメール本文に含まれる

_For any_ 買主データで `pre_viewing_notes` が空でない場合、修正後の `mergeAngleBracketPlaceholders()` は `<<内覧前伝達事項v>>` をその買主の `pre_viewing_notes` の値で置換し、メール本文に内覧前伝達事項の内容が含まれるものとする。

**Validates: Requirements 2.1**

Property 2: Bug Condition - 内覧前伝達事項がSMSメッセージに含まれる

_For any_ 買主データで `pre_viewing_notes` が空でない場合、修正後の `SmsDropdownButton` はSMSメッセージの適切な位置に内覧前伝達事項の内容を含めるものとする。

**Validates: Requirements 2.3**

Property 3: Preservation - 他プレースホルダーの正常動作維持

_For any_ `mergeAngleBracketPlaceholders()` の呼び出しで、`<<内覧前伝達事項v>>` 以外のプレースホルダー（`<<氏名>>`、`<<住居表示>>`、`<<GoogleMap>>` 等）の置換結果は、修正前後で同一であるものとする。

**Validates: Requirements 3.1, 3.3, 3.5**

Property 4: Preservation - SMS既存テンプレートの変更なし

_For any_ `pre_viewing_notes` が空の買主に対するSMS送信で、修正後の `SmsDropdownButton` が生成するメッセージは修正前と同一であるものとする。

**Validates: Requirements 3.2, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づく修正内容：

**変更1: `backend/src/services/EmailTemplateService.ts`**

**関数**: `mergeAngleBracketPlaceholders()`

**具体的な変更:**
1. **関数シグネチャの拡張**: `buyer` パラメータの型定義に `pre_viewing_notes?: string` を追加する
2. **無条件空文字置換の削除**: 末尾の `result = result.replace(/<<内覧前伝達事項v>>/g, '');` を削除する
3. **正しい置換ロジックの追加**: `buyer.pre_viewing_notes` の値で置換する処理を追加する

```typescript
// 修正前（削除する）
result = result.replace(/<<内覧前伝達事項v>>/g, '');

// 修正後（追加する）
result = result.replace(/<<内覧前伝達事項v>>/g, buyer.pre_viewing_notes || '');
```

**変更2: `frontend/frontend/src/components/SmsDropdownButton.tsx`**

**具体的な変更:**
1. **propsインターフェースの拡張**: `SmsDropdownButtonProps` に `preViewingNotes?: string` を追加する
2. **コンポーネント引数の追加**: 分割代入に `preViewingNotes` を追加する
3. **テンプレートへの差し込み**: 内覧前伝達事項が関連する各テンプレート（`land_no_permission`、`land_need_permission`、`house_mansion`、`minpaku` 等）に内覧前伝達事項セクションを追加する
4. **差し込み位置**: 各テンプレートの本文末尾（会社署名の直前）に追加する
5. **空の場合の処理**: `preViewingNotes` が空の場合はセクション自体を省略する

```typescript
// 差し込みロジック例
const preViewingSection = preViewingNotes
  ? `\n\n【内覧前のご確認事項】\n${preViewingNotes}`
  : '';

// テンプレート内での使用例
message = `${name}様\n\n...(本文)...${preViewingSection}\n\n株式会社 いふう\nTEL：097-533-2022`;
```

**変更3: `SmsDropdownButton` の呼び出し元**

`SmsDropdownButton` を使用している親コンポーネント（買主リストページ等）で `preViewingNotes` プロップを渡すよう修正する。呼び出し元ファイルは調査の上特定する。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：まず未修正コードでバグを再現するテストを書いてバグを確認し、次に修正後のコードで正しい動作と既存動作の維持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `mergeAngleBracketPlaceholders()` と `SmsDropdownButton` のメッセージ生成ロジックに対して、内覧前伝達事項が入力されているケースのテストを書き、未修正コードで実行して失敗を確認する。

**Test Cases**:
1. **Gmail置換テスト**: `pre_viewing_notes = "駐車場は右側"` で `mergeAngleBracketPlaceholders()` を呼び出し、結果に "駐車場は右側" が含まれることをアサート（未修正コードでは失敗する）
2. **SMS差し込みテスト**: `preViewingNotes = "担当者同行必須"` で `land_no_permission` テンプレートのメッセージを生成し、"担当者同行必須" が含まれることをアサート（未修正コードでは失敗する）
3. **Gmail空値テスト**: `pre_viewing_notes = ""` で `mergeAngleBracketPlaceholders()` を呼び出し、`<<内覧前伝達事項v>>` が空文字に置換されることをアサート（未修正コードでも成功する）

**Expected Counterexamples**:
- Gmail: `<<内覧前伝達事項v>>` が空文字に置換され、`pre_viewing_notes` の値が消える
- SMS: メッセージに `pre_viewing_notes` の内容が含まれない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition({ channel: 'gmail', pre_viewing_notes: buyer.pre_viewing_notes }) DO
  result := mergeAngleBracketPlaceholders_fixed(template, buyer, properties)
  ASSERT result CONTAINS buyer.pre_viewing_notes
END FOR

FOR ALL buyer WHERE isBugCondition({ channel: 'sms', pre_viewing_notes: buyer.pre_viewing_notes }) DO
  message := generateSmsMessage_fixed(templateId, buyer)
  ASSERT message CONTAINS buyer.pre_viewing_notes
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT mergeAngleBracketPlaceholders_original(input) = mergeAngleBracketPlaceholders_fixed(input)
END FOR

FOR ALL buyer WHERE buyer.pre_viewing_notes IS EMPTY DO
  ASSERT generateSmsMessage_original(templateId, buyer) = generateSmsMessage_fixed(templateId, buyer)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な買主データ（氏名・住所・内覧前伝達事項の組み合わせ）を自動生成できる
- 手動テストでは見落としがちなエッジケース（特殊文字、改行、長文）を検出できる
- 既存動作が全ての入力パターンで維持されることを強く保証できる

**Test Cases**:
1. **他プレースホルダー維持テスト**: `<<氏名>>`、`<<住居表示>>`、`<<GoogleMap>>` 等が修正前後で同じ値に置換されることを確認
2. **SUUMO URL空文字維持テスト**: `<<SUUMO　URLの表示>>` が引き続き空文字に置換されることを確認
3. **SMS空値維持テスト**: `preViewingNotes = ""` の場合、全テンプレートのメッセージが修正前後で同一であることを確認
4. **SMS履歴記録維持テスト**: SMS送信時の履歴記録APIコールが修正前後で変わらないことを確認

### Unit Tests

- `mergeAngleBracketPlaceholders()` に `pre_viewing_notes` あり/なしの両ケースをテスト
- `mergeAngleBracketPlaceholders()` の全プレースホルダー（`<<氏名>>`、`<<住居表示>>`、`<<SUUMO　URLの表示>>` 等）が正常に動作することをテスト
- `SmsDropdownButton` の各テンプレートで `preViewingNotes` あり/なしの両ケースをテスト
- `preViewingNotes` が空の場合にセクションが省略されることをテスト

### Property-Based Tests

- ランダムな `pre_viewing_notes` 文字列（空文字含む）を生成し、Gmail置換結果が期待通りであることを検証
- ランダムな買主データを生成し、`<<内覧前伝達事項v>>` 以外のプレースホルダーが修正前後で同じ結果になることを検証
- ランダムな `preViewingNotes` 文字列（空文字含む）を生成し、SMS各テンプレートの動作を検証

### Integration Tests

- 買主リストページから実際にGmail送信フローを実行し、メール本文に内覧前伝達事項が含まれることを確認
- 買主リストページから実際にSMS送信フローを実行し、SMSメッセージに内覧前伝達事項が含まれることを確認
- 内覧前伝達事項が空の買主に対して両フローを実行し、既存動作が変わらないことを確認
