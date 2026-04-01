# 土地面積（当社調べ）保存エラー修正 Bugfix Design

## Overview

通話モードページで「土地面積（当社調べ）」フィールドを保存すると、`properties`テーブルの`address`カラムが見つからないというスキーマエラーが発生する問題を修正します。

根本原因は、`PropertyService.ts`の`mapToPropertyInfo()`メソッドが`data.address`を参照しているが、`properties`テーブルには`address`カラムが存在せず、`property_address`カラムのみが存在するためです。また、Geocoding API呼び出し時に誤ったカラム名を参照している可能性があります。

この修正により、ユーザーは通話モードページで土地面積（当社調べ）を正常に保存できるようになります。

## Glossary

- **Bug_Condition (C)**: 土地面積（当社調べ）フィールドに値を入力して保存ボタンをクリックした時
- **Property (P)**: 正しいカラム名（`property_address`）を使用してデータベースに保存され、成功メッセージが表示される
- **Preservation**: 他のフィールド（土地面積、建物面積など）の保存、および`property_address`を正しく使用している既存機能が引き続き正常に動作する
- **PropertyService**: `backend/src/services/PropertyService.ts`の物件情報管理サービス
- **mapToPropertyInfo**: `PropertyService`内のメソッドで、データベースの生データを`PropertyInfo`型にマッピングする
- **properties テーブル**: 物件情報を格納するデータベーステーブル（`property_address`カラムを持つ）

## Bug Details

### Bug Condition

バグは、通話モードページの物件情報セクションで「土地面積（当社調べ）」フィールドに値を入力して保存ボタンをクリックした時に発生します。`PropertyService.ts`の`mapToPropertyInfo()`メソッドが`data.address`を参照しようとしますが、`properties`テーブルには`address`カラムが存在しないため、スキーマエラーが発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, value: number, action: string }
  OUTPUT: boolean
  
  RETURN input.fieldName == 'land_area_verified'
         AND input.value > 0
         AND input.action == 'save'
         AND propertiesTableHasNoAddressColumn()
END FUNCTION
```

### Examples

- **例1**: 通話モードページで「土地面積（当社調べ）」に「100」を入力して保存 → エラー「Could not find the 'address' column of 'properties' in the schema cache」が発生
- **例2**: 通話モードページで「土地面積（当社調べ）」に「200」を入力して保存 → Geocoding APIが「REQUEST DENIED」エラーで失敗
- **例3**: 通話モードページで「土地面積（当社調べ）」に「150」を入力して保存 → サーバーが500エラーを返す
- **エッジケース**: 「土地面積（当社調べ）」に「0」を入力して保存 → 正常に保存される（バグ条件を満たさない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 通話モードページの他のフィールド（土地面積（m²）、建物面積（m²）、建物面積（当社調べ）（m²）など）の保存が引き続き正常に動作する
- 売主詳細ページや他のページで物件情報を編集して保存する機能が引き続き正常に動作する
- `property_address`カラムを正しく使用している既存の機能（物件住所の表示、検索など）が引き続き正常に動作する

**Scope:**
「土地面積（当社調べ）」フィールド以外の物件情報フィールドの保存、および`property_address`を使用している既存機能は、この修正の影響を受けません。

## Hypothesized Root Cause

バグ説明に基づくと、最も可能性の高い原因は以下の通りです：

1. **誤ったカラム名の参照**: `PropertyService.ts`の`mapToPropertyInfo()`メソッドが`data.address`を参照しているが、`properties`テーブルには`address`カラムが存在しない
   - 現在の実装: `address: data.property_address || data.address`
   - 問題: `data.address`は`undefined`になるが、フォールバックとして参照されている

2. **Geocoding API呼び出し時の誤ったカラム参照**: Geocoding APIを呼び出す際に、`address`カラムを参照している可能性がある
   - 可能性のある箇所: `PropertyService.ts`の`updateProperty()`メソッド内

3. **データベーススキーマの不一致**: コードが`address`カラムの存在を前提としているが、実際のスキーマには`property_address`カラムのみが存在する

4. **エラーハンドリングの不足**: スキーマエラーが発生した際に、適切なエラーメッセージがユーザーに表示されていない

## Correctness Properties

Property 1: Bug Condition - 土地面積（当社調べ）保存成功

_For any_ 通話モードページの物件情報セクションで「土地面積（当社調べ）」フィールドに値（例: 100）を入力して保存ボタンをクリックした場合、修正後のシステムは正しいカラム名（`property_address`）を使用してデータベースに保存し、成功メッセージを表示する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他フィールド保存の継続動作

_For any_ 「土地面積（当社調べ）」フィールド以外の物件情報フィールド（土地面積（m²）、建物面積（m²）、建物面積（当社調べ）（m²）など）を編集して保存する場合、修正後のコードは修正前と同じ動作を維持し、正常に保存される。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定すると、以下の変更が必要です：

**File**: `backend/src/services/PropertyService.ts`

**Function**: `mapToPropertyInfo()`

**Specific Changes**:
1. **`data.address`参照の削除**: `mapToPropertyInfo()`メソッドから`data.address`のフォールバック参照を削除
   - 現在: `address: data.property_address || data.address`
   - 修正後: `address: data.property_address`
   - 理由: `properties`テーブルには`address`カラムが存在しないため、フォールバックは不要

2. **Geocoding API呼び出しの修正**: `updateProperty()`メソッド内でGeocoding APIを呼び出す際に、`property_address`カラムを参照するように修正
   - 確認が必要: `updateProperty()`メソッド内でGeocoding APIを呼び出している箇所があるか
   - 修正: `address`カラムを参照している箇所を`property_address`に変更

3. **エラーハンドリングの追加**: スキーマエラーが発生した際に、適切なエラーメッセージをユーザーに表示
   - `try-catch`ブロックを追加
   - エラーメッセージ: 「物件情報の保存に失敗しました。システム管理者に連絡してください。」

4. **データベーススキーマの確認**: `properties`テーブルに`address`カラムが存在しないことを確認
   - マイグレーションファイルを確認
   - 必要に応じて、`address`カラムを削除するマイグレーションを作成

5. **他のサービスの確認**: `PropertyService`以外のサービスで`properties.address`を参照している箇所がないか確認
   - `grepSearch`で`properties.*address`を検索
   - 該当箇所があれば、`property_address`に修正

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する反例を表面化させ、次に修正が正しく動作し、既存の動作を保持していることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、バグを実証する反例を表面化させる。根本原因分析を確認または反証する。反証した場合は、再仮説が必要です。

**Test Plan**: 通話モードページで「土地面積（当社調べ）」フィールドに値を入力して保存するテストを作成します。修正前のコードでこれらのテストを実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **土地面積（当社調べ）保存テスト**: 「土地面積（当社調べ）」に「100」を入力して保存（修正前のコードで失敗）
2. **Geocoding APIエラーテスト**: 「土地面積（当社調べ）」に「200」を入力して保存し、Geocoding APIエラーを確認（修正前のコードで失敗）
3. **500エラーテスト**: 「土地面積（当社調べ）」に「150」を入力して保存し、500エラーを確認（修正前のコードで失敗）
4. **エッジケーステスト**: 「土地面積（当社調べ）」に「0」を入力して保存（修正前のコードで成功する可能性あり）

**Expected Counterexamples**:
- スキーマエラー「Could not find the 'address' column of 'properties' in the schema cache」が発生
- 可能性のある原因: `mapToPropertyInfo()`が`data.address`を参照、Geocoding API呼び出し時の誤ったカラム参照、データベーススキーマの不一致

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := updateProperty_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateProperty_original(input) = updateProperty_fixed(input)
END FOR
```

**Testing Approach**: 保全チェックにはプロパティベーステストが推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成
- 手動ユニットテストでは見逃す可能性のあるエッジケースをキャッチ
- バグのない入力に対して動作が変更されていないことを強力に保証

**Test Plan**: まず、修正前のコードでマウスクリックや他の操作の動作を観察し、次にその動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **他フィールド保存の保全**: 「土地面積（m²）」「建物面積（m²）」「建物面積（当社調べ）（m²）」などの他フィールドを保存し、修正前と同じ動作を確認
2. **物件住所表示の保全**: 物件住所が正しく表示されることを確認（`property_address`を使用）
3. **物件検索の保全**: 物件検索機能が引き続き正常に動作することを確認

### Unit Tests

- 「土地面積（当社調べ）」フィールドの保存テスト（各種値でテスト）
- エッジケース（0、負の値、非常に大きな値）のテスト
- 他のフィールド（土地面積、建物面積など）の保存が引き続き動作することをテスト

### Property-Based Tests

- ランダムな物件データを生成し、「土地面積（当社調べ）」フィールドの保存が正しく動作することを検証
- ランダムな物件構成を生成し、他フィールドの保存動作が保持されることを検証
- 多くのシナリオで、`property_address`を使用する全ての機能が引き続き動作することをテスト

### Integration Tests

- 通話モードページで「土地面積（当社調べ）」フィールドを保存する完全なフローをテスト
- 売主詳細ページや他のページで物件情報を編集して保存する完全なフローをテスト
- 物件住所の表示、検索などの既存機能が引き続き動作することをテスト
