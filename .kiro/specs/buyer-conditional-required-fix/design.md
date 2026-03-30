# buyer-conditional-required-fix Bugfix Design

## Overview

買主詳細画面（`BuyerDetailPage.tsx`）において、「持家ヒアリング結果」（`owned_home_hearing_result`）フィールドが無条件に必須扱いになっているバグを修正する。

正しい必須条件は「問合時持家ヒアリング」（`owned_home_hearing_inquiry`）に値がある場合、かつ受付日が2026/3/30以降の場合のみ。`isHomeHearingResultRequired` 関数の実装は既に正しいが、初回ロード時の `fetchBuyer` 内の必須チェックロジックが `isHomeHearingResultRequired` を呼び出さずに無条件で `owned_home_hearing_result` を必須扱いしている可能性がある。修正は最小限の変更で行い、既存の他バリデーションロジックには一切影響を与えない。

## Glossary

- **Bug_Condition (C)**: `owned_home_hearing_inquiry` が空欄であるにもかかわらず、`owned_home_hearing_result` が必須フィールドとして赤枠表示・警告ダイアログに表示される状態
- **Property (P)**: `owned_home_hearing_inquiry` が空欄の場合、`owned_home_hearing_result` は必須扱いにならない（赤枠なし・警告なし）
- **Preservation**: `owned_home_hearing_inquiry` に値がある場合の必須チェック、および他の全必須フィールドのバリデーションロジックは変更なく動作し続ける
- **isHomeHearingResultRequired**: `BuyerDetailPage.tsx` 内のヘルパー関数。`reception_date >= 2026-03-30` かつ `owned_home_hearing_inquiry` が空でない場合に `true` を返す
- **checkMissingFields**: 保存ボタン押下時に未入力の必須項目を検出する関数
- **fetchBuyer**: 初回ロード時に買主データを取得し、初期の必須フィールドハイライトを設定する関数

## Bug Details

### Bug Condition

バグは買主詳細画面を開いた際（`fetchBuyer` 実行時）、または保存ボタンを押した際（`checkMissingFields` 実行時）に発現する。`owned_home_hearing_inquiry` が空欄であっても `owned_home_hearing_result` が必須フィールドとして扱われる。

**Formal Specification:**
```
FUNCTION isBugCondition(data)
  INPUT: data of type Buyer
  OUTPUT: boolean

  RETURN (data.owned_home_hearing_inquiry IS NULL OR TRIM(data.owned_home_hearing_inquiry) = '')
         AND owned_home_hearing_result IS MARKED AS REQUIRED
END FUNCTION
```

### Examples

- **例1（バグ発現）**: `owned_home_hearing_inquiry = null`、`reception_date = "2026-04-01"` → `owned_home_hearing_result` が赤枠表示される（期待: 赤枠なし）
- **例2（バグ発現）**: `owned_home_hearing_inquiry = ""`、`reception_date = "2026-04-01"` → 保存時に「持家ヒアリング結果」が警告ダイアログに表示される（期待: 表示されない）
- **例3（正常動作すべき）**: `owned_home_hearing_inquiry = "Y"`、`reception_date = "2026-04-01"` → `owned_home_hearing_result` が赤枠表示される（期待通り）
- **例4（正常動作すべき）**: `owned_home_hearing_inquiry = "Y"`、`reception_date = "2026-03-29"` → `owned_home_hearing_result` は赤枠表示されない（受付日条件を満たさない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `owned_home_hearing_inquiry` に値があり、かつ受付日が2026/3/30以降の場合、`owned_home_hearing_result` は引き続き必須扱いになる
- 受付日が2026/3/30より前の場合、`owned_home_hearing_result` は必須扱いにならない（受付日条件は変更なし）
- `distribution_type`、`inquiry_source`、`initial_assignee`、`inquiry_email_phone`、`three_calls_confirmed` など他の全必須フィールドのバリデーションは変更なく動作する
- `owned_home_hearing_inquiry` が空欄の場合の `owned_home_hearing_result` フィールドの表示制御（非表示ロジック）は変更なし

**Scope:**
`owned_home_hearing_result` の必須判定ロジック（`isHomeHearingResultRequired` の呼び出し箇所）のみが修正対象。他のフィールドのバリデーション、UI表示、保存処理には一切影響しない。

## Hypothesized Root Cause

コードを確認した結果、`isHomeHearingResultRequired` 関数自体は正しく実装されている（`owned_home_hearing_inquiry` が空の場合は `false` を返す）。

根本原因の候補：

1. **fetchBuyer 内の初期ハイライト処理**: `fetchBuyer` 関数内で初回ロード時の必須フィールドハイライトを設定する際、`isHomeHearingResultRequired(res.data)` を呼び出しているが、その呼び出し前後のロジックに問題がある可能性
2. **checkMissingFields 内の呼び出し**: `checkMissingFields` 関数内で `isHomeHearingResultRequired(buyer)` を呼び出しているが、`buyer` ステートが古い値を参照している可能性
3. **REQUIRED_FIELD_LABEL_MAP への登録**: `owned_home_hearing_result` が `REQUIRED_FIELD_LABEL_MAP` に登録されているため、条件に関わらず必須フィールドとして扱われるコードパスが存在する可能性

現在のコードでは `isHomeHearingResultRequired` の呼び出しは正しく実装されているため、実際のバグは別の箇所（例: `SAVE_BUTTON_FIELDS` の定義や、フィールド定義の `required: true` 属性など）に起因している可能性が高い。

## Correctness Properties

Property 1: Bug Condition - 持家ヒアリング結果の条件付き必須

_For any_ 買主データ where `owned_home_hearing_inquiry` が空欄（null または空文字）の場合、修正後の `isHomeHearingResultRequired` 呼び出しは `false` を返し、`owned_home_hearing_result` フィールドは必須扱いにならず、赤枠表示・警告ダイアログへの表示が行われない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存の必須チェック動作の保持

_For any_ 買主データ where `owned_home_hearing_inquiry` に値があり、かつ `reception_date >= 2026-03-30` の場合（バグ条件が成立しない場合）、修正後のコードは修正前と同じ動作をし、`owned_home_hearing_result` が未入力であれば必須エラーとして扱われる。また、他の全必須フィールドのバリデーション動作も変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Specific Changes**:

1. **fetchBuyer 内の初期ハイライト処理の確認・修正**:
   - `fetchBuyer` 関数内の `owned_home_hearing_result` の必須チェック箇所を確認
   - `isHomeHearingResultRequired(res.data)` の呼び出しが正しく行われているか確認
   - 誤って無条件で `initialMissing.push('owned_home_hearing_result')` している箇所があれば修正

2. **checkMissingFields 内の呼び出し確認**:
   - `isHomeHearingResultRequired(buyer)` の呼び出しが正しく行われているか確認
   - `buyer` ステートが最新値を参照しているか確認

3. **フィールド定義の `required` 属性確認**:
   - `BUYER_FIELD_SECTIONS` 内の `owned_home_hearing_result` フィールド定義に `required: true` が設定されていないか確認
   - 設定されている場合は削除（条件付き必須のため静的な `required` 属性は不適切）

**修正方針**: `isHomeHearingResultRequired` 関数のロジックは正しいため、この関数を経由しない必須チェックのコードパスを特定して修正する。

## Testing Strategy

### Validation Approach

修正前のコードでバグを再現するテストを先に書き、修正後に全テストが通ることを確認する二段階アプローチを採用する。

### Exploratory Bug Condition Checking

**Goal**: `owned_home_hearing_inquiry` が空欄の状態で `owned_home_hearing_result` が必須扱いになることを確認し、根本原因を特定する。

**Test Plan**: `owned_home_hearing_inquiry = null` の買主データで `isHomeHearingResultRequired` を呼び出し、`false` が返ることを確認。また、`checkMissingFields` および `fetchBuyer` の初期ハイライト処理で `owned_home_hearing_result` が `missingRequiredFields` に含まれないことを確認する。

**Test Cases**:
1. **空欄テスト**: `owned_home_hearing_inquiry = null`、`reception_date = "2026-04-01"` → `isHomeHearingResultRequired` が `false` を返すことを確認（修正前は `checkMissingFields` が誤って必須扱いする）
2. **空文字テスト**: `owned_home_hearing_inquiry = ""`、`reception_date = "2026-04-01"` → 同上
3. **初回ロードテスト**: 上記データで画面を開いた際、`owned_home_hearing_result` が赤枠表示されないことを確認

**Expected Counterexamples**:
- `owned_home_hearing_inquiry` が空欄でも `owned_home_hearing_result` が `missingRequiredFields` に含まれる
- 原因: `fetchBuyer` または `checkMissingFields` 内で `isHomeHearingResultRequired` を経由しない必須チェックが存在する

### Fix Checking

**Goal**: 修正後、バグ条件が成立する全入力に対して正しい動作をすることを確認する。

**Pseudocode:**
```
FOR ALL data WHERE isBugCondition(data) DO
  result := isHomeHearingResultRequired(data)
  ASSERT result = false
  ASSERT 'owned_home_hearing_result' NOT IN checkMissingFields(data)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない入力（`owned_home_hearing_inquiry` に値がある場合）で、修正前後の動作が同一であることを確認する。

**Pseudocode:**
```
FOR ALL data WHERE NOT isBugCondition(data) DO
  ASSERT isHomeHearingResultRequired_original(data) = isHomeHearingResultRequired_fixed(data)
  ASSERT checkMissingFields_original(data) = checkMissingFields_fixed(data)
END FOR
```

**Testing Approach**: プロパティベーステストにより、様々な `owned_home_hearing_inquiry` の値と `reception_date` の組み合わせで保存動作が変わらないことを確認する。

**Test Cases**:
1. **値あり・日付条件満たす**: `owned_home_hearing_inquiry = "Y"`、`reception_date = "2026-04-01"`、`owned_home_hearing_result = null` → 必須エラーが発生することを確認
2. **値あり・日付条件満たさない**: `owned_home_hearing_inquiry = "Y"`、`reception_date = "2026-03-01"` → 必須エラーが発生しないことを確認
3. **他フィールドのバリデーション保持**: `distribution_type` が空欄の場合、引き続き必須エラーが発生することを確認

### Unit Tests

- `isHomeHearingResultRequired` 関数の全パターンテスト（空欄/値あり × 日付条件前後）
- `checkMissingFields` で `owned_home_hearing_result` が正しく条件付き必須扱いされることのテスト
- 他の必須フィールド（`distribution_type` 等）のバリデーションが影響を受けないことのテスト

### Property-Based Tests

- ランダムな `owned_home_hearing_inquiry` の値（空/非空）と `reception_date` の組み合わせで `isHomeHearingResultRequired` の結果が仕様通りであることを検証
- `owned_home_hearing_inquiry` が空の場合、どんな `reception_date` でも `false` を返すことを検証
- 修正前後で `owned_home_hearing_inquiry` に値がある場合の必須チェック結果が同一であることを検証

### Integration Tests

- 買主詳細画面を開いた際、`owned_home_hearing_inquiry` が空欄の買主で `owned_home_hearing_result` が赤枠表示されないことを確認
- 保存ボタン押下時、`owned_home_hearing_inquiry` が空欄の場合に警告ダイアログに「持家ヒアリング結果」が表示されないことを確認
- `owned_home_hearing_inquiry` に値がある場合の既存動作が変わらないことを確認
