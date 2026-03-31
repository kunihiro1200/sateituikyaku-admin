# 買主リスト表示・バリデーション問題 修正設計

## Overview

買主リストにおける2つの表示・バリデーション問題を修正する：

**問題1: 業者向けアンケート表示問題（買主7260）**
- スプレッドシートからデータベースに正しく同期されているが、ブラウザで表示されない
- 根本原因: フロントエンドとバックエンドでフィールド名が不一致
  - データベース・GAS: `vendor_survey` ✅
  - フロントエンド: `broker_survey` ❌

**問題2: 持家ヒアリング結果の誤必須問題（買主7267）**
- 「問合時持家ヒアリング」が完全に空欄なのに「持家ヒアリング結果」が必須扱いになる
- 根本原因: データベースに見えない空白文字が保存されており、バリデーションロジックが空白文字のみの値を「値あり」と判定している

## Glossary

- **Bug_Condition_1 (C1)**: フロントエンドが `broker_survey` フィールド名を使用している状態
- **Bug_Condition_2 (C2)**: `isHomeHearingResultRequired()` 関数が空白文字のみの値を「値あり」と判定している状態
- **Property_1 (P1)**: フロントエンドが `vendor_survey` フィールド名を使用し、データベースから取得した値を正しく表示する
- **Property_2 (P2)**: `isHomeHearingResultRequired()` 関数が空白文字のみの値を「空欄」として正しく判定する
- **Preservation**: 他のフィールドの表示・編集機能、および正常な条件付き必須動作が変更されないこと
- **vendor_survey**: データベースカラム名（正しいフィールド名）
- **broker_survey**: フロントエンドで誤って使用されているフィールド名
- **owned_home_hearing_inquiry**: 「問合時持家ヒアリング」のデータベースカラム名
- **owned_home_hearing_result**: 「持家ヒアリング結果」のデータベースカラム名
- **BuyerDetailPage**: 買主詳細ページ（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **NewBuyerPage**: 新規買主ページ（`frontend/frontend/src/pages/NewBuyerPage.tsx`）

## Bug Details

### Bug Condition 1: 業者向けアンケートのフィールド名不一致

バグは、フロントエンドが `broker_survey` フィールド名を使用して買主データを参照・更新しようとする際に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition1(code)
  INPUT: code of type TypeScriptCode
  OUTPUT: boolean
  
  RETURN code.contains('broker_survey')
         AND code.fileType IN ['BuyerDetailPage.tsx', 'NewBuyerPage.tsx']
         AND NOT code.contains('vendor_survey')
END FUNCTION
```

### Bug Condition 2: 持家ヒアリング結果の誤必須判定

バグは、`isHomeHearingResultRequired()` 関数が空白文字のみの値を「値あり」と判定する際に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition2(data)
  INPUT: data of type BuyerData
  OUTPUT: boolean
  
  LET value = data.owned_home_hearing_inquiry
  RETURN value IS NOT NULL
         AND value IS NOT UNDEFINED
         AND String(value).trim() === ''
         AND isHomeHearingResultRequired(data) === true
END FUNCTION
```

**現在の実装（問題あり）:**
```typescript
const isHomeHearingResultRequired = (data: any): boolean => {
  return !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
};
```

**問題点**: `data.owned_home_hearing_inquiry` が空白文字のみの場合、`!!` 演算子が trim 前の値（truthy）を評価してしまう

### Examples

**例1: 買主詳細ページでの表示（問題1）**
- **入力**: 買主番号7260の詳細ページを開く
- **期待される動作**: 「業者向けアンケート」フィールドに「確認済み」と表示される
- **実際の動作**: フィールドが非表示になる（`buyer?.broker_survey` が `undefined` のため）
- **原因**: APIレスポンスには `vendor_survey: "確認済み"` が含まれるが、フロントエンドは `broker_survey` を参照している

**例2: 新規買主ページでの保存（問題1）**
- **入力**: 新規買主を作成し、「業者向けアンケート」に「未」を選択して保存
- **期待される動作**: データベースの `vendor_survey` カラムに「未」が保存される
- **実際の動作**: `broker_survey` フィールド名でデータが送信されるため、バックエンドが正しく処理できない可能性がある
- **原因**: フロントエンドが `broker_survey` フィールド名でデータを送信している

**例3: 買主詳細ページでの条件付き表示（問題1）**
- **入力**: 買主番号7260の詳細ページを開く（データベースには `vendor_survey: "確認済み"` が保存されている）
- **期待される動作**: 「業者向けアンケート」フィールドが表示される
- **実際の動作**: `!buyer?.broker_survey` が `true` になるため、フィールドが非表示になる
- **原因**: フロントエンドが `broker_survey` の値をチェックしているが、実際のデータは `vendor_survey` に保存されている

**例4: 持家ヒアリング結果の誤必須判定（問題2）**
- **入力**: 買主番号7267の詳細ページを開く
- **データベースの状態**: `owned_home_hearing_inquiry = '  '`（空白文字のみ）
- **期待される動作**: 「持家ヒアリング結果」は必須扱いにならない
- **実際の動作**: 「持家ヒアリング結果」が赤枠で必須扱いになる
- **原因**: `!!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim())` の評価順序により、trim 前の値（truthy）が評価されている

**例5: 空白文字のパターン（問題2）**
- **入力1**: `owned_home_hearing_inquiry = ' '`（スペース1つ）→ 必須扱いになる（バグ）
- **入力2**: `owned_home_hearing_inquiry = '\n'`（改行）→ 必須扱いになる（バグ）
- **入力3**: `owned_home_hearing_inquiry = '\t'`（タブ）→ 必須扱いになる（バグ）
- **入力4**: `owned_home_hearing_inquiry = null`（null）→ 必須扱いにならない（正常）
- **入力5**: `owned_home_hearing_inquiry = ''`（空文字列）→ 必須扱いにならない（正常）
- **入力6**: `owned_home_hearing_inquiry = 'Y'`（実際の値）→ 必須扱いになる（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のフィールド（問合時ヒアリング、初動担当、Pinrich、3コール確認など）の表示・編集機能は変更されない
- ボタン選択フィールドの動作（クリックで選択・解除、選択時の強調表示）は変更されない
- データベースの `vendor_survey` カラムに保存されているデータは変更されない
- **「問合時持家ヒアリング」に実際に値が入力されている買主では、「持家ヒアリング結果」は引き続き必須扱いになる**（正常な条件付き必須動作）
- 他の条件付き必須フィールド（初動担当、★最新状況など）の動作は変更されない

**Scope:**
「業者向けアンケート」フィールドと「持家ヒアリング結果」の必須判定ロジック以外の全てのフィールドは、この修正の影響を受けません。

## Hypothesized Root Cause

バグ説明に基づくと、最も可能性の高い原因は以下の通りです：

**問題1: 業者向けアンケート表示問題**

1. **フィールド名の不一致**: フロントエンドが `broker_survey` を使用しているが、データベースとバックエンドは `vendor_survey` を使用している
   - BuyerDetailPage.tsx: `buyer?.broker_survey` で参照
   - NewBuyerPage.tsx: `broker_survey` フィールド名でデータを送信
   - データベース: `vendor_survey` カラムにデータが保存されている

2. **型定義の不一致**: フロントエンドの型定義が `broker_survey` を使用している可能性がある

3. **過去の命名変更**: 過去に「業者向けアンケート」フィールドの名前が変更された際、フロントエンドの更新が漏れた可能性がある

**問題2: 持家ヒアリング結果の誤必須問題**

1. **データベースの空白文字**: スプレッドシートから同期された際、空白文字（スペース、タブ、改行など）がデータベースに保存された
   - GASの同期処理で空白文字のクリーンアップが行われていない可能性
   - 手動入力時に誤って空白文字が入力された可能性

2. **バリデーションロジックの評価順序**: `!!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim())` の評価順序により、`!!` 演算子が trim 前の値を評価している
   - `data.owned_home_hearing_inquiry` が `'  '`（空白文字）の場合、truthy と判定される
   - その後 `&&` で `String(...).trim()` が評価されるが、`!!` は既に `true` を返している

3. **正しい評価順序**: trim した結果を評価すべき
   ```typescript
   // ❌ 間違い（現在の実装）
   !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim())
   
   // ✅ 正しい
   !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim().length > 0)
   ```

## Correctness Properties

Property 1: Bug Condition 1 - フィールド名の統一

_For any_ 買主データの表示・編集操作において、フロントエンドは `vendor_survey` フィールド名を使用し、データベースから取得した値を正しく表示・保存する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition 2 - 空白文字のみの値を空欄として判定

_For any_ 買主データにおいて、`owned_home_hearing_inquiry` が空白文字のみ（スペース、タブ、改行など）の場合、`isHomeHearingResultRequired()` 関数は `false` を返し、「持家ヒアリング結果」は必須扱いにならない。

**Validates: Requirements 2.4, 2.5, 2.6**

Property 3: Preservation - 他のフィールドの動作保持

_For any_ 「業者向けアンケート」および「持家ヒアリング結果」の必須判定ロジック以外のフィールドの表示・編集操作において、修正後のコードは修正前と同じ動作を保持し、既存の機能に影響を与えない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定すると、以下の変更が必要です：

**問題1: 業者向けアンケート表示問題の修正**

**File 1**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Specific Changes**:
1. **フィールド定義の修正**: `broker_survey` を `vendor_survey` に変更
   - 行150: `'broker_survey'` → `'vendor_survey'`
   - 行163: `{ key: 'broker_survey', ...}` → `{ key: 'vendor_survey', ...}`

2. **条件付き表示ロジックの修正**: `buyer?.broker_survey` を `buyer?.vendor_survey` に変更
   - 行2011: `if (field.key === 'broker_survey')` → `if (field.key === 'vendor_survey')`
   - 行2013: `if (!buyer?.broker_survey || !String(buyer.broker_survey).trim())` → `if (!buyer?.vendor_survey || !String(buyer.vendor_survey).trim())`
   - 行2018: `const isUmi = buyer?.broker_survey === '未';` → `const isUmi = buyer?.vendor_survey === '未';`

**File 2**: `frontend/frontend/src/pages/NewBuyerPage.tsx`

**Specific Changes**:
1. **フィールド定義の修正**: `broker_survey` を `vendor_survey` に変更
   - 行91: `{ key: 'broker_survey', ...}` → `{ key: 'vendor_survey', ...}`

2. **条件付き表示ロジックの修正**: `broker_survey` を `vendor_survey` に変更
   - 行640: `if (field.key === 'broker_survey' && (!value || value.trim() === ''))` → `if (field.key === 'vendor_survey' && (!value || value.trim() === ''))`

3. **データ送信時のフィールド名修正**: `broker_survey` を `vendor_survey` に変更
   - 行304: `broker_survey: vendorSurvey || null,` → `vendor_survey: vendorSurvey || null,`

**File 3**: `frontend/frontend/src/types/index.ts`（型定義ファイル、存在する場合）

**Specific Changes**:
1. **Buyer型の修正**: `broker_survey` を `vendor_survey` に変更
   ```typescript
   // 修正前
   interface Buyer {
     broker_survey?: string;
   }
   
   // 修正後
   interface Buyer {
     vendor_survey?: string;
   }
   ```

**問題2: 持家ヒアリング結果の誤必須問題の修正**

**File 4**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Specific Changes**:
1. **`isHomeHearingResultRequired()` 関数の修正**:
   ```typescript
   // 修正前（行248-251）
   const isHomeHearingResultRequired = (data: any): boolean => {
     return !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
   };
   
   // 修正後
   const isHomeHearingResultRequired = (data: any): boolean => {
     if (!data.owned_home_hearing_inquiry) return false;
     const trimmed = String(data.owned_home_hearing_inquiry).trim();
     return trimmed.length > 0;
   };
   ```

**File 5**: `backend/src/services/BuyerService.ts`（データクリーンアップ、オプション）

**Specific Changes**:
1. **空白文字のクリーンアップ処理を追加**（買主データ取得時）:
   ```typescript
   // 買主データ取得後、空白文字のみのフィールドをnullに正規化
   if (buyer.owned_home_hearing_inquiry && String(buyer.owned_home_hearing_inquiry).trim() === '') {
     buyer.owned_home_hearing_inquiry = null;
   }
   ```

### 注意事項

- **データベースの変更は不要**: `vendor_survey` カラムは既に存在し、データも正しく保存されている
- **バックエンドの変更は最小限**: BuyerServiceは既に `vendor_survey` フィールドを正しく扱っている
- **GASの変更は不要**: スプレッドシート同期は既に `vendor_survey` を使用している
- **データクリーンアップはオプション**: フロントエンドのバリデーションロジック修正だけでも問題は解決する

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現し、次に修正後のコードで正しく動作することを確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は、再度仮説を立てる必要があります。

**Test Plan**: 買主番号7260の詳細ページを開き、「業者向けアンケート」フィールドが表示されないことを確認する。修正前のコードで実行し、失敗を観察して根本原因を理解する。

**Test Cases**:
1. **買主詳細ページ表示テスト**: 買主番号7260の詳細ページを開く（修正前のコードで失敗する）
2. **新規買主保存テスト**: 新規買主を作成し、「業者向けアンケート」に「未」を選択して保存する（修正前のコードで失敗する可能性がある）
3. **条件付き表示テスト**: データベースに `vendor_survey: "確認済み"` が保存されている買主の詳細ページを開く（修正前のコードで失敗する）
4. **エッジケーステスト**: `vendor_survey` が空文字列の買主の詳細ページを開く（修正前のコードで失敗する可能性がある）

**Expected Counterexamples**:
- 「業者向けアンケート」フィールドが表示されない
- 可能な原因: フィールド名の不一致（`broker_survey` vs `vendor_survey`）、型定義の不一致、APIレスポンスの欠落

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して、期待される動作が実現されることを確認する。

**Pseudocode:**
```
FOR ALL code WHERE isBugCondition(code) DO
  result := fixedCode(code)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Plan**: 修正後のコードで、買主番号7260の詳細ページを開き、「業者向けアンケート」フィールドが正しく表示されることを確認する。

**Test Cases**:
1. **買主詳細ページ表示テスト**: 買主番号7260の詳細ページを開き、「業者向けアンケート」フィールドに「確認済み」と表示されることを確認
2. **新規買主保存テスト**: 新規買主を作成し、「業者向けアンケート」に「未」を選択して保存し、データベースの `vendor_survey` カラムに「未」が保存されることを確認
3. **条件付き表示テスト**: データベースに `vendor_survey: "確認済み"` が保存されている買主の詳細ページを開き、フィールドが表示されることを確認
4. **エッジケーステスト**: `vendor_survey` が空文字列の買主の詳細ページを開き、フィールドが非表示になることを確認

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後のコードが修正前のコードと同じ結果を生成することを確認する。

**Pseudocode:**
```
FOR ALL field WHERE NOT isBugCondition(field) DO
  ASSERT originalCode(field) = fixedCode(field)
END FOR
```

**Testing Approach**: プロパティベーステストは、保存チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動ユニットテストが見逃す可能性のあるエッジケースを捕捉する
- 全ての非バグ入力に対して動作が変更されていないという強力な保証を提供する

**Test Plan**: 修正前のコードで他のフィールド（問合時ヒアリング、初動担当など）の動作を観察し、次に修正後のコードでその動作を捕捉するプロパティベーステストを作成する。

**Test Cases**:
1. **他のフィールド表示保存テスト**: 修正前のコードで「問合時ヒアリング」フィールドが正しく表示されることを観察し、修正後も同じ動作を確認するテストを作成
2. **ボタン選択フィールド保存テスト**: 修正前のコードで「Pinrich」フィールドが正しく動作することを観察し、修正後も同じ動作を確認するテストを作成
3. **データベース読み取り保存テスト**: 修正前のコードで `vendor_survey` カラムからデータを正しく読み取ることを観察し、修正後も同じ動作を確認するテストを作成

### Unit Tests

- 買主詳細ページで「業者向けアンケート」フィールドが正しく表示されることをテスト
- 新規買主ページで「業者向けアンケート」フィールドが正しく保存されることをテスト
- エッジケース（空文字列、null、undefined）をテスト
- 他のフィールドが引き続き正しく動作することをテスト

### Property-Based Tests

- ランダムな買主データを生成し、「業者向けアンケート」フィールドが正しく表示されることを確認
- ランダムなフィールド値を生成し、他のフィールドの動作が保存されることを確認
- 多くのシナリオで全ての非バグ入力が引き続き動作することをテスト

### Integration Tests

- 買主詳細ページの完全なフローをテスト（表示 → 編集 → 保存 → 再表示）
- 新規買主作成の完全なフローをテスト（入力 → 保存 → 詳細ページ表示）
- スプレッドシート同期との統合をテスト（スプレッドシート → データベース → ブラウザ表示）
