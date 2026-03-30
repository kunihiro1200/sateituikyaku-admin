# PropertyListingDetailPage isMobile未定義エラー修正 Design

## Overview

PropertyListingDetailPage.tsxで「isMobile is not defined」エラーが発生しています。このバグは、`isMobile`変数がコンポーネント内で使用されているにもかかわらず、`react-device-detect`ライブラリからインポートされていないことが原因です。修正は単純で、ファイル先頭のインポート文に`import { isMobile } from 'react-device-detect';`を追加するだけです。

## Glossary

- **Bug_Condition (C)**: PropertyListingDetailPage.tsxが読み込まれ、`isMobile`変数が参照される条件
- **Property (P)**: `isMobile`が正しくインポートされ、エラーなくコンポーネントがレンダリングされる
- **Preservation**: 既存のインポート文、`isMobile`の使用箇所、レイアウトロジックが変更されないこと
- **isMobile**: `react-device-detect`ライブラリが提供するboolean値で、モバイルデバイスかどうかを判定する
- **PropertyListingDetailPage.tsx**: 物件リスト詳細画面のコンポーネント（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）

## Bug Details

### Bug Condition

バグは、PropertyListingDetailPage.tsxが読み込まれ、コンポーネント内で`isMobile`変数が参照される際に発生します。`isMobile`は行921, 935, 936, 937, 945, 949などの複数箇所で使用されていますが、ファイル先頭でインポートされていません。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ComponentRenderEvent
  OUTPUT: boolean
  
  RETURN input.component == 'PropertyListingDetailPage'
         AND input.variableUsed == 'isMobile'
         AND NOT isImported('isMobile', 'react-device-detect')
END FUNCTION
```

### Examples

- **例1**: ユーザーが`/property-listings/BB14`にアクセス → 「isMobile is not defined」エラーが発生 → ページが表示されない
- **例2**: コンポーネントが行921で`{isMobile && (`を評価 → `isMobile`が未定義 → ReferenceErrorが発生
- **例3**: コンポーネントが行935で`alignItems: isMobile ? 'flex-start' : 'center'`を評価 → `isMobile`が未定義 → ReferenceErrorが発生
- **エッジケース**: 他のコンポーネントが`isMobile`を正しくインポートしている場合でも、PropertyListingDetailPage.tsxでは独立してインポートが必要

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 既存のインポート文（React, MUI, その他のライブラリ）は変更されない
- `isMobile`の使用箇所（行921, 935, 936, 937, 945, 949など）のロジックは変更されない
- モバイル/デスクトップでのレイアウト切り替えロジックは変更されない

**Scope:**
`isMobile`のインポート追加以外の変更は一切行わない。これには以下が含まれます：
- 他のインポート文の追加・削除・変更
- `isMobile`を使用している条件分岐の変更
- コンポーネントのロジックやスタイルの変更

## Hypothesized Root Cause

バグの根本原因は明確です：

1. **インポート文の欠落**: PropertyListingDetailPage.tsxのファイル先頭に`import { isMobile } from 'react-device-detect';`が存在しない
   - 開発者が`isMobile`を使用する際に、インポート文を追加し忘れた
   - または、リファクタリング時にインポート文が削除された

2. **TypeScriptの型チェック不足**: TypeScriptは`isMobile`が未定義であることを検出できなかった
   - `react-device-detect`の型定義がグローバルに宣言されている可能性
   - または、型チェックが無効化されている

3. **ビルド時のエラー検出不足**: ビルドプロセスが未定義変数を検出しなかった
   - Viteのビルドが警告を出さなかった
   - または、警告が無視された

## Correctness Properties

Property 1: Bug Condition - isMobileインポート追加

_For any_ コンポーネントレンダリングイベントで、PropertyListingDetailPage.tsxが読み込まれ、`isMobile`変数が参照される場合、修正後のコンポーネントは`react-device-detect`から`isMobile`を正しくインポートし、エラーなくレンダリングされる。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存機能の保持

_For any_ `isMobile`のインポート追加以外の変更（他のインポート文、`isMobile`の使用箇所、レイアウトロジック）について、修正後のコードは修正前のコードと完全に同じ動作を保持し、既存の機能を変更しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

修正は非常にシンプルです：

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Function**: なし（ファイルレベルの変更）

**Specific Changes**:
1. **インポート文の追加**: ファイル先頭（行1-50の範囲）に以下のインポート文を追加
   ```typescript
   import { isMobile } from 'react-device-detect';
   ```
   - 既存のインポート文の後に追加（例: 行48の`import { buildUpdatedHistory } from '../utils/priceHistoryUtils';`の後）
   - または、他のライブラリインポートと同じセクションに追加

2. **他の変更は一切不要**: `isMobile`の使用箇所（行921, 935, 936, 937, 945, 949など）は変更しない

## Testing Strategy

### Validation Approach

テスト戦略は2段階です：まず、未修正のコードでエラーが発生することを確認し、次に修正後のコードでエラーが解消され、既存機能が保持されることを確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで「isMobile is not defined」エラーが発生することを確認する。

**Test Plan**: PropertyListingDetailPage.tsxを未修正の状態でブラウザで開き、コンソールにReferenceErrorが表示されることを確認する。

**Test Cases**:
1. **基本エラー確認**: `/property-listings/BB14`にアクセス → 「isMobile is not defined」エラーが発生（未修正コードで失敗）
2. **モバイルレイアウト確認**: モバイルデバイスでアクセス → エラーが発生してページが表示されない（未修正コードで失敗）
3. **デスクトップレイアウト確認**: デスクトップでアクセス → エラーが発生してページが表示されない（未修正コードで失敗）

**Expected Counterexamples**:
- コンソールに「ReferenceError: isMobile is not defined」が表示される
- ページが白紙またはエラー画面になる

### Fix Checking

**Goal**: 修正後のコードで、`isMobile`が正しくインポートされ、エラーなくコンポーネントがレンダリングされることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderPropertyListingDetailPage_fixed(input)
  ASSERT result.error == null
  ASSERT result.isMobileImported == true
  ASSERT result.pageRendered == true
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、`isMobile`のインポート追加以外の動作が変更されていないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderPropertyListingDetailPage_original(input) = renderPropertyListingDetailPage_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは推奨されませんが、手動テストで以下を確認します：
- 既存のインポート文が変更されていないこと
- `isMobile`の使用箇所のロジックが変更されていないこと
- モバイル/デスクトップでのレイアウトが正しく表示されること

**Test Plan**: 修正前のコードの動作を観察し、修正後も同じ動作をすることを確認する。

**Test Cases**:
1. **インポート文の保持**: 修正前の全てのインポート文が修正後も存在することを確認
2. **isMobile使用箇所の保持**: 行921, 935, 936, 937, 945, 949などの`isMobile`使用箇所が変更されていないことを確認
3. **モバイルレイアウトの保持**: モバイルデバイスで修正後のページを開き、戻るボタンが画面上部に表示されることを確認
4. **デスクトップレイアウトの保持**: デスクトップで修正後のページを開き、戻るボタンがヘッダー左側に表示されることを確認

### Unit Tests

- PropertyListingDetailPage.tsxが正しくレンダリングされることを確認
- `isMobile`が`true`の場合、モバイル用レイアウトが表示されることを確認
- `isMobile`が`false`の場合、デスクトップ用レイアウトが表示されることを確認

### Property-Based Tests

- ランダムなデバイスタイプ（モバイル/デスクトップ）で、ページが正しくレンダリングされることを確認
- ランダムな物件番号で、ページが正しくレンダリングされることを確認

### Integration Tests

- `/property-listings/:id`にアクセスして、ページが正しく表示されることを確認
- モバイルデバイスでアクセスして、モバイル用レイアウトが表示されることを確認
- デスクトップでアクセスして、デスクトップ用レイアウトが表示されることを確認
