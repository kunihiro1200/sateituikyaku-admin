# 買主詳細画面「他社物件情報」セクション条件表示バグ修正設計

## Overview

買主リスト詳細画面において、他社物件フィールド（`other_company_property`および`building_name_price`）に値がない場合でも「他社物件情報」セクションが表示されている問題を修正します。新規買主登録画面では、入力のために常に表示する必要があります。この修正により、詳細画面での不要なセクション表示を削減し、UIの整理を実現します。

## Glossary

- **Bug_Condition (C)**: 買主詳細画面で他社物件フィールド（`other_company_property`と`building_name_price`）の両方が空（null、undefined、または空文字列）であるにもかかわらず、「他社物件情報」セクションが表示される状態
- **Property (P)**: 買主詳細画面では、他社物件フィールドのいずれかに値がある場合のみ「他社物件情報」セクションを表示し、両方が空の場合は非表示にする
- **Preservation**: 新規買主登録画面では常に「他社物件情報」セクションを表示し、他の全てのセクション（基本情報、問合せ内容など）の表示・保存機能は変更されない
- **BuyerDetailPage**: 買主詳細画面コンポーネント（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **NewBuyerPage**: 新規買主登録画面コンポーネント（`frontend/frontend/src/pages/NewBuyerPage.tsx`）
- **other_company_property**: 他社物件フィールド（データベースカラム名）
- **building_name_price**: 建物名/価格フィールド（データベースカラム名）

## Bug Details

### Bug Condition

バグは、買主詳細画面で他社物件フィールド（`other_company_property`と`building_name_price`）の両方が空の場合に発生します。現在の実装では、いずれかのフィールドに値があれば表示する条件（`||`演算子）を使用していますが、これは正しい動作です。しかし、ユーザーの要件では「値がなければ非表示」とされているため、現在の条件式が要件を満たしているかを確認する必要があります。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { other_company_property: string | null, building_name_price: string | null, page: string }
  OUTPUT: boolean
  
  RETURN input.page === 'BuyerDetailPage'
         AND (input.other_company_property === null OR input.other_company_property === '' OR input.other_company_property === undefined)
         AND (input.building_name_price === null OR input.building_name_price === '' OR input.building_name_price === undefined)
         AND sectionIsDisplayed === true
END FUNCTION
```

### Examples

- **例1**: 買主詳細画面で`other_company_property`が空、`building_name_price`が空 → 「他社物件情報」セクションが表示される（バグ） → 非表示にすべき
- **例2**: 買主詳細画面で`other_company_property`に「〇〇マンション」、`building_name_price`が空 → 「他社物件情報」セクションが表示される（正しい）
- **例3**: 買主詳細画面で`other_company_property`が空、`building_name_price`に「△△ビル/3000万円」 → 「他社物件情報」セクションが表示される（正しい）
- **エッジケース**: 新規買主登録画面では、両フィールドが空でも「他社物件情報」セクションが常に表示される（正しい動作、変更不要）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 新規買主登録画面では、他社物件フィールドの値の有無に関わらず「他社物件情報」セクションを常に表示する
- 買主詳細画面で他社物件フィールドに値を入力・保存する機能は引き続き正常に動作する
- 買主詳細画面の他の全てのセクション（基本情報、問合せ内容、内覧履歴など）の表示は変更されない

**Scope:**
他社物件フィールド以外の全ての操作は、この修正の影響を受けません。これには以下が含まれます：
- 基本情報（氏名、電話番号、メールアドレスなど）の表示・編集
- 問合せ内容の表示・編集
- 内覧履歴の表示
- 新規買主登録画面での全ての入力・保存操作

## Hypothesized Root Cause

バグ説明に基づき、最も可能性の高い原因は以下の通りです：

1. **条件式の論理エラー**: `BuyerDetailPage.tsx`の1722行目の条件式`{(buyer?.other_company_property || buyer?.building_name_price) && (...)}`は、JavaScriptの真偽値評価により、空文字列（`""`）を`false`として扱います。しかし、`null`や`undefined`の場合は正しく動作しますが、空文字列の場合は`false`と評価されるため、両方が空文字列の場合は非表示になるはずです。
   - 可能性: データベースから取得した値が`null`ではなく空文字列（`""`）として保存されている場合、条件式が正しく動作しない

2. **データベースのデフォルト値**: `buyers`テーブルの`other_company_property`および`building_name_price`カラムのデフォルト値が空文字列（`""`）ではなく`null`に設定されている場合、条件式は正しく動作するはずです。
   - 確認が必要: データベースのデフォルト値とバックエンドAPIのレスポンス形式

3. **フロントエンドのデータ変換**: バックエンドAPIから取得したデータをフロントエンドで変換する際に、`null`を空文字列（`""`）に変換している可能性
   - 確認が必要: `BuyerDetailPage.tsx`のデータ取得処理

4. **条件式の意図の不一致**: 現在の条件式は「いずれかのフィールドに値があれば表示」という意図で実装されていますが、ユーザーの要件は「両方が空の場合は非表示」であり、これは同じ意味です。しかし、実際にバグが発生しているということは、条件式が期待通りに動作していない可能性があります。

## Correctness Properties

Property 1: Bug Condition - 他社物件情報セクションの条件付き表示

_For any_ 買主詳細画面において、他社物件フィールド（`other_company_property`と`building_name_price`）の両方が空（null、undefined、または空文字列）の場合、「他社物件情報」セクションは非表示にされるべきです。いずれかのフィールドに値がある場合は、セクションが表示されるべきです。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 新規買主登録画面での常時表示

_For any_ 新規買主登録画面において、他社物件フィールドの値の有無に関わらず、「他社物件情報」セクションは常に表示され、入力可能な状態であるべきです。また、買主詳細画面の他の全てのセクションの表示・保存機能は変更されないべきです。

**Validates: Requirements 2.3, 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Location**: 1722行目の「他社物件情報」セクションの条件式

**Specific Changes**:
1. **条件式の明示的な空チェックを追加**:
   - 現在: `{(buyer?.other_company_property || buyer?.building_name_price) && (...)}`
   - 修正後: `{((buyer?.other_company_property && buyer.other_company_property.trim() !== '') || (buyer?.building_name_price && buyer.building_name_price.trim() !== '')) && (...)}`
   - これにより、空文字列、null、undefinedの全てのケースで正しく非表示になる

2. **代替案: ヘルパー関数を使用**:
   - 条件式が複雑になる場合は、ヘルパー関数を作成して可読性を向上
   ```typescript
   const hasOtherCompanyPropertyData = (buyer: Buyer | null): boolean => {
     if (!buyer) return false;
     const hasOtherProperty = buyer.other_company_property && buyer.other_company_property.trim() !== '';
     const hasBuildingName = buyer.building_name_price && buyer.building_name_price.trim() !== '';
     return hasOtherProperty || hasBuildingName;
   };
   ```
   - 使用: `{hasOtherCompanyPropertyData(buyer) && (...)}`

3. **データベースとバックエンドの確認（オプション）**:
   - `buyers`テーブルの`other_company_property`および`building_name_price`カラムのデフォルト値を確認
   - バックエンドAPIのレスポンスで`null`が空文字列に変換されていないか確認
   - 必要に応じてバックエンドで`null`を返すように修正

4. **NewBuyerPageの確認**:
   - `NewBuyerPage.tsx`の427行目の「他社物件情報」セクションは条件なしで常に表示されているため、変更不要
   - 念のため、修正後も常に表示されることを確認

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する反例を表面化させ、次に修正が正しく機能し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、バグを実証する反例を表面化させます。根本原因分析を確認または反証します。反証された場合は、再仮説が必要です。

**Test Plan**: 買主詳細画面で他社物件フィールドが空の場合に「他社物件情報」セクションが表示されるかを確認するテストを作成します。これらのテストを修正前のコードで実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **両フィールドが空の場合**: `other_company_property`と`building_name_price`が両方とも空（null、undefined、または空文字列） → セクションが表示される（修正前はバグ） → 非表示にすべき
2. **other_company_propertyのみ値がある場合**: `other_company_property`に値、`building_name_price`が空 → セクションが表示される（正しい動作）
3. **building_name_priceのみ値がある場合**: `other_company_property`が空、`building_name_price`に値 → セクションが表示される（正しい動作）
4. **両フィールドに値がある場合**: 両方に値 → セクションが表示される（正しい動作）

**Expected Counterexamples**:
- 両フィールドが空の場合でも「他社物件情報」セクションが表示される
- 可能な原因: 条件式の論理エラー、データベースのデフォルト値、フロントエンドのデータ変換

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderOtherCompanyPropertySection_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderOtherCompanyPropertySection_original(input) = renderOtherCompanyPropertySection_fixed(input)
END FOR
```

**Testing Approach**: 保存チェックにはプロパティベーステストが推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成
- 手動の単体テストでは見逃す可能性のあるエッジケースをキャッチ
- すべての非バグ入力に対して動作が変更されていないという強力な保証を提供

**Test Plan**: まず、修正前のコードで他社物件フィールドに値がある場合の表示動作を観察し、次にその動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **新規買主登録画面での常時表示**: 他社物件フィールドの値の有無に関わらず、セクションが常に表示されることを確認
2. **他社物件フィールドへの入力・保存**: 買主詳細画面で他社物件フィールドに値を入力・保存する機能が正常に動作することを確認
3. **他のセクションの表示**: 基本情報、問合せ内容などの他のセクションが正しく表示され続けることを確認
4. **データの取得と表示**: バックエンドAPIから取得したデータが正しく表示されることを確認

### Unit Tests

- 買主詳細画面で両フィールドが空の場合にセクションが非表示になることをテスト
- 買主詳細画面でいずれかのフィールドに値がある場合にセクションが表示されることをテスト
- 新規買主登録画面でセクションが常に表示されることをテスト
- エッジケース（空文字列、null、undefined、空白文字のみ）をテスト

### Property-Based Tests

- ランダムな買主データを生成し、他社物件フィールドの値に応じてセクションの表示が正しいことを検証
- ランダムな入力値（空文字列、null、undefined、空白文字、有効な値）を生成し、条件式が正しく動作することを検証
- すべての非バグ入力（いずれかのフィールドに値がある、新規登録画面）で動作が保持されることを多くのシナリオでテスト

### Integration Tests

- 買主詳細画面での表示 → 他社物件フィールドへの入力 → 保存 → 再表示を含む完全なフローをテスト
- 新規買主登録画面での入力 → 保存 → 詳細画面での表示を含む完全なフローをテスト
- 複数の買主で他社物件フィールドの有無を切り替え、セクションの表示が常に正しく更新されることをテスト
