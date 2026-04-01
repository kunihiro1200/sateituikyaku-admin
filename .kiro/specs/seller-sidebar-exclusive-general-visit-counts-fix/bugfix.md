# バグ修正要件書：売主サイドバー「専任」「一般」「訪問後他決」カテゴリのカウント数不一致修正

## Introduction

売主リストのサイドバーで「専任」「一般」「訪問後他決」の3つのカテゴリにおいて、サイドバーに表示されるカウント数と、カテゴリをクリックして一覧を開いたときのカウント数が一致していない問題が発生しています。

この問題は、昨日修正した「未訪問他決」カテゴリと全く同じ根本原因によるものです。

## Bug Analysis

### Current Behavior (Defect)

#### 1.1 カウント数の不一致（専任カテゴリ）

WHEN ユーザーが売主リストページのサイドバーで「専任」カテゴリを確認する THEN サイドバーには正しいカウント数が表示される

WHEN ユーザーが「専任」カテゴリをクリックしてフィルタリングする THEN 実際に表示される売主の件数がサイドバーのカウント数と一致しない

**根本原因**：

- **GAS（Google Apps Script）**：`nextCallDate !== todayStr`（次電日が今日**ではない**）
- **バックエンド（SellerService）**：`.gt('next_call_date', todayJST)`（次電日が今日**より大きい** = 今日を除外）
- **フロントエンド（sellerStatusFilters.ts）**：`isTodayOrBefore(nextCallDate)`を**否定**（次電日が今日**以前ではない** = 今日を**含む**）← **間違い**

GASとバックエンドは「次電日が今日ではない」という条件で一致していますが、フロントエンドのフィルター関数 `isExclusive` は `isTodayOrBefore(nextCallDate)` を否定しているため、「次電日が今日以前ではない」= 「次電日が今日より後」という条件になり、**今日を含んでしまっています**。

これにより、次電日が今日の売主がカウントには含まれるが、フィルタリング結果には含まれないという不一致が発生しています。

#### 1.2 カウント数の不一致（一般カテゴリ）

WHEN ユーザーが売主リストページのサイドバーで「一般」カテゴリを確認する THEN サイドバーには正しいカウント数が表示される

WHEN ユーザーが「一般」カテゴリをクリックしてフィルタリングする THEN 実際に表示される売主の件数がサイドバーのカウント数と一致しない

**根本原因**：

専任カテゴリと全く同じ理由で、フロントエンドの `isGeneral` 関数が `isTodayOrBefore(nextCallDate)` を使用しているため、次電日が今日の売主を含んでしまっています。

#### 1.3 カウント数の不一致（訪問後他決カテゴリ）

WHEN ユーザーが売主リストページのサイドバーで「訪問後他決」カテゴリを確認する THEN サイドバーには正しいカウント数が表示される

WHEN ユーザーが「訪問後他決」カテゴリをクリックしてフィルタリングする THEN 実際に表示される売主の件数がサイドバーのカウント数と一致しない

**根本原因**：

専任カテゴリと全く同じ理由で、フロントエンドの `isVisitOtherDecision` 関数が `isTodayOrBefore(nextCallDate)` を使用しているため、次電日が今日の売主を含んでしまっています。

### Expected Behavior (Correct)

#### 2.1 カウント数の一致（専任カテゴリ）

WHEN ユーザーが売主リストページのサイドバーで「専任」カテゴリを確認する THEN サイドバーに表示される件数と、クリック後にフィルタリングされる売主の件数が一致すること

**修正内容**：

フロントエンドの `isExclusive` 関数の条件を修正し、GASとバックエンドと同じ「次電日が今日ではない」という条件に統一します。

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

#### 2.2 カウント数の一致（一般カテゴリ）

WHEN ユーザーが売主リストページのサイドバーで「一般」カテゴリを確認する THEN サイドバーに表示される件数と、クリック後にフィルタリングされる売主の件数が一致すること

**修正内容**：

フロントエンドの `isGeneral` 関数の条件を修正し、GASとバックエンドと同じ「次電日が今日ではない」という条件に統一します。

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

#### 2.3 カウント数の一致（訪問後他決カテゴリ）

WHEN ユーザーが売主リストページのサイドバーで「訪問後他決」カテゴリを確認する THEN サイドバーに表示される件数と、クリック後にフィルタリングされる売主の件数が一致すること

**修正内容**：

フロントエンドの `isVisitOtherDecision` 関数の条件を修正し、GASとバックエンドと同じ「次電日が今日ではない」という条件に統一します。

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

### Unchanged Behavior (Regression Prevention)

#### 3.1 他のカテゴリのカウントと表示

WHEN ユーザーが売主リストページのサイドバーで他のカテゴリ（「当日TEL分」「未訪問他決」など）を確認する THEN これらのカテゴリのカウント数とフィルタリング結果が正しく一致し続けること

#### 3.2 「専任」カテゴリの基本条件

WHEN ユーザーが「専任」カテゴリをフィルタリングする THEN 以下の条件を満たす売主のみが表示され続けること：

- 専任他決打合せ ≠ "完了"
- 次電日 ≠ 今日（次電日が空 OR 次電日が今日でない）
- 状況（当社） IN ("専任媒介", "他決→専任", "リースバック（専任）")

#### 3.3 「一般」カテゴリの基本条件

WHEN ユーザーが「一般」カテゴリをフィルタリングする THEN 以下の条件を満たす売主のみが表示され続けること：

- 専任他決打合せ ≠ "完了"
- 次電日 ≠ 今日（次電日が空 OR 次電日が今日でない）
- 状況（当社） = "一般媒介"
- 契約年月 >= "2025-06-23"

#### 3.4 「訪問後他決」カテゴリの基本条件

WHEN ユーザーが「訪問後他決」カテゴリをフィルタリングする THEN 以下の条件を満たす売主のみが表示され続けること：

- 専任他決打合せ ≠ "完了"
- 次電日 ≠ 今日（次電日が空 OR 次電日が今日でない）
- 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
- 営担 ≠ ""（空欄ではない）

#### 3.5 GASとバックエンドのカウントロジック

WHEN GASとバックエンドが「専任」「一般」「訪問後他決」カテゴリのカウントを計算する THEN 既存のロジック（次電日が今日ではない）が変更されないこと
