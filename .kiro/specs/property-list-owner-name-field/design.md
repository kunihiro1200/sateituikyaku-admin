# 設計ドキュメント：物件リスト詳細画面の売主氏名フィールド取得ロジック変更

## 概要

物件リスト詳細画面の「売主氏名」フィールドについて、スプレッドシートのBL列（`●所有者情報`）を優先し、空欄の場合はO列（`名前(売主）`）にフォールバックする取得ロジックに変更する。

### 現状の問題

`property-listing-column-mapping.json` の `spreadsheetToDatabase` セクションに以下の重複マッピングが存在する：

```json
"名前(売主）": "seller_name",
"●所有者情報": "seller_name",   // ← seller_nameへの重複マッピング（問題）
...
"●所有者情報": "owner_info",    // ← owner_infoへのマッピング（正しい）
```

JSONオブジェクトでは同一キーが重複した場合、後の定義が有効になる。現在のJSONでは `●所有者情報` が `owner_info` にマッピングされているが、`seller_name` へのマッピングも残っており、意図が不明確な状態になっている。

また、`PropertyListingColumnMapper.mapSpreadsheetToDatabase()` は単純なキー→値のマッピングのみを行うため、「BL列優先、O列フォールバック」というロジックを実装できない。このロジックは `PropertyListingSyncService` 側で実装する必要がある。

### 変更後の動作

```
seller_name = owner_info（BL列）が空でない場合 → owner_info の値
             owner_info（BL列）が空の場合      → seller_name（O列）の値
             両方空の場合                       → null
```

---

## アーキテクチャ

### 変更対象コンポーネント

```
backend/src/config/
  └── property-listing-column-mapping.json   ← 重複マッピング修正

backend/src/services/
  ├── PropertyListingColumnMapper.ts          ← 変更なし（マッピング定義のみ）
  └── PropertyListingSyncService.ts           ← フォールバックロジック追加
```

### データフロー

```
スプレッドシート
  ├── O列: 名前(売主）  ──→ [ColumnMapper] ──→ seller_name（DBカラム）
  └── BL列: ●所有者情報 ──→ [ColumnMapper] ──→ owner_info（DBカラム）
                                                      ↓
                                          [SyncService フォールバックロジック]
                                                      ↓
                                          seller_name = owner_info ?? seller_name
```

---

## コンポーネントとインターフェース

### 1. `property-listing-column-mapping.json` の修正

**変更前（問題のある状態）：**
```json
"名前(売主）": "seller_name",
"●所有者情報": "seller_name",   // 重複（後の定義が有効）
...
"●所有者情報": "owner_info",    // こちらが実際に有効
```

**変更後（正しい状態）：**
```json
"名前(売主）": "seller_name",
"●所有者情報": "owner_info",
```

`●所有者情報` の `seller_name` への重複マッピングを削除し、`owner_info` への単一マッピングのみを残す。

### 2. `PropertyListingSyncService` のフォールバックロジック

`syncUpdatedPropertyListings()` 内のバッチ処理で、`columnMapper.mapSpreadsheetToDatabase()` 実行後にフォールバックロジックを適用する。

**追加するロジック（概念コード）：**
```typescript
// スプレッドシートデータをDBカラムにマッピング
const mappedUpdates = this.columnMapper.mapSpreadsheetToDatabase(update.spreadsheet_data);

// BL列（owner_info）優先、空欄の場合はO列（seller_name）にフォールバック
mappedUpdates.seller_name = mappedUpdates.owner_info || mappedUpdates.seller_name || null;
```

このロジックは以下の2箇所に適用する：
- `syncUpdatedPropertyListings()` のバッチ処理内
- `detectUpdatedPropertyListings()` の変更検出処理内（`seller_name` の比較が正しく行われるよう）

---

## データモデル

### `property_listings` テーブルの関連カラム

| カラム名 | 型 | 説明 |
|---|---|---|
| `seller_name` | `text \| null` | 売主氏名（表示用）。BL列優先、O列フォールバック |
| `owner_info` | `text \| null` | 所有者情報（BL列の生データ）。参照用 |

### スプレッドシートカラムとDBカラムのマッピング（変更後）

| スプレッドシートカラム | DBカラム | 備考 |
|---|---|---|
| `名前(売主）`（O列） | `seller_name` | 括弧混在：半角`(`と全角`）` |
| `●所有者情報`（BL列） | `owner_info` | 重複マッピング削除後 |

---

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1：BL列優先フォールバックロジック

*任意の* スプレッドシート行データに対して、`owner_info`（BL列）に値がある場合は `seller_name` が `owner_info` の値と等しく、`owner_info` が空の場合は `seller_name` が元の `seller_name`（O列）の値と等しくなること

**Validates: Requirements 1.1, 1.2, 1.3, 3.4, 4.2, 4.3**

### プロパティ2：フォールバックの単調性

*任意の* `owner_info` と `seller_name` の組み合わせに対して、フォールバックロジックを2回適用した結果は1回適用した結果と等しいこと（冪等性）

**Validates: Requirements 1.1, 1.2, 3.4**

---

## エラーハンドリング

### 同期処理中のエラー

既存の `syncUpdatedPropertyListings()` のエラーハンドリングをそのまま踏襲する。個別物件の処理でエラーが発生した場合：

1. エラーをコンソールにログ出力
2. 当該物件の処理をスキップ（`success: false` を返す）
3. 他の物件の処理を継続

```typescript
// 既存のエラーハンドリングパターン（変更なし）
try {
  // フォールバックロジックを含む処理
  return await this.updatePropertyListing(update.property_number, changedFieldsOnly);
} catch (error: any) {
  return {
    success: false,
    property_number: update.property_number,
    error: error.message
  };
}
```

### `null` / 空文字列の扱い

- `owner_info` が `null`、`undefined`、空文字列のいずれかの場合、フォールバックを実行する
- `seller_name`（O列）も同様に空の場合、最終的に `null` を保存する
- `PropertyListingService.getByPropertyNumber()` は `seller_name` が `null` でもエラーにしない（既存動作）

---

## テスト戦略

### ユニットテスト

**対象：** `PropertyListingSyncService` のフォールバックロジック

1. BL列に値あり、O列に値あり → BL列の値が `seller_name` になること
2. BL列が空、O列に値あり → O列の値が `seller_name` になること
3. BL列が空、O列も空 → `seller_name` が `null` になること
4. BL列に値あり、O列が空 → BL列の値が `seller_name` になること

**対象：** `PropertyListingColumnMapper` のマッピング確認

5. `●所有者情報` が `owner_info` にマッピングされること
6. `名前(売主）`（括弧混在）が `seller_name` にマッピングされること
7. `●所有者情報` が `seller_name` にマッピングされないこと（重複解消の確認）

### プロパティベーステスト

PBTライブラリ：**fast-check**（TypeScript向け）

各プロパティテストは最低100回のイテレーションで実行する。

**プロパティ1のテスト実装方針：**

```typescript
// Feature: property-list-owner-name-field, Property 1: BL列優先フォールバックロジック
fc.assert(
  fc.property(
    fc.record({
      owner_info: fc.oneof(fc.string(), fc.constant(null), fc.constant('')),
      seller_name: fc.oneof(fc.string(), fc.constant(null), fc.constant(''))
    }),
    ({ owner_info, seller_name }) => {
      const result = applyFallbackLogic({ owner_info, seller_name });
      if (owner_info && owner_info.trim() !== '') {
        return result.seller_name === owner_info;
      } else if (seller_name && seller_name.trim() !== '') {
        return result.seller_name === seller_name;
      } else {
        return result.seller_name === null;
      }
    }
  ),
  { numRuns: 100 }
);
```

**プロパティ2のテスト実装方針：**

```typescript
// Feature: property-list-owner-name-field, Property 2: フォールバックの単調性（冪等性）
fc.assert(
  fc.property(
    fc.record({
      owner_info: fc.oneof(fc.string(), fc.constant(null)),
      seller_name: fc.oneof(fc.string(), fc.constant(null))
    }),
    (data) => {
      const once = applyFallbackLogic(data);
      const twice = applyFallbackLogic(once);
      return once.seller_name === twice.seller_name;
    }
  ),
  { numRuns: 100 }
);
```

### インテグレーションテスト

- スプレッドシートのモックデータを使用して `syncUpdatedPropertyListings()` を実行し、`seller_name` が正しく更新されることを確認
- エラー発生時に他の物件の処理が継続されることを確認
