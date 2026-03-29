# buyer-latest-status-required-condition-fix Bugfix Design

## Overview

買主詳細ページ（`BuyerDetailPage.tsx`）の `checkMissingFields` 関数と `fetchBuyer` 内の `initialMissing` 構築処理において、「★最新状況」（`latest_status`）フィールドの必須チェック条件が誤っている。

現在の実装では `latest_status` が空欄であれば**無条件で必須**として赤くハイライトされるが、正しくは以下の全条件を満たす場合のみ必須とすべきである：

- 条件A: `inquiry_hearing` が空欄でなく かつ `inquiry_source` に「電話」が含まれる、または `inquiry_email_phone` が「済」である
- 条件B: `reception_date` が 2026-02-08 以降である
- 条件C: `broker_inquiry` が空欄である

修正は `checkMissingFields` と `fetchBuyer` 内の `initialMissing` 構築処理の2箇所に適用する。

## Glossary

- **Bug_Condition (C)**: バグ条件 — `latest_status` が空欄であるにもかかわらず、正しい必須条件を満たさないのに必須フィールドとして扱われるケース
- **Property (P)**: 期待される正しい動作 — 正しい必須条件を満たさない場合、`latest_status` は必須フィールドとして扱われない
- **Preservation**: 既存の他フィールドの必須チェック動作（`initial_assignee`、`inquiry_source`、`distribution_type` 等）が変更されないこと
- **checkMissingFields**: `BuyerDetailPage.tsx` 内の関数。未入力の必須フィールドキーリストを返し、`missingRequiredFields` stateを更新する
- **initialMissing**: `fetchBuyer` 内で初回ロード時に必須フィールドのハイライトを設定するための配列
- **isLatestStatusRequired**: `latest_status` が必須かどうかを判定するロジック（修正対象）

## Bug Details

### Bug Condition

現在の実装は `latest_status` が空欄であれば、買主の問合せ種別・受付日・業者問合せの有無に関わらず必須フィールドとして扱う。正しくは条件A・B・Cの全てを満たす場合のみ必須とすべきである。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerData
  OUTPUT: boolean

  // 現在の誤った実装が「必須」と判定するが、正しくは「必須でない」ケース
  RETURN isBlank(X.latest_status)
    AND NOT (
      AND(
        OR(
          AND(isNotBlank(X.inquiry_hearing), contains(X.inquiry_source, "電話")),
          equals(X.inquiry_email_phone, "済")
        ),
        isAfterOrEqual(X.reception_date, "2026-02-08"),
        isBlank(X.broker_inquiry)
      )
    )
END FUNCTION
```

### Examples

- `broker_inquiry = "業者問合せ"`, `latest_status = ""` → 必須でない（業者問合せあり）
- `reception_date = "2026-01-01"`, `latest_status = ""` → 必須でない（受付日が2026-02-08より前）
- `inquiry_hearing = ""`, `inquiry_source = "電話"`, `inquiry_email_phone = ""`, `latest_status = ""` → 必須でない（ヒアリングなし・問合メール電話対応未済）
- `inquiry_hearing = "初見か：あり"`, `inquiry_source = "電話"`, `reception_date = "2026-03-01"`, `broker_inquiry = ""`, `latest_status = ""` → 必須（全条件を満たす）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `initial_assignee` が空欄の場合は引き続き必須ハイライトされる
- `broker_inquiry` が「業者問合せ」でなく `inquiry_source` が空欄の場合は引き続き必須ハイライトされる
- `distribution_type` が空欄の場合は引き続き必須ハイライトされる
- `inquiry_source` に「メール」が含まれ `inquiry_email_phone` が空欄の場合は引き続き必須ハイライトされる
- 全条件を満たし `latest_status` が空欄の場合は引き続き必須ハイライトされる

**Scope:**
`latest_status` の必須チェック条件のみを変更する。他の必須フィールドのロジックは一切変更しない。

## Hypothesized Root Cause

1. **条件チェックの欠如**: `checkMissingFields` 内の `latest_status` チェックが単純な空欄チェックのみで、条件A・B・Cの評価を行っていない
   ```typescript
   // 現在の誤った実装
   if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
     missingKeys.push('latest_status');
   }
   ```

2. **initialMissing の同様の欠如**: `fetchBuyer` 内の `initialMissing` 構築処理も同じ単純チェックのみ

3. **条件ロジックの未実装**: 正しい必須条件（条件A・B・C）を評価するヘルパー関数が存在しない

## Correctness Properties

Property 1: Bug Condition - latest_status 誤必須ハイライト修正

_For any_ 買主データ X において、isBugCondition(X) が true（`latest_status` が空欄かつ正しい必須条件を満たさない）の場合、修正後の `checkMissingFields` および `initialMissing` 構築処理は `latest_status` を必須フィールドとして扱わない（`missingRequiredFields` に `latest_status` が含まれない）。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 他フィールドの必須チェック動作維持

_For any_ 買主データ X において、isBugCondition(X) が false（正しい必須条件を満たす、または `latest_status` が空欄でない）の場合、修正後の `checkMissingFields` は修正前と同じ結果を返す。また、`latest_status` 以外の必須フィールド（`initial_assignee`、`inquiry_source`、`distribution_type` 等）のチェック結果は変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Specific Changes**:

1. **isLatestStatusRequired ヘルパー関数の追加**: `checkMissingFields` 内（または関数外）に正しい必須条件を評価するロジックを追加
   ```typescript
   const isLatestStatusRequired = (data: any): boolean => {
     // 条件C: broker_inquiry が空欄
     if (data.broker_inquiry && String(data.broker_inquiry).trim()) return false;
     // 条件B: reception_date が 2026-02-08 以降
     if (!data.reception_date) return false;
     const receptionDate = new Date(data.reception_date);
     if (receptionDate < new Date('2026-02-08')) return false;
     // 条件A: (inquiry_hearingが空欄でない AND inquiry_sourceに「電話」を含む) OR inquiry_email_phoneが「済」
     const hearingFilled = data.inquiry_hearing && String(data.inquiry_hearing).trim();
     const hasPhone = data.inquiry_source && String(data.inquiry_source).includes('電話');
     const emailPhoneDone = data.inquiry_email_phone && String(data.inquiry_email_phone) === '済';
     if (!((hearingFilled && hasPhone) || emailPhoneDone)) return false;
     return true;
   };
   ```

2. **checkMissingFields の latest_status チェックを修正**:
   ```typescript
   // 修正前
   if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
     missingKeys.push('latest_status');
   }
   // 修正後
   if (isLatestStatusRequired(buyer) && (!buyer.latest_status || !String(buyer.latest_status).trim())) {
     missingKeys.push('latest_status');
   }
   ```

3. **fetchBuyer 内の initialMissing の latest_status チェックを修正**:
   ```typescript
   // 修正前
   if (!res.data.latest_status || !String(res.data.latest_status).trim()) {
     initialMissing.push('latest_status');
   }
   // 修正後
   if (isLatestStatusRequired(res.data) && (!res.data.latest_status || !String(res.data.latest_status).trim())) {
     initialMissing.push('latest_status');
   }
   ```

## Testing Strategy

### Validation Approach

未修正コードでバグを再現するテストを先に書き、修正後に全テストがパスすることを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグ条件が発生することを確認する。

**Test Plan**: `isLatestStatusRequired` ロジックを直接テストし、バグ条件（業者問合せあり・受付日が古い・ヒアリングなし等）で誤って必須扱いされることを確認する。

**Test Cases**:
1. `broker_inquiry = "業者問合せ"`, `latest_status = ""` → 未修正コードでは必須扱い（バグ）
2. `reception_date = "2026-01-01"`, `latest_status = ""` → 未修正コードでは必須扱い（バグ）
3. `inquiry_hearing = ""`, `inquiry_source = "電話"`, `inquiry_email_phone = ""`, `latest_status = ""` → 未修正コードでは必須扱い（バグ）
4. 全条件を満たす買主で `latest_status = ""` → 未修正・修正後ともに必須扱い（正常）

**Expected Counterexamples**:
- 業者問合せあり・受付日が古い・ヒアリングなしの買主で `latest_status` が必須扱いされる

### Fix Checking

**Goal**: 修正後、バグ条件を満たす全入力で `latest_status` が必須扱いされないことを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := isLatestStatusRequired_fixed(X)
  ASSERT result = false
END FOR
```

### Preservation Checking

**Goal**: 修正後、バグ条件を満たさない入力で動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT isLatestStatusRequired_original(X) = isLatestStatusRequired_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストで多数のランダム入力を生成し、修正前後の動作が一致することを確認する。

**Test Cases**:
1. 全条件を満たす買主で `latest_status = ""` → 修正前後ともに必須扱い
2. 全条件を満たす買主で `latest_status = "商談中"` → 修正前後ともに必須扱いなし
3. `initial_assignee` が空欄 → 修正前後ともに必須扱い（他フィールドへの影響なし）
4. `distribution_type` が空欄 → 修正前後ともに必須扱い（他フィールドへの影響なし）

### Unit Tests

- `isLatestStatusRequired` ヘルパーの各条件（A・B・C）の単体テスト
- 条件の境界値テスト（`reception_date = "2026-02-08"` ちょうど）
- `checkMissingFields` の統合テスト（バグ条件・正常条件）

### Property-Based Tests

- ランダムな買主データを生成し、isBugCondition が true の場合は `latest_status` が必須扱いされないことを検証
- ランダムな買主データを生成し、`latest_status` 以外のフィールドの必須チェック結果が変わらないことを検証

### Integration Tests

- 業者問合せありの買主詳細ページで `latest_status` が赤くハイライトされないことを確認
- 受付日が2026-02-08より前の買主詳細ページで `latest_status` が赤くハイライトされないことを確認
- 全条件を満たす買主詳細ページで `latest_status` が空欄の場合に赤くハイライトされることを確認
