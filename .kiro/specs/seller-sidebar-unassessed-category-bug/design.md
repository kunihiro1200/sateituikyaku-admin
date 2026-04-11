# seller-sidebar-unassessed-category-bug バグ修正デザイン

## Overview

売主リストサイドバーにおいて、AA13953が「⑤未査定」カテゴリに誤って表示されるバグを修正する。

本来、AA13953は「⑦当日TEL_未着手」の全条件を満たしているため、「⑦当日TEL_未着手」カテゴリにのみ表示されるべきである。

**バグの根本原因**: `isUnvaluated()` 関数内に `isTodayCallNotStarted()` の除外ロジックが存在するが、コードを確認すると既に実装されている。しかし、`isTodayCallNotStarted()` が `true` を返す売主に対して `isUnvaluated()` も `true` を返してしまっている状態が発生している。

**修正方針**: `isUnvaluated()` 内の除外チェック順序と条件を精査し、`isTodayCallNotStarted()` が `true` の場合は確実に `false` を返すよう保証する。

## Glossary

- **Bug_Condition (C)**: 「当日TEL_未着手」の全条件を満たす売主が `isUnvaluated()` でも `true` を返してしまう状態
- **Property (P)**: `isTodayCallNotStarted(seller)` が `true` の場合、`isUnvaluated(seller)` は必ず `false` を返すべき
- **Preservation**: 「当日TEL_未着手」条件を満たさない売主の `isUnvaluated()` 判定は変更しない
- **isUnvaluated**: `frontend/frontend/src/utils/sellerStatusFilters.ts` 内の未査定判定関数
- **isTodayCallNotStarted**: 同ファイル内の当日TEL_未着手判定関数。`isTodayCall()` を内部で呼び出す
- **isTodayCall**: 当日TEL分の基本条件（追客中 + 次電日今日以前 + コミュニケーション情報なし + 営担なし）を判定する関数
- **inquiryDate**: 反響日付。`isUnvaluated()` と `isTodayCallNotStarted()` の両方で参照される

## Bug Details

### Bug Condition

「当日TEL_未着手」の全条件（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし + 不通が空欄 + 反響日付が2026/1/1以降）を満たす売主に対して、`isUnvaluated()` が `false` を返さず（除外されず）、「⑤未査定」カテゴリに誤って表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  RETURN isTodayCallNotStarted(seller) = true
         AND isUnvaluated(seller) = true
END FUNCTION
```

### Examples

- **AA13953（バグあり）**: 反響日付=2026/1/1以降、状況=追客中、営担なし、不通=空欄、次電日=今日以前、コミュニケーション情報なし、査定額なし → `isTodayCallNotStarted()=true` かつ `isUnvaluated()=true`（誤り）→「⑤未査定」に表示される（誤り）
- **AA13953（修正後）**: 同条件 → `isTodayCallNotStarted()=true` かつ `isUnvaluated()=false`（正しい）→「⑦当日TEL_未着手」にのみ表示される
- **反響日付が2025-12-10の売主**: `isTodayCallNotStarted()=false`（反響日付が2026/1/1未満）→ `isUnvaluated()` の除外対象外 → 「⑤未査定」に表示される（正しい）
- **営担ありの売主**: `isTodayCallNotStarted()=false`（営担ありのため `isTodayCall()=false`）→ `isUnvaluated()` の除外対象外だが、営担チェックで除外 → 「⑤未査定」に表示されない（正しい）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 反響日付が2026/1/1より前の売主は、他の条件を満たす場合に「⑤未査定」カテゴリに引き続き表示される
- 営担（visitAssignee）が入力されている売主は「⑤未査定」カテゴリに表示されない（変更なし）
- 「③当日TEL分」の条件を満たす売主（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし）は引き続き「③当日TEL分」に表示される
- マウスクリックなど、キーボード以外の操作は一切影響を受けない

**Scope:**
`isTodayCallNotStarted()` が `false` を返す全ての売主に対して、`isUnvaluated()` の動作は変更されない。これには以下が含まれる：
- 反響日付が2026/1/1より前の売主
- 不通カラムに入力がある売主
- 状況が「追客中」以外の売主
- 営担がある売主

## Hypothesized Root Cause

ソースコードを確認すると、`isUnvaluated()` の末尾に以下の除外ロジックが既に実装されている：

```typescript
// 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
if (isTodayCallNotStarted(seller)) {
  return false;
}
```

しかし、このチェックが `normalizedInquiryDate >= CUTOFF_DATE_STR` の判定**直前**に置かれている。

**仮説1（最有力）: 除外チェックの実行タイミング問題**

`isUnvaluated()` の処理フローを追うと：
1. `isValuationNotRequired()` チェック
2. `status.includes('追客中')` チェック
3. `hasAssignee` チェック
4. `hasNoValuation` チェック
5. `normalizedInquiryDate` の取得・nullチェック
6. **`isTodayCallNotStarted(seller)` チェック** ← ここで除外
7. `normalizedInquiryDate >= CUTOFF_DATE_STR` の判定

この順序自体は問題ないように見えるが、`isTodayCallNotStarted()` が内部で `isTodayCall()` を呼び出し、`isTodayCall()` が `isTodayCallBase()` を呼び出す。`isTodayCallBase()` は `status.includes('追客')` で判定するが、`isUnvaluated()` は `status.includes('追客中')` で判定する。この差異により、特定の状況値（例: 「除外後追客中」「他決→追客」）で挙動が異なる可能性がある。

**仮説2: `isTodayCallNotStarted()` の内部条件の不整合**

`isTodayCallNotStarted()` は `status !== '追客中'`（完全一致）の場合に `false` を返す。一方、`isUnvaluated()` は `status.includes('追客中')` で判定する。AA13953の状況が「追客中」（完全一致）であれば、両方の条件を満たすため、除外ロジックが正しく機能するはずである。

**仮説3: フィールド参照の不整合**

`isTodayCallNotStarted()` は `seller.inquiryDate || seller.inquiry_date || seller.inquiryDetailedDatetime` を参照し、`isUnvaluated()` も同じフィールドを参照する。しかし、`isTodayCallNotStarted()` のカットオフ日は `2026-01-01`、`isUnvaluated()` のカットオフ日は `2025-12-08` であるため、反響日付が `2025-12-08` 〜 `2025-12-31` の範囲の売主は `isUnvaluated()=true` かつ `isTodayCallNotStarted()=false` となり、正しく「⑤未査定」に表示される。AA13953の反響日付が `2026-01-01` 以降であれば、除外ロジックが機能するはずだが、何らかの理由で機能していない可能性がある。

## Correctness Properties

Property 1: Bug Condition - 当日TEL_未着手の売主は未査定から除外される

_For any_ 売主において `isTodayCallNotStarted(seller)` が `true` を返す場合、修正後の `isUnvaluated(seller)` は必ず `false` を返し、「⑤未査定」カテゴリに表示されない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 当日TEL_未着手でない売主の未査定判定は変わらない

_For any_ 売主において `isTodayCallNotStarted(seller)` が `false` を返す場合、修正後の `isUnvaluated(seller)` は修正前と同じ結果を返し、既存の未査定判定ロジックを保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `isUnvaluated`

**Specific Changes**:

1. **除外チェックの位置を前倒し**: `isTodayCallNotStarted(seller)` のチェックを、`normalizedInquiryDate` の取得前（できるだけ早い段階）に移動する。これにより、不要な計算を省きつつ、除外ロジックが確実に実行される。

   現在の順序:
   ```typescript
   // ... 各種チェック ...
   const inquiryDate = seller.inquiryDate || ...;
   const normalizedInquiryDate = normalizeDateString(inquiryDate);
   if (!normalizedInquiryDate) return false;
   
   // 当日TEL_未着手の条件を満たす場合は未査定から除外
   if (isTodayCallNotStarted(seller)) {
     return false;
   }
   return normalizedInquiryDate >= CUTOFF_DATE_STR;
   ```

   修正後の順序（案）:
   ```typescript
   // ... 各種チェック ...
   
   // 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
   if (isTodayCallNotStarted(seller)) {
     return false;
   }
   
   const inquiryDate = seller.inquiryDate || ...;
   const normalizedInquiryDate = normalizeDateString(inquiryDate);
   if (!normalizedInquiryDate) return false;
   return normalizedInquiryDate >= CUTOFF_DATE_STR;
   ```

2. **探索的テストによる根本原因の確定**: 修正前に探索的テストを実行し、AA13953の実際のデータで `isTodayCallNotStarted()` と `isUnvaluated()` の両方が `true` を返すことを確認する。根本原因が仮説1〜3のどれかを特定してから実装を確定する。

3. **テストによる検証**: 修正後、Property 1とProperty 2の両方を満たすことをテストで確認する。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず未修正コードでバグを再現する探索的テストを実行し、根本原因を確定する。次に修正後のコードでProperty 1（バグ修正）とProperty 2（保存）の両方を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `isTodayCallNotStarted()=true` かつ `isUnvaluated()=true` となるケースを再現し、根本原因を確定する。

**Test Plan**: AA13953相当のデータを使ってユニットテストを作成し、未修正コードで実行する。

**Test Cases**:
1. **AA13953相当テスト**: 反響日付=2026-01-15、状況=追客中、営担なし、不通=空欄、次電日=今日以前、コミュニケーション情報なし、査定額なし → `isTodayCallNotStarted()=true` かつ `isUnvaluated()=true` となることを確認（未修正コードで失敗するはず）
2. **境界値テスト（反響日付=2026-01-01）**: カットオフ日ちょうどの売主で同様の確認
3. **状況値バリエーションテスト**: 状況=「追客中」（完全一致）と「除外後追客中」（部分一致）で挙動の差異を確認
4. **フィールド参照テスト**: `inquiryDate` と `inquiry_date` の両方のフィールド名で動作確認

**Expected Counterexamples**:
- `isTodayCallNotStarted()=true` の売主に対して `isUnvaluated()=true` が返される
- 可能性のある原因: 除外チェックの実行タイミング、フィールド参照の不整合

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して期待される動作を確認する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := isUnvaluated_fixed(seller)
  ASSERT result = false
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない全ての入力に対して、修正前と同じ結果を返すことを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT isUnvaluated_original(seller) = isUnvaluated_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 入力ドメイン（反響日付、状況値、各フィールドの組み合わせ）が広い
- 手動テストでは見落としやすいエッジケースを自動的に発見できる
- 「修正前と同じ結果」という保存性を強く保証できる

**Test Cases**:
1. **反響日付が2025-12-08〜2025-12-31の売主**: `isTodayCallNotStarted()=false` → `isUnvaluated()` の結果が変わらないことを確認
2. **反響日付が2025-12-08より前の売主**: 同様に `isUnvaluated()` の結果が変わらないことを確認
3. **営担ありの売主**: `isUnvaluated()=false` が変わらないことを確認
4. **査定額ありの売主**: `isUnvaluated()=false` が変わらないことを確認

### Unit Tests

- `isTodayCallNotStarted()=true` の売主に対して `isUnvaluated()=false` を返すことを確認
- 反響日付が2026/1/1以降かつ他の未着手条件を満たす売主のテスト
- 反響日付が2025/12/8〜2025/12/31の売主が引き続き「⑤未査定」に表示されることを確認
- 不通カラムに入力がある売主が「⑦当日TEL_未着手」から除外されることを確認

### Property-Based Tests

- ランダムな反響日付（2025-12-08以降）を持つ売主を生成し、`isTodayCallNotStarted()=true` の場合は `isUnvaluated()=false` となることを検証
- ランダムな売主データを生成し、`isTodayCallNotStarted()=false` の場合は修正前後で `isUnvaluated()` の結果が一致することを検証
- 状況値のバリエーション（「追客中」「除外後追客中」「他決→追客」など）を網羅的にテスト

### Integration Tests

- AA13953相当の売主データを使って `getCategoryCounts()` を実行し、`unvaluated` カウントに含まれないことを確認
- `todayCallNotStarted` カウントに正しくカウントされることを確認
- 反響日付が2025-12-10の売主が `unvaluated` カウントに含まれることを確認（保存性）
