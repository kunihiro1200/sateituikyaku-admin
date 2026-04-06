---
inclusion: manual
---

# 売主訪問日時のTIMESTAMP型移行（完了済み）

## ⚠️ 重要：visit_dateはTIMESTAMP型

**日付**: 2026年4月3日

**変更内容**: `sellers.visit_date`カラムをDATE型からTIMESTAMP型に変更し、`visit_time`カラムを削除しました。

---

## 📋 変更前後の比較

### Before（変更前）
```sql
visit_date DATE           -- 訪問日（例: 2026-04-04）
visit_time VARCHAR(20)    -- 訪問時間（例: 10:00）
```

### After（変更後）
```sql
visit_date TIMESTAMP      -- 訪問予定日時（例: 2026-04-04 10:00:00）
```

---

## 🚨 絶対に守るべきルール

### ルール1: visit_dateはTIMESTAMP型として扱う

**❌ 間違い**:
```typescript
// DATE型として扱う
const visitDate = seller.visit_date?.split(' ')[0];  // 時刻を捨てる
```

**✅ 正しい**:
```typescript
// TIMESTAMP型として扱う
const visitDate = seller.visit_date;  // 2026-04-04 10:00:00
```

### ルール2: visit_timeカラムは存在しない

**❌ 間違い**:
```typescript
// visit_timeを参照する
const visitTime = seller.visit_time;  // エラー: カラムが存在しない
```

**✅ 正しい**:
```typescript
// visit_dateから時刻を抽出
const visitDateTime = new Date(seller.visit_date);
const hours = visitDateTime.getHours();
const minutes = visitDateTime.getMinutes();
```

### ルール3: GAS同期では日付と時刻を結合する

**GASコード**（`gas_complete_code.js`）:
```javascript
// スプレッドシートの「訪問日 Y/M/D」と「訪問時間」を結合
var rawVisitDate = row['訪問日 Y/M/D'];
var rawVisitTime = row['訪問時間'];
var sheetVisitDateTime = null;

if (rawVisitDate && rawVisitDate !== '') {
  var visitDateStr = formatDateToISO_(rawVisitDate);
  if (visitDateStr) {
    visitDateStr = visitDateStr.replace(/-/g, '/');
    sheetVisitDateTime = visitDateStr;  // 例: 2026/04/04
    
    // 訪問時間が存在する場合、時刻を追加
    if (rawVisitTime && rawVisitTime !== '') {
      var timeStr = extractTimeString(rawVisitTime);
      if (timeStr) {
        sheetVisitDateTime += ' ' + timeStr;  // 例: 2026/04/04 10:00:00
      }
    }
  }
}

// YYYY/MM/DD HH:MM:SS形式をYYYY-MM-DD HH:MM:SS形式に変換してDBに保存
if (sheetVisitDateTime) {
  updateData.visit_date = sheetVisitDateTime.replace(/\//g, '-');
}
```

---

## 📝 実装チェックリスト

新しいコードを書く際、以下を確認してください：

- [ ] `visit_date`をTIMESTAMP型として扱っているか？
- [ ] `visit_time`カラムを参照していないか？
- [ ] GAS同期で日付と時刻を結合しているか？
- [ ] フロントエンドで`YYYY/MM/DD HH:MM`形式で表示しているか？
- [ ] サイドバーフィルターで時刻を考慮しているか？

---

## 🎯 実装例

### バックエンド（SellerService）

```typescript
// ✅ 正しい実装
const decrypted = {
  // ...
  visitDate: seller.visit_date,  // TIMESTAMP型（例: 2026-04-04 10:00:00）
  // visitTime: seller.visit_time,  // ❌ 削除済み
};
```

### フロントエンド（CallModePage）

```typescript
// ✅ 正しい実装
const formatVisitDateTime = (visitDate: string | null) => {
  if (!visitDate) return '未設定';
  
  // YYYY-MM-DD HH:MM:SS形式をYYYY/MM/DD HH:MM形式に変換
  const date = new Date(visitDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

// 表示
<div>{formatVisitDateTime(seller.visitDate)}</div>
```

### サイドバーフィルター（sellerStatusFilters.ts）

```typescript
// ✅ 正しい実装
export function isVisitDayBefore(seller: Seller): boolean {
  if (!seller.visitAssignee || !seller.visitDate) return false;
  
  // TIMESTAMP型から日付部分を抽出
  const visitDate = new Date(seller.visitDate);
  visitDate.setHours(0, 0, 0, 0);
  
  const visitDay = visitDate.getDay();
  const daysBeforeVisit = visitDay === 4 ? 2 : 1;  // 木曜訪問のみ2日前
  
  const notifyDate = new Date(visitDate);
  notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return today.getTime() === notifyDate.getTime();
}
```

---

## 🚨 過去の問題

### 問題1: AA13729の訪問時刻が表示されない

**日付**: 2026年4月3日

**症状**: 通話モードページで`2026/04/04`（日付のみ）と表示され、時刻`10:00`が表示されない

**根本原因**: データベースの`visit_date`カラムがDATE型のままで、TIMESTAMP型に変更されていなかった

**解決策**: Migration 105を実行し、`visit_date`をTIMESTAMP型に変更

---

## 📚 関連ファイル

- `backend/migrations/105_migrate_visit_date_to_timestamp.sql` - マイグレーションSQL
- `backend/migrations/105_EXECUTION_GUIDE.md` - 実行ガイド
- `gas_complete_code.js` - GAS同期ロジック
- `backend/src/services/SellerService.supabase.ts` - バックエンドサービス
- `frontend/frontend/src/pages/CallModePage.tsx` - フロントエンド表示
- `frontend/frontend/src/utils/sellerStatusFilters.ts` - サイドバーフィルター
- `.kiro/specs/seller-visit-date-time-format-fix/` - Specファイル

---

**最終更新日**: 2026年4月3日  
**作成理由**: visit_dateのTIMESTAMP型移行を記録し、今後の開発で同じ間違いを防ぐため

