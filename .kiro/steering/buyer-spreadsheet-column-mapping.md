---
inclusion: fileMatch
fileMatchPattern: "**/buyer*.{ts,tsx,js,md}"
---

# 買主スプレッドシートのカラムマッピング（完全版）

## ⚠️ 重要：このドキュメントが唯一の正解

買主リストスプレッドシートとデータベースのカラムマッピングは、このドキュメントに記載されている内容が**唯一の正解**です。

**絶対に推測しないでください。必ずこのドキュメントを参照してください。**

---

## 🚨 最重要：買主番号はE列（B列ではない）

**絶対に間違えないでください**：

- ❌ **B列は買主番号ではありません**
- ✅ **E列が買主番号です**（`買主番号`カラム）

**スプレッドシートで買主番号を検索する際は、必ずE列を検索してください。**

**過去の間違い**：
- B列で買主番号を検索してしまい、見つからなかった
- この間違いを何度も繰り返した

**正しい検索方法**：
```typescript
// ✅ 正しい（E列を検索、0-indexed: 4）
const buyerNumberIndex = 4;
const rows = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '買主リスト!A:GZ',
});
const buyerRow = rows.data.values?.find(row => row[buyerNumberIndex] === '7187');

// ❌ 間違い（B列を検索）
const rows = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '買主リスト!B:GZ',
});
const buyerRow = rows.data.values?.find(row => row[0] === '7187');
```

---

## 📋 重要なカラムマッピング表

### 基本情報

| 列 | スプレッドシートカラム名 | データベースカラム名 | 型 | 説明 |
|----|---------------------|-------------------|-----|------|
| **E** | **`買主番号`** | **`buyer_number`** | **TEXT** | **買主の一意識別子（例: 7187）** |
| F | `受付日` | `reception_date` | DATE | 受付日 |
| G | `●氏名・会社名` | `name` | TEXT | 買主名 |
| I | `●内覧日(最新）` | `viewing_date` | DATE | 内覧日 |
| J | `●希望時期` | `desired_timing` | TEXT | 希望時期 |
| **BI** | **`内覧形態`** | **`viewing_mobile`** | **TEXT** | **内覧形態（例: 【内覧_専（自社物件）】）** |
| **BP** | **`●時間`** | **`viewing_time`** | **TIME** | **内覧時間（例: 14:30）** |
| **FQ** | **`内覧形態_一般媒介`** | **`viewing_type_general`** | **TEXT** | **内覧形態（一般媒介用）** |

---

## 🚨 絶対に守るべきルール

### ルール1: 買主番号はE列

**❌ 間違い**:
```typescript
// B列で検索
const buyerRow = rows.find(row => row[0] === '7187');
```

**✅ 正しい**:
```typescript
// E列で検索（0-indexed: 4）
const buyerRow = rows.find(row => row[4] === '7187');
```

### ルール2: 内覧形態はBI列（列61）

**列位置**: BI列（0-indexed: 60）

**データベースカラム**: `viewing_mobile`

**例**:
```typescript
const biIndex = 60;
const viewingMobile = row[biIndex];
```

### ルール3: 内覧形態_一般媒介はFQ列（列173）

**列位置**: FQ列（0-indexed: 172）

**データベースカラム**: `viewing_type_general`

**例**:
```typescript
const fqIndex = 172;
const viewingTypeGeneral = row[fqIndex];
```

### ルール4: 内覧時間はBP列

**列位置**: BP列（0-indexed: 67）

**データベースカラム**: `viewing_time`

**型**: TIME（HH:MM:SS形式）

---

## 📝 GASコードでの実装例

### 買主番号で検索

```javascript
// ✅ 正しい（E列で検索）
function findBuyerRow(buyerNumber) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('買主リスト');
  var data = sheet.getDataRange().getValues();
  
  // E列（0-indexed: 4）で検索
  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === buyerNumber) {
      return i + 1; // 行番号（1-indexed）
    }
  }
  return null;
}
```

### 内覧形態を取得

```javascript
// ✅ 正しい（BI列とFQ列から取得）
function getViewingFormat(buyerNumber) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('買主リスト');
  var data = sheet.getDataRange().getValues();
  
  // E列（0-indexed: 4）で検索
  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === buyerNumber) {
      var viewingMobile = data[i][60];        // BI列（0-indexed: 60）
      var viewingTypeGeneral = data[i][172];  // FQ列（0-indexed: 172）
      
      return {
        viewing_mobile: viewingMobile,
        viewing_type_general: viewingTypeGeneral
      };
    }
  }
  return null;
}
```

---

## 🔍 トラブルシューティング

### 問題1: 買主が見つからない

**症状**: 
```
❌ 買主7187が見つかりませんでした
```

**原因**: B列で検索している

**解決策**: E列（0-indexed: 4）で検索する

---

### 問題2: 内覧形態が同期されない

**症状**: スプレッドシートに値があるが、データベースに保存されない

**確認事項**:
1. BI列（0-indexed: 60）から取得しているか？
2. FQ列（0-indexed: 172）から取得しているか？
3. `buyer-column-mapping.json`に正しくマッピングされているか？

**解決策**:
```json
// backend/src/config/buyer-column-mapping.json
{
  "spreadsheetToDatabaseExtended": {
    "内覧形態": "viewing_mobile",
    "内覧形態_一般媒介": "viewing_type_general"
  }
}
```

---

## 📊 列位置の一覧表

| 列名 | 列位置 | 0-indexed | データベースカラム名 |
|------|--------|-----------|-------------------|
| **E** | **5** | **4** | **`buyer_number`** |
| I | 9 | 8 | `viewing_date` |
| J | 10 | 9 | `desired_timing` |
| **BI** | **61** | **60** | **`viewing_mobile`** |
| **BP** | **68** | **67** | **`viewing_time`** |
| **FQ** | **173** | **172** | **`viewing_type_general`** |

---

## まとめ

**絶対に守るべきルール**:

1. **買主番号はE列**（0-indexed: 4） ← B列ではない
2. **内覧形態はBI列**（0-indexed: 60）
3. **内覧形態_一般媒介はFQ列**（0-indexed: 172）
4. **内覧時間はBP列**（0-indexed: 67）

**このルールを徹底することで、買主番号の検索ミスを完全に防止できます。**

---

**最終更新日**: 2026年4月5日  
**作成理由**: 買主番号の列位置（E列）を何度も間違えるため、正しい構造を記録する  
**関連ファイル**: 
- `gas_buyer_complete_code.js` - 買主リスト用GAS
- `backend/src/config/buyer-column-mapping.json` - カラムマッピング定義
