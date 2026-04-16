# 買主詳細画面「他社物件情報」セクション修正 Bugfix Design

## Overview

買主リスト詳細画面の「他社物件情報」セクションに2つのバグが存在する。

**バグ1（UI）**: `property_number` が未設定の場合に表示される「他社物件情報」セクションが、`other_company_property_info` という単一フィールドのみを持つ簡易UIになっている。本来は `other_company_property`（他社物件）と `building_name_price`（建物名/価格）の2つのテキストエリアと説明文を表示すべきである。

**バグ2（同期）**: 上記の簡易UIの保存ハンドラー `handleSaveOtherCompanyPropertyInfo` が `sync=false` パラメータ付きでAPIを呼び出しているため、スプレッドシートへの即時同期が行われない。また、`other_company_property` と `building_name_price` フィールドは `handleInlineFieldSave`（`sync=true`）経由で保存されるが、それらが表示されるセクション（`hasOtherCompanyPropertyData` が true の場合）は既存データがある場合のみ表示される。

修正方針は、`property_number` 未設定時のセクションを `other_company_property` / `building_name_price` の2フィールドUIに統一し、`handleInlineFieldSave`（sync=true）を使用するよう変更することである。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 買主詳細画面で「他社物件情報」セクションを表示した際に、UIが1枠のみ表示される、またはスプレッドシートへの即時同期が行われない状態
- **Property (P)**: 期待される正しい動作 — 2つのテキストエリア（他社物件・建物名/価格）と説明文が表示され、保存時にスプレッドシートのDJ列・H列に即時同期される
- **Preservation**: 修正によって変更してはならない既存動作 — 他社物件情報セクション以外の全フィールドの保存・同期処理、空フィールド保存時の動作
- **handleSaveOtherCompanyPropertyInfo**: `BuyerDetailPage.tsx` 内の保存ハンドラー。現在 `sync=false` でAPIを呼び出しており、スプレッドシート同期をスキップしている
- **handleInlineFieldSave**: `BuyerDetailPage.tsx` 内のインライン編集保存ハンドラー。`sync=true, force=true` でAPIを呼び出し、スプレッドシートへの即時同期を実行する
- **hasOtherCompanyPropertyData**: `other_company_property` フィールドに値があるかを判定するヘルパー関数
- **databaseToSpreadsheet**: `buyer-column-mapping.json` 内のDBカラム→スプレッドシート列名マッピング。`other_company_property` → `他社物件`（DJ列）、`building_name_price` → `建物名/価格 内覧物件は赤表示（★は他社物件）`（H列）が定義済み

## Bug Details

### Bug Condition

バグは買主詳細画面の「他社物件情報」セクションを表示・操作する際に発現する。具体的には以下の2つの条件で発現する。

**バグ1（UI欠落）**: `property_number` が未設定の買主の詳細画面を表示した場合、`other_company_property_info` という単一フィールドのみの簡易UIが表示され、`other_company_property`（他社物件）と `building_name_price`（建物名/価格）の2つのテキストエリアおよび説明文が表示されない。

**バグ2（同期不具合）**: 上記の簡易UIで「保存」ボタンをクリックした場合、`handleSaveOtherCompanyPropertyInfo` が `sync=false` でAPIを呼び出すため、スプレッドシートへの即時同期が行われない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyerPropertyNumber: string | null, fieldSaved: string, syncEnabled: boolean }
  OUTPUT: boolean

  // バグ1: UIが1枠のみ表示される条件
  IF input.buyerPropertyNumber IS NULL OR input.buyerPropertyNumber = ''
    AND currentUI shows only 'other_company_property_info' textarea
    AND currentUI does NOT show 'other_company_property' textarea
    AND currentUI does NOT show 'building_name_price' textarea
    THEN RETURN true

  // バグ2: スプレッドシート同期が行われない条件
  IF input.fieldSaved IN ['other_company_property', 'building_name_price']
    AND input.syncEnabled = false
    THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **バグ1の例**: `property_number` が空の買主AA1234の詳細画面を開く → 「他社物件情報」セクションに1つのテキストエリアのみ表示される（期待: 2つのテキストエリア + 説明文）
- **バグ2の例**: 上記UIで「他社物件の情報を入力してください」欄に値を入力して「保存」をクリック → DBには保存されるがスプレッドシートのDJ列に反映されない（期待: DJ列に即時反映）
- **バグ2の例（建物名/価格）**: `other_company_property` に値がある買主の詳細画面で「建物名/価格」フィールドを編集して保存 → H列に反映される（これは正常動作。`handleInlineFieldSave` 経由のため）
- **エッジケース**: `other_company_property` に値がある買主の場合、既存の2枠UIが表示されるため、バグ1は発現しない

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 「他社物件情報」セクション以外の買主詳細フィールドの保存・スプレッドシート同期処理は引き続き正常に動作しなければならない
- `other_company_property` フィールドが空の状態で保存した場合、他のフィールドの保存処理は正常に完了しなければならない
- `building_name_price` フィールドが空の状態で保存した場合、他のフィールドの保存処理は正常に完了しなければならない
- 買主詳細画面の他のセクション（基本情報、希望条件など）のレイアウトと機能は変更されてはならない
- `property_number` が設定済みの買主では、「他社物件情報」セクションの表示ロジックは変更されてはならない

**Scope:**
「他社物件情報」セクション以外の全ての入力・保存操作はこの修正の影響を受けない。具体的には:
- 他のフィールドのインライン編集・保存
- スプレッドシートからDBへの同期（GAS経由）
- 買主一覧ページの表示

**注意:** 期待される正しい動作（2枠表示・即時同期）は「Correctness Properties」セクションのProperty 1に定義する。

## Hypothesized Root Cause

コードベースの調査に基づき、以下の根本原因を仮説として立てる。

1. **UIの二重実装による欠落（バグ1の主因）**: `BuyerDetailPage.tsx` の `property_number` 未設定時のセクション（行1883〜1919）が、`other_company_property` / `building_name_price` の2フィールドUIとは別に、`other_company_property_info` という単一フィールドの簡易UIとして実装されている。本来は同じ2フィールドUIを使用すべきところ、別実装が混在している。
   - `property_number` 未設定時: `other_company_property_info` の1枠のみ（簡易UI）
   - `hasOtherCompanyPropertyData` が true の時: `other_company_property` + `building_name_price` の2枠（正しいUI）

2. **sync=false による同期スキップ（バグ2の主因）**: `handleSaveOtherCompanyPropertyInfo`（行855〜870）が `api.put('/api/buyers/${buyer_number}?sync=false', ...)` を呼び出している。`sync=false` が明示的に指定されると、`buyers.ts` ルートは `buyerService.update()`（同期なし）を使用し、`buyerService.updateWithSync()`（同期あり）を使用しない。

3. **フィールド名の不一致**: 簡易UIは `other_company_property_info` というフィールドを使用しているが、スプレッドシートマッピング（`buyer-column-mapping.json`）には `other_company_property` と `building_name_price` のみが定義されており、`other_company_property_info` のマッピングは存在しない。

4. **説明文の欠落**: 簡易UIには「こちらは詳細な住所のみにしてください。お客様に物件情報として表示されます。他社名や価格は「建物名/価格」欄に書いてください。」という説明文が含まれていない。

## Correctness Properties

Property 1: Bug Condition - 他社物件情報セクションの2枠表示と即時同期

_For any_ 買主詳細画面において、`property_number` の有無に関わらず「他社物件情報」セクションを表示・保存する操作に対して、修正後の実装は以下を満たさなければならない:
1. `other_company_property`（他社物件）テキストエリアを表示する
2. 「こちらは詳細な住所のみにしてください。お客様に物件情報として表示されます。他社名や価格は「建物名/価格」欄に書いてください。」という説明文を表示する
3. `building_name_price`（建物名/価格）テキストエリアを表示する
4. `other_company_property` を保存した際にスプレッドシートのDJ列（カラム名「他社物件」）に即時同期する
5. `building_name_price` を保存した際にスプレッドシートのH列（カラム名「建物名/価格 内覧物件は赤表示（★は他社物件）」）に即時同期する

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 他セクションの動作保持

_For any_ 「他社物件情報」セクション以外の買主詳細フィールドの保存・表示操作に対して、修正後の実装は修正前と同一の動作を維持しなければならない。具体的には、空フィールドの保存、他セクションのスプレッドシート同期、画面レイアウトが変更されてはならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

仮説した根本原因が正しいと仮定した場合の修正内容:

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Specific Changes**:

1. **簡易UIセクションの削除**: `property_number` 未設定時に表示される `other_company_property_info` 単一フィールドの簡易UIブロック（行1883〜1919付近）を削除する。

2. **表示条件の変更**: 「他社物件情報」セクション（`hasOtherCompanyPropertyData` による条件分岐）の表示条件を変更し、`property_number` が未設定の場合も常に表示されるようにする。具体的には:
   - 現在: `{hasOtherCompanyPropertyData(buyer) && (...)}`
   - 修正後: `{!buyer?.property_number && (...)}`（または常時表示）

3. **不要なstateの削除**: `otherCompanyPropertyInfo`、`isSavingOtherCompanyInfo`、`otherCompanyInfoSaveStatus` の各stateと、`handleSaveOtherCompanyPropertyInfo` 関数を削除する（簡易UIが不要になるため）。

4. **初期値設定の修正**: `fetchBuyer` 内の `setOtherCompanyPropertyInfo(res.data.other_company_property_info || '')` を削除する。

**注意**: `other_company_property` と `building_name_price` フィールドは既に `handleInlineFieldSave`（`sync=true`）を使用しているため、スプレッドシート同期は自動的に修正される。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず修正前のコードでバグの存在を確認し（探索的テスト）、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグが存在することを確認し、根本原因の仮説を検証する。

**Test Plan**: `BuyerDetailPage` コンポーネントをレンダリングし、`property_number` が未設定の買主データを渡した際のUI表示と保存動作を確認する。修正前のコードでテストを実行し、失敗することでバグの存在を証明する。

**Test Cases**:
1. **UI欠落テスト**: `property_number` が null の買主データで `BuyerDetailPage` をレンダリングし、「他社物件」テキストエリアが表示されないことを確認（修正前は失敗）
2. **説明文欠落テスト**: 同条件で「こちらは詳細な住所のみにしてください」という説明文が表示されないことを確認（修正前は失敗）
3. **建物名/価格欠落テスト**: 同条件で「建物名/価格」テキストエリアが表示されないことを確認（修正前は失敗）
4. **sync=false テスト**: `handleSaveOtherCompanyPropertyInfo` が `sync=false` でAPIを呼び出すことを確認（修正前は失敗）

**Expected Counterexamples**:
- `property_number` が null の場合、`other_company_property` テキストエリアが見つからない
- APIコールに `sync=false` パラメータが含まれている

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待される動作が実現されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderBuyerDetailPage_fixed(input)
  ASSERT expectedBehavior(result)
    // 「他社物件」テキストエリアが表示される
    // 説明文が表示される
    // 「建物名/価格」テキストエリアが表示される
    // 保存時にsync=trueでAPIが呼ばれる
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全ての入力に対して、修正前と同一の動作が維持されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT BuyerDetailPage_original(input) = BuyerDetailPage_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由:
- 多様な買主データ（各フィールドの有無・値の組み合わせ）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強く保証できる

**Test Plan**: 修正前のコードで他セクションの動作を観察し、修正後も同一動作が維持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **他セクション保存の保持**: `property_number` が設定済みの買主で他フィールドを保存した際、`sync=true` でAPIが呼ばれることを確認
2. **空フィールド保存の保持**: `other_company_property` が空の状態で他フィールドを保存した際、正常に完了することを確認
3. **レイアウト保持**: 他のセクション（基本情報、希望条件など）のレンダリングが変更されないことを確認

### Unit Tests

- `property_number` が null/空の買主データで2つのテキストエリアと説明文が表示されることをテスト
- `property_number` が設定済みの買主データで「他社物件情報」セクションの表示ロジックが変更されないことをテスト
- `other_company_property` 保存時に `handleInlineFieldSave` が `sync=true` で呼ばれることをテスト
- `building_name_price` 保存時に `handleInlineFieldSave` が `sync=true` で呼ばれることをテスト

### Property-Based Tests

- ランダムな買主データ（`property_number` の有無を含む）を生成し、「他社物件情報」セクションの表示条件が正しく動作することを確認
- ランダムなフィールド値を生成し、`other_company_property` / `building_name_price` 以外のフィールドの保存動作が変更されないことを確認
- 多様な買主状態（各フィールドの有無・値の組み合わせ）に対して、他セクションのレンダリングが変更されないことを確認

### Integration Tests

- `property_number` が未設定の買主で「他社物件」フィールドを入力・保存し、スプレッドシートのDJ列に反映されることを確認
- `property_number` が未設定の買主で「建物名/価格」フィールドを入力・保存し、スプレッドシートのH列に反映されることを確認
- 修正後も他フィールドの保存・同期フローが正常に動作することを確認
