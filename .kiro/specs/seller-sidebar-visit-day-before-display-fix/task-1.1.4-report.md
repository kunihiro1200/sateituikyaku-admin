# タスク1.1.4: 訪問日が空欄の売主が含まれていないか確認 - 調査報告書

## 📋 調査概要

**タスクID**: 1.1.4  
**実行日**: 2026年4月9日  
**調査対象**: 訪問日が空欄（null）の売主が誤ってカウントされていないか確認

---

## 🔍 調査結果

### 1. スクリプト実行結果

**使用スクリプト**: `backend/check-visit-day-before-sellers.js`

```
=== 訪問日前日の売主を確認 ===

今日（JST）: 2026-04-09

営担あり + 訪問日ありの売主: 1000件

訪問日前日の条件を満たす売主: 0件

=== カウント比較 ===
seller_sidebar_counts: 2件
実際の条件を満たす売主: 0件
差分: 2件
```

### 2. 訪問日が空欄の売主の状況

**訪問日がnullの売主**: 1,000件

**AA13888の状態**:
- 売主番号: AA13888
- 訪問日: `null`
- 営担: `null`
- 訪問前日通知担当: `null`

### 3. isVisitDayBefore()関数のロジック検証

**ファイル**: `backend/check-visit-day-before-sellers.js`

```javascript
function isVisitDayBefore(visitDateStr, todayStr) {
  if (!visitDateStr) return false;  // ← 訪問日がnullの場合、falseを返す
  
  // TIMESTAMP形式（YYYY-MM-DD HH:MM:SS）から日付部分のみを抽出
  let visitDateOnly = visitDateStr;
  if (typeof visitDateStr === 'string') {
    if (visitDateStr.includes(' ')) {
      visitDateOnly = visitDateStr.split(' ')[0];
    } else if (visitDateStr.includes('T')) {
      visitDateOnly = visitDateStr.split('T')[0];
    }
  }
  
  const parts = visitDateOnly.split('-');
  if (parts.length !== 3) return false;
  
  // ... 以下、日付計算ロジック
}
```

**✅ 検証結果**: 
- `isVisitDayBefore()`関数は訪問日が空欄（null）の場合に正しく`false`を返す
- 訪問日が空欄の売主は「訪問日前日」カテゴリーに含まれない

---

## 📊 問題の特定

### 問題1: seller_sidebar_countsテーブルのカウント不一致

| 項目 | 件数 |
|------|------|
| seller_sidebar_countsのカウント | **2件** |
| 実際の条件を満たす売主 | **0件** |
| **差分** | **2件** |

**結論**: `seller_sidebar_counts`テーブルに誤ったデータが記録されている

### 問題2: 訪問日が空欄の売主の扱い

**AA13888の例**:
- 訪問日: `null`
- 営担: `null`
- `isVisitDayBefore()`の判定: `false`（正しい）

**✅ 確認結果**: 
- 訪問日が空欄の売主は`isVisitDayBefore()`関数で正しく除外される
- AA13888は「訪問日前日」カテゴリーに含まれるべきではない

---

## 🎯 根本原因の分析

### 原因1: バックエンドのカウント計算ロジックの問題

`seller_sidebar_counts`テーブルの更新ロジックが`isVisitDayBefore()`関数と一致していない可能性がある。

**推測される問題**:
1. カウント計算時に訪問日が空欄の売主を誤ってカウントしている
2. 古いデータが残っている（過去に訪問日があったが、現在は削除されている）

### 原因2: データの不整合

**seller_sidebar_countsテーブル**:
- カテゴリー: `visitDayBefore`
- カウント: `2件`
- 更新日時: 2026-04-09T09:54:02.921+00:00

**実際の売主データ**:
- 訪問日前日の条件を満たす売主: `0件`

**結論**: データベースのカウントが実際の売主データと一致していない

---

## ✅ 確認事項

### 1. isVisitDayBefore()関数のロジック

**✅ 正常**: 訪問日が空欄（null）の場合に正しく`false`を返す

```javascript
if (!visitDateStr) return false;  // ← 訪問日がnullの場合、falseを返す
```

### 2. 訪問日が空欄の売主の数

**確認結果**: 1,000件の売主が訪問日が空欄

**AA13888を含む訪問日が空欄の売主**:
- AA13662, AA3882, AA13405, AA786, AA5796, AA6262, AA6359, AA13393, AA10340, AA910, ...

### 3. seller_sidebar_countsテーブルのカウント

**確認結果**: `visitDayBefore`カテゴリーに`2件`が記録されている

**問題**: 実際の条件を満たす売主は`0件`なのに、`2件`が記録されている

---

## 🔧 次のステップ

### ステップ1: バックエンドのカウント計算ロジックを確認

**ファイル**: `backend/src/services/SellerSidebarCountsUpdateService.ts`

**確認事項**:
- [ ] 訪問日前日のカウント計算ロジックが`isVisitDayBefore()`関数と一致しているか
- [ ] 訪問日が空欄の売主を明示的に除外しているか
- [ ] `visit_reminder_assignee`が空であることを確認しているか

### ステップ2: seller_sidebar_countsテーブルのデータを修正

**SQL**:
```sql
-- 訪問日前日カテゴリーのレコードを確認
SELECT * FROM seller_sidebar_counts 
WHERE category = 'visitDayBefore';

-- カウントを0に更新（実際の条件を満たす売主が0件のため）
UPDATE seller_sidebar_counts 
SET count = 0, updated_at = NOW()
WHERE category = 'visitDayBefore';
```

### ステップ3: カウント更新ロジックを修正

**修正内容**:
```typescript
// 訪問日前日のカウント計算
const visitDayBeforeSellers = allSellers.filter(seller => {
  // 1. 営担がある
  if (!seller.visit_assignee || seller.visit_assignee.trim() === '') return false;
  
  // 2. 訪問日がある（空欄を除外）
  if (!seller.visit_date) return false;
  
  // 3. visitReminderAssigneeが空
  if (seller.visit_reminder_assignee && seller.visit_reminder_assignee.trim() !== '') return false;
  
  // 4. 今日が訪問日の前営業日である
  return isVisitDayBeforeUtil(seller.visit_date, todayDate);
});
```

---

## 📝 まとめ

### 確認結果

1. **✅ isVisitDayBefore()関数は正しく動作している**
   - 訪問日が空欄（null）の場合に正しく`false`を返す
   - AA13888は「訪問日前日」カテゴリーに含まれない

2. **❌ seller_sidebar_countsテーブルのカウントが不正確**
   - 記録されているカウント: 2件
   - 実際の条件を満たす売主: 0件
   - 差分: 2件

3. **❌ バックエンドのカウント計算ロジックに問題がある可能性**
   - `isVisitDayBefore()`関数と一致していない
   - 訪問日が空欄の売主を誤ってカウントしている可能性

### 次のアクション

1. **バックエンドのカウント計算ロジックを確認・修正**（タスク1.3）
2. **seller_sidebar_countsテーブルのデータを修正**（タスク2.1）
3. **カウント更新を実行して整合性を確認**（タスク3.2）

---

**作成日**: 2026年4月9日  
**作成者**: Kiro AI  
**ステータス**: 調査完了
