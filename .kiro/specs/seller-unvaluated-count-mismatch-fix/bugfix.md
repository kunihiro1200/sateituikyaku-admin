# 売主リスト「未査定」カテゴリのカウント不一致修正 - バグ修正要件

## Introduction

売主リストページにおいて、サイドバーの「⑤未査定」カテゴリのカウント（1件）と、一覧に表示される売主の件数（3件）が一致していない問題を修正します。

この問題は、過去に修正した「訪問日前日」カテゴリのカウント不一致問題と同様に、**サイドバーのカウント計算ロジック**と**一覧のフィルタリングロジック**が異なる実装になっていることが原因と推測されます。

## Bug Analysis

### Current Behavior (Defect)

#### 1.1 サイドバーと一覧のカウント不一致

**WHEN** 売主リストページを開き、サイドバーの「⑤未査定」カテゴリを確認する  
**THEN** サイドバーには「1件」と表示されるが、実際に一覧には「3件」の売主が表示される

**具体例**:
- サイドバー表示: 「⑤未査定: 1」
- 一覧表示: 3件の売主が表示される

#### 1.2 カウント計算とフィルタリングロジックの不一致

**WHEN** サイドバーのカウント計算（バックエンド）と一覧のフィルタリング（フロントエンド）を比較する  
**THEN** 両者で異なる判定条件を使用している可能性がある

**推測される原因**:
- サイドバー: `SellerService.getSidebarCounts()` または `getSidebarCountsFallback()` メソッド
- 一覧: `SellerService.listSellers()` メソッド（`statusCategory: 'unvaluated'` パラメータ）
- 両者で異なるSQLクエリまたはフィルタリング条件を使用

### Expected Behavior (Correct)

#### 2.1 サイドバーと一覧のカウント一致

**WHEN** 売主リストページを開き、サイドバーの「⑤未査定」カテゴリを確認する  
**THEN** サイドバーのカウント数と一覧の表示件数が完全に一致する

**例**:
- サイドバー表示: 「⑤未査定: 3」
- 一覧表示: 3件の売主が表示される

#### 2.2 判定条件の統一

**WHEN** サイドバーのカウント計算と一覧のフィルタリングを実行する  
**THEN** 両者で同じ判定条件を使用する

**未査定の判定条件**（ステアリングドキュメントより）:
- 査定額1, 2, 3が全て空欄（自動計算と手動入力の両方）
- 反響日付が2025/12/8以降
- 査定不要ではない
- 営担（visitAssignee）が空欄
- 状況（当社）に「追客中」が含まれる

### Unchanged Behavior (Regression Prevention)

#### 3.1 他のカテゴリのカウント精度

**WHEN** 「未査定」カテゴリ以外のカテゴリ（「訪問日前日」「当日TEL分」など）を確認する  
**THEN** これらのカテゴリのカウント数と一覧の表示件数は引き続き一致する

#### 3.2 パフォーマンス

**WHEN** サイドバーのカウント計算と一覧のフィルタリングを実行する  
**THEN** 処理時間は修正前と同等（100ms以内）を維持する

#### 3.3 既存のキャッシュ機構

**WHEN** サイドバーのカウントを取得する  
**THEN** 既存のキャッシュ機構（60秒TTL）が引き続き動作する

---

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SellerListRequest
  OUTPUT: boolean
  
  // 「未査定」カテゴリを選択した場合にバグが発生
  RETURN X.statusCategory = 'unvaluated'
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - 未査定カウント一致
FOR ALL X WHERE isBugCondition(X) DO
  sidebarCount ← getSidebarCounts().unvaluated
  listResult ← listSellers(X)
  ASSERT sidebarCount = listResult.total
END FOR
```

**期待される動作**:
- サイドバーのカウント数 = 一覧の表示件数
- 例: サイドバー「3件」→ 一覧「3件」

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**保証すべき動作**:
- 他のカテゴリ（「訪問日前日」「当日TEL分」など）のカウント精度は変わらない
- パフォーマンスは維持される
- キャッシュ機構は引き続き動作する

---

## Technical Context

### 関連ファイル

1. **バックエンド**:
   - `backend/src/services/SellerService.supabase.ts`
     - `getSidebarCounts()` メソッド（`seller_sidebar_counts` テーブルから取得）
     - `getSidebarCountsFallback()` メソッド（DBクエリでカウント計算）
     - `listSellers()` メソッド（一覧フィルタリング）

2. **フロントエンド**:
   - `frontend/frontend/src/utils/sellerStatusFilters.ts`
     - `isUnvaluated()` 関数（未査定の判定）

3. **GAS**:
   - `gas_complete_code.js`
     - `updateSidebarCounts_()` 関数（サイドバーカウント更新）

### 過去の類似問題

**「訪問日前日」カテゴリのカウント不一致**（2026年4月3日修正）:
- **原因**: バックエンドのSQLクエリで `.neq('visit_assignee', '外す')` を使用していたが、フロントエンドは「外す」を有効な営業担当として扱っていた
- **解決策**: バックエンドのSQLクエリから `.neq('visit_assignee', '外す')` を削除し、フロントエンドと同じロジックに統一

**今回の問題との類似点**:
- サイドバーのカウント計算（バックエンド）と一覧のフィルタリング（フロントエンド）で異なるロジックを使用している可能性
- 両者のロジックを統一することで解決できる

---

## Counterexample

**具体例**: 売主AA13501

**データ**:
- 査定額1, 2, 3: 全て空欄
- 反響日付: 2025/12/15
- 査定不要: false
- 営担: 空欄
- 状況（当社）: 「追客中」

**期待される動作**:
- サイドバーのカウントに含まれる
- 一覧にも表示される

**実際の動作**（バグ）:
- サイドバーのカウントに含まれない（1件のみカウント）
- 一覧には表示される（3件表示）

**結果**: カウント不一致（サイドバー1件 vs 一覧3件）

---

**作成日**: 2026年4月5日  
**作成者**: Kiro AI  
**ステータス**: Draft
