# viewing-type-sync-fix バグ修正デザイン

## Overview

スプレッドシートの「内覧形態」列の値がDBに反映されないバグを修正する。

根本原因は `gas/buyer-sync/BuyerSync.gs` の `BUYER_COLUMN_MAPPING` において、
「内覧形態」が `'viewing_type'` にマッピングされているが、
`backend/src/config/buyer-column-mapping.json` では `"viewing_mobile"` にマッピングされており、
DBテーブル（`buyers`）には `viewing_type` カラムは存在するが `viewing_mobile` カラムは存在しない
という不整合が原因である。

修正方針: GASの `BUYER_COLUMN_MAPPING` の `'内覧形態'` のマッピング値を
`'viewing_type'` から `'viewing_mobile'` に修正し、
`buyer-column-mapping.json` との整合性を取る。
ただし、DBに `viewing_mobile` カラムが存在しない場合はマイグレーションも必要。

## Glossary

- **Bug_Condition (C)**: GASの `BUYER_COLUMN_MAPPING` で「内覧形態」が `'viewing_type'` にマッピングされており、`buyer-column-mapping.json` の `'viewing_mobile'` と不一致になっている状態
- **Property (P)**: 「内覧形態」列の値がDBの正しいカラムに保存されること
- **Preservation**: 「内覧形態」以外の全フィールドのスプレッドシート→DB同期が従来通り動作すること
- **BUYER_COLUMN_MAPPING**: `gas/buyer-sync/BuyerSync.gs` 内の定数。スプレッドシートのカラム名とDBカラム名のマッピングを定義する
- **buyer-column-mapping.json**: `backend/src/config/buyer-column-mapping.json`。バックエンド側のカラムマッピング定義ファイル
- **viewing_type**: DBの `buyers` テーブルに存在するカラム（GASが現在書き込んでいる先）
- **viewing_mobile**: `buyer-column-mapping.json` が参照するカラム名（DBに存在しない可能性あり）

## Bug Details

### Bug Condition

GASの `BUYER_COLUMN_MAPPING` で「内覧形態」が `'viewing_type'` にマッピングされているため、
スプレッドシートの「内覧形態」列の値は `buyers.viewing_type` カラムに書き込まれる。
しかし `buyer-column-mapping.json` は `"内覧形態": "viewing_mobile"` と定義しており、
`viewing_mobile` カラムはDBに存在しないため、バックエンド経由の同期では値が反映されない。

**Formal Specification:**
```
FUNCTION isBugCondition(mapping)
  INPUT: mapping of type BUYER_COLUMN_MAPPING entry
  OUTPUT: boolean

  RETURN mapping.key === '内覧形態'
         AND mapping.value === 'viewing_type'
         AND buyer-column-mapping.json['内覧形態'] === 'viewing_mobile'
         AND NOT columnExistsInDB('viewing_mobile')
END FUNCTION
```

### Examples

- **物件番号7344の買主**: スプレッドシートの「内覧形態」列に「【内覧_専（自社物件）】」が入力されているが、DBの `viewing_mobile` カラムには反映されない（`viewing_type` カラムには書き込まれているが、フロントエンドは `viewing_mobile` を参照するため表示されない）
- **空欄の場合**: スプレッドシートの「内覧形態」列が空欄の場合、DBの `viewing_mobile` も空のまま（期待通り）
- **「内覧形態_一般媒介」列**: GASでは `'viewing_type_general'` にマッピングされており、`buyer-column-mapping.json` も同じ値のため問題なし

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 「内覧形態」以外の全フィールド（`viewing_date`、`viewing_time`、`viewing_type_general` 等）のスプレッドシート→DB同期は従来通り動作する
- スプレッドシートの「内覧形態」列が空欄の場合、DBの該当フィールドも空のまま維持される
- 売主リスト、業務リスト等、内覧リスト以外の同期処理は影響を受けない

**Scope:**
「内覧形態」列以外の全フィールドの同期処理は完全に影響を受けない。
変更対象は `gas/buyer-sync/BuyerSync.gs` の `BUYER_COLUMN_MAPPING` の1エントリのみ。

## Hypothesized Root Cause

調査結果に基づき、根本原因は以下の通り特定された：

1. **GASのBUYER_COLUMN_MAPPINGとbuyer-column-mapping.jsonの不整合**: `BuyerSync.gs` の `BUYER_COLUMN_MAPPING` で `'内覧形態': 'viewing_type'` と定義されているが、`buyer-column-mapping.json` では `"内覧形態": "viewing_mobile"` と定義されている。どちらかが正しいカラム名であり、もう一方が誤っている。

2. **DBカラム名の確認が必要**: `042_add_buyers_complete.sql` では `viewing_type TEXT` カラムが定義されており、`viewing_mobile` カラムは存在しない。`buyer-column-mapping.json` が参照する `viewing_mobile` カラムがDBに存在しないため、バックエンド経由の同期では書き込みが失敗する可能性がある。

3. **カラム追加時のGAS更新漏れ**: `buyer-column-mapping.json` に `viewing_mobile` が追加された際、GASの `BUYER_COLUMN_MAPPING` の更新が漏れたと推測される（過去の `vendor_survey` バグと同じパターン）。

4. **修正方針の決定**: `buyer-column-mapping.json` の `"内覧形態": "viewing_mobile"` が正しい定義であるとすると、GASの `'内覧形態': 'viewing_type'` を `'viewing_mobile'` に修正し、DBに `viewing_mobile` カラムを追加するマイグレーションが必要。

## Correctness Properties

Property 1: Bug Condition - 内覧形態の同期

_For any_ スプレッドシートの「内覧形態」列に値が入力されている買主レコードに対して、
修正後のGAS同期処理は `buyers.viewing_mobile` カラムにその値を正しく書き込む。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他フィールドの同期

_For any_ 「内覧形態」以外のフィールドを含む買主レコードに対して、
修正後のGAS同期処理は従来通り各フィールドをDBの対応カラムに正しく書き込み、
既存の同期動作を変更しない。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**調査結果に基づく修正方針:**

`buyer-column-mapping.json` の定義（`"内覧形態": "viewing_mobile"`）を正とし、
GASのマッピングをそれに合わせる。また、DBに `viewing_mobile` カラムが存在しない場合は
マイグレーションで追加する。

---

**File 1**: `gas/buyer-sync/BuyerSync.gs`

**変更箇所**: `BUYER_COLUMN_MAPPING` の「内覧形態」エントリ

**Specific Changes**:
1. **マッピング値の修正**: `'内覧形態': 'viewing_type'` を `'内覧形態': 'viewing_mobile'` に変更
   - 変更前: `'内覧形態': 'viewing_type',`
   - 変更後: `'内覧形態': 'viewing_mobile',`

---

**File 2**: `backend/migrations/114_add_viewing_mobile_to_buyers.sql`（新規作成）

**変更箇所**: `buyers` テーブルに `viewing_mobile` カラムを追加

**Specific Changes**:
1. **マイグレーション追加**: `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS viewing_mobile TEXT;`
2. **既存データの移行**: `viewing_type` カラムのデータを `viewing_mobile` にコピー（必要に応じて）

---

**注意**: `viewing_type` カラムはDBに存在するが、`buyer-column-mapping.json` では参照されていない。
修正後は `viewing_mobile` カラムが正式な「内覧形態」の保存先となる。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：
1. 未修正コードでバグを再現するテストを実行してバグを確認する
2. 修正後に正しく動作することと既存動作が保全されることを確認する

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `BUYER_COLUMN_MAPPING` の「内覧形態」エントリが `'viewing_type'` にマッピングされていることを確認し、`buyer-column-mapping.json` の `'viewing_mobile'` との不一致を検証する。

**Test Cases**:
1. **マッピング不一致テスト**: `BuyerSync.gs` の `BUYER_COLUMN_MAPPING['内覧形態']` が `'viewing_type'` であることを確認（未修正コードで失敗するはず）
2. **DBカラム存在確認テスト**: `buyers` テーブルに `viewing_mobile` カラムが存在しないことを確認
3. **物件番号7344の同期テスト**: 買主番号7344のスプレッドシート行を同期し、`viewing_mobile` がDBに反映されないことを確認

**Expected Counterexamples**:
- `BUYER_COLUMN_MAPPING['内覧形態']` が `'viewing_mobile'` ではなく `'viewing_type'` を返す
- DBの `buyers` テーブルに `viewing_mobile` カラムが存在しない

### Fix Checking

**Goal**: 修正後、「内覧形態」列の値がDBの `viewing_mobile` カラムに正しく書き込まれることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(BUYER_COLUMN_MAPPING)
  result := syncBuyer_fixed(buyer)
  ASSERT result.viewing_mobile === spreadsheet['内覧形態']
END FOR
```

### Preservation Checking

**Goal**: 「内覧形態」以外の全フィールドの同期動作が変更されていないことを確認する。

**Pseudocode:**
```
FOR ALL field WHERE field !== '内覧形態'
  ASSERT BUYER_COLUMN_MAPPING_original[field] === BUYER_COLUMN_MAPPING_fixed[field]
END FOR
```

**Testing Approach**: `BUYER_COLUMN_MAPPING` の差分確認により、「内覧形態」エントリのみが変更されていることを検証する。

**Test Cases**:
1. **他フィールドのマッピング保全**: `viewing_type_general`、`viewing_date`、`viewing_time` 等のマッピングが変更されていないことを確認
2. **空欄処理の保全**: 「内覧形態」列が空欄の場合、`viewing_mobile` が `null` または空値になることを確認
3. **他の同期処理への影響なし**: 売主リスト同期、業務リスト同期が影響を受けないことを確認

### Unit Tests

- `BUYER_COLUMN_MAPPING['内覧形態']` が `'viewing_mobile'` を返すことを確認
- `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended['内覧形態']` が `'viewing_mobile'` であることを確認
- DBの `buyers` テーブルに `viewing_mobile` カラムが存在することを確認

### Property-Based Tests

- ランダムな買主レコードに対して、「内覧形態」フィールドが `viewing_mobile` カラムに正しく同期されることを確認
- 「内覧形態」以外の全フィールドについて、マッピングが変更前後で同一であることを確認
- 空値・null値・特殊文字を含む「内覧形態」値に対して、同期処理が正しく動作することを確認

### Integration Tests

- 物件番号7344の買主レコードに対してGAS同期を実行し、`viewing_mobile` がDBに反映されることを確認
- 修正後の同期で、他の買主フィールドが従来通り正常に同期されることを確認
- `buyer-column-mapping.json` と `BUYER_COLUMN_MAPPING` の全エントリが整合していることを確認
