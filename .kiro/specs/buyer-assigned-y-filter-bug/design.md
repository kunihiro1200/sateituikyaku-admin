# 買主「担当(Y)」フィルタバグ修正 Design

## Overview

買主リストの「担当(Y)」サイドバーカテゴリにおいて、サイドバーカウント（3件）と一覧表示件数（0件）が不一致となるバグを修正します。

根本原因は、`BuyerService.getBuyersByStatus()` メソッドが `calculated_status = '担当(Y)'` でフィルタリングしているのに対し、GASのサイドバーカウントは `follow_up_assignee = 'Y'` の全買主（3件）をカウントしているためです。

`BuyerStatusCalculator` は `follow_up_assignee = 'Y'` の買主を3つのステータスに分類します：
1. `内覧済み(Y)` - 内覧日が過去
2. `当日TEL(Y)` - 次電日が今日以前
3. `担当(Y)` - それ以外

修正方針は、「担当(Y)」カテゴリクリック時に `follow_up_assignee = 'Y'` の全買主を表示するように `BuyerService.getBuyersByStatus()` を修正することです。

## Glossary

- **Bug_Condition (C)**: 「担当(Y)」カテゴリをクリックした際に、一覧表示が0件となる条件
- **Property (P)**: サイドバーカウントと一覧表示件数が一致し、正しく3件が表示される状態
- **Preservation**: 他のサイドバーカテゴリ（「当日TEL」「内覧日前日」など）のフィルタリングが正常に動作し続けること
- **calculated_status**: `BuyerStatusCalculator.calculateBuyerStatus()` が計算した買主のステータス
- **buyer_sidebar_counts**: GASが10分ごとに更新するサイドバーカウントテーブル
- **fetchAllBuyersWithStatus()**: 全買主を取得し、各買主の `calculated_status` を計算するメソッド
- **getBuyersByStatus()**: 指定されたステータスで買主をフィルタリングするメソッド

## Bug Details

### Bug Condition

「担当(Y)」カテゴリをクリックした際に、一覧表示が正しくフィルタリングされず、0件が表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { statusCategory: string }
  OUTPUT: boolean
  
  RETURN input.statusCategory MATCHES '担当\\([A-Z久外す]+\\)'
END FUNCTION
```

### Examples

- **例1**: サイドバーに「担当(Y) 3」と表示されているが、カテゴリをクリックすると0件が表示される
- **例2**: 買主7277, 7278, 7254の3件が `follow_up_assignee = 'Y'` だが、一覧には0件が表示される
- **例3**: 他のカテゴリ（「当日TEL」など）は正しくフィルタリングされるが、「担当(Y)」だけが0件表示される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のサイドバーカテゴリ（「当日TEL」「内覧日前日」など）のフィルタリングは引き続き正常に動作する
- サイドバーカウントは `buyer_sidebar_counts` テーブルから高速に取得される
- 買主のステータス計算は `BuyerStatusCalculator.calculateBuyerStatus()` で引き続き行われる

**Scope:**
「担当(Y)」以外のカテゴリをクリックした場合は、全く影響を受けない。

## Hypothesized Root Cause

根本原因として、以下が確認されています：

1. **GASのカウントロジック**: `follow_up_assignee = 'Y'` の全買主（3件）をカウント
   - 買主7277: `follow_up_assignee = 'Y'`, `calculated_status = '内覧済み(Y)'`
   - 買主7278: `follow_up_assignee = 'Y'`, `calculated_status = '当日TEL(Y)'`
   - 買主7254: `follow_up_assignee = 'Y'`, `calculated_status = '担当(Y)'`

2. **TypeScriptのフィルタリングロジック**: `calculated_status = '担当(Y)'` の買主のみ（1件）を表示
   - `getBuyersByStatus('担当(Y)')` は `calculated_status = '担当(Y)'` でフィルタリング
   - 買主7254のみが該当（1件）
   - しかし、実際には0件が表示される（原因不明）

3. **ステータス計算の分類**: `BuyerStatusCalculator` が `follow_up_assignee = 'Y'` の買主を3つのステータスに分類
   - `内覧済み(Y)` - 内覧日が過去
   - `当日TEL(Y)` - 次電日が今日以前
   - `担当(Y)` - それ以外

## Correctness Properties

Property 1: Bug Condition - 担当(Y)カテゴリのフィルタリング

_For any_ 買主リストページで「担当(Y)」カテゴリをクリックした場合、一覧表示には `buyer_sidebar_counts` テーブルのカウント数と同じ件数の買主が表示され、全ての買主が `follow_up_assignee = 'Y'` を満たす。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他のカテゴリのフィルタリング

_For any_ 「担当(Y)」以外のサイドバーカテゴリをクリックした場合、修正前と同じフィルタリング結果が表示され、既存の動作が保持される。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

修正方針は、「担当(Y)」カテゴリクリック時に `follow_up_assignee = 'Y'` の全買主を表示するように `BuyerService.getBuyersByStatus()` を修正することです。

**File**: `backend/src/services/BuyerService.ts`

**Function**: `getBuyersByStatus()`

**Specific Changes**:

1. **担当カテゴリの判定を追加**:
   ```typescript
   // 担当カテゴリのパターンマッチング（例: 担当(Y), 担当(I), 担当(久), 担当(外す)）
   const assignedPattern = /^担当\((.+)\)$/;
   const assignedMatch = status.match(assignedPattern);
   ```

2. **担当カテゴリの場合、follow_up_assigneeでフィルタリング**:
   ```typescript
   if (assignedMatch) {
     const assignee = assignedMatch[1]; // 'Y', 'I', '久', '外す' など
     
     filteredBuyers = allBuyers.filter(buyer => {
       // follow_up_assignee または initial_assignee が一致する買主を全て表示
       return (
         buyer.follow_up_assignee === assignee ||
         (!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
       );
     });
   } else {
     // 既存のロジック（calculated_statusでフィルタリング）
     filteredBuyers = allBuyers.filter(buyer => buyer.calculated_status === status);
   }
   ```

3. **デバッグログを追加**:
   - 「担当(Y)」判定時に、買主番号、担当者、判定結果をログ出力
   - GASのログと比較して、判定ロジックが一致しているか確認

4. **他の担当カテゴリも同様に修正**:
   - 「担当(I)」「担当(久)」「担当(外す)」なども同じロジックで修正

## Testing Strategy

### Validation Approach

テスト戦略は、まず未修正コードで「担当(Y)」カテゴリのフィルタリングが失敗することを確認し、次に修正後のコードで正しくフィルタリングされることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで「担当(Y)」カテゴリのフィルタリングが失敗することを確認する。

**Test Plan**: 買主リストページで「担当(Y)」カテゴリをクリックし、一覧表示が0件表示されることを確認する。

**Test Cases**:
1. **サイドバーカウント確認**: サイドバーに「担当(Y) 3」と表示されることを確認（GASのカウントが正しい）
2. **一覧表示確認**: 「担当(Y)」カテゴリをクリックし、0件が表示されることを確認（フィルタリングが失敗）
3. **デバッグログ確認**: バックエンドのログで、`getBuyersByStatus('担当(Y)')` が0件を返していることを確認

**Expected Counterexamples**:
- サイドバーカウント: 3件
- 一覧表示: 0件
- 原因: `calculated_status = '担当(Y)'` でフィルタリングしているが、実際には `follow_up_assignee = 'Y'` でフィルタリングすべき

### Fix Checking

**Goal**: 修正後のコードで、「担当(Y)」カテゴリのフィルタリングが正しく動作することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  sidebarCount ← getSidebarCount('担当(Y)')
  listResult ← getBuyersByStatus('担当(Y)')
  
  ASSERT sidebarCount = listResult.total
  ASSERT listResult.data の全ての買主が follow_up_assignee = 'Y' を満たす
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、他のサイドバーカテゴリのフィルタリングが引き続き正常に動作することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // 他のカテゴリ（「当日TEL」「内覧日前日」など）
  ASSERT getBuyersByStatus_original(input) = getBuyersByStatus_fixed(input)
END FOR
```

**Testing Approach**: 他のカテゴリ（「当日TEL」「内覧日前日」など）をクリックし、修正前と同じフィルタリング結果が表示されることを確認する。

**Test Plan**: 未修正コードで他のカテゴリのフィルタリングが正しく動作することを確認し、修正後も同じ結果が得られることを検証する。

**Test Cases**:
1. **当日TELカテゴリ**: 「当日TEL」カテゴリをクリックし、正しくフィルタリングされることを確認
2. **内覧日前日カテゴリ**: 「内覧日前日」カテゴリをクリックし、正しくフィルタリングされることを確認
3. **業者問合せありカテゴリ**: 「業者問合せあり」カテゴリをクリックし、正しくフィルタリングされることを確認

### Unit Tests

- `BuyerService.getBuyersByStatus()` の「担当(Y)」判定ロジックをテスト
- 買主7277, 7278, 7254が「担当(Y)」に該当することを確認
- 他の買主が「担当(Y)」に該当しないことを確認

### Property-Based Tests

- ランダムな買主データを生成し、「担当(Y)」判定ロジックが正しく動作することを確認
- GASの判定ロジックとTypeScriptの判定ロジックが完全に一致することを確認

### Integration Tests

- 買主リストページで「担当(Y)」カテゴリをクリックし、正しくフィルタリングされることを確認
- サイドバーカウントと一覧表示件数が一致することを確認
- 他のカテゴリのフィルタリングが引き続き正常に動作することを確認
