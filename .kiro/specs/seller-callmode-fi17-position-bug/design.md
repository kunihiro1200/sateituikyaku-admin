# Seller CallMode FI17 Position Bug - Bugfix Design

## Overview

通話モードページ（CallModePage）の物件位置マップにおいて、FIプレフィックスの売主（福岡支店）の物件ピンが誤った位置に表示されるバグを修正します。

根本原因は `backend/src/services/GeocodingService.ts` の `geocodeAddress()` メソッドにあります。このメソッドは住所に「大分県」が含まれていない場合、無条件に「大分県」を先頭に付加します。FIプレフィックスの売主は福岡支店の売主であり、福岡県内の住所に「大分県」が付加されることで、誤った座標がDBに保存されます。

修正方針は、`geocodeAddress()` メソッドに売主IDプレフィックスを渡せるようにし、AAプレフィックス（大分支店）の場合のみ「大分県」を自動付加する条件分岐を追加することです。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — FIプレフィックスの売主の住所に「大分県」が含まれていない場合に、誤って「大分県」が付加される
- **Property (P)**: 期待される正しい動作 — 売主IDプレフィックスに応じた都道府県自動付加ロジックが適用される
- **Preservation**: 修正によって変更してはならない既存の動作 — AAプレフィックスの売主への「大分県」自動付加、既に都道府県が含まれる住所への重複付加防止
- **geocodeAddress()**: `backend/src/services/GeocodingService.ts` 内のメソッド。住所文字列を受け取り、Google Geocoding APIを呼び出して緯度経度を返す
- **sellerPrefix**: 売主IDの先頭2文字（例: `AA`, `FI`）。支店を識別するために使用される
- **AAプレフィックス**: 大分支店の売主を示すプレフィックス。物件住所は大分県内が多いため「大分県」自動付加が有効
- **FIプレフィックス**: 福岡支店の売主を示すプレフィックス。物件住所は福岡県内のため「大分県」自動付加は不要

## Bug Details

### Bug Condition

バグは、FIプレフィックスの売主（例: FI17）の物件住所が「大分県」を含まない場合に発生します。`geocodeAddress()` メソッドは売主のプレフィックスを考慮せず、住所に「大分県」が含まれていないという条件だけで自動付加を行います。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { address: string, sellerPrefix: string }
  OUTPUT: boolean

  RETURN input.sellerPrefix NOT IN ['AA']
         AND NOT input.address.includes('大分県')
         AND geocodeAddress() ADDS '大分県' to input.address
END FUNCTION
```

### Examples

- **FI17、住所「福岡市中央区天神1-1-1」**: 「大分県」が付加され「大分県福岡市中央区天神1-1-1」としてジオコーディング → 大分県内の誤った座標が保存される（バグ）
- **FI17、住所「福岡県福岡市中央区天神1-1-1」**: 既に「福岡県」が含まれているため付加されない → 正しい座標が保存される（バグなし）
- **AA1234、住所「大分市府内町1-1-1」**: 「大分県」が付加され「大分県大分市府内町1-1-1」としてジオコーディング → 正しい座標が保存される（正常動作）
- **AA1234、住所「大分県大分市府内町1-1-1」**: 既に「大分県」が含まれているため付加されない → 正しい座標が保存される（正常動作）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- AAプレフィックスの売主（大分支店）の住所に「大分県」が含まれていない場合、引き続き「大分県」を自動付加してジオコーディングを実行する
- 住所に既に都道府県名（「大分県」を含む）が含まれている場合、重複付加しない
- AAプレフィックスの売主の通話モードページで、物件位置が正しく表示される

**スコープ:**
FIプレフィックス以外の売主（特にAAプレフィックス）の動作は、この修正によって一切変更されてはなりません。また、既に都道府県名を含む住所の処理も変更されません。

## Hypothesized Root Cause

バグの説明に基づき、最も可能性の高い原因は以下の通りです:

1. **プレフィックス非考慮の都道府県自動付加**: `geocodeAddress()` メソッドが売主IDのプレフィックスを受け取らず、住所に「大分県」が含まれているかどうかだけを判断基準にしている
   - 現在のコード: `if (!address.includes('大分県')) { fullAddress = '大分県' + address; }`
   - FIプレフィックスの売主の住所は福岡県内のため「大分県」を含まない → 誤って付加される

2. **呼び出し元でのプレフィックス情報の未伝達**: `geocodeAddress()` を呼び出す箇所（SellerServiceなど）が売主IDのプレフィックス情報を渡していない

3. **設計上の問題**: 「大分県」自動付加ロジックが特定の支店（大分支店）向けの仕様であるにもかかわらず、全売主に適用される汎用メソッドに組み込まれている

## Correctness Properties

Property 1: Bug Condition - FIプレフィックス売主の住所に「大分県」を付加しない

_For any_ 入力において、FIプレフィックスの売主IDと「大分県」を含まない住所が渡された場合、修正後の `geocodeAddress()` メソッドは「大分県」を付加せず、元の住所のままジオコーディングを実行し、正しい座標を返す。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - AAプレフィックス売主への「大分県」自動付加を維持

_For any_ 入力において、AAプレフィックスの売主IDと「大分県」を含まない住所が渡された場合、修正後の `geocodeAddress()` メソッドは修正前と同じく「大分県」を付加してジオコーディングを実行し、同じ座標を返す。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

ルート原因分析が正しいと仮定した場合:

**File**: `backend/src/services/GeocodingService.ts`

**Function**: `geocodeAddress()`

**Specific Changes**:

1. **メソッドシグネチャの変更**: `geocodeAddress(address: string)` に `sellerPrefix?: string` オプション引数を追加する
   - 後方互換性を維持するためオプション引数とする
   - `geocodeAddress(address: string, sellerPrefix?: string): Promise<Coordinates | null>`

2. **都道府県自動付加ロジックの条件分岐**: 「大分県」を付加する条件を、プレフィックスがAAの場合（または未指定の場合）に限定する
   - 変更前: `if (!address.includes('大分県'))`
   - 変更後: `if (!address.includes('大分県') && (!sellerPrefix || sellerPrefix === 'AA'))`

3. **呼び出し元の修正**: `geocodeAddress()` を呼び出している箇所（SellerServiceなど）で、売主IDからプレフィックスを抽出して渡すように修正する
   - 売主IDの先頭2文字をプレフィックスとして抽出: `sellerId.substring(0, 2).toUpperCase()`

4. **ログの改善**: デバッグ用ログに `sellerPrefix` 情報を追加し、どのロジックが適用されたかを記録する

5. **既存DBデータの修正**: FI17など影響を受けた売主の座標を再ジオコーディングして正しい値に更新する（別途スクリプトで対応）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成されます。まず修正前のコードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを実証するカウンターエグザンプルを確認し、ルート原因分析を検証する。

**Test Plan**: FIプレフィックスの売主IDと福岡県内の住所を使って `geocodeAddress()` を呼び出し、「大分県」が付加されることを確認する。修正前のコードで実行してバグを観察する。

**Test Cases**:
1. **FIプレフィックス・福岡市住所テスト**: `geocodeAddress('福岡市中央区天神1-1-1')` を呼び出し、内部で「大分県福岡市中央区天神1-1-1」としてAPIが呼ばれることを確認（修正前は失敗）
2. **FIプレフィックス・北九州市住所テスト**: `geocodeAddress('北九州市小倉北区魚町1-1-1')` を呼び出し、誤った「大分県」付加を確認（修正前は失敗）
3. **AAプレフィックス・大分市住所テスト**: `geocodeAddress('大分市府内町1-1-1')` を呼び出し、「大分県」が付加されることを確認（修正前後ともに正常）
4. **都道府県含む住所テスト**: `geocodeAddress('福岡県福岡市中央区天神1-1-1')` を呼び出し、「大分県」が付加されないことを確認（修正前後ともに正常）

**Expected Counterexamples**:
- FIプレフィックスの売主の住所に「大分県」が付加され、Google Maps APIに誤った住所が送信される
- 返却される座標が福岡県ではなく大分県内の位置を示す

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := geocodeAddress_fixed(input.address, input.sellerPrefix)
  ASSERT result.coordinates ARE IN fukuoka_prefecture_bounds
  ASSERT '大分県' NOT PREPENDED to input.address
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT geocodeAddress_original(input.address) = geocodeAddress_fixed(input.address, input.sellerPrefix)
END FOR
```

**Testing Approach**: プロパティベーステストが保持チェックに推奨されます。理由:
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストが見逃すエッジケースを検出できる
- 非バグ入力に対して動作が変更されていないことを強く保証できる

**Test Plan**: まず修正前のコードでAAプレフィックスの動作を観察し、修正後も同じ動作が維持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **AAプレフィックス保持テスト**: AAプレフィックスの売主IDと「大分県」を含まない住所で、修正前後の動作が同一であることを確認
2. **都道府県含む住所保持テスト**: 既に都道府県名を含む住所で、修正前後の動作が同一であることを確認
3. **通話モードページ表示保持テスト**: AAプレフィックスの売主の通話モードページで、物件位置ピンが正しく表示されることを確認

### Unit Tests

- FIプレフィックスと「大分県」を含まない住所で「大分県」が付加されないことをテスト
- AAプレフィックスと「大分県」を含まない住所で「大分県」が付加されることをテスト
- 既に都道府県名を含む住所で重複付加されないことをテスト（FI・AA両方）
- `sellerPrefix` 未指定時（後方互換）に「大分県」が付加されることをテスト

### Property-Based Tests

- ランダムなFIプレフィックス売主IDと福岡県内住所を生成し、「大分県」が付加されないことを検証
- ランダムなAAプレフィックス売主IDと大分県内住所を生成し、修正前後の動作が同一であることを検証
- 都道府県名を含む住所を多数生成し、いずれのプレフィックスでも重複付加されないことを検証

### Integration Tests

- FI17の実際の物件住所でジオコーディングを実行し、福岡県内の正しい座標が返ることを確認
- AA売主の実際の物件住所でジオコーディングを実行し、修正前後で同じ座標が返ることを確認
- 通話モードページでFI17の物件位置ピンが正しい場所（福岡県内）に表示されることを確認
