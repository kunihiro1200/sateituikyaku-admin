# 買主リスト「通知送信者」フィールドDB→スプレッドシート同期バグ修正 Design

## Overview

買主リストの「通知送信者」フィールドをブラウザUIで更新すると、データベースには正しく保存されるが、スプレッドシート（BS列）には反映されない問題を修正する。

根本原因は、`buyer-column-mapping.json`の`databaseToSpreadsheet`セクションに`notification_sender`のマッピングが**既に正しく定義されている**にも関わらず、実際の同期処理が正常に動作していないことである。

調査の結果、以下の3つの可能性が考えられる：

1. **BuyerWriteService.updateFields()が呼び出されていない**
2. **BuyerColumnMapper.mapDatabaseToSpreadsheet()が正しく動作していない**
3. **GoogleSheetsClient.updateRowPartial()が正しく動作していない**

## Glossary

- **Bug_Condition (C)**: ブラウザUIで買主の「通知送信者」フィールドを更新した際に、データベースには保存されるがスプレッドシートに反映されない状態
- **Property (P)**: 「通知送信者」フィールドの更新がデータベースとスプレッドシートの両方に正しく反映される状態
- **Preservation**: 他のフィールド（内覧日、最新状況、次電日等）の同期が正常に動作し続ける状態
- **BuyerWriteService**: バックエンドの即時同期サービス（DB→スプレッドシート）
- **BuyerColumnMapper**: データベースカラム名とスプレッドシートカラム名のマッピングを管理するサービス
- **notification_sender**: データベースの`notification_sender`カラム（スプレッドシートのBS列「通知送信者」に対応）

## Bug Details

### Bug Condition

バグは、ユーザーがブラウザUIで買主の「通知送信者」フィールドを更新した際に発生する。`BuyerWriteService.updateFields()`が呼び出されるが、スプレッドシート（BS列）に反映されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyerNumber: string, fieldName: string, newValue: string }
  OUTPUT: boolean
  
  RETURN input.fieldName === 'notification_sender'
         AND databaseUpdated(input.buyerNumber, input.fieldName, input.newValue)
         AND NOT spreadsheetUpdated(input.buyerNumber, 'BS列', input.newValue)
END FUNCTION
```

### Examples

- **例1**: 買主7282の「通知送信者」を「Y」に更新 → データベースには保存されるが、スプレッドシートBS列には反映されない
- **例2**: 買主5641の「通知送信者」を「I」に更新 → データベースには保存されるが、スプレッドシートBS列には反映されない
- **例3**: 買主7187の「内覧日」を更新 → データベースとスプレッドシートの両方に正しく反映される（他のフィールドは正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 買主の他のフィールド（内覧日、最新状況、次電日等）の同期が正常に動作し続ける
- GASの定期同期（スプレッドシート→データベース）が正常に動作し続ける
- 売主リストの同期が正常に動作し続ける

**Scope:**
「通知送信者」フィールド以外の全てのフィールドは、この修正の影響を受けない。

## Hypothesized Root Cause

調査の結果、以下の3つの可能性が考えられる：

### 1. **BuyerWriteService.updateFields()が呼び出されていない**

**可能性**: バックエンドのルーティングまたはコントローラーで、`BuyerWriteService.updateFields()`が呼び出されていない

**確認方法**:
- Vercelのログで`[BuyerWriteService] updateFields called for buyer`が出力されているか確認
- 出力されていない場合、ルーティングまたはコントローラーの問題

### 2. **BuyerColumnMapper.mapDatabaseToSpreadsheet()が正しく動作していない**

**可能性**: `buyer-column-mapping.json`の`databaseToSpreadsheet`セクションに`notification_sender`のマッピングが定義されているが、`BuyerColumnMapper`が正しく読み込んでいない

**確認方法**:
- Vercelのログで`[BuyerColumnMapper] Mapping notification_sender -> 通知送信者`が出力されているか確認
- 出力されていない場合、`BuyerColumnMapper`の問題

### 3. **GoogleSheetsClient.updateRowPartial()が正しく動作していない**

**可能性**: `GoogleSheetsClient.updateRowPartial()`がBS列を正しく更新していない

**確認方法**:
- Vercelのログで`[BuyerWriteService] Successfully updated row`が出力されているか確認
- 出力されている場合、`GoogleSheetsClient`の問題

## Correctness Properties

Property 1: Bug Condition - 通知送信者フィールドの同期

_For any_ 買主の「通知送信者」フィールドの更新において、`BuyerWriteService.updateFields()`が呼び出された場合、データベースとスプレッドシート（BS列）の両方に正しく反映される SHALL。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他のフィールドの同期

_For any_ 「通知送信者」以外のフィールドの更新において、既存の同期処理が正常に動作し続ける SHALL。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因の調査結果に基づいて、以下の修正を行う：

#### ステップ1: Vercelログの確認

**目的**: どの段階で問題が発生しているか特定する

**確認項目**:
1. `[BuyerWriteService] updateFields called for buyer`が出力されているか？
2. `[BuyerColumnMapper] Mapping notification_sender -> 通知送信者`が出力されているか？
3. `[BuyerWriteService] Successfully updated row`が出力されているか？

**結果に基づく対応**:
- ログ1が出力されていない → ルーティング/コントローラーの修正
- ログ2が出力されていない → `BuyerColumnMapper`の修正
- ログ3が出力されているがスプレッドシートに反映されない → `GoogleSheetsClient`の修正

#### ステップ2: 根本原因に応じた修正

**ケース1: BuyerWriteService.updateFields()が呼び出されていない**

**ファイル**: `backend/src/routes/buyers.ts`（推測）

**修正内容**:
- 買主更新エンドポイントで`BuyerWriteService.updateFields()`を呼び出す
- `notification_sender`フィールドが更新された場合、即座にスプレッドシートに同期する

**ケース2: BuyerColumnMapper.mapDatabaseToSpreadsheet()が正しく動作していない**

**ファイル**: `backend/src/services/BuyerColumnMapper.ts`

**修正内容**:
- `databaseToSpreadsheet`セクションが正しく読み込まれているか確認
- `notification_sender`のマッピングが正しく動作しているか確認
- デバッグログを追加して、マッピング結果を確認

**ケース3: GoogleSheetsClient.updateRowPartial()が正しく動作していない**

**ファイル**: `backend/src/services/GoogleSheetsClient.ts`

**修正内容**:
- `updateRowPartial()`がBS列を正しく更新しているか確認
- 列インデックスの計算が正しいか確認
- デバッグログを追加して、更新内容を確認

#### ステップ3: テスト

**テスト手順**:
1. ローカル環境で買主7282の「通知送信者」を「Y」に更新
2. Vercelのログを確認
3. スプレッドシートBS列を確認
4. データベースを確認

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチを採用する：まず、Vercelログを確認して根本原因を特定し、次に修正を適用してスプレッドシートに正しく反映されることを確認する。

### Exploratory Bug Condition Checking

**Goal**: Vercelログを確認して、どの段階で問題が発生しているか特定する

**Test Plan**: 買主の「通知送信者」フィールドを更新し、Vercelログを確認する

**Test Cases**:
1. **BuyerWriteService呼び出し確認**: `[BuyerWriteService] updateFields called for buyer`が出力されるか確認（出力されない場合、ルーティング/コントローラーの問題）
2. **BuyerColumnMapperマッピング確認**: `[BuyerColumnMapper] Mapping notification_sender -> 通知送信者`が出力されるか確認（出力されない場合、`BuyerColumnMapper`の問題）
3. **GoogleSheetsClient更新確認**: `[BuyerWriteService] Successfully updated row`が出力されるか確認（出力されているがスプレッドシートに反映されない場合、`GoogleSheetsClient`の問題）

**Expected Counterexamples**:
- いずれかのログが出力されない、または出力されているがスプレッドシートに反映されない

### Fix Checking

**Goal**: 修正後、「通知送信者」フィールドがデータベースとスプレッドシートの両方に正しく反映されることを確認する

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := BuyerWriteService.updateFields(input.buyerNumber, { notification_sender: input.newValue })
  ASSERT result.success === true
  ASSERT spreadsheetValue(input.buyerNumber, 'BS列') === input.newValue
END FOR
```

### Preservation Checking

**Goal**: 「通知送信者」以外のフィールドの同期が正常に動作し続けることを確認する

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT existingSyncBehavior(input) === expectedBehavior(input)
END FOR
```

**Testing Approach**: 既存のフィールド（内覧日、最新状況、次電日等）を更新し、スプレッドシートに正しく反映されることを確認する

**Test Cases**:
1. **内覧日の同期**: 買主の内覧日を更新し、スプレッドシートI列に正しく反映されることを確認
2. **最新状況の同期**: 買主の最新状況を更新し、スプレッドシートに正しく反映されることを確認
3. **次電日の同期**: 買主の次電日を更新し、スプレッドシートに正しく反映されることを確認

### Unit Tests

- BuyerWriteService.updateFields()が正しく呼び出されることをテスト
- BuyerColumnMapper.mapDatabaseToSpreadsheet()が`notification_sender`を正しくマッピングすることをテスト
- GoogleSheetsClient.updateRowPartial()がBS列を正しく更新することをテスト

### Property-Based Tests

- ランダムな買主番号と「通知送信者」の値を生成し、同期が正しく動作することを確認
- ランダムな他のフィールドを生成し、既存の同期が正常に動作し続けることを確認

### Integration Tests

- ブラウザUIで買主の「通知送信者」を更新し、データベースとスプレッドシートの両方に正しく反映されることを確認
- 他のフィールドを更新し、既存の同期が正常に動作し続けることを確認
