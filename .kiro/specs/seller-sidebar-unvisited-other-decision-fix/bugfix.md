# バグ修正要件書：売主サイドバー「未訪問他決」カテゴリの問題修正

## Introduction

売主リストのサイドバーで「未訪問他決」カテゴリに以下の2つの問題が発生しています：

1. **カウント数の不一致**：サイドバーに「未訪問他決：26件」と表示されているが、クリックすると「23件」しか表示されない
2. **英語表記の問題**：カテゴリキーが「unvisitedOtherDecision」という英語表記で表示されている

これらの問題により、ユーザーが正確な件数を把握できず、また日本語UIとして不適切な表示になっています。

## Bug Analysis

### Current Behavior (Defect)

#### 1.1 カウント数の不一致

WHEN ユーザーが売主リストページのサイドバーで「未訪問他決」カテゴリを確認する THEN サイドバーには「未訪問他決：26件」と表示される

WHEN ユーザーが「未訪問他決」カテゴリをクリックしてフィルタリングする THEN 実際には「23件」の売主しか表示されない

**根本原因**：

- **GAS（Google Apps Script）**：`nextCallDate !== todayStr`（次電日が今日**ではない**）
- **バックエンド（SellerService）**：`.gt('next_call_date', todayJST)`（次電日が今日**より大きい** = 今日を除外）
- **フロントエンド（sellerStatusFilters.ts）**：`isTodayOrBefore(nextCallDate)`を**否定**（次電日が今日**以前ではない** = 今日を**含む**）

GASとバックエンドは「次電日が今日ではない」という条件で一致していますが、フロントエンドのフィルター関数 `isUnvisitedOtherDecision` は `isTodayOrBefore(nextCallDate)` を否定しているため、「次電日が今日以前ではない」= 「次電日が今日より後」という条件になり、**今日を含んでしまっています**。

これにより、次電日が今日の売主がカウントには含まれるが、フィルタリング結果には含まれないという不一致が発生しています。

#### 1.2 英語表記の問題

WHEN ユーザーが売主リストページのサイドバーを確認する THEN カテゴリが「unvisitedOtherDecision」という英語表記で表示されている

**根本原因**：

`SellerStatusSidebar.tsx` の `getCategoryLabel` 関数に `unvisitedOtherDecision` ケースが定義されていますが、サイドバーの `renderCategoryButton` 呼び出し時に、カテゴリキー `'unvisitedOtherDecision'` とラベル `'未訪問他決'` を正しく渡していない可能性があります。

### Expected Behavior (Correct)

#### 2.1 カウント数の一致

WHEN ユーザーが売主リストページのサイドバーで「未訪問他決」カテゴリを確認する THEN サイドバーに表示される件数と、クリック後にフィルタリングされる売主の件数が一致すること

**修正内容**：

フロントエンドの `isUnvisitedOtherDecision` 関数の条件を修正し、GASとバックエンドと同じ「次電日が今日ではない」という条件に統一します。

**修正前**：
```typescript
// 次電日が今日の場合は除外
const nextCallDate = seller.nextCallDate || seller.next_call_date;
if (isTodayOrBefore(nextCallDate)) {  // ← 今日を含む
  return false;
}
```

**修正後**：
```typescript
// 次電日が今日の場合は除外
const nextCallDate = seller.nextCallDate || seller.next_call_date;
const todayStr = getTodayJSTString();
const normalizedNextCallDate = normalizeDateString(nextCallDate);
if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) {  // ← 今日を除外
  return false;
}
```

#### 2.2 日本語表記の表示

WHEN ユーザーが売主リストページのサイドバーを確認する THEN カテゴリが「未訪問他決」という日本語表記で表示されること

**修正内容**：

`SellerStatusSidebar.tsx` の `renderAllCategories` 関数で、`renderCategoryButton` を呼び出す際に、正しいラベル `'未訪問他決'` を渡します。

**修正前**：
```typescript
{renderCategoryButton('unvisitedOtherDecision', '未訪問他決', '#ff5722')}
```

**修正後**（確認）：
既に正しく実装されている場合は修正不要。もし実装されていない場合は追加します。

### Unchanged Behavior (Regression Prevention)

#### 3.1 他のカテゴリのカウントと表示

WHEN ユーザーが売主リストページのサイドバーで他のカテゴリ（「専任」「一般」「訪問後他決」など）を確認する THEN これらのカテゴリのカウント数とフィルタリング結果が正しく一致し続けること

#### 3.2 「未訪問他決」カテゴリの基本条件

WHEN ユーザーが「未訪問他決」カテゴリをフィルタリングする THEN 以下の条件を満たす売主のみが表示され続けること：

- 専任他決打合せ ≠ "完了"
- 次電日 ≠ 今日（次電日が空 OR 次電日が今日でない）
- 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
- 営担 = ""（空欄）または 営担 = "外す"（「外す」は空欄扱い）

**重要**: 営担が「外す」の場合は、空欄と同じ扱いとする。つまり、営担が「外す」の売主は「未訪問他決」カテゴリに含まれる。

#### 3.3 GASとバックエンドのカウントロジック

WHEN GASとバックエンドが「未訪問他決」カテゴリのカウントを計算する THEN 既存のロジック（次電日が今日ではない）が変更されないこと
