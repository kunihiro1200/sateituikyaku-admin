# 「問合メール未対応」フィルタバグ修正 Design

## Overview

買主リストの「問合メール未対応」サイドバーカテゴリにおいて、カウント表示（5件）とフィルタリング結果（0件）が一致しない問題を修正します。

この不一致は、サイドバーカウント計算ロジック（BuyerService.ts）で `viewing_date` フィールドを使用しているのに対し、ステータス計算ロジック（BuyerStatusCalculator.ts）では `latest_viewing_date` フィールドを使用していることが原因です。

## Glossary

- **Bug_Condition (C)**: サイドバーカウント計算とステータス計算で異なるフィールド（`viewing_date` vs `latest_viewing_date`）を参照し、カウント表示とフィルタリング結果が不一致となる条件
- **Property (P)**: 両方のロジックで同じフィールド（`latest_viewing_date`）を使用し、カウント表示とフィルタリング結果が一致する状態
- **Preservation**: 他のサイドバーカテゴリのカウント計算が正常に動作し続けること
- **viewing_date**: 旧フィールド（使用されていない）
- **latest_viewing_date**: 正しいフィールド（BuyerStatusCalculator.ts で使用）
- **inquiry_email_phone**: 【問合メール】電話対応フィールド
- **inquiry_email_reply**: 【問合メール】メール返信フィールド

## Bug Details

### Bug Condition

サイドバーカウント計算ロジックで `viewing_date` フィールドを使用しているため、ステータス計算ロジック（`latest_viewing_date` を使用）と異なる結果になっています。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type Buyer
  OUTPUT: boolean
  
  RETURN (
    サイドバーカウント計算で viewing_date を参照 AND
    ステータス計算で latest_viewing_date を参照 AND
    viewing_date != latest_viewing_date
  )
END FUNCTION
```

### Examples

- **例1**: サイドバーに「問合メール未対応: 5件」と表示されるが、クリックすると「買主データみつかりません」と表示される
- **例2**: `viewing_date` が空欄で `latest_viewing_date` に値がある買主が、サイドバーカウントには含まれるがフィルタリング結果には含まれない
- **例3**: `viewing_date` に値があり `latest_viewing_date` が空欄の買主が、サイドバーカウントには含まれないがフィルタリング結果には含まれる

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のサイドバーカテゴリ（「内覧日前日」「当日TEL」など）のカウント計算は引き続き正常に動作する
- ステータス計算ロジックの他の優先順位（Priority 1-4, 6-38）の判定は変更されない
- 「問合メール未対応」以外のフィルタリングは影響を受けない

**Scope:**
`viewing_date` フィールドを参照している箇所のみを `latest_viewing_date` に変更します。他のフィールドやロジックは変更しません。

## Hypothesized Root Cause

サイドバーカウント計算ロジック（BuyerService.ts 1813行目）で誤って `viewing_date` フィールドを使用しています。

**現在のコード（間違い）**:
```typescript
// backend/src/services/BuyerService.ts (1810-1825行目)
// 1. 問合メール未対応
const inquiryEmailPhone = buyer.inquiry_email_phone || '';
const inquiryEmailReply = buyer.inquiry_email_reply || '';
const viewingDate = buyer.viewing_date || '';  // ❌ 間違い

if (
  inquiryEmailPhone === '未' ||
  inquiryEmailReply === '未' ||
  (
    !viewingDate &&  // ❌ 間違い
    (inquiryEmailPhone === '不要' || inquiryEmailPhone === '不要') &&
    (inquiryEmailReply === '未' || !inquiryEmailReply)
  )
) {
  result.inquiryEmailUnanswered++;
}
```

**正しいコード（BuyerStatusCalculator.ts）**:
```typescript
// backend/src/services/BuyerStatusCalculator.ts (145-167行目)
// Priority 5: 問合メール未対応
if (
  or(
    equals(buyer.inquiry_email_phone, '未'),
    equals(buyer.inquiry_email_reply, '未'),
    and(
      isBlank(buyer.latest_viewing_date),  // ✅ 正しい
      equals(buyer.inquiry_email_phone, '不要'),
      or(
        equals(buyer.inquiry_email_reply, '未'),
        isBlank(buyer.inquiry_email_reply)
      )
    )
  )
) {
  const status = '問合メール未対応';
  return { status, priority: 5, matchedCondition: '問い合わせメールへの対応が未完了', color: getStatusColor(status) };
}
```

## Correctness Properties

Property 1: Bug Condition - フィールド名の統一

_For any_ 買主データに対して、サイドバーカウント計算とステータス計算の両方で同じフィールド（`latest_viewing_date`）を使用し、同じ判定結果が得られる。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他のカテゴリのカウント計算

_For any_ 「問合メール未対応」以外のサイドバーカテゴリに対して、修正前と同じカウント計算結果が得られる。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerService.ts`

**Lines**: 1810-1825

**Specific Changes**:
1. **フィールド名の変更**: `viewing_date` → `latest_viewing_date`
   - 1813行目: `const viewingDate = buyer.viewing_date || '';` → `const viewingDate = buyer.latest_viewing_date || '';`
   - または変数名も変更: `const latestViewingDate = buyer.latest_viewing_date || '';`

**修正後のコード**:
```typescript
// backend/src/services/BuyerService.ts (1810-1825行目)
// 1. 問合メール未対応
const inquiryEmailPhone = buyer.inquiry_email_phone || '';
const inquiryEmailReply = buyer.inquiry_email_reply || '';
const latestViewingDate = buyer.latest_viewing_date || '';  // ✅ 修正

if (
  inquiryEmailPhone === '未' ||
  inquiryEmailReply === '未' ||
  (
    !latestViewingDate &&  // ✅ 修正
    (inquiryEmailPhone === '不要' || inquiryEmailPhone === '不要') &&
    (inquiryEmailReply === '未' || !inquiryEmailReply)
  )
) {
  result.inquiryEmailUnanswered++;
}
```

## Testing Strategy

### Validation Approach

修正後、以下の2段階でテストを実施します：
1. **Exploratory Bug Condition Checking**: 修正前のコードで不一致を確認
2. **Fix Checking**: 修正後のコードでカウント表示とフィルタリング結果が一致することを確認

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで、サイドバーカウントとフィルタリング結果が不一致であることを確認する。

**Test Plan**: 
1. 本番環境で「問合メール未対応: 5件」と表示されることを確認
2. クリックして「買主データみつかりません」と表示されることを確認
3. データベースで `viewing_date` と `latest_viewing_date` の値を比較

**Test Cases**:
1. **カウント不一致テスト**: サイドバーカウント（5件）とフィルタリング結果（0件）が異なることを確認（修正前）
2. **フィールド値比較テスト**: `viewing_date` と `latest_viewing_date` の値が異なる買主データを確認
3. **ステータス計算テスト**: BuyerStatusCalculator.ts で「問合メール未対応」と判定される買主を確認

**Expected Counterexamples**:
- サイドバーカウントは5件だが、フィルタリング結果は0件
- `viewing_date` が空欄で `latest_viewing_date` に値がある買主が存在する

### Fix Checking

**Goal**: 修正後のコードで、サイドバーカウントとフィルタリング結果が一致することを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  sidebarCount := calculateSidebarCount_fixed(buyer)
  filteringResult := calculateStatus_fixed(buyer)
  ASSERT sidebarCount = filteringResult
END FOR
```

**Test Plan**:
1. `backend/src/services/BuyerService.ts` の1813行目を修正
2. サーバーを再起動
3. サイドバーカウントを確認
4. 「問合メール未対応」をクリックしてフィルタリング結果を確認
5. カウント表示とフィルタリング結果が一致することを確認

**Test Cases**:
1. **カウント一致テスト**: サイドバーカウントとフィルタリング結果が一致することを確認（修正後）
2. **フィールド参照テスト**: サイドバーカウント計算で `latest_viewing_date` を使用していることを確認
3. **ステータス一致テスト**: BuyerStatusCalculator.ts と同じ判定結果が得られることを確認

### Preservation Checking

**Goal**: 修正後も、他のサイドバーカテゴリのカウント計算が正常に動作することを確認する。

**Pseudocode:**
```
FOR ALL category WHERE category != '問合メール未対応' DO
  ASSERT calculateSidebarCount_original(category) = calculateSidebarCount_fixed(category)
END FOR
```

**Test Plan**:
1. 「内覧日前日」カテゴリのカウントを確認
2. 「当日TEL」カテゴリのカウントを確認
3. 「担当(Y)」カテゴリのカウントを確認
4. 修正前と同じカウント結果が得られることを確認

**Test Cases**:
1. **内覧日前日カウント**: 修正前と同じカウント結果が得られることを確認
2. **当日TELカウント**: 修正前と同じカウント結果が得られることを確認
3. **担当(Y)カウント**: 修正前と同じカウント結果が得られることを確認

### Unit Tests

- サイドバーカウント計算で `latest_viewing_date` を使用していることをテスト
- 「問合メール未対応」の判定条件が BuyerStatusCalculator.ts と一致することをテスト
- 他のサイドバーカテゴリのカウント計算が影響を受けないことをテスト

### Property-Based Tests

- ランダムな買主データを生成し、サイドバーカウントとフィルタリング結果が一致することを検証
- `viewing_date` と `latest_viewing_date` の値が異なる買主データを生成し、正しく判定されることを検証

### Integration Tests

- 本番環境で「問合メール未対応」カテゴリをクリックし、正しい件数が表示されることを確認
- サイドバーカウントとフィルタリング結果が一致することを確認
- 他のサイドバーカテゴリが正常に動作することを確認

## 参考情報

### 同様のバグ修正例

**コミット a7598425**: 買主「担当(Y)」フィルタバグ修正

**問題**: フロントエンドとバックエンドのフィルタリングロジックが異なっていた

**修正内容**: フロントエンドのロジックをバックエンドと完全に一致させた

**教訓**: フィルタリングロジックは、フロントエンドとバックエンドで完全に一致させる必要がある

### 今回の修正との類似点

- **問題の構造**: 2つのロジック（サイドバーカウント vs ステータス計算）が異なる結果を返す
- **修正方法**: 一方のロジックをもう一方に合わせる（今回は `viewing_date` → `latest_viewing_date`）
- **テスト方法**: 修正前に不一致を確認し、修正後に一致を確認する
