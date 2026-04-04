# Bugfix Requirements Document

## Introduction

買主リストページ（`/buyers`）のサイドバーに「All: 4683」のみが表示され、他のカテゴリー（内覧日前日、当日TEL、担当(イニシャル)など）が全て表示されない問題を修正する。

**影響範囲**: 買主リストページのサイドバー全体

**発生時期**: 4月2日以降（4月2日はOK）

**環境**: 本番環境（Vercel）

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主リストページ（`/buyers`）を開く THEN サイドバーに「All: 4683」のみが表示される

1.2 WHEN APIエンドポイント `/api/buyers/status-categories-with-buyers` を呼び出す THEN レスポンスの `statusCategoriesWithBuyers` が空の配列 `[]` になる

1.3 WHEN `buyer_sidebar_counts` テーブルを確認する THEN データが存在しない、または更新されていない

1.4 WHEN GASの `updateBuyerSidebarCounts_` 関数を確認する THEN 関数が実装されていない、または実行されていない

### Expected Behavior (Correct)

2.1 WHEN 買主リストページ（`/buyers`）を開く THEN サイドバーに以下のカテゴリーが表示される SHALL:
- All: 4683
- ②内覧日前日: X件
- ⑯当日TEL: X件
- 担当(Y): X件
- 担当(I): X件
- など

2.2 WHEN APIエンドポイント `/api/buyers/status-categories-with-buyers` を呼び出す THEN レスポンスの `statusCategoriesWithBuyers` に各カテゴリーのデータが含まれる SHALL

2.3 WHEN `buyer_sidebar_counts` テーブルを確認する THEN 各カテゴリーのカウントデータが存在する SHALL

2.4 WHEN GASの `updateBuyerSidebarCounts_` 関数が実行される THEN `buyer_sidebar_counts` テーブルにデータが保存される SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主リストページ（`/sellers`）を開く THEN サイドバーに全てのカテゴリーが正常に表示される SHALL CONTINUE TO

3.2 WHEN 買主リストページで「All」カテゴリーを選択する THEN 全ての買主（4683件）が表示される SHALL CONTINUE TO

3.3 WHEN 買主データをスプレッドシートで編集する THEN データベースに正常に同期される SHALL CONTINUE TO

3.4 WHEN 買主データをブラウザUIで編集する THEN スプレッドシートに正常に同期される SHALL CONTINUE TO

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerSidebarRequest
  OUTPUT: boolean
  
  // 買主リストページでサイドバーカテゴリーを取得しようとした場合
  RETURN X.endpoint = "/api/buyers/status-categories-with-buyers"
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - サイドバーカテゴリーの表示
FOR ALL X WHERE isBugCondition(X) DO
  result ← getBuyerStatusCategories'(X)
  ASSERT result.statusCategoriesWithBuyers.length > 0
  ASSERT result.statusCategoriesWithBuyers CONTAINS "viewingDayBefore"
  ASSERT result.statusCategoriesWithBuyers CONTAINS "todayCall"
  ASSERT result.statusCategoriesWithBuyers CONTAINS "assigned"
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 売主リストと買主データの同期
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Key Definitions:**
- **F**: 修正前のシステム（`buyer_sidebar_counts` テーブルが空）
- **F'**: 修正後のシステム（`buyer_sidebar_counts` テーブルにデータが存在）

## Root Cause Analysis

### 想定される原因

1. **GASの `updateBuyerSidebarCounts_` 関数が実装されていない**
   - 売主リストは `gas_complete_code.js` の `updateSidebarCounts_` で更新
   - 買主リストは `gas_buyer_complete_code.js` の `updateBuyerSidebarCounts_` で更新されるべき
   - この関数が実装されていないか、トリガーが設定されていない可能性

2. **`buyer_sidebar_counts` テーブルにデータが存在しない**
   - テーブルは存在するが、データが空の可能性

3. **バックエンドAPIが `buyer_sidebar_counts` テーブルを参照していない**
   - `/api/buyers/status-categories-with-buyers` エンドポイントの実装に問題がある可能性

### 調査が必要な箇所

1. `gas_buyer_complete_code.js` に `updateBuyerSidebarCounts_` 関数が実装されているか
2. `buyer_sidebar_counts` テーブルにデータが存在するか
3. バックエンドAPI（`backend/src/routes/buyers.ts`）が正しく実装されているか
4. フロントエンド（`frontend/frontend/src/components/BuyerStatusSidebar.tsx`）が正しくAPIを呼び出しているか

## Counterexample

**具体例**: 買主リストページを開く

**入力**:
- URL: `https://sateituikyaku-admin-frontend.vercel.app/buyers`
- APIエンドポイント: `/api/buyers/status-categories-with-buyers`

**現在の出力（不正）**:
```json
{
  "statusCategoriesWithBuyers": []
}
```

**期待される出力（正しい）**:
```json
{
  "statusCategoriesWithBuyers": [
    {
      "category": "viewingDayBefore",
      "count": 2,
      "label": "②内覧日前日",
      "assignee": null
    },
    {
      "category": "todayCall",
      "count": 5,
      "label": "⑯当日TEL",
      "assignee": null
    },
    {
      "category": "assigned",
      "count": 150,
      "label": "担当(Y)",
      "assignee": "Y"
    }
  ]
}
```

## Success Criteria

修正が成功したと判断する基準:

1. ✅ 買主リストページのサイドバーに「All」以外のカテゴリーが表示される
2. ✅ APIレスポンスの `statusCategoriesWithBuyers` に各カテゴリーのデータが含まれる
3. ✅ `buyer_sidebar_counts` テーブルにデータが存在する
4. ✅ GASの `updateBuyerSidebarCounts_` 関数が正常に実行される
5. ✅ 売主リストのサイドバーが引き続き正常に動作する
6. ✅ 買主データの同期が引き続き正常に動作する
