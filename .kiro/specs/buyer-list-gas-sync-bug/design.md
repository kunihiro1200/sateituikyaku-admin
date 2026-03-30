# 買主リストGAS同期バグ修正設計

## Overview

買主リストのスプレッドシートに入力した「業者向けアンケート」フィールドがデータベースに同期されない問題の修正設計。

買主番号7260を含む全買主に影響する可能性がある。GASの買主リスト同期スクリプト（10分トリガー）がスプレッドシートからデータベースへの同期を実行しているが、「業者向けアンケート」フィールドが同期されていない。

**調査結果**:
- ✅ GASの`BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が既に存在
- ✅ バックエンドの`buyer-column-mapping.json`にも定義済み
- ✅ DBの買主番号7260には`vendor_survey: '確認済み'`が既に同期されている

**推測される原因**:
- 今日一度修正した後、GASの10分トリガーで**古いバージョンのコード**が実行された可能性
- GASプロジェクトに最新コードがデプロイされていない可能性

過去に類似の問題（`buyer-vendor-survey-sync-bug`）があり、GASの`BUYER_COLUMN_MAPPING`の更新漏れが原因だった。今回は既にマッピングが存在するため、**GASのデプロイ状態**を確認する必要がある。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — スプレッドシートの買主行に値が入力されているが、GASの`BUYER_COLUMN_MAPPING`に該当カラムのマッピングが存在しない
- **Property (P)**: 期待される正しい動作 — 同期後にDBの該当カラムがスプレッドシートの値と一致すること
- **Preservation**: 修正によって変更してはならない既存の動作 — 他の買主フィールドの同期動作
- **BUYER_COLUMN_MAPPING**: GASスクリプト内の定数。スプレッドシートのヘッダー名からDBカラム名へのマッピングを定義する
- **buyerMapRowToRecord**: GASの関数。`BUYER_COLUMN_MAPPING`を参照してスプレッドシートの1行をDBレコードに変換する
- **buyer-column-mapping.json**: バックエンドの設定ファイル。スプレッドシートとデータベースのカラムマッピングを定義する

## Bug Details

### Bug Condition

スプレッドシートの買主行に特定のフィールドの値が入力されている場合、GASの`buyerMapRowToRecord`関数は`BUYER_COLUMN_MAPPING`を参照してDBレコードを構築するが、このマッピングに該当フィールドのマッピングが存在しないため、当該フィールドがスキップされる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SpreadsheetRow (買主行データ)
  OUTPUT: boolean
  
  RETURN EXISTS field IN input WHERE
         input[field] IS NOT NULL
         AND input[field] != ''
         AND field NOT IN BUYER_COLUMN_MAPPING
END FUNCTION
```

### Examples

**具体例（買主番号7260）**:
- スプレッドシートに買主番号7260のデータが入力されている
- 特定のフィールド（例: 新規追加されたカラム）に値が入力されている
- GASの10分トリガーが実行される
- `BUYER_COLUMN_MAPPING`に該当フィールドのマッピングが存在しない
- `buyerMapRowToRecord`が該当フィールドをスキップする
- DBに該当フィールドの値が反映されない（`NULL`または古い値のまま）

**期待される動作**:
- GASの10分トリガーが実行される
- `BUYER_COLUMN_MAPPING`に該当フィールドのマッピングが存在する
- `buyerMapRowToRecord`が該当フィールドを正しく変換する
- DBに該当フィールドの値が正しく反映される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 既存の買主フィールドの同期動作は変更されない
- `BUYER_COLUMN_MAPPING`に既に定義されているフィールドの同期は従来通り動作する
- 買主番号7260以外の買主のデータ同期は従来通り動作する

**Scope:**
`BUYER_COLUMN_MAPPING`に既に定義されているフィールドの同期動作は完全に保持される。新規追加されたフィールドのみが同期対象に追加される。

## Hypothesized Root Cause

バグの根本原因は以下のいずれかと推測される：

1. **GASプロジェクトに最新コードがデプロイされていない**（最有力）: ローカルの`gas/buyer-sync/BuyerSync.gs`には`'業者向けアンケート': 'vendor_survey'`のマッピングが存在するが、GASプロジェクト（スプレッドシートに紐づいたGASエディタ）には古いバージョンのコードがデプロイされている。10分トリガーは古いコードを実行するため、`BUYER_COLUMN_MAPPING`にマッピングが存在せず、同期がスキップされる。

2. **GASのトリガーが古いバージョンを参照している**: GASエディタで最新コードを保存したが、トリガーが古いバージョンのスクリプトを参照している可能性。GASのバージョン管理で古いバージョンが実行されている。

3. **スプレッドシートのヘッダー名の不一致**: スプレッドシートの実際のヘッダー名と`BUYER_COLUMN_MAPPING`に定義されているキー名が一致していない（例: 改行文字、全角/半角スペース、トリム漏れ等）。ただし、ローカルの`BuyerSync.gs`には正しいマッピングが存在するため、この可能性は低い。

4. **GASの実行ログにエラーが記録されている**: GASの10分トリガーが実行されているが、エラーが発生して同期が失敗している可能性。GASの実行ログを確認する必要がある。

## Correctness Properties

Property 1: Bug Condition - 新規フィールドの同期

_For any_ 買主行データにおいて、スプレッドシートに値が入力されており、かつ`BUYER_COLUMN_MAPPING`に該当フィールドのマッピングが存在する場合、修正後のGASスクリプトはそのフィールドをDBに正しく同期する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存フィールドの同期

_For any_ 買主行データにおいて、`BUYER_COLUMN_MAPPING`に既に定義されているフィールドについては、修正前後で同一の同期結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

修正は以下の手順で実施する：

#### ステップ1: GASプロジェクトのデプロイ状態を確認

**目的**: GASプロジェクトに最新コードがデプロイされているか確認する

**方法**:
1. GASエディタを開く（スプレッドシートの「拡張機能」→「Apps Script」）
2. `BuyerSync.gs`の内容を確認
3. `BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在するか確認
4. 存在しない場合、ローカルの`gas/buyer-sync/BuyerSync.gs`から最新コードをコピー

#### ステップ2: GASの実行ログを確認

**目的**: GASの10分トリガーが正常に実行されているか、エラーが発生していないか確認する

**方法**:
1. GASエディタの「実行数」タブを開く
2. 最近の`syncBuyers`の実行ログを確認
3. エラーが記録されている場合、エラーメッセージを確認
4. 成功している場合、同期されたレコード数を確認

#### ステップ3: 最新コードをGASプロジェクトにデプロイ

**File**: `gas/buyer-sync/BuyerSync.gs`

**対象**: GASプロジェクト全体

**Specific Changes**:
1. ローカルの`gas/buyer-sync/BuyerSync.gs`の内容を全てコピー
2. GASエディタに貼り付けて保存
3. GASエディタで`buyerTestSync()`を手動実行してテスト
4. 次回の10分トリガー実行時に最新コードが反映される

**重要**: GASのバージョン管理で最新バージョンが選択されていることを確認

#### ステップ4: 買主番号7260を手動同期

**方法**:
1. GASエディタで`syncSingleBuyer('7260')`を実行
2. 実行ログを確認して、`vendor_survey`フィールドが同期されたことを確認
3. DBの`buyers`テーブルを確認して、`vendor_survey`カラムが正しく更新されたことを確認

#### ステップ5: 10分トリガーの次回実行を確認

**方法**:
1. GASエディタの「トリガー」タブを開く
2. `syncBuyers`の10分トリガーが存在することを確認
3. 次回実行時刻を確認
4. 次回実行後、GASの実行ログを確認して、エラーがないことを確認

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチを採用する：
1. **探索的バグ条件チェック**: 未修正コードで反例を表面化させ、根本原因を確認または反証する
2. **修正チェック**: 修正後のコードで、バグ条件を満たす全入力に対して期待される動作を検証する
3. **保全チェック**: 修正後のコードで、バグ条件を満たさない全入力に対して従来通りの動作を検証する

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで反例を表面化させ、根本原因を確認または反証する。反証された場合は再仮説を立てる。

**Test Plan**: 
1. 買主番号7260のスプレッドシートデータを取得
2. `buyerMapRowToRecord`関数に渡す
3. 返却されたレコードに該当フィールドが含まれないことを確認（未修正コードで失敗）
4. `BUYER_COLUMN_MAPPING`に該当フィールドのマッピングが存在しないことを確認

**Test Cases**:
1. **買主番号7260の同期テスト**: スプレッドシートの買主番号7260の行を`buyerMapRowToRecord`に渡し、返却レコードに該当フィールドが含まれないことを確認（未修正コードで失敗）
2. **BUYER_COLUMN_MAPPINGの確認**: `BUYER_COLUMN_MAPPING`に該当フィールドのマッピングが存在しないことを確認
3. **buyer-column-mapping.jsonとの比較**: バックエンドの`buyer-column-mapping.json`に該当フィールドのマッピングが存在することを確認

**Expected Counterexamples**:
- `buyerMapRowToRecord`の返却オブジェクトに該当フィールドのキーが存在しない
- 原因: `BUYER_COLUMN_MAPPING`に該当フィールドのマッピングが存在しない

### Fix Checking

**Goal**: バグ条件を満たす全入力に対して、修正後の関数が期待される動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  record := buyerMapRowToRecord_fixed(headers, input)
  ASSERT record[該当DBカラム名] == input[該当スプレッドシートカラム名]
END FOR
```

**Test Plan**: 
1. 該当フィールドに値が入力されている買主行データを用意
2. 修正後の`buyerMapRowToRecord`に渡す
3. 返却レコードに該当フィールドが正しく含まれることを確認

**Test Cases**:
1. **買主番号7260の同期テスト（修正後）**: スプレッドシートの買主番号7260の行を修正後の`buyerMapRowToRecord`に渡し、返却レコードに該当フィールドが正しく含まれることを確認
2. **様々な値でのテスト**: 該当フィールドに様々な値（空文字、長い文字列、特殊文字等）を設定して、正しく処理されることを確認

### Preservation Checking

**Goal**: バグ条件を満たさない全入力に対して、修正後の関数が修正前と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT buyerMapRowToRecord_original(headers, input) = buyerMapRowToRecord_fixed(headers, input)
END FOR
```

**Testing Approach**: Property-based testingを推奨する理由：
- 入力ドメイン全体で多数のテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを捕捉する
- 全ての非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: 
1. 未修正コードで既存フィールドの同期動作を観察する
2. 修正後のコードで同じ入力に対して同一の結果が返ることを確認する

**Test Cases**:
1. **他フィールド保持テスト**: `next_call_date`、`latest_status`、`broker_inquiry`等を含む行を渡し、修正前後で同一の結果が返ることを確認
2. **空欄行テスト**: 該当フィールドが空欄の行で、他フィールドの同期結果が変わらないことを確認
3. **全フィールド網羅テスト**: `BUYER_COLUMN_MAPPING`に定義された全カラムが修正後も正しくマッピングされることを確認

### Unit Tests

- 該当フィールドに値が入力されている買主行の同期テスト
- 該当フィールドが空欄の買主行の同期テスト
- 既存フィールドの同期が変更されていないことを確認するテスト

### Property-Based Tests

- ランダムな買主行データを生成し、`BUYER_COLUMN_MAPPING`に定義された全カラムが正しくマッピングされることを確認
- 該当フィールド以外のフィールドを含む行で、修正前後の結果が一致することを確認
- 様々な値（空文字、長い文字列、特殊文字等）で該当フィールドが正しく処理されることを確認

### Integration Tests

- GASの10分トリガーを手動実行して、買主番号7260のデータが正しく同期されることを確認
- 他の買主のデータ同期が従来通り動作することを確認
- バックエンドAPIで買主番号7260のデータを取得して、該当フィールドが正しく表示されることを確認

## 次のステップ

1. **GASプロジェクトのデプロイ状態を確認**: GASエディタで`BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在するか確認
2. **GASの実行ログを確認**: 最近の`syncBuyers`の実行ログを確認して、エラーがないか確認
3. **最新コードをGASプロジェクトにデプロイ**: ローカルの`gas/buyer-sync/BuyerSync.gs`をGASエディタにコピー
4. **手動同期テスト**: `syncSingleBuyer('7260')`を実行して、正しく同期されることを確認
5. **統合テスト**: 10分トリガーの次回実行時に、全買主の「業者向けアンケート」データが正しく同期されることを確認
