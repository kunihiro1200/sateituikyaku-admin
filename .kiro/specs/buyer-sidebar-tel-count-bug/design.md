# 買主サイドバーTELカウントバグ 修正設計

## Overview

サイドバーの「当日TEL」カウント（GAS: `updateBuyerSidebarCounts()`）と、一覧フィルタリング（バックエンド: `calculateBuyerStatus()`）で「当日TEL」の判定条件が異なるため、件数が一致しないバグ。

修正方針: GAS側の判定条件をバックエンド側に合わせる（`=今日` → `<=今日`、担当あり/なしで分岐）。

## Glossary

- **Bug_Condition (C)**: GASの`updateBuyerSidebarCounts()`が誤った条件で「当日TEL」をカウントする状態
- **Property (P)**: GASとバックエンドの「当日TEL」判定条件が一致し、サイドバーカウントと一覧件数が等しくなること
- **Preservation**: 修正対象外の全カウント（内覧日前日、担当別カウント等）が変更前と同じ結果を返すこと
- **updateBuyerSidebarCounts()**: `gas_buyer_complete_code.js` 内のGAS関数。スプレッドシートの買主データを集計してサイドバーに表示するカウントを更新する
- **calculateBuyerStatus()**: `backend/src/services/BuyerStatusCalculator.ts` 内のバックエンド関数。買主1件のステータスを判定し、一覧フィルタリングに使用する
- **next_call_date**: 次回架電予定日。「当日TEL」判定の基準となる日付フィールド
- **follow_up_assignee**: 追客担当者イニシャル。空の場合は「当日TEL」、空でない場合は「当日TEL(担当)」として分類する
- **initial_assignee**: 初期担当者イニシャル。`follow_up_assignee`が空の場合のフォールバック

## Bug Details

### Bug Condition

GASの`updateBuyerSidebarCounts()`が「当日TEL」を判定する際、以下の2点でバックエンドと条件が異なる。

1. `next_call_date === 今日`（今日のみ）を使用しているが、バックエンドは`next_call_date <= 今日`（今日以前）を使用している
2. `follow_up_assignee`の有無に関わらず`counts.todayCall`にカウントしているが、バックエンドは`follow_up_assignee`が空の場合のみ「当日TEL」と判定する

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer オブジェクト（next_call_date, follow_up_assignee フィールドを含む）
  OUTPUT: boolean

  todayStr := 今日の日付文字列（YYYY/MM/DD形式）
  nextCallDate := buyer.next_call_date

  -- GASが誤ったカウントをする条件
  RETURN (nextCallDate === todayStr)                    -- 今日のみ（<=今日 ではない）
         OR (nextCallDate < todayStr                    -- 過去日付なのにカウントされない
             AND NOT buyer.follow_up_assignee)          -- 担当なしなのに漏れる
         OR (nextCallDate <= todayStr                   -- 今日以前なのに
             AND buyer.follow_up_assignee               -- 担当ありなのに todayCall にカウントされる)
END FUNCTION
```

### Examples

- **買主7326**: `next_call_date = 今日以前`, `follow_up_assignee = 空` → バックエンドは「当日TEL」と判定するが、GASは`next_call_date === 今日`でないためカウントしない（漏れ）
- **買主7327**: `next_call_date = 今日以前`, `follow_up_assignee = 空` → 同上（漏れ）
- **買主7342**: `next_call_date = 今日以前`, `follow_up_assignee = 空` → 同上（漏れ）
- **担当ありの買主**: `next_call_date = 今日`, `follow_up_assignee = 'Y'` → GASは`counts.todayCall`にカウントするが、バックエンドは「当日TEL(Y)」として別カテゴリに分類する（過剰カウント）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `next_call_date`が未来の日付である買主は「当日TEL」にカウントしない
- `next_call_date`が空である買主は「当日TEL」にカウントしない
- 内覧日前日カウント（`counts.viewingDayBefore`）は変更なし
- 担当別カウント（`counts.assigned`）の集計ロジックは変更なし（ただしassignee取得順序は修正対象）
- `follow_up_assignee`が空でない買主の`next_call_date`が今日以前の場合は「当日TEL(担当)」としてカウントする

**Scope:**
`next_call_date`が未来の日付、または`next_call_date`が空の買主は修正の影響を受けない。また、「当日TEL」以外のカウントカテゴリ（内覧日前日、担当別等）も影響を受けない。

## Hypothesized Root Cause

1. **日付比較演算子の誤り**: `===`（完全一致）を使用しているため、過去日付の`next_call_date`を持つ買主がカウントされない。バックエンドは`<=`（以前）を使用している。

2. **follow_up_assigneeによる分岐の欠如**: 担当ありの買主を`counts.todayCall`と`counts.todayCallAssigned`の両方にカウントしている（または`todayCall`のみにカウントしている）。バックエンドは担当なしのみ「当日TEL」、担当ありは「当日TEL(担当)」として別カテゴリに分類する。

3. **assignee取得順序の誤り**: `initial_assignee || follow_up_assignee`（initial_assigneeを優先）となっているが、バックエンドは`follow_up_assignee || initial_assignee`（follow_up_assigneeを優先）を使用している。

4. **GASとバックエンドの仕様乖離**: 両者が独立して実装されたため、判定ロジックの同期が取れていない。

## Correctness Properties

Property 1: Bug Condition - 当日TELカウント条件の一致

_For any_ 買主データにおいて`next_call_date <= 今日`かつ`follow_up_assignee`が空である場合（isBugConditionが示す誤カウント対象）、修正後の`updateBuyerSidebarCounts()`は当該買主を`counts.todayCall`にカウントし、`calculateBuyerStatus()`が「当日TEL」と判定する買主の集合と一致するべきである。

**Validates: Requirements 2.1, 2.4**

Property 2: Preservation - 非バグ条件入力の動作保持

_For any_ 買主データにおいて`next_call_date`が未来の日付または空である場合（isBugConditionが示す誤カウント対象でない場合）、修正後の`updateBuyerSidebarCounts()`は修正前と同じカウント結果を返し、既存の全カウントカテゴリの動作を保持するべきである。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `gas_buyer_complete_code.js`

**Function**: `updateBuyerSidebarCounts()`

**Specific Changes**:

1. **assignee取得順序の修正**: `initial_assignee || follow_up_assignee` → `follow_up_assignee || initial_assignee`
   ```javascript
   // 修正前
   var assignee = buyer.initial_assignee || buyer.follow_up_assignee || '';
   // 修正後
   var assignee = buyer.follow_up_assignee || buyer.initial_assignee || '';
   ```

2. **日付比較演算子の修正**: `===` → `<=`（今日以前を対象とする）
   ```javascript
   // 修正前
   if (nextCallDate === todayStr) {
   // 修正後
   if (nextCallDate && nextCallDate <= todayStr) {
   ```

3. **follow_up_assigneeによる分岐の追加**: 担当なしのみ`counts.todayCall`にカウント、担当ありは`counts.todayCallAssigned`にカウント
   ```javascript
   // 修正後
   if (nextCallDate && nextCallDate <= todayStr) {
     if (!buyer.follow_up_assignee) {
       counts.todayCall++;
     } else {
       counts.todayCallAssigned[buyer.follow_up_assignee] =
         (counts.todayCallAssigned[buyer.follow_up_assignee] || 0) + 1;
     }
   }
   ```

4. **適用方法**: `gas_buyer_complete_code.js`は`.kiroignore`で除外されているため、Pythonスクリプトを使用してUTF-8エンコーディングを維持しながら変更を適用する

5. **git履歴確認**: コミット`74cad450`で何が修正されたかを確認してから作業を開始する

## Testing Strategy

### Validation Approach

修正前のコードでバグを再現するテストを先に書き、根本原因を確認してから修正を適用する。修正後は全カウントカテゴリの動作が保持されることをプロパティベーステストで検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因（日付比較演算子と担当分岐の欠如）を確認する。

**Test Plan**: `updateBuyerSidebarCounts()`相当のロジックをJavaScriptでユニットテストとして再現し、買主7326・7327・7342のデータで実行する。修正前コードでは期待するカウントにならないことを確認する。

**Test Cases**:
1. **過去日付・担当なし**: `next_call_date = 昨日`, `follow_up_assignee = ''` → 修正前は`counts.todayCall`が増えない（バグ確認）
2. **今日・担当あり**: `next_call_date = 今日`, `follow_up_assignee = 'Y'` → 修正前は`counts.todayCall`が増える（過剰カウント確認）
3. **買主7326・7327・7342の実データ**: 修正前は合計カウントが3にならないことを確認
4. **assignee取得順序**: `initial_assignee = 'A'`, `follow_up_assignee = 'B'` → 修正前は`assignee = 'A'`になる（バグ確認）

**Expected Counterexamples**:
- 過去日付の買主が`counts.todayCall`にカウントされない
- 担当ありの買主が`counts.todayCall`に誤ってカウントされる
- 原因: `===`演算子と`follow_up_assignee`分岐の欠如

### Fix Checking

**Goal**: 修正後のコードで、バグ条件に該当する全入力に対して期待する動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := updateBuyerSidebarCounts_fixed([buyer])
  ASSERT result.todayCall === expectedTodayCallCount(buyer)
  ASSERT result.todayCallAssigned === expectedTodayCallAssignedCount(buyer)
END FOR
```

### Preservation Checking

**Goal**: バグ条件に該当しない全入力（未来日付、空日付、担当ありの買主等）に対して、修正前後で同じカウント結果が得られることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT updateBuyerSidebarCounts_original([buyer])
       = updateBuyerSidebarCounts_fixed([buyer])
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。ランダムな買主データを生成し、修正前後のカウント結果が一致することを多数のケースで検証する。

**Test Cases**:
1. **未来日付の保存**: `next_call_date = 明日以降` → 修正前後ともに`counts.todayCall`が増えない
2. **空日付の保存**: `next_call_date = ''` → 修正前後ともにカウントされない
3. **内覧日前日カウントの保存**: 内覧日前日の買主データで修正前後のカウントが一致する
4. **担当別カウントの保存**: `follow_up_assignee`ありの買主で`counts.assigned`が正しく集計される

### Unit Tests

- 日付比較ロジックのユニットテスト（今日、昨日、明日、空の各ケース）
- `follow_up_assignee`の有無による分岐テスト
- `assignee`取得順序のテスト（両方あり、片方のみ、両方なし）
- 買主7326・7327・7342の実データを使った統合テスト

### Property-Based Tests

- ランダムな`next_call_date`（過去・今日・未来・空）と`follow_up_assignee`（あり・なし）の組み合わせで、修正後のカウントがバックエンドの`calculateBuyerStatus()`と一致することを検証
- ランダムな買主リストで、修正前後の「当日TEL以外」のカウントカテゴリが変化しないことを検証
- `assignee`取得順序が`follow_up_assignee || initial_assignee`であることを多数のケースで検証

### Integration Tests

- スプレッドシートの実データを使って`updateBuyerSidebarCounts()`を実行し、サイドバーカウントと一覧件数が一致することを確認
- 買主7326・7327・7342が「当日TEL」として3件カウントされることを確認
- サイドバーの「当日TEL」をクリックした際に表示される一覧が3件であることを確認
