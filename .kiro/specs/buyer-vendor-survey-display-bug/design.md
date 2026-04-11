# 買主リスト詳細画面「業者向けアンケート」フィールド表示バグ 設計ドキュメント

## Overview

買主詳細画面において、スプレッドシートの「業者向けアンケート」列（FZ列）が空欄のとき、DBには null または空として保存されるべきだが、実際には「未」という値が保存されてしまい、フィールドが「未」として表示されるバグが発生している。

フロントエンド（`BuyerDetailPage.tsx`）には既に「vendor_survey が null または空文字の場合は非表示」というロジックが実装されているが、GASの同期処理でスプシ空欄時に「未」という文字列がDBに書き込まれているため、フロントエンドの非表示ロジックが機能していない。

修正方針：GASの同期処理（`gas/buyer-sync/BuyerSync.gs`）でスプシ空欄時に null または空文字を保存するよう修正する。

## Glossary

- **Bug_Condition (C)**: スプレッドシートの「業者向けアンケート」列が空欄であるにもかかわらず、DBの `vendor_survey` フィールドに「未」が保存されている状態
- **Property (P)**: `vendor_survey` が null または空文字のとき、買主詳細画面で「業者向けアンケート」フィールドが非表示になること
- **Preservation**: 有効な値（「済」「未」など）が保存されている場合の正常な表示動作、および他のフィールドの表示動作が変更されないこと
- **vendor_survey**: `buyers` テーブルのカラム。スプレッドシートのFZ列「業者向けアンケート」に対応する
- **BUYER_COLUMN_MAPPING**: GASの `BuyerSync.gs` に定義されたスプレッドシート列名とDBカラム名のマッピング
- **buyerMapRowToRecord**: GASの関数。スプレッドシートの行データをDBレコードに変換する

## Bug Details

### Bug Condition

スプレッドシートの「業者向けアンケート」列が空欄のとき、GASの同期処理が空欄を「未」として解釈してDBに保存してしまう。フロントエンドには `vendor_survey` が null または空文字の場合に非表示にするロジックが実装されているが、「未」という文字列が保存されているため非表示にならない。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type BuyerRecord (DBから取得した買主データ)
  OUTPUT: boolean

  RETURN buyer.vendor_survey IS NOT NULL
         AND buyer.vendor_survey IS NOT EMPTY
         AND buyer.vendor_survey = '未'
         AND spreadsheet_cell_for_vendor_survey(buyer) IS EMPTY
END FUNCTION
```

### Examples

- **例1（バグ）**: スプシのFZ列が空欄 → DBに `vendor_survey = '未'` が保存 → 画面に「業者向けアンケート: 未」が表示される（期待: 非表示）
- **例2（バグ）**: DBの `vendor_survey = null` → 画面に「業者向けアンケート: 未」が表示される（期待: 非表示）
- **例3（正常）**: スプシのFZ列に「確認済み」が入力 → DBに `vendor_survey = '確認済み'` が保存 → 画面に「業者向けアンケート: 確認済み」が表示される
- **例4（正常）**: スプシのFZ列に「未」が明示的に入力 → DBに `vendor_survey = '未'` が保存 → 画面に「業者向けアンケート: 未」がオレンジ強調で表示される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- DBの `vendor_survey` フィールドに有効な値（「済」「未」「確認済み」など）が保存されているとき、買主詳細画面でその値が正しく表示される
- スプレッドシートの「業者向けアンケート」列に値が入力されているとき、その値がDBに保存され、買主詳細画面に表示される
- 他の買主詳細フィールド（氏名、電話番号、問合せ内容など）が正しく表示される

**Scope:**
`vendor_survey` フィールドの表示ロジックのみが変更対象。他のフィールドの表示・保存動作は一切変更しない。

## Hypothesized Root Cause

コードベースの調査から、以下の根本原因が特定された：

1. **GASの同期処理でのデフォルト値設定**: `gas/buyer-sync/BuyerSync.gs` の `buyerMapRowToRecord` 関数またはその呼び出し元で、スプシ空欄時に空文字や null ではなく「未」をデフォルト値として設定している可能性がある

2. **フロントエンドの非表示ロジックは正常**: `BuyerDetailPage.tsx` の2260行目付近に以下のロジックが実装されており、これは正しく動作している：
   ```typescript
   if (!buyer?.vendor_survey || !String(buyer.vendor_survey).trim()) {
     return null; // 非表示
   }
   ```
   しかし「未」という文字列は truthy であるため、このチェックをパスしてしまう

3. **バックエンドのデフォルト値**: `backend/src/services/BuyerService.ts` でDBから取得する際に `vendor_survey` のデフォルト値として「未」を設定している可能性がある

4. **GASのカラムマッピング**: `gas/buyer-sync/BuyerSync.gs` の `BUYER_COLUMN_MAPPING` に `'業者向けアンケート': 'vendor_survey'` が追加されているが、空欄時の処理が適切でない可能性がある

## Correctness Properties

Property 1: Bug Condition - 空欄時の非表示

_For any_ 買主データにおいて、スプレッドシートの「業者向けアンケート」列が空欄であり、DBの `vendor_survey` が null または空文字のとき、修正後の買主詳細画面は「業者向けアンケート」フィールドを表示しない（return null）。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 有効な値の表示

_For any_ 買主データにおいて、DBの `vendor_survey` に null でも空文字でもない有効な値（「済」「未」「確認済み」など）が保存されているとき、修正後の買主詳細画面は元のコードと同じ動作をし、その値を「業者向けアンケート」フィールドとして正しく表示する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因の仮説に基づき、以下の変更が必要：

**File 1**: `gas/buyer-sync/BuyerSync.gs`（または対応するGASファイル）

**Function**: `buyerMapRowToRecord` または同期処理関数

**Specific Changes**:
1. **空欄時のnull保存**: スプシの「業者向けアンケート」列が空欄のとき、「未」ではなく null または空文字を保存するよう修正
   - 現在: `vendor_survey: cellValue || '未'`（推定）
   - 修正後: `vendor_survey: cellValue || null`

2. **既存データの修正**: DBに「未」として保存されている既存レコードのうち、スプシが空欄のものを null に更新するバックフィルスクリプトが必要な場合がある

**File 2**: `backend/src/services/BuyerService.ts`（必要な場合）

**Specific Changes**:
1. **デフォルト値の確認**: `vendor_survey` フィールドのデフォルト値が「未」に設定されていないか確認し、設定されている場合は null に変更

### 実装前の調査事項

修正前に以下を確認する：
1. GASの `BuyerSync.gs` で `vendor_survey` の空欄時処理を確認
2. バックエンドの `BuyerService.ts` で `vendor_survey` のデフォルト値を確認
3. 買主ID 7319 のDBレコードを確認し、`vendor_survey` の実際の値を確認

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ：まず未修正コードでバグを確認し、次に修正後の正しい動作と既存動作の保全を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを確認し、根本原因の仮説を検証する。

**Test Plan**: 買主ID 7319（バグが確認されている）のDBレコードを取得し、`vendor_survey` の値を確認する。また、GASの同期処理をシミュレートして空欄時の動作を確認する。

**Test Cases**:
1. **DB値確認テスト**: 買主7319の `vendor_survey` 値を確認（「未」が保存されていることを確認）
2. **フロントエンド表示テスト**: `vendor_survey = '未'` のとき、フロントエンドが「業者向けアンケート」フィールドを表示することを確認（バグ）
3. **GAS同期シミュレーション**: スプシ空欄行を `buyerMapRowToRecord` に渡し、`vendor_survey` の値を確認
4. **null/空文字テスト**: `vendor_survey = null` または `vendor_survey = ''` のとき、フロントエンドが非表示にすることを確認（既に実装済み）

**Expected Counterexamples**:
- `vendor_survey = '未'` のとき、フロントエンドの非表示ロジックが機能しない
- GASの同期処理でスプシ空欄時に「未」が保存される

### Fix Checking

**Goal**: 修正後、バグ条件を満たす入力に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := renderVendorSurveyField_fixed(buyer)
  ASSERT result = null  // フィールドが非表示
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない入力に対して、修正前後で同じ動作をすることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT renderVendorSurveyField_original(buyer) = renderVendorSurveyField_fixed(buyer)
END FOR
```

**Testing Approach**: プロパティベーステストを使用して、有効な値を持つ多様な買主データに対して保全を確認する。

**Test Cases**:
1. **有効値の表示保全**: `vendor_survey = '確認済み'` のとき、修正後も正しく表示されることを確認
2. **「未」の表示保全**: スプシに「未」が明示的に入力されている場合（DBに「未」が保存）、修正後も「未」がオレンジ強調で表示されることを確認
3. **他フィールドの保全**: `vendor_survey` 以外のフィールドが修正後も正しく表示されることを確認

### Unit Tests

- `vendor_survey = null` のとき非表示になることを確認
- `vendor_survey = ''` のとき非表示になることを確認
- `vendor_survey = '未'` のとき表示されることを確認（スプシに「未」が入力された正常ケース）
- `vendor_survey = '確認済み'` のとき表示されることを確認

### Property-Based Tests

- ランダムな有効値（非null、非空文字）を持つ買主データに対して、フィールドが表示されることを確認
- null または空文字の `vendor_survey` を持つ買主データに対して、フィールドが非表示になることを確認
- 多様な買主データに対して、`vendor_survey` 以外のフィールドが影響を受けないことを確認

### Integration Tests

- スプシ空欄 → GAS同期 → DB保存 → フロントエンド表示の全フローで非表示になることを確認
- スプシに「確認済み」入力 → GAS同期 → DB保存 → フロントエンド表示の全フローで正しく表示されることを確認
- 買主7319の実際のデータで修正後の動作を確認
