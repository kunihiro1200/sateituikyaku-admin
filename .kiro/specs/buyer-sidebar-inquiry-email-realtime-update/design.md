# 買主サイドバー「問合せメール未対応」リアルタイム更新 バグ修正デザイン

## Overview

買主詳細画面で `inquiry_email_phone` フィールドを更新しても、サイドバーの「問合せメール未対応」カウントがリアルタイムに更新されないバグを修正する。

根本原因は2つある：
1. `BuyerService.shouldUpdateBuyerSidebarCounts()` の監視フィールドリストに `inquiry_email_phone` が含まれていない
2. `SidebarCountsUpdateService.determineBuyerCategories()` に `inquiryEmailUnanswered` カテゴリの判定ロジックが実装されていない

この修正により、`inquiry_email_phone` の更新後にサイドバーカウントが即座に差分更新される。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `inquiry_email_phone` フィールドを更新したにもかかわらず、サイドバーカウント更新がトリガーされない、またはカウントが正しく減算されない状態
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作 — `inquiry_email_phone` 更新後にサイドバーカウントが即座に正しく更新される
- **Preservation**: 修正によって変更されてはならない既存の動作 — 他フィールド更新時のサイドバーカウント更新、他カテゴリのカウント動作
- **shouldUpdateBuyerSidebarCounts**: `backend/src/services/BuyerService.ts` 内のプライベートメソッド。更新データにサイドバーカテゴリに影響するフィールドが含まれているかを判定する
- **determineBuyerCategories**: `backend/src/services/SidebarCountsUpdateService.ts` 内のプライベートメソッド。買主データから所属するサイドバーカテゴリを判定し、差分更新に使用する
- **inquiryEmailUnanswered**: 「問合せメール未対応」サイドバーカテゴリのキー名。`inquiry_email_phone` が `'未'` の場合などに該当する
- **inquiry_email_phone**: 買主テーブルの「問合メール電話」フィールド。値は `'未'`、`'済'`、`'不通'`、`'不要'` 等

## Bug Details

### Bug Condition

バグは、買主詳細画面で `inquiry_email_phone` フィールドを更新して保存したときに発生する。
`shouldUpdateBuyerSidebarCounts()` が `inquiry_email_phone` の変更を検知できず、
かつ `determineBuyerCategories()` が `inquiryEmailUnanswered` カテゴリを判定しないため、
差分更新でカウントが正しく減算されない。

**Formal Specification:**
```
FUNCTION isBugCondition(updateData, buyer)
  INPUT: updateData - 更新フィールドのオブジェクト
         buyer - 更新前の買主データ
  OUTPUT: boolean

  RETURN 'inquiry_email_phone' IN keys(updateData)
         AND buyer.inquiry_email_phone IN ['未', '不要']  // 更新前が「問合メール未対応」条件を満たす
         AND NOT sidebarCountUpdateTriggered(updateData)  // カウント更新がトリガーされない
END FUNCTION
```

### Examples

- `inquiry_email_phone` を `'未'` → `'済'` に更新 → サイドバーカウント更新がトリガーされず「問合せメール未対応 1」が残る（バグ）
- `inquiry_email_phone` を `'未'` → `'済'` に更新 → サイドバーから「問合せメール未対応」が消えるべき（期待動作）
- 「問合せメール未対応」カテゴリをクリック → 「買主データが見つかりませんでした」と表示され、コンソールに404エラー（バグの副作用）
- `inquiry_email_phone` が `'未'` のままの別の買主が存在する → 引き続きカウントされるべき（保持）

## Expected Behavior

### Preservation Requirements

**変更されてはならない動作:**
- `next_call_date`、`follow_up_assignee`、`viewing_date`、`notification_sender` フィールドを更新した場合のサイドバーカウント更新は従来通り動作する
- `inquiry_email_phone` が `'未'` のままの買主は引き続き「問合せメール未対応」カテゴリにカウントされる
- 「内覧日前日」「当日TEL」「担当」等の他のサイドバーカテゴリのカウントは影響を受けない
- 買主リストページの初回ロード時のサイドバーカウント表示は従来通り動作する

**スコープ:**
`inquiry_email_phone` フィールドの更新を含まない操作は、今回の修正によって一切影響を受けない。これには以下が含まれる：
- 他フィールドの更新（`next_call_date` 等）
- マウスクリックによるボタン操作
- 初回ページロード時のサイドバーカウント取得

## Hypothesized Root Cause

根本原因は2つある：

1. **`shouldUpdateBuyerSidebarCounts()` の監視フィールドリスト不足**
   - `backend/src/services/BuyerService.ts` の `sidebarFields` 配列に `inquiry_email_phone` が含まれていない
   - 現在のリスト: `['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender']`
   - `inquiry_email_phone` を更新しても `shouldUpdateBuyerSidebarCounts()` が `false` を返すため、サイドバーカウント更新がスキップされる

2. **`determineBuyerCategories()` の `inquiryEmailUnanswered` 判定ロジック未実装**
   - `backend/src/services/SidebarCountsUpdateService.ts` の `determineBuyerCategories()` に `inquiryEmailUnanswered` カテゴリの判定が存在しない
   - `BuyerStatusCalculator.ts` の Priority 5 判定ロジック（`inquiry_email_phone === '未'` 等）が移植されていない
   - 仮に問題1が修正されてもカウント更新がトリガーされるだけで、差分計算で `inquiryEmailUnanswered` が `removed` に含まれないため、カウントが減算されない

3. **GASとの非同期性**
   - GASによる全件集計（10分ごと）では `inquiryEmailUnanswered` カウントは正しく計算されているが、リアルタイム差分更新のパスが機能していない

## Correctness Properties

Property 1: Bug Condition - inquiry_email_phone 更新でサイドバーカウント更新がトリガーされる

_For any_ 更新データに `inquiry_email_phone` フィールドが含まれる場合、修正後の `shouldUpdateBuyerSidebarCounts()` は `true` を返し、サイドバーカウント更新をトリガーする。

**Validates: Requirements 2.1**

Property 2: Bug Condition - inquiryEmailUnanswered カテゴリが正しく判定される

_For any_ 買主データで `inquiry_email_phone === '未'`、または `inquiry_email_phone === '不要'` かつ `latest_viewing_date` が空欄 かつ `inquiry_email_reply` が `'未'` または空欄の場合、修正後の `determineBuyerCategories()` は `inquiryEmailUnanswered` カテゴリを返す。

**Validates: Requirements 2.2**

Property 3: Preservation - 既存フィールドの監視動作が維持される

_For any_ 更新データに `next_call_date`、`follow_up_assignee`、`viewing_date`、`notification_sender` のいずれかが含まれる場合、修正後の `shouldUpdateBuyerSidebarCounts()` は修正前と同じく `true` を返す。

**Validates: Requirements 3.1**

Property 4: Preservation - inquiry_email_phone が '未' の買主は引き続きカウントされる

_For any_ 買主データで `inquiry_email_phone === '未'` の場合、修正後の `determineBuyerCategories()` は `inquiryEmailUnanswered` カテゴリを返し、カウントが維持される。

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正内容：

**File 1**: `backend/src/services/BuyerService.ts`

**Function**: `shouldUpdateBuyerSidebarCounts`

**Specific Changes**:
1. **sidebarFields リストに `inquiry_email_phone` を追加**
   - 変更前: `['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender']`
   - 変更後: `['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender', 'inquiry_email_phone']`

---

**File 2**: `backend/src/services/SidebarCountsUpdateService.ts`

**Function**: `determineBuyerCategories`

**Specific Changes**:
2. **`inquiryEmailUnanswered` カテゴリの判定ロジックを追加**
   - `BuyerStatusCalculator.ts` の Priority 5 判定ロジックを参考に実装
   - 判定条件（OR）:
     - `inquiry_email_phone === '未'`
     - `inquiry_email_reply === '未'`
     - `latest_viewing_date` が空欄 かつ `inquiry_email_phone === '不要'` かつ (`inquiry_email_reply === '未'` または空欄)
   - 既存の `viewingDayBefore`、`todayCall`、`assigned` カテゴリ判定の後に追加

**追加するコードのイメージ:**
```typescript
// 問合せメール未対応
const isInquiryEmailUnanswered =
  buyer.inquiry_email_phone === '未' ||
  buyer.inquiry_email_reply === '未' ||
  (
    !buyer.latest_viewing_date &&
    buyer.inquiry_email_phone === '不要' &&
    (buyer.inquiry_email_reply === '未' || !buyer.inquiry_email_reply)
  );

if (isInquiryEmailUnanswered) {
  categories.push({ category: 'inquiryEmailUnanswered', assignee: null });
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず未修正コードでバグを再現するカウンターエグザンプルを確認し、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `shouldUpdateBuyerSidebarCounts()` と `determineBuyerCategories()` に対して、`inquiry_email_phone` を含む入力でテストを実行し、未修正コードでの失敗を観察する。

**Test Cases**:
1. **shouldUpdateBuyerSidebarCounts - inquiry_email_phone のみ更新**: `{ inquiry_email_phone: '済' }` を渡すと `false` を返す（未修正コードでは FAIL: `true` を期待）
2. **determineBuyerCategories - inquiry_email_phone='未' の買主**: `inquiryEmailUnanswered` カテゴリが返されない（未修正コードでは FAIL: カテゴリが含まれることを期待）
3. **差分更新でカウントが減算されない**: `inquiry_email_phone` を `'未'` → `'済'` に更新後、`inquiryEmailUnanswered` が `removed` に含まれない（未修正コードでは FAIL）

**Expected Counterexamples**:
- `shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: '済' })` が `false` を返す
- `determineBuyerCategories({ inquiry_email_phone: '未', ... })` が `[]` を返す（`inquiryEmailUnanswered` が含まれない）

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL updateData WHERE 'inquiry_email_phone' IN keys(updateData) DO
  result := shouldUpdateBuyerSidebarCounts_fixed(updateData)
  ASSERT result === true
END FOR

FOR ALL buyer WHERE isBugCondition(buyer) DO
  categories := determineBuyerCategories_fixed(buyer)
  ASSERT 'inquiryEmailUnanswered' IN categories.map(c => c.category)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL updateData WHERE 'inquiry_email_phone' NOT IN keys(updateData) DO
  ASSERT shouldUpdateBuyerSidebarCounts_original(updateData)
       = shouldUpdateBuyerSidebarCounts_fixed(updateData)
END FOR

FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT determineBuyerCategories_original(buyer)
       = determineBuyerCategories_fixed(buyer)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な買主データパターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存カテゴリ（`viewingDayBefore`、`todayCall`、`assigned`）への影響がないことを強く保証できる

**Test Cases**:
1. **既存フィールド更新の保持**: `next_call_date`、`follow_up_assignee`、`viewing_date`、`notification_sender` を含む更新データで `shouldUpdateBuyerSidebarCounts()` が `true` を返すことを確認
2. **inquiry_email_phone 非関連フィールドの保持**: `inquiry_email_phone` を含まない更新データで `shouldUpdateBuyerSidebarCounts()` の動作が変わらないことを確認
3. **他カテゴリ判定の保持**: `inquiry_email_phone` が `'未'` でない買主で `determineBuyerCategories()` が `inquiryEmailUnanswered` を返さないことを確認
4. **viewingDayBefore カテゴリの保持**: `viewing_date` が明日の買主で `viewingDayBefore` カテゴリが引き続き返されることを確認

### Unit Tests

- `shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: '済' })` が `true` を返すことをテスト
- `shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: '未' })` が `true` を返すことをテスト
- `shouldUpdateBuyerSidebarCounts({ next_call_date: '2026-01-01' })` が引き続き `true` を返すことをテスト
- `determineBuyerCategories({ inquiry_email_phone: '未', ... })` が `inquiryEmailUnanswered` を含むことをテスト
- `determineBuyerCategories({ inquiry_email_phone: '済', ... })` が `inquiryEmailUnanswered` を含まないことをテスト
- `determineBuyerCategories({ inquiry_email_phone: '不要', latest_viewing_date: null, inquiry_email_reply: '未', ... })` が `inquiryEmailUnanswered` を含むことをテスト

### Property-Based Tests

- ランダムな買主データを生成し、`inquiry_email_phone === '未'` の場合は常に `inquiryEmailUnanswered` カテゴリが含まれることを検証
- ランダムな更新データを生成し、`inquiry_email_phone` を含む場合は常に `shouldUpdateBuyerSidebarCounts()` が `true` を返すことを検証
- `inquiry_email_phone` を含まない多様な更新データで、修正前後の `shouldUpdateBuyerSidebarCounts()` の結果が一致することを検証

### Integration Tests

- 買主詳細画面で `inquiry_email_phone` を `'未'` → `'済'` に更新後、サイドバーの「問合せメール未対応」カウントが即座に減算されることを確認
- 「問合せメール未対応」の買主が0件になった後、サイドバーからカテゴリが消えることを確認
- `inquiry_email_phone` 更新後に他のサイドバーカテゴリ（「当日TEL」等）のカウントが変化しないことを確認
