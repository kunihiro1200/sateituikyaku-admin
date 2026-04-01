# Bugfix Requirements Document

## Introduction

売主リスト通話モードページにおいて、状況（当社）が「一般媒介」の場合に「競合（複数選択可）」と「専任・他決要因（複数選択可）」が必須項目として誤って扱われているバグを修正します。

このバグにより、一般媒介の売主に対して不要なフィールドの入力を強制し、ユーザーが空欄のまま保存しようとするとバリデーションエラーが発生します。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 状況（当社）= "一般媒介" THEN システムは「競合（複数選択可）」フィールドに赤枠と「必須項目です」メッセージを表示する

1.2 WHEN 状況（当社）= "一般媒介" AND 「競合（複数選択可）」が空欄 THEN システムは保存時にバリデーションエラーを発生させる

1.3 WHEN 状況（当社）= "一般媒介" THEN システムは「専任・他決要因（複数選択可）」フィールドに赤枠と「必須項目です」メッセージを表示する

1.4 WHEN 状況（当社）= "一般媒介" AND 「専任・他決要因（複数選択可）」が空欄 THEN システムは保存時にバリデーションエラーを発生させる

### Expected Behavior (Correct)

2.1 WHEN 状況（当社）= "一般媒介" THEN システムは「競合（複数選択可）」フィールドを任意項目として扱い、赤枠と「必須項目です」メッセージを表示しない

2.2 WHEN 状況（当社）= "一般媒介" AND 「競合（複数選択可）」が空欄 THEN システムは保存を許可し、バリデーションエラーを発生させない

2.3 WHEN 状況（当社）= "一般媒介" THEN システムは「専任・他決要因（複数選択可）」フィールドを任意項目として扱い、赤枠と「必須項目です」メッセージを表示しない

2.4 WHEN 状況（当社）= "一般媒介" AND 「専任・他決要因（複数選択可）」が空欄 THEN システムは保存を許可し、バリデーションエラーを発生させない

2.5 WHEN 状況（当社） IN ("専任媒介", "他決→専任", "リースバック（専任）", "他決→追客", "他決→追客不要", "一般→他決", "他社買取") THEN システムは「競合（複数選択可）」と「専任・他決要因（複数選択可）」を必須項目として扱う

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 状況（当社） = "専任媒介" THEN システムは「競合（複数選択可）」と「専任・他決要因（複数選択可）」を必須項目として扱い続ける

3.2 WHEN 状況（当社） = "他決→専任" THEN システムは「競合（複数選択可）」と「専任・他決要因（複数選択可）」を必須項目として扱い続ける

3.3 WHEN 状況（当社） = "リースバック（専任）" THEN システムは「競合（複数選択可）」と「専任・他決要因（複数選択可）」を必須項目として扱い続ける

3.4 WHEN 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") THEN システムは「競合（複数選択可）」と「専任・他決要因（複数選択可）」を必須項目として扱い続ける

3.5 WHEN 状況（当社） = "追客中" THEN システムは「競合（複数選択可）」と「専任・他決要因（複数選択可）」を表示しない（現在の動作を維持）

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SellerStatus
  OUTPUT: boolean
  
  // 状況（当社）が「一般媒介」の場合にバグが発生
  RETURN X.status = "一般媒介"
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - 一般媒介の場合は任意項目
FOR ALL X WHERE isBugCondition(X) DO
  result ← validateRequiredFields'(X)
  ASSERT result.competitorsRequired = false AND
         result.exclusiveOtherDecisionFactorsRequired = false AND
         result.canSaveWithEmptyFields = true
END FOR
```

### Preservation Goal (Preservation Checking)

```pascal
// Property: Preservation Checking - 他のステータスは必須のまま
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT validateRequiredFields(X) = validateRequiredFields'(X)
END FOR
```

ここで：
- **F**: 修正前の`requiresDecisionDate`関数（一般媒介も`true`を返す）
- **F'**: 修正後の`requiresDecisionDate`関数（一般媒介は`false`を返す）
- **X.status**: 状況（当社）の値

## Technical Context

### Affected Files

- `frontend/frontend/src/pages/CallModePage.tsx` - 通話モードページのメインコンポーネント
  - `requiresDecisionDate()` 関数（行3068-3072）
  - `isRequiredFieldsComplete()` 関数（行3075-3084）
  - 「競合（複数選択可）」フィールド（行6342-6369）
  - 「専任・他決要因（複数選択可）」フィールド（行6371-6398）

### Root Cause

`requiresDecisionDate`関数が「一般媒介」を含む全てのケースで`true`を返すため、条件付き必須ロジックが正しく機能していません。

```typescript
// 現在の実装（バグあり）
const requiresDecisionDate = (status: string): boolean => {
  if (!status) return false;
  const label = getStatusLabel(status);
  return label.includes('専任') || label.includes('他決') || label.includes('一般媒介');
};
```

### Expected Fix

「一般媒介」を除外し、専任・他決関連のステータスのみを対象とする：

```typescript
// 修正後の実装
const requiresDecisionDate = (status: string): boolean => {
  if (!status) return false;
  const label = getStatusLabel(status);
  return label.includes('専任') || label.includes('他決');
};
```

## Counterexample

### 具体例: AA13XXX（一般媒介の売主）

**データ**:
- `status`: "一般媒介"
- `competitors`: [] （空配列）
- `exclusiveOtherDecisionFactors`: [] （空配列）

**現在の動作（バグ）**:
- ✅ 状況（当社）= "一般媒介"
- ❌ 「競合（複数選択可）」に赤枠と「必須項目です」が表示される
- ❌ 「専任・他決要因（複数選択可）」に赤枠と「必須項目です」が表示される
- ❌ 保存時にバリデーションエラーが発生

**期待される動作（修正後）**:
- ✅ 状況（当社）= "一般媒介"
- ✅ 「競合（複数選択可）」は任意項目として表示される（赤枠なし）
- ✅ 「専任・他決要因（複数選択可）」は任意項目として表示される（赤枠なし）
- ✅ 空欄のまま保存できる
