# デザインドキュメント: seller-first-tel-db-sync

## 概要

本機能は、売主リストスプレッドシートのY列（「一番TEL」）に格納された担当者イニシャルを、Supabase DBの`sellers.first_call_initials`カラムへ一括同期するGASスクリプト（`syncFirstTelToDb`関数）を新規実装するものです。

既存の10分トリガー同期（`syncSellerList`）とは完全に独立した手動実行専用の関数として実装します。対象は反響日付が2026/1/1以降のレコードに限定します。

---

## アーキテクチャ

### 処理フロー

```mermaid
flowchart TD
    A[syncFirstTelToDb 手動実行] --> B[売主リストシート取得]
    B --> C[全行をrowToObjectで変換]
    C --> D{売主番号バリデーション\n/^[A-Z]{2}\\d+$/}
    D -- 不一致 --> E[スキップ]
    D -- 一致 --> F{反響日付フィルタ\n>= 2026-01-01}
    F -- 対象外/空欄 --> E
    F -- 対象 --> G[updateData構築\nfirst_call_initials のみ]
    G --> H[patchSellerToSupabase_\nPATCH /rest/v1/sellers]
    H --> I{HTTPステータス}
    I -- 200系 --> J[updatedCount++]
    I -- 200系以外 --> K[errorCount++ / Logger.log]
    J --> L[次のレコードへ]
    K --> L
    E --> L
    L --> M{全レコード処理完了}
    M --> N[サマリーログ出力]
```

### 既存コードとの関係

```
gas_seller_complete_code.js（既存）
├── SUPABASE_CONFIG          ← 再利用（接続設定）
├── rowToObject()            ← 再利用（行→オブジェクト変換）
├── formatDateToISO_()       ← 再利用（日付フォーマット）
├── patchSellerToSupabase_() ← 再利用（Supabase PATCH）
├── syncSellerList()         ← 変更なし（独立）
└── syncFirstTelToDb()       ← 新規追加（本機能）
```

---

## コンポーネントとインターフェース

### 新規関数: `syncFirstTelToDb()`

**責務**: 売主リストシートのY列「一番TEL」をSupabase `sellers.first_call_initials` へ一括同期する。

**シグネチャ**:
```javascript
function syncFirstTelToDb()
```

**処理ステップ**:
1. 開始時刻を記録し、Logger.logに出力
2. `売主リスト`シートを取得
3. 全行を`rowToObject()`でオブジェクト配列に変換
4. 各行に対して以下を実行:
   - 売主番号バリデーション（`/^[A-Z]{2}\d+$/`）
   - 反響日付フィルタ（`formatDateToISO_()` で変換後、`>= '2026-01-01'` を確認）
   - `updateData = { first_call_initials: value_or_null }` を構築
   - `patchSellerToSupabase_(sellerNumber, updateData)` を呼び出し
5. 処理結果（対象数・更新数・スキップ数・エラー数・処理時間）をLogger.logに出力

### 再利用する既存関数

| 関数名 | 役割 | 変更 |
|--------|------|------|
| `SUPABASE_CONFIG` | Supabase URL・SERVICE_KEY | なし |
| `rowToObject(headers, rowData)` | スプレッドシート行をオブジェクトに変換 | なし |
| `formatDateToISO_(value)` | 日付文字列をYYYY-MM-DD形式に変換 | なし |
| `patchSellerToSupabase_(sellerNumber, updateData)` | Supabase REST API PATCH呼び出し | なし |

---

## データモデル

### スプレッドシート → DB マッピング

| スプレッドシート列 | カラム名 | DB カラム | 型 | 変換ルール |
|-----------------|---------|----------|-----|-----------|
| Y列 | 一番TEL | `first_call_initials` | VARCHAR(10) | 値あり→文字列、空欄→null |
| B列 | 売主番号 | `seller_number` | VARCHAR | PATCH条件（変更なし） |
| 反響日付列 | 反響日付 | `inquiry_date` | DATE | フィルタ条件のみ（更新しない） |

### updateData オブジェクト構造

```javascript
// syncFirstTelToDb が構築する updateData
{
  first_call_initials: "AB"   // Y列の値（文字列）
  // または
  first_call_initials: null   // Y列が空欄の場合
}
```

**重要**: `updated_at` を含む他のカラムは一切含めない。`first_call_initials` のみ。

### 前提条件: DBスキーマ

`sellers` テーブルに以下のカラムが存在すること:

```sql
-- カラムが存在しない場合は先に実行すること
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS first_call_initials VARCHAR(10);
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いを形式的に記述したものです。プロパティは人間が読める仕様と機械検証可能な正確性保証の橋渡しとなります。*

### プロパティ 1: 日付フィルタの正確性

*任意の* 日付文字列（YYYY/MM/DD または YYYY-MM-DD 形式）に対して、`formatDateToISO_()` で変換した結果が `'2026-01-01'` 以上であるレコードのみが同期対象と判定され、それ以外（2025-12-31以前・空欄・無効値）はスキップされること。

**Validates: Requirements 1.1, 1.2, 1.3**

### プロパティ 2: 売主番号バリデーションの正確性

*任意の* 文字列に対して、`/^[A-Z]{2}\d+$/` 正規表現に一致するもの（例: AA1234, BB999）のみが処理対象と判定され、それ以外（空文字、小文字、数字のみ、記号含む等）はスキップされること。

**Validates: Requirements 1.4**

### プロパティ 3: 一番TEL値のマッピング正確性

*任意の* スプレッドシート行オブジェクトに対して、`syncFirstTelToDb` が構築する `updateData` は `first_call_initials` キーのみを含み、その値は行の `'一番TEL'` キーの値が非空文字列であれば同じ文字列、空欄であれば `null` となること。

**Validates: Requirements 2.1, 2.2, 5.2**

### プロパティ 4: エラー時の処理継続性

*任意の* レコードセットに対して、一部のレコードでSupabase APIがHTTPエラー（200系以外）を返した場合でも、残りの全レコードの処理が継続され、最終的なエラー件数が実際のAPIエラー数と一致すること。

**Validates: Requirements 2.5**

### プロパティ 5: ログ統計の正確性

*任意の* レコードセット（対象レコード・スキップレコード・エラーレコードを含む）を処理した後、Logger.logに出力される更新件数・スキップ件数・エラー件数の合計が入力レコード総数と一致すること。

**Validates: Requirements 3.2, 3.3**

---

## エラーハンドリング

### エラーケースと対応

| エラーケース | 対応 | ログ出力 |
|------------|------|---------|
| `売主リスト`シートが存在しない | 即時終了 | `❌ シート「売主リスト」が見つかりません` |
| 売主番号が空欄または形式不一致 | スキップ | skippedCount++ |
| 反響日付が空欄・無効・2026/1/1より前 | スキップ | skippedCount++ |
| Supabase API HTTP 200系以外 | 次レコードへ継続 | `❌ {sellerNumber}: HTTP {code} - {message}` |
| ネットワークエラー（例外） | 次レコードへ継続 | `❌ {sellerNumber}: Network error - {message}` |

### エラー後の継続処理

`patchSellerToSupabase_()` は既に `muteHttpExceptions: true` と try-catch を実装しており、`{ success: boolean, error?: string }` を返します。`syncFirstTelToDb` はこの戻り値を確認し、失敗時はエラーカウントを増やして次のレコードへ進みます。

---

## テスト戦略

### PBT適用性の評価

本機能はGASスクリプトであり、純粋なJavaScript関数として実装されます。フィルタリングロジック・データマッピング・エラーハンドリングは純粋関数として切り出してテスト可能です。ただし、GAS環境（SpreadsheetApp、UrlFetchApp）はモックが必要です。

### ユニットテスト（例ベース）

以下の具体的なケースを例ベーステストで検証します:

1. **日付フィルタ境界値テスト**
   - `2026/1/1` → 対象（境界値）
   - `2025/12/31` → スキップ
   - `''`（空欄）→ スキップ
   - `'invalid'` → スキップ

2. **売主番号バリデーションテスト**
   - `'AA13501'` → 有効
   - `'aa13501'` → 無効（小文字）
   - `'A13501'` → 無効（1文字）
   - `''` → 無効

3. **updateData構築テスト**
   - `'一番TEL': 'AB'` → `{ first_call_initials: 'AB' }`
   - `'一番TEL': ''` → `{ first_call_initials: null }`
   - updateDataに `first_call_initials` 以外のキーが含まれないこと

4. **エラー継続テスト**
   - 3件中2件目がAPIエラー → 3件目も処理される

### プロパティベーステスト

プロパティベーステストライブラリ: **fast-check**（Node.js環境でのGASロジックテスト用）

各プロパティテストは最低100回のイテレーションで実行します。

```javascript
// タグ形式: Feature: seller-first-tel-db-sync, Property {番号}: {プロパティ内容}

// Property 1: 日付フィルタの正確性
// Feature: seller-first-tel-db-sync, Property 1: 日付フィルタの正確性
fc.assert(fc.property(
  fc.oneof(
    fc.date({ min: new Date('2026-01-01'), max: new Date('2030-12-31') }),
    fc.date({ min: new Date('2000-01-01'), max: new Date('2025-12-31') }),
    fc.constant(null),
    fc.string()
  ),
  (dateValue) => {
    const iso = formatDateToISO_(dateValue);
    const shouldInclude = iso !== null && iso >= '2026-01-01';
    return isTargetRecord(dateValue) === shouldInclude;
  }
), { numRuns: 100 });

// Property 2: 売主番号バリデーション
// Feature: seller-first-tel-db-sync, Property 2: 売主番号バリデーションの正確性
fc.assert(fc.property(
  fc.string(),
  (sellerNumber) => {
    const isValid = /^[A-Z]{2}\d+$/.test(sellerNumber);
    return isValidSellerNumber(sellerNumber) === isValid;
  }
), { numRuns: 100 });

// Property 3: 一番TEL値のマッピング正確性
// Feature: seller-first-tel-db-sync, Property 3: 一番TEL値のマッピング正確性
fc.assert(fc.property(
  fc.record({ '一番TEL': fc.oneof(fc.string({ minLength: 1 }), fc.constant('')) }),
  (rowObj) => {
    const updateData = buildUpdateData(rowObj);
    const keys = Object.keys(updateData);
    if (keys.length !== 1 || keys[0] !== 'first_call_initials') return false;
    const expected = rowObj['一番TEL'] ? String(rowObj['一番TEL']) : null;
    return updateData.first_call_initials === expected;
  }
), { numRuns: 100 });
```

### 統合テスト（手動）

GAS環境での実際の動作確認:

1. テスト用スプレッドシートで `syncFirstTelToDb` を手動実行
2. Logger.logで処理件数・更新件数・スキップ件数を確認
3. Supabase管理画面で `first_call_initials` カラムの更新を確認
4. 2026/1/1より前のレコードが更新されていないことを確認
5. 既存の `syncSellerList` トリガーが影響を受けていないことを確認
