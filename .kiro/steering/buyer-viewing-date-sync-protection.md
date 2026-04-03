# 買主内覧日同期保護ルール（絶対に壊してはいけない設定）

## ⚠️ 最重要：この設定は何度も壊れている

**この設定は過去に何度も壊れて、その度に修正を繰り返しています。**
**今回成功した設定を絶対に変更しないでください。**

---

## ✅ 成功している設定（2026年4月4日時点）

### 1. `buyer-column-mapping.json`の`databaseToSpreadsheet`セクション

**ファイル**: `backend/src/config/buyer-column-mapping.json`

```json
"databaseToSpreadsheet": {
  "viewing_date": "●内覧日(最新）",
  "viewing_time": "●時間"
}
```

**重要**:
- ✅ `viewing_date` → `"●内覧日(最新）"` ← **この設定は絶対に変更しない**
- ✅ `viewing_time` → `"●時間"` ← **この設定も絶対に変更しない**
- ✅ 半角カッコ `(` と `）` を使用（全角カッコではない）
- ✅ スプレッドシートの**I列**に対応

---

### 2. スプレッドシートの列構成

| 列 | ヘッダー名 | データベースカラム名 | 説明 |
|----|-----------|-------------------|------|
| **I列** | `●内覧日(最新）` | `viewing_date` | **内覧日（DATE型）** |
| J列 | `●希望時期` | `desired_timing` | 希望時期 |
| **BP列** | `●時間` | `viewing_time` | **内覧時間（TIME型）** |

**重要**:
- ✅ **I列が内覧日** ← J列ではない！
- ✅ **BP列が内覧時間** ← 正常に同期できている

---

### 3. `BuyerColumnMapper.ts`の実装

**ファイル**: `backend/src/services/BuyerColumnMapper.ts`

```typescript
constructor() {
  // Merge both mapping objects
  this.spreadsheetToDb = {
    ...columnMapping.spreadsheetToDatabase,
    ...columnMapping.spreadsheetToDatabaseExtended
  };
  
  // databaseToSpreadsheetセクションが存在する場合はそれを使用、なければ自動生成
  if (columnMapping.databaseToSpreadsheet && Object.keys(columnMapping.databaseToSpreadsheet).length > 0) {
    this.dbToSpreadsheet = columnMapping.databaseToSpreadsheet;  // ✅ 正しい
  } else {
    // 自動生成（後方互換性）
    this.dbToSpreadsheet = {};
    for (const [key, value] of Object.entries(this.spreadsheetToDb)) {
      this.dbToSpreadsheet[value] = key;
    }
  }
  
  this.typeConversions = columnMapping.typeConversions;
}
```

**重要**:
- ✅ `databaseToSpreadsheet`セクションが存在する場合は、それを優先使用
- ✅ 自動生成はフォールバックのみ

---

### 4. `BuyerWriteService.ts`の実装

**ファイル**: `backend/src/services/BuyerWriteService.ts`

```typescript
async updateFields(buyerNumber: string, updates: Record<string, any>): Promise<WriteResult> {
  try {
    console.log(`[BuyerWriteService] updateFields called for buyer ${buyerNumber}`);
    console.log(`[BuyerWriteService] Updates:`, JSON.stringify(updates, null, 2));
    
    // 行番号を検索
    const rowNumber = await this.findRowByBuyerNumber(buyerNumber);
    
    if (!rowNumber) {
      console.error(`[BuyerWriteService] Buyer ${buyerNumber} not found in spreadsheet`);
      return {
        success: false,
        error: `Buyer ${buyerNumber} not found in spreadsheet`
      };
    }

    console.log(`[BuyerWriteService] Found buyer at row ${rowNumber}`);

    // 変更フィールドのみをスプシに書き込み（数式を壊さないよう部分更新）
    const formattedValues = this.columnMapper.mapDatabaseToSpreadsheet(updates);
    console.log(`[BuyerWriteService] Formatted values for spreadsheet:`, JSON.stringify(formattedValues, null, 2));
    
    await this.sheetsClient.updateRowPartial(rowNumber, formattedValues);
    console.log(`[BuyerWriteService] Successfully updated row ${rowNumber}`);

    return {
      success: true,
      rowNumber
    };
  } catch (error: any) {
    console.error(`[BuyerWriteService] Error updating buyer ${buyerNumber}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}
```

**重要**:
- ✅ デバッグログが追加されている ← **絶対に削除しない**
- ✅ `updateRowPartial()`を使用（部分更新）

---

## 🚨 絶対にやってはいけないこと

### ❌ 禁止1: `databaseToSpreadsheet`セクションを削除

```json
// ❌ 絶対にこうしてはいけない
"databaseToSpreadsheet": {}
```

**理由**: 自動生成に戻ると、`viewing_date`のマッピングが壊れる可能性がある

---

### ❌ 禁止2: カラム名を変更

```json
// ❌ 絶対にこうしてはいけない
"databaseToSpreadsheet": {
  "viewing_date": "●内覧日（最新）",  // 全角カッコに変更
  "viewing_time": "●時間"
}
```

**理由**: スプレッドシートのヘッダー名と一致しなくなる

---

### ❌ 禁止3: デバッグログを削除

```typescript
// ❌ 絶対にこうしてはいけない
async updateFields(buyerNumber: string, updates: Record<string, any>): Promise<WriteResult> {
  // デバッグログを削除
  const rowNumber = await this.findRowByBuyerNumber(buyerNumber);
  // ...
}
```

**理由**: 問題が再発した際に、原因を特定できなくなる

---

### ❌ 禁止4: `BuyerColumnMapper`のコンストラクタを変更

```typescript
// ❌ 絶対にこうしてはいけない
constructor() {
  // 自動生成のみを使用
  this.dbToSpreadsheet = {};
  for (const [key, value] of Object.entries(this.spreadsheetToDb)) {
    this.dbToSpreadsheet[value] = key;
  }
}
```

**理由**: `databaseToSpreadsheet`セクションが無視される

---

## 📋 変更前のチェックリスト

`buyer-column-mapping.json`または`BuyerColumnMapper.ts`を変更する前に、以下を確認：

- [ ] `databaseToSpreadsheet`セクションを削除していないか？
- [ ] `viewing_date`のマッピングを変更していないか？
- [ ] `viewing_time`のマッピングを変更していないか？
- [ ] カラム名の半角カッコ・全角カッコを変更していないか？
- [ ] デバッグログを削除していないか？
- [ ] `BuyerColumnMapper`のコンストラクタを変更していないか？

**全てのチェックがOKの場合のみ、変更を進めてください。**

---

## 🔍 問題が再発した場合の確認手順

### ステップ1: `buyer-column-mapping.json`を確認

```bash
# ファイルを開く
code backend/src/config/buyer-column-mapping.json
```

**確認ポイント**:
- `databaseToSpreadsheet`セクションが存在するか？
- `viewing_date`のマッピングが正しいか？

---

### ステップ2: スプレッドシートのヘッダーを確認

```bash
# 確認スクリプトを実行
npx ts-node backend/check-buyer-spreadsheet-j-column.ts
```

**確認ポイント**:
- I列のヘッダーが`●内覧日(最新）`か？
- BP列のヘッダーが`●時間`か？

---

### ステップ3: Vercelのログを確認

**確認ポイント**:
- `[BuyerWriteService] updateFields called for buyer 5641`が出力されているか？
- `[BuyerColumnMapper] Mapping viewing_date -> ●内覧日(最新）`が出力されているか？
- `[BuyerWriteService] Successfully updated row 3227`が出力されているか？

---

### ステップ4: デバッグログが出力されない場合

**原因**: デバッグログが削除された可能性がある

**解決策**: コミット`8f368190`に戻す

```bash
git show 8f368190:backend/src/services/BuyerWriteService.ts > backend/src/services/BuyerWriteService.ts
git show 8f368190:backend/src/services/BuyerColumnMapper.ts > backend/src/services/BuyerColumnMapper.ts
```

---

## 📝 成功時のログ例

### BuyerWriteService

```
[BuyerWriteService] updateFields called for buyer 5641
[BuyerWriteService] Updates: {
  "viewing_date": "2026-04-05T00:00:00+00:00",
  "viewing_time": "14:00"
}
[BuyerWriteService] Found buyer at row 3227
[BuyerWriteService] Formatted values for spreadsheet: {
  "●内覧日(最新）": "2026/04/05",
  "●時間": "14:00"
}
[BuyerWriteService] Successfully updated row 3227
```

### BuyerColumnMapper

```
[BuyerColumnMapper] mapDatabaseToSpreadsheet called with: {
  "viewing_date": "2026-04-05T00:00:00+00:00",
  "viewing_time": "14:00"
}
[BuyerColumnMapper] dbToSpreadsheet mapping: {
  "viewing_date": "●内覧日(最新）",
  "viewing_time": "●時間"
}
[BuyerColumnMapper] Mapping viewing_date -> ●内覧日(最新）
[BuyerColumnMapper] Formatted value for ●内覧日(最新）: 2026/04/05
[BuyerColumnMapper] Mapping viewing_time -> ●時間
[BuyerColumnMapper] Formatted value for ●時間: 14:00
[BuyerColumnMapper] Final result: {
  "●内覧日(最新）": "2026/04/05",
  "●時間": "14:00"
}
```

---

## 🎯 まとめ

**成功している設定（絶対に変更しない）**:

1. ✅ `buyer-column-mapping.json`の`databaseToSpreadsheet`セクション
2. ✅ `BuyerColumnMapper.ts`のコンストラクタ（`databaseToSpreadsheet`優先）
3. ✅ `BuyerWriteService.ts`のデバッグログ
4. ✅ スプレッドシートのI列 = `●内覧日(最新）`

**この設定を守ることで、買主内覧日の即時同期が確実に動作します。**

---

**最終更新日**: 2026年4月4日  
**作成理由**: 買主内覧日の即時同期が何度も壊れているため、成功した設定を保護する  
**成功時のコミット**: `8f368190`, `b1377876`

