# buyer-sidebar-inquiry-mail-category-fix バグ修正デザイン

## Overview

買主リストのサイドバーカテゴリー「問合メール未対応」の判定条件が誤っている。
`backend/src/services/BuyerStatusCalculator.ts` の Priority 7 において、
現在は `inquiry_email_phone = "未"` **かつ** `inquiry_email_reply = "未"` の両方が揃った場合のみ
「問合メール未対応」に分類されるが、スプレッドシートのIFS式では **どちらか一方が "未"** であれば
分類されるべきである。

修正方針は `and` を `or` に変更し、さらにスプレッドシートの3番目の条件
（内覧日が空欄 かつ 電話対応が "不要" かつ メール返信が "未" または空欄）も追加する。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — `inquiry_email_phone = "未"` または `inquiry_email_reply = "未"` であるにもかかわらず「問合メール未対応」に分類されない状態
- **Property (P)**: 期待される正しい動作 — 上記条件を満たす買主は「問合メール未対応」に分類される
- **Preservation**: 修正によって変更してはならない既存の動作（他のカテゴリーの判定、優先度順序など）
- **calculateBuyerStatus**: `backend/src/services/BuyerStatusCalculator.ts` 内の関数で、買主データからステータスと優先度を算出する
- **Priority 7**: 「問合メール未対応」カテゴリーの優先度番号（Priority 1〜6 より低く、Priority 8 以降より高い）
- **inquiry_email_phone**: 【問合メール】電話対応フィールド（"未" / "不要" / "不通" / 空欄 など）
- **inquiry_email_reply**: 【問合メール】メール返信フィールド（"未" / 空欄 など）
- **latest_viewing_date**: 内覧日（最新）フィールド

## Bug Details

### Bug Condition

`inquiry_email_phone = "未"` または `inquiry_email_reply = "未"` の条件を満たす買主が
「問合メール未対応」に分類されるべきであるにもかかわらず、現在の実装では両方が "未" の場合のみ
分類されるため、片方だけが "未" の買主（例: 買主番号7192）が正しく分類されない。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type BuyerData
  OUTPUT: boolean

  // Priority 1-6 の条件を満たさない前提で評価する
  RETURN (
    equals(buyer.inquiry_email_phone, '未')
    OR equals(buyer.inquiry_email_reply, '未')
    OR (
      isBlank(buyer.latest_viewing_date)
      AND equals(buyer.inquiry_email_phone, '不要')
      AND (
        equals(buyer.inquiry_email_reply, '未')
        OR isBlank(buyer.inquiry_email_reply)
      )
    )
  )
  AND NOT currentlyClassifiedAs(buyer, '問合メール未対応')
END FUNCTION
```

### Examples

- **バグ例1**: `inquiry_email_phone = "未"`, `inquiry_email_reply = null`（空欄）
  - 現在: 「問合メール未対応」に分類されない（`and` 条件のため）
  - 正しい: 「問合メール未対応」に分類されるべき（`inquiry_email_phone = "未"` のため）

- **バグ例2**: `inquiry_email_phone = null`（空欄）, `inquiry_email_reply = "未"`
  - 現在: 「問合メール未対応」に分類されない
  - 正しい: 「問合メール未対応」に分類されるべき（`inquiry_email_reply = "未"` のため）

- **バグ例3**: `latest_viewing_date = null`, `inquiry_email_phone = "不要"`, `inquiry_email_reply = "未"`
  - 現在: 「問合メール未対応」に分類されない（3番目の条件が実装されていない）
  - 正しい: 「問合メール未対応」に分類されるべき（IFS式の3番目の条件）

- **正常例（変更なし）**: `inquiry_email_phone = "未"`, `inquiry_email_reply = "未"`
  - 現在: 「問合メール未対応」に分類される
  - 修正後: 引き続き「問合メール未対応」に分類される

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- Priority 1〜6 の条件を満たす買主は、引き続きそれらの優先度の高いカテゴリーに分類される
- Priority 8 以降（3回架電未、担当別カテゴリー等）の条件のみを満たす買主は、引き続きそれらのカテゴリーに分類される
- `inquiry_email_phone = "不通"` の買主は「問合メール未対応」に分類されない（"不通" は "未" とは異なる）
- `inquiry_email_phone` が "未" でも "不要" でもなく、`inquiry_email_reply` が "未" でも空欄でもない買主は「問合メール未対応」に分類されない

**スコープ:**
Priority 7 の条件判定ロジックのみを変更する。他の Priority の条件、`getStatusColor` の呼び出し、
返却する `status` / `priority` / `matchedCondition` の値は変更しない。

## Hypothesized Root Cause

バグの根本原因は単純なロジックエラーである：

1. **`and` を `or` に変更すべきだった**: スプレッドシートのIFS式では `OR` 条件だが、
   実装時に `AND` 条件として実装されてしまった

2. **3番目の条件が未実装**: スプレッドシートのIFS式には
   「内覧日が空欄 かつ 電話対応が "不要" かつ メール返信が "未" または空欄」という
   3番目の条件があるが、現在の実装には含まれていない

3. **スプレッドシートのIFS式との乖離**: 実装時にスプレッドシートの正確な条件を
   参照せずに実装した可能性がある

## Correctness Properties

Property 1: Bug Condition - 問合メール未対応の正しい分類

_For any_ 買主データにおいて、以下のいずれかの条件を満たし、かつ Priority 1〜6 の条件を満たさない場合、
修正後の `calculateBuyerStatus` 関数は「問合メール未対応」（priority: 7）を返す SHALL:
- `inquiry_email_phone = "未"` である
- `inquiry_email_reply = "未"` である
- `latest_viewing_date` が空欄 かつ `inquiry_email_phone = "不要"` かつ `inquiry_email_reply` が "未" または空欄

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 非バグ条件の動作保持

_For any_ 買主データにおいて、上記のバグ条件を満たさない場合（`inquiry_email_phone` が "未" でも "不要" でもなく、
`inquiry_email_reply` が "未" でも空欄でもない）、修正後の関数は修正前の関数と同じ結果を返す SHALL。
「問合メール未対応」に分類されない動作が保持される。

**Validates: Requirements 3.1, 3.4**

Property 3: Preservation - 優先度順序の保持

_For any_ 買主データにおいて、Priority 1〜6 の条件を満たす場合、修正後の関数は
Priority 7 より高い優先度のステータスを返す SHALL。優先度順序は変更されない。

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerStatusCalculator.ts`

**Function**: `calculateBuyerStatus`

**Specific Changes**:

1. **Priority 7 の条件を `and` から `or` に変更**:
   ```typescript
   // 修正前（誤り）
   if (and(equals(buyer.inquiry_email_phone, '未'), equals(buyer.inquiry_email_reply, '未'))) {

   // 修正後（正しい）
   if (
     or(
       equals(buyer.inquiry_email_phone, '未'),
       equals(buyer.inquiry_email_reply, '未'),
       and(
         isBlank(buyer.latest_viewing_date),
         equals(buyer.inquiry_email_phone, '不要'),
         or(
           equals(buyer.inquiry_email_reply, '未'),
           isBlank(buyer.inquiry_email_reply)
         )
       )
     )
   ) {
   ```

2. **3番目の条件を追加**: スプレッドシートのIFS式の3番目の条件
   （内覧日が空欄 かつ 電話対応が "不要" かつ メール返信が "未" または空欄）を追加する

3. **`status`, `priority`, `matchedCondition`, `color` は変更しない**:
   返却値の内容は現在のまま維持する

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：
1. **探索フェーズ**: 修正前のコードでバグを再現するテストを実行し、根本原因を確認する
2. **検証フェーズ**: 修正後のコードでバグが修正され、既存動作が保持されることを確認する

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `calculateBuyerStatus` に各種バグ条件の買主データを渡し、
「問合メール未対応」に分類されないことを確認する（修正前コードで失敗するテスト）。

**Test Cases**:
1. **電話対応のみ "未" のケース**: `inquiry_email_phone = "未"`, `inquiry_email_reply = null`
   → 修正前は「問合メール未対応」に分類されない（バグ）
2. **メール返信のみ "未" のケース**: `inquiry_email_phone = null`, `inquiry_email_reply = "未"`
   → 修正前は「問合メール未対応」に分類されない（バグ）
3. **3番目の条件のケース**: `latest_viewing_date = null`, `inquiry_email_phone = "不要"`, `inquiry_email_reply = "未"`
   → 修正前は「問合メール未対応」に分類されない（バグ）
4. **両方 "未" のケース（正常動作確認）**: `inquiry_email_phone = "未"`, `inquiry_email_reply = "未"`
   → 修正前も「問合メール未対応」に分類される（正常）

**Expected Counterexamples**:
- テストケース1〜3で `status !== '問合メール未対応'` となることを確認
- 根本原因: `and` 条件のため、片方だけが "未" の場合に分類されない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := calculateBuyerStatus_fixed(buyer)
  ASSERT result.status = '問合メール未対応'
  ASSERT result.priority = 7
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない入力に対して、修正前後で同じ結果が返ることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT calculateBuyerStatus_original(buyer) = calculateBuyerStatus_fixed(buyer)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な買主データを自動生成して網羅的に検証できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正が他のカテゴリーに影響しないことを強く保証できる

**Test Cases**:
1. **"不通" の保持**: `inquiry_email_phone = "不通"` の場合、「問合メール未対応」に分類されないことを確認
2. **Priority 1〜6 の優先度保持**: Priority 1〜6 の条件を満たす場合、それらが優先されることを確認
3. **Priority 8 以降の保持**: バグ条件を満たさず Priority 8 以降の条件を満たす場合、正しく分類されることを確認
4. **両フィールドが空欄の保持**: `inquiry_email_phone = null`, `inquiry_email_reply = null` の場合、「問合メール未対応」に分類されないことを確認

### Unit Tests

- `inquiry_email_phone = "未"` のみの場合に「問合メール未対応」に分類されることを確認
- `inquiry_email_reply = "未"` のみの場合に「問合メール未対応」に分類されることを確認
- 3番目の条件（内覧日空欄 + 電話対応 "不要" + メール返信 "未" または空欄）を確認
- `inquiry_email_phone = "不通"` の場合に「問合メール未対応」に分類されないことを確認
- Priority 1〜6 の条件を満たす場合に Priority 7 より優先されることを確認

### Property-Based Tests

- ランダムな買主データを生成し、`inquiry_email_phone = "未"` の場合は必ず「問合メール未対応」に分類されることを確認（Property 1）
- ランダムな買主データを生成し、`inquiry_email_reply = "未"` の場合は必ず「問合メール未対応」に分類されることを確認（Property 1）
- ランダムな買主データを生成し、バグ条件を満たさない場合は「問合メール未対応」に分類されないことを確認（Property 2）
- Priority 1〜6 の条件を満たすランダムな買主データで、Priority 7 より高い優先度が返ることを確認（Property 3）

### Integration Tests

- 買主リストAPIを呼び出し、`inquiry_email_phone = "未"` の買主が「問合メール未対応」カテゴリーに表示されることを確認
- サイドバーのカテゴリーカウントが正しく更新されることを確認
- 修正後も他のカテゴリー（⑯当日TEL、3回架電未など）が正しく動作することを確認
