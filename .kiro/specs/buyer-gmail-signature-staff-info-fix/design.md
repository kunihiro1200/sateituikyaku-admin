# buyer-gmail-signature-staff-info-fix Bugfix Design

## Overview

買主詳細画面のGmail送信機能において、「内覧後お礼メール」等のテンプレートを選択した際、署名の `TEL：`、`MAIL:`、`固定休：` が空欄になるバグを修正する。

根本原因は2つある：
1. `EmailTemplateService.mergeAngleBracketPlaceholders` 関数に `<<担当名（営業）電話番号>>`、`<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>` の置換処理が実装されていない
2. 担当者情報の取得に必要な `follow_up_assignee`（後続担当）がフロントエンドからバックエンドへのリクエストに含まれていない

修正方針は最小限の変更で既存動作を維持しつつ、担当者情報プレースホルダーの置換を追加することである。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `<<担当名（営業）電話番号>>`、`<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>` のいずれかを含む買主向けテンプレートを選択したとき
- **Property (P)**: 期待される正しい動作 — 後続担当のスタッフ情報を取得して各プレースホルダーを実際の値で置換する
- **Preservation**: 修正によって変更してはならない既存の動作 — 買主情報・物件情報プレースホルダーの置換、`follow_up_assignee` なしの場合の動作
- **mergeAngleBracketPlaceholders**: `backend/src/services/EmailTemplateService.ts` 内の関数。`<<>>` 形式のプレースホルダーを実際のデータで置換する
- **mergeMultiple エンドポイント**: `backend/src/routes/emailTemplates.ts` の `POST /:templateId/mergeMultiple`。複数物件のデータをマージして返す
- **follow_up_assignee**: 後続担当者のイニシャルまたは氏名。`buyers` テーブルのカラム
- **StaffManagementService**: スタッフ情報をスプレッドシートから取得するサービス。`getStaffByInitials()` と `getStaffByNameContains()` メソッドを持つ

## Bug Details

### Bug Condition

バグは以下の2つの条件が重なったときに発生する：

1. `BuyerGmailSendButton` が `mergeMultiple` エンドポイントにリクエストを送る際、`buyer.follow_up_assignee` を含めていない
2. `mergeAngleBracketPlaceholders` 関数が `<<担当名（営業）電話番号>>`、`<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>` の置換処理を持っていない

その結果、これらのプレースホルダーは最終的に `<<[^>]*>>` の正規表現で空文字に置換され、署名の TEL・MAIL・固定休が空欄になる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { templateBody: string, buyerFollowUpAssignee: string | undefined }
  OUTPUT: boolean

  RETURN (
    input.templateBody CONTAINS '<<担当名（営業）電話番号>>'
    OR input.templateBody CONTAINS '<<担当名（営業）メールアドレス>>'
    OR input.templateBody CONTAINS '<<担当名（営業）固定休>>'
  )
  AND (
    input.buyerFollowUpAssignee IS undefined OR IS empty
    OR mergeAngleBracketPlaceholders DOES NOT handle these placeholders
  )
END FUNCTION
```

### Examples

- **例1**: 「内覧後お礼メール」テンプレートを選択 → 署名の `TEL：` が空欄（期待値: 後続担当の電話番号）
- **例2**: 「内覧後お礼メール」テンプレートを選択 → 署名の `MAIL:` が空欄（期待値: 後続担当のメールアドレス）
- **例3**: 「内覧後お礼メール」テンプレートを選択 → 署名の `固定休：` が空欄（期待値: 後続担当の固定休）
- **エッジケース**: `follow_up_assignee` が設定されているがスタッフ情報が見つからない → 空文字で置換（エラーなし）

## Expected Behavior

### Preservation Requirements

**変更してはならない既存の動作:**
- `<<氏名>>`、`<<買主番号>>`、`<<メールアドレス>>` 等の買主情報プレースホルダーの置換は引き続き正常に動作する
- `<<住居表示>>`、`<<GoogleMap>>`、`<<内覧アンケート>>` 等の物件情報プレースホルダーの置換は引き続き正常に動作する
- `follow_up_assignee` がリクエストに含まれない場合、担当者情報プレースホルダーは空文字に置換される（既存動作を維持）
- 売主向けテンプレートの `mergePropertyTemplate` 関数による担当者情報置換は影響を受けない
- `<<担当名（営業）名前>>` の置換処理（既存）は引き続き正常に動作する

**スコープ:**
担当者情報プレースホルダー（`<<担当名（営業）電話番号>>`、`<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>`) 以外のプレースホルダーはこの修正の影響を受けない。

## Hypothesized Root Cause

根本原因の分析：

1. **フロントエンドの送信データ不足**: `BuyerGmailSendButton.tsx` の `handleTemplateSelect` 関数が `mergeMultiple` エンドポイントに送るリクエストの `buyer` オブジェクトに `follow_up_assignee` が含まれていない。`BuyerDetailPage.tsx` から `followUpAssignee` prop が渡されていないため。

2. **バックエンドの置換処理の欠如**: `EmailTemplateService.mergeAngleBracketPlaceholders` 関数は `<<担当名（営業）名前>>` の置換処理を持っていない（これは `mergePropertyTemplate` にのみ実装されている）。さらに `<<担当名（営業）電話番号>>`、`<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>` の置換処理も存在しない。

3. **エンドポイントでのスタッフ情報取得の欠如**: `mergeMultiple` エンドポイントは `follow_up_assignee` を受け取っても `StaffManagementService` を呼び出してスタッフ情報を取得する処理がない。

4. **フォールスルー**: 上記の結果、これらのプレースホルダーは `mergeAngleBracketPlaceholders` の末尾にある `result.replace(/<<[^>]*>>/g, '')` で空文字に置換される。

## Correctness Properties

Property 1: Bug Condition - 担当者情報プレースホルダーの置換

_For any_ テンプレートに `<<担当名（営業）電話番号>>`、`<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>` のいずれかが含まれ、かつ `follow_up_assignee` が指定されてスタッフ情報が取得できる場合、修正後の `mergeAngleBracketPlaceholders` 関数はそれぞれのプレースホルダーをスタッフの電話番号・メールアドレス・固定休で置換する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 既存プレースホルダー置換の維持

_For any_ テンプレートに担当者情報プレースホルダーが含まれない場合（`isBugCondition` が false）、修正後の関数は修正前の関数と同一の結果を返し、買主情報・物件情報プレースホルダーの置換動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の4ファイルを修正する：

---

**File 1**: `frontend/frontend/src/components/BuyerGmailSendButton.tsx`

**Function**: `BuyerGmailSendButtonProps` interface および `handleTemplateSelect`

**Specific Changes**:
1. **Props に `followUpAssignee` を追加**: `followUpAssignee?: string` を `BuyerGmailSendButtonProps` に追加
2. **リクエストに `follow_up_assignee` を追加**: `mergeMultiple` エンドポイントへのリクエストの `buyer` オブジェクトに `follow_up_assignee: followUpAssignee || ''` を追加

---

**File 2**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Function**: `BuyerGmailSendButton` コンポーネントの呼び出し箇所

**Specific Changes**:
1. **`followUpAssignee` prop を渡す**: `<BuyerGmailSendButton>` に `followUpAssignee={buyer.follow_up_assignee || ''}` を追加

---

**File 3**: `backend/src/routes/emailTemplates.ts`

**Function**: `POST /:templateId/mergeMultiple` エンドポイント

**Specific Changes**:
1. **`follow_up_assignee` を取得**: `const { buyer, propertyIds, templateSubject, templateBody } = req.body;` から `buyer.follow_up_assignee` を取得
2. **スタッフ情報を検索**: `follow_up_assignee` が存在する場合、`staffService.getStaffByInitials()` で検索し、見つからない場合は `staffService.getStaffByNameContains()` で部分一致検索
3. **`mergeAngleBracketPlaceholders` に `staffInfo` を渡す**: 既存の呼び出しに `staffInfo` パラメータを追加

---

**File 4**: `backend/src/services/EmailTemplateService.ts`

**Function**: `mergeAngleBracketPlaceholders`

**Specific Changes**:
1. **`staffInfo` パラメータを追加**: オプションパラメータ `staffInfo?: { name?: string; phone?: string | null; email?: string | null; regularHoliday?: string | null } | null` を追加
2. **担当者情報プレースホルダーの置換を追加**: `<<[^>]*>>` による空文字置換の前に以下を追加：
   - `<<担当名（営業）名前>>` → `staffInfo?.name || ''`
   - `<<担当名（営業）電話番号>>` → `staffInfo?.phone || ''`
   - `<<担当名（営業）メールアドレス>>` → `staffInfo?.email || ''`
   - `<<担当名（営業）固定休>>` → `staffInfo?.regularHoliday || ''`

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しく動作することを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `mergeAngleBracketPlaceholders` に担当者情報プレースホルダーを含むテキストを渡し、置換されずに空文字になることを確認する。

**Test Cases**:
1. **担当者電話番号テスト**: `<<担当名（営業）電話番号>>` を含むテキストを `mergeAngleBracketPlaceholders` に渡す → 未修正コードでは空文字になる（バグ確認）
2. **担当者メールアドレステスト**: `<<担当名（営業）メールアドレス>>` を含むテキストを渡す → 未修正コードでは空文字になる（バグ確認）
3. **担当者固定休テスト**: `<<担当名（営業）固定休>>` を含むテキストを渡す → 未修正コードでは空文字になる（バグ確認）
4. **フロントエンドリクエストテスト**: `BuyerGmailSendButton` が送るリクエストに `follow_up_assignee` が含まれないことを確認する

**Expected Counterexamples**:
- `<<担当名（営業）電話番号>>` が空文字に置換される（置換処理が存在しないため）
- `follow_up_assignee` がリクエストに含まれない（props が渡されていないため）

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する入力に対して期待通りの動作をすることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := mergeAngleBracketPlaceholders_fixed(input.text, input.buyer, input.properties, input.staffInfo)
  ASSERT result DOES NOT CONTAIN '<<担当名（営業）電話番号>>'
  ASSERT result DOES NOT CONTAIN '<<担当名（営業）メールアドレス>>'
  ASSERT result DOES NOT CONTAIN '<<担当名（営業）固定休>>'
  ASSERT result CONTAINS staffInfo.phone (if staffInfo exists)
  ASSERT result CONTAINS staffInfo.email (if staffInfo exists)
  ASSERT result CONTAINS staffInfo.regularHoliday (if staffInfo exists)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない入力に対して修正前と同一の結果を返すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT mergeAngleBracketPlaceholders_original(input) = mergeAngleBracketPlaceholders_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な入力パターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存の買主情報・物件情報プレースホルダーが影響を受けないことを強く保証できる

**Test Cases**:
1. **買主情報プレースホルダー保持**: `<<氏名>>`、`<<買主番号>>`、`<<メールアドレス>>` の置換が修正前後で同一であることを確認
2. **物件情報プレースホルダー保持**: `<<住居表示>>`、`<<GoogleMap>>` の置換が修正前後で同一であることを確認
3. **`staffInfo` なしの動作保持**: `staffInfo` を渡さない場合（または null の場合）、担当者情報プレースホルダーが空文字に置換されることを確認
4. **スタッフ情報が見つからない場合**: `follow_up_assignee` が指定されているがスタッフが見つからない場合、空文字で置換されエラーが発生しないことを確認

### Unit Tests

- `mergeAngleBracketPlaceholders` に `staffInfo` を渡した場合の各プレースホルダー置換テスト
- `staffInfo` が null/undefined の場合のフォールバック動作テスト
- `mergeMultiple` エンドポイントが `follow_up_assignee` を受け取りスタッフ情報を取得するテスト
- `getStaffByInitials` で見つからない場合に `getStaffByNameContains` にフォールバックするテスト

### Property-Based Tests

- ランダムな買主データと物件データを生成し、担当者情報プレースホルダーを含まないテンプレートで修正前後の結果が同一であることを確認
- ランダムなスタッフ情報を生成し、担当者情報プレースホルダーが正しく置換されることを確認
- `staffInfo` の各フィールドが null/undefined の場合でも空文字に置換されエラーが発生しないことを確認

### Integration Tests

- 買主詳細画面から Gmail 送信ボタンを押し、テンプレートを選択した際に署名の TEL・MAIL・固定休が正しく表示されることを確認
- `follow_up_assignee` が設定されていない買主でも Gmail 送信が正常に動作することを確認
- 売主向けテンプレートの `mergePropertyTemplate` が引き続き正常に動作することを確認
