# Bugfix Requirements Document

## Introduction

物件リストページのサイドバーで「未完了」カテゴリーのカウントが正しく動作していない問題を修正します。

具体的には、物件番号BB14で「事務へチャット」を送信し、データベースの`property_listings`テーブルで`confirmation`カラムが「未」になっているにもかかわらず、サイドバーの「未完了」カテゴリーにカウントされず、そのため「未完了」カテゴリー自体がサイドバーに表示されない（1件以上でないと表示されないため）という問題が発生しています。

この問題は以前から存在しており、成功したことがないとのことです。

## Bug Analysis

### Root Cause

`PropertyListingSpreadsheetSync.syncConfirmationFromSpreadsheet()`メソッドで、スプレッドシートのDQ列（確認フィールド）を読み取る際に、配列インデックスが1つずれている。

**問題のコード**（`backend/src/services/PropertyListingSpreadsheetSync.ts` 207行目）:
```typescript
const range = '物件!B:DQ';
const rows = await this.sheetsClient.readRawRange(range);
// ...
const confirmation = row[119]; // DQ列（0-indexed: 119） ← 間違い！
```

**原因**:
- 読み取り範囲は`B:DQ`（B列から開始）
- B列は配列のインデックス0
- DQ列は120番目の列（A=1, B=2, ..., DQ=120）
- B列から開始しているため、DQ列は配列のインデックス118（120 - 2 = 118）になるべき
- しかし、コードでは`row[119]`を読み取っているため、DR列（121番目の列）を読み取ってしまっている

### Current Behavior (Defect)

1.1 WHEN スプレッドシートのDQ列（確認フィールド）に「未」が入力されている THEN `syncConfirmationFromSpreadsheet()`が間違った列（DR列）を読み取る

1.2 WHEN `syncConfirmationFromSpreadsheet()`が実行される THEN データベースの`confirmation`カラムが正しく更新されない

1.3 WHEN 物件番号BB14の`confirmation`カラムがデータベースで「未」でない THEN サイドバーの「未完了」カテゴリーにカウントされない

1.4 WHEN 「未完了」カテゴリーのカウントが0件である THEN サイドバーに「未完了」カテゴリーが表示されない

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートのDQ列（確認フィールド）に「未」が入力されている THEN `syncConfirmationFromSpreadsheet()`が正しい列（DQ列、インデックス118）を読み取る

2.2 WHEN `syncConfirmationFromSpreadsheet()`が実行される THEN データベースの`confirmation`カラムが正しく更新される

2.3 WHEN 物件番号BB14の`confirmation`カラムがデータベースで「未」である THEN サイドバーの「未完了」カテゴリーに正しくカウントされる

2.4 WHEN 「未完了」カテゴリーのカウントが1件以上である THEN サイドバーに「未完了 1」と表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件の`confirmation`カラムが「済」である THEN サイドバーの「未完了」カテゴリーにカウントされない

3.2 WHEN 他のサイドバーカテゴリー（「未報告」「要値下げ」など）の条件を満たす物件がある THEN それらのカテゴリーは引き続き正しく表示される

3.3 WHEN 物件リストページをリロードする THEN 「未完了」カテゴリーのカウントが正しく表示される

3.4 WHEN `syncConfirmationToSpreadsheet()`が実行される THEN DQ列への書き込みは引き続き正しく動作する
