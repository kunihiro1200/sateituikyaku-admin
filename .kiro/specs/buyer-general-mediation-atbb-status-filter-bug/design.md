# 買主リスト「一般媒介_内覧後売主連絡未」atbb_statusフィルタバグ修正設計

## Overview

買主リストページのサイドバーカテゴリー「一般媒介_内覧後売主連絡未」において、atbb_statusが"非公開"などの物件も含まれてしまっている問題を修正します。このカテゴリーには、atbb_statusに"公開中"という文字列が含まれる物件のみが表示されるべきです。

修正は`BuyerStatusCalculator.ts`のPriority 8のロジックに`contains(buyer.atbb_status, '公開中')`条件を追加することで実現します。

## Glossary

- **Bug_Condition (C)**: 「一般媒介_内覧後売主連絡未」カテゴリーに該当する買主のうち、atbb_statusに"公開中"が含まれない買主が表示されてしまう条件
- **Property (P)**: 「一般媒介_内覧後売主連絡未」カテゴリーには、atbb_statusに"公開中"が含まれる買主のみが表示される
- **Preservation**: 他のサイドバーカテゴリーのフィルタリングロジックは変更されない
- **BuyerStatusCalculator**: `backend/src/services/BuyerStatusCalculator.ts`。買主のステータスを算出するサービス
- **atbb_status**: 物件の公開ステータス（"一般・公開中"、"非公開"など）
- **Priority 8**: BuyerStatusCalculatorにおける「一般媒介_内覧後売主連絡未」の優先順位

## Bug Details

### Bug Condition

バグは、買主リストの「一般媒介_内覧後売主連絡未」カテゴリーを表示する際に発生します。`BuyerStatusCalculator.ts`のPriority 8のロジックが、atbb_statusのフィルタ条件を含んでいないため、"非公開"などの物件も含まれてしまいます。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type BuyerData
  OUTPUT: boolean
  
  RETURN (conditionA OR conditionB)
         AND NOT contains(buyer.atbb_status, '公開中')
         
  WHERE:
    conditionA = isNotBlank(buyer.viewing_type_general)
                 AND isNotBlank(buyer.latest_viewing_date)
                 AND isPast(buyer.latest_viewing_date)
                 AND isAfterOrEqual(buyer.latest_viewing_date, '2025-08-01')
                 AND isBlank(buyer.post_viewing_seller_contact)
    
    conditionB = equals(buyer.post_viewing_seller_contact, '未')
END FUNCTION
```

### Examples

- **買主7145**: atbb_status = "非公開"、viewing_type_general = "一般"、latest_viewing_date = "2025-09-15"（過去）、post_viewing_seller_contact = 空欄 → 現在は「一般媒介_内覧後売主連絡未」に表示されるが、表示されるべきではない
- **買主7148**: atbb_status = "一般・公開中"、viewing_type_general = "一般"、latest_viewing_date = "2025-09-20"（過去）、post_viewing_seller_contact = 空欄 → 正しく「一般媒介_内覧後売主連絡未」に表示される
- **買主7150**: atbb_status = "専任・公開中"、post_viewing_seller_contact = "未" → 現在は「一般媒介_内覧後売主連絡未」に表示されるが、表示されるべきではない（条件Bを満たすが、atbb_statusに"公開中"が含まれていない）
- **買主7152**: atbb_status = "一般・公開中"、post_viewing_seller_contact = "未" → 正しく「一般媒介_内覧後売主連絡未」に表示される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のサイドバーカテゴリー（Priority 1-7, 9-35）のフィルタリングロジックは変更されない
- Priority 9-15の「内覧後未入力」カテゴリーは既に`contains(buyer.atbb_status, '公開中')`条件を持っており、これは変更されない
- 「一般媒介_内覧後売主連絡未」カテゴリーで、atbb_statusに"公開中"が含まれ、かつ他の条件を満たす買主は引き続き正しく表示される

**Scope:**
atbb_statusに"公開中"が含まれない買主（"非公開"、"専任・公開中"など）は、「一般媒介_内覧後売主連絡未」カテゴリーから除外されるべきです。これには以下が含まれます：
- atbb_status = "非公開"
- atbb_status = "専任・公開中"（"公開中"は含まれるが、"一般"が含まれないため除外される可能性がある）
- atbb_status = 空欄
- atbb_status = その他の値

## Hypothesized Root Cause

コードレビューの結果、以下の根本原因が特定されました：

1. **atbb_statusフィルタ条件の欠如**: `BuyerStatusCalculator.ts`のPriority 8のロジックに、`contains(buyer.atbb_status, '公開中')`条件が含まれていない
   - Priority 9-15の「内覧後未入力」カテゴリーには既にこの条件が実装されている
   - Priority 8にも同じ条件を追加する必要がある

2. **実装の不整合**: 同じような性質のカテゴリー（内覧後の対応が必要な買主）であるにもかかわらず、Priority 8とPriority 9-15でフィルタ条件が異なっている

## Correctness Properties

Property 1: Bug Condition - atbb_statusフィルタの適用

_For any_ 買主データにおいて、「一般媒介_内覧後売主連絡未」カテゴリーに該当する条件（条件A OR 条件B）を満たす場合、修正後のBuyerStatusCalculatorは、atbb_statusに"公開中"という文字列が含まれる買主のみをこのカテゴリーに分類する。atbb_statusに"公開中"が含まれない買主（"非公開"など）は除外される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他のカテゴリーのフィルタリング

_For any_ 買主データにおいて、「一般媒介_内覧後売主連絡未」以外のサイドバーカテゴリー（Priority 1-7, 9-35）については、修正前と同じフィルタリングロジックが適用され、同じ結果が得られる。

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

修正は1つのファイルのみで完結します。

**File**: `backend/src/services/BuyerStatusCalculator.ts`

**Function**: `calculateBuyerStatus()`

**Specific Changes**:
1. **Priority 8のロジックにatbb_statusフィルタを追加**:
   - 現在の条件A: `isNotBlank(viewing_type_general) AND isNotBlank(latest_viewing_date) AND isPast(latest_viewing_date) AND isAfterOrEqual(latest_viewing_date, '2025-08-01') AND isBlank(post_viewing_seller_contact)`
   - 修正後の条件A: 上記 + `AND contains(buyer.atbb_status, '公開中')`
   
   - 現在の条件B: `equals(post_viewing_seller_contact, '未')`
   - 修正後の条件B: 上記 + `AND contains(buyer.atbb_status, '公開中')`

2. **実装コード**:
   ```typescript
   // Priority 8: 一般媒介_内覧後売主連絡未
   // 条件A: 内覧日が2025/8/1以降かつ今日未満 かつ 内覧形態_一般媒介が非空 かつ 内覧後売主連絡が未入力 かつ atbb_statusに"公開中"が含まれる
   // 条件B: 内覧後売主連絡 = "未" かつ atbb_statusに"公開中"が含まれる
   const conditionA = and(
     isNotBlank(buyer.viewing_type_general),
     isNotBlank(buyer.latest_viewing_date),
     isPast(buyer.latest_viewing_date),
     isAfterOrEqual(buyer.latest_viewing_date, '2025-08-01'),
     isBlank(buyer.post_viewing_seller_contact),
     contains(buyer.atbb_status, '公開中')  // ← 追加
   );
   const conditionB = and(
     equals(buyer.post_viewing_seller_contact, '未'),
     contains(buyer.atbb_status, '公開中')  // ← 追加
   );
   if (or(conditionA, conditionB)) {
     const status = '一般媒介_内覧後売主連絡未';
     return { status, priority: 8, matchedCondition: '一般媒介で内覧後の売主連絡が未完了（公開中のみ）', color: getStatusColor(status) };
   }
   ```

3. **コメントの更新**:
   - 条件Aのコメントに「かつ atbb_statusに"公開中"が含まれる」を追加
   - 条件Bのコメントに「かつ atbb_statusに"公開中"が含まれる」を追加
   - matchedConditionに「（公開中のみ）」を追加

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチを採用します：まず、修正前のコードでバグを再現し、次に修正後のコードで正しく動作することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: atbb_statusが"非公開"などの買主データを用意し、現在のBuyerStatusCalculatorで「一般媒介_内覧後売主連絡未」に分類されることを確認する。

**Test Cases**:
1. **条件Aのみ満たす + atbb_status="非公開"**: viewing_type_general="一般"、latest_viewing_date="2025-09-15"（過去）、post_viewing_seller_contact=空欄、atbb_status="非公開" → 現在は「一般媒介_内覧後売主連絡未」に分類される（バグ）
2. **条件Bのみ満たす + atbb_status="専任・公開中"**: post_viewing_seller_contact="未"、atbb_status="専任・公開中" → 現在は「一般媒介_内覧後売主連絡未」に分類される（バグ）
3. **条件A満たす + atbb_status="一般・公開中"**: viewing_type_general="一般"、latest_viewing_date="2025-09-20"（過去）、post_viewing_seller_contact=空欄、atbb_status="一般・公開中" → 正しく「一般媒介_内覧後売主連絡未」に分類される
4. **条件B満たす + atbb_status=空欄**: post_viewing_seller_contact="未"、atbb_status=空欄 → 現在は「一般媒介_内覧後売主連絡未」に分類される（バグ）

**Expected Counterexamples**:
- atbb_statusに"公開中"が含まれない買主が「一般媒介_内覧後売主連絡未」に分類される
- 原因: Priority 8のロジックに`contains(buyer.atbb_status, '公開中')`条件が欠けている

### Fix Checking

**Goal**: 修正後のコードで、atbb_statusに"公開中"が含まれる買主のみが「一般媒介_内覧後売主連絡未」に分類されることを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE (conditionA OR conditionB) DO
  result := calculateBuyerStatus_fixed(buyer)
  IF contains(buyer.atbb_status, '公開中') THEN
    ASSERT result.status = '一般媒介_内覧後売主連絡未'
  ELSE
    ASSERT result.status != '一般媒介_内覧後売主連絡未'
  END IF
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、他のサイドバーカテゴリー（Priority 1-7, 9-35）のフィルタリングロジックが変更されていないことを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT (conditionA OR conditionB) DO
  ASSERT calculateBuyerStatus_original(buyer) = calculateBuyerStatus_fixed(buyer)
END FOR
```

**Testing Approach**: Property-based testingを推奨します。理由：
- 多様な買主データパターンを自動生成できる
- 他のカテゴリーへの影響を網羅的に検証できる
- エッジケースを見逃さない

**Test Plan**: 修正前のコードで各カテゴリーに分類される買主データを記録し、修正後も同じカテゴリーに分類されることを確認する。

**Test Cases**:
1. **Priority 9-15の内覧後未入力カテゴリー**: 既に`contains(buyer.atbb_status, '公開中')`条件を持っているため、動作は変わらない
2. **Priority 1-7のカテゴリー**: Priority 8の修正は影響しない（優先順位が高いため）
3. **Priority 23-35のカテゴリー**: Priority 8の修正は影響しない（優先順位が低いため）
4. **atbb_statusに"公開中"が含まれる + 条件A満たす**: 修正前後で「一般媒介_内覧後売主連絡未」に分類される

### Unit Tests

- BuyerStatusCalculatorのPriority 8ロジックをテスト
  - 条件A満たす + atbb_status="一般・公開中" → 「一般媒介_内覧後売主連絡未」
  - 条件A満たす + atbb_status="非公開" → 「一般媒介_内覧後売主連絡未」でない
  - 条件B満たす + atbb_status="一般・公開中" → 「一般媒介_内覧後売主連絡未」
  - 条件B満たす + atbb_status="専任・公開中" → 「一般媒介_内覧後売主連絡未」でない
  - 条件A満たす + atbb_status=空欄 → 「一般媒介_内覧後売主連絡未」でない
- エッジケース
  - atbb_status="公開中"（"一般・"なし） → 「一般媒介_内覧後売主連絡未」に分類される（"公開中"が含まれるため）
  - atbb_status="一般・非公開" → 「一般媒介_内覧後売主連絡未」でない（"公開中"が含まれないため）

### Property-Based Tests

- ランダムな買主データを生成し、以下を検証：
  - atbb_statusに"公開中"が含まれない買主は「一般媒介_内覧後売主連絡未」に分類されない
  - atbb_statusに"公開中"が含まれ、かつ条件A OR 条件Bを満たす買主は「一般媒介_内覧後売主連絡未」に分類される
  - 他のカテゴリーに分類される買主は、修正前後で同じカテゴリーに分類される

### Integration Tests

- 買主リストページのサイドバーで「一般媒介_内覧後売主連絡未」カテゴリーをクリック
- 表示される買主が全てatbb_statusに"公開中"を含むことを確認
- atbb_statusが"非公開"の買主が表示されないことを確認
- 他のカテゴリーをクリックして、正しくフィルタリングされることを確認
