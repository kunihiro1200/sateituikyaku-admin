# Bugfix Requirements Document

## Introduction

買主リストの希望条件において「★エリア」フィールド（T列）がスプレッドシートからデータベースに同期されていない問題を修正する。

**影響範囲**:
- 買主番号7272など、「★エリア」フィールドに値が入力されている買主のデータがDBに保存されない
- 買主配信サービス（`BuyerDistributionService`、`EnhancedBuyerDistributionService`）がエリアベースマッチングを正しく実行できない
- 買主候補サービス（`BuyerCandidateService`）がエリア条件でフィルタリングできない

**データベースカラム名**: `desired_area`（TEXT型）

**スプレッドシートカラム名**: `★エリア`（T列）

---

## Bug Analysis

### Current Behavior (Defect)

#### 1.1 スプレッドシート → データベース同期時の問題

**WHEN** GASの`syncBuyerList()`関数が10分ごとに実行され、スプレッドシートのT列「★エリア」に値が入力されている買主（例: 買主番号7272）を同期する **THEN** データベースの`buyers.desired_area`カラムに値が保存されない

**根本原因**:
- `gas_buyer_complete_code.js`の`syncUpdatesToSupabase_()`関数が、`desired_area`フィールドを同期対象に含めていない
- 同期対象フィールドは以下の8つのみ：
  1. `latest_status`（★最新状況）
  2. `next_call_date`（★次電日）
  3. `initial_assignee`（初動担当）
  4. `follow_up_assignee`（後続担当）
  5. `inquiry_email_phone`（【問合メール】電話対応）
  6. `three_calls_confirmed`（3回架電確認済み）
  7. `reception_date`（受付日）
  8. `distribution_type`（配信種別）

**証拠**:
```javascript
// gas_buyer_complete_code.js の syncUpdatesToSupabase_() 関数（抜粋）
var sheetStatus = row['★最新状況\n'] ? String(row['★最新状況\n']) : null;
if (sheetStatus !== (dbBuyer.latest_status || null)) { updateData.latest_status = sheetStatus; needsUpdate = true; }

var sheetNextCallDate = formatDateToISO_(row['★次電日']);
var dbNextCallDate = dbBuyer.next_call_date ? String(dbBuyer.next_call_date).substring(0, 10) : null;
if (sheetNextCallDate !== dbNextCallDate) { updateData.next_call_date = sheetNextCallDate; needsUpdate = true; }

// ... 他の6フィールド

// ★エリアフィールドの同期処理が存在しない
```

#### 1.2 バックエンドAPI経由の同期時の問題

**WHEN** バックエンドの`EnhancedAutoSyncService.updateSingleBuyer()`が買主データを更新する **THEN** `desired_area`フィールドは「手動入力優先フィールド」として扱われ、`db_updated_at > last_synced_at`の場合は上書きされない

**根本原因**:
- `EnhancedAutoSyncService.ts`の`updateSingleBuyer()`関数が、`desired_area`を`manualPriorityFields`配列に含めている
- これにより、DBで手動更新された`desired_area`がスプレッドシートの値で上書きされないようになっている
- しかし、GASの`syncUpdatesToSupabase_()`が`desired_area`を同期していないため、スプレッドシートの値がDBに反映されない

**証拠**:
```typescript
// backend/src/services/EnhancedAutoSyncService.ts の updateSingleBuyer() 関数（抜粋）
// 手動入力優先フィールド: DBがスプレッドシートより後に更新されていれば上書きしない
const manualPriorityFields = ['desired_area'];

// DBの現在値を取得して比較
const { data: existingBuyer } = await this.supabase
  .from('buyers')
  .select('db_updated_at, last_synced_at, desired_area')
  .eq('buyer_number', buyerNumber)
  .maybeSingle();
```

---

### Expected Behavior (Correct)

#### 2.1 スプレッドシート → データベース同期の正しい動作

**WHEN** GASの`syncBuyerList()`関数が10分ごとに実行され、スプレッドシートのT列「★エリア」に値が入力されている買主（例: 買主番号7272）を同期する **THEN** データベースの`buyers.desired_area`カラムに正しく値が保存される

**期待される動作**:
1. GASの`syncUpdatesToSupabase_()`関数が、スプレッドシートのT列「★エリア」の値を取得
2. データベースの`buyers.desired_area`カラムと比較
3. 値が異なる場合、`updateData.desired_area`に新しい値を設定
4. Supabase REST APIの`PATCH`リクエストで`buyers`テーブルを更新

**実装例**:
```javascript
// gas_buyer_complete_code.js の syncUpdatesToSupabase_() 関数に追加
var sheetDesiredArea = row['★エリア'] ? String(row['★エリア']) : null;
var dbDesiredArea = dbBuyer.desired_area || null;
if (sheetDesiredArea !== dbDesiredArea) { 
  updateData.desired_area = sheetDesiredArea; 
  needsUpdate = true; 
}
```

#### 2.2 手動入力優先ロジックの維持

**WHEN** バックエンドの`EnhancedAutoSyncService.updateSingleBuyer()`が買主データを更新し、`db_updated_at > last_synced_at`の場合 **THEN** `desired_area`フィールドは上書きされず、DBの値が保持される

**期待される動作**:
- `EnhancedAutoSyncService.ts`の`manualPriorityFields`配列に`desired_area`が含まれている状態を維持
- DBで手動更新された`desired_area`がスプレッドシートの値で上書きされないようにする
- ただし、GASの`syncUpdatesToSupabase_()`が`desired_area`を同期するため、スプレッドシートの値がDBに反映される

---

### Unchanged Behavior (Regression Prevention)

#### 3.1 既存の同期フィールドの動作

**WHEN** GASの`syncBuyerList()`関数が実行される **THEN** 既存の8つの同期フィールド（`latest_status`、`next_call_date`、`initial_assignee`、`follow_up_assignee`、`inquiry_email_phone`、`three_calls_confirmed`、`reception_date`、`distribution_type`）は引き続き正しく同期される

#### 3.2 サイドバーカウント更新の動作

**WHEN** GASの`syncBuyerList()`関数が実行される **THEN** `updateBuyerSidebarCounts_()`関数が正しく実行され、`buyer_sidebar_counts`テーブルが更新される

#### 3.3 追加同期・削除同期の動作

**WHEN** GASの`syncBuyerList()`関数が実行される **THEN** Phase 1（追加同期）とPhase 3（削除同期）が正しく実行される

#### 3.4 バックエンドAPIの手動入力優先ロジック

**WHEN** バックエンドの`EnhancedAutoSyncService.updateSingleBuyer()`が買主データを更新する **THEN** `desired_area`以外の手動入力優先フィールドは引き続き正しく動作する

---

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerSyncInput
  OUTPUT: boolean
  
  // X.spreadsheet_desired_area: スプレッドシートのT列「★エリア」の値
  // X.db_desired_area: データベースの buyers.desired_area カラムの値
  
  RETURN X.spreadsheet_desired_area IS NOT NULL 
    AND X.spreadsheet_desired_area != X.db_desired_area
END FUNCTION
```

**説明**:
- スプレッドシートのT列「★エリア」に値が入力されている
- データベースの`buyers.desired_area`カラムの値と異なる
- この条件を満たす買主が、バグの影響を受ける

**例**:
- 買主番号7272: スプレッドシートのT列「★エリア」= "㊵㊶"、データベースの`desired_area` = NULL → バグ条件を満たす

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - desired_area フィールドの同期
FOR ALL X WHERE isBugCondition(X) DO
  result ← syncBuyerList'(X)
  ASSERT result.db_desired_area = X.spreadsheet_desired_area
END FOR
```

**説明**:
- バグ条件を満たす全ての買主について
- 修正後の`syncBuyerList()`関数を実行
- データベースの`desired_area`カラムがスプレッドシートの値と一致することを確認

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT syncBuyerList(X) = syncBuyerList'(X)
END FOR
```

**説明**:
- バグ条件を満たさない買主（`desired_area`が既に同期されている、または空欄の買主）について
- 修正前と修正後の`syncBuyerList()`関数の動作が同じであることを確認

---

## Counterexample

**買主番号7272**:
- スプレッドシートのT列「★エリア」: "㊵㊶"
- データベースの`buyers.desired_area`: NULL
- 期待される動作: GASの`syncBuyerList()`実行後、`desired_area`が"㊵㊶"になる
- 実際の動作: `desired_area`がNULLのまま（同期されない）

---

## Technical Context

### 関連ファイル

1. **GASファイル**: `gas_buyer_complete_code.js`
   - `syncBuyerList()`: メイン同期関数（10分トリガー）
   - `syncUpdatesToSupabase_()`: Supabase直接更新関数（Phase 2）
   - `fetchAllBuyersFromSupabase_()`: Supabase全買主取得関数

2. **バックエンドサービス**: `backend/src/services/EnhancedAutoSyncService.ts`
   - `updateSingleBuyer()`: 単一買主更新関数
   - `manualPriorityFields`: 手動入力優先フィールド配列

3. **データベーステーブル**: `buyers`
   - `desired_area`: TEXT型カラム（希望エリア）

### 依存関係

- `BuyerDistributionService`: `desired_area`を使用してエリアベースマッチングを実行
- `EnhancedBuyerDistributionService`: `desired_area`を使用してエリアベースマッチングを実行
- `BuyerCandidateService`: `desired_area`を使用してエリア条件でフィルタリング

---

## Acceptance Criteria

### AC1: GASの同期処理に`desired_area`フィールドを追加

**GIVEN** スプレッドシートのT列「★エリア」に値が入力されている買主（例: 買主番号7272）が存在する  
**WHEN** GASの`syncBuyerList()`関数が実行される  
**THEN** データベースの`buyers.desired_area`カラムに正しく値が保存される

### AC2: 既存の同期フィールドの動作を維持

**GIVEN** GASの`syncBuyerList()`関数が実行される  
**WHEN** 既存の8つの同期フィールド（`latest_status`、`next_call_date`など）が更新される  
**THEN** これらのフィールドは引き続き正しく同期される

### AC3: 手動入力優先ロジックの維持

**GIVEN** バックエンドの`EnhancedAutoSyncService.updateSingleBuyer()`が実行される  
**WHEN** `db_updated_at > last_synced_at`の場合  
**THEN** `desired_area`フィールドは上書きされず、DBの値が保持される

### AC4: サイドバーカウント更新の動作を維持

**GIVEN** GASの`syncBuyerList()`関数が実行される  
**WHEN** `updateBuyerSidebarCounts_()`関数が実行される  
**THEN** `buyer_sidebar_counts`テーブルが正しく更新される

---

## Test Cases

### Test Case 1: 新規買主の`desired_area`同期

**前提条件**:
- スプレッドシートのT列「★エリア」に"㊵㊶"が入力されている買主番号7272が存在
- データベースの`buyers.desired_area`がNULL

**実行**:
1. GASの`syncBuyerList()`関数を実行

**期待結果**:
- データベースの`buyers.desired_area`が"㊵㊶"になる

### Test Case 2: 既存買主の`desired_area`更新

**前提条件**:
- スプレッドシートのT列「★エリア」が"㊵㊶"から"㊵"に変更された買主番号7272が存在
- データベースの`buyers.desired_area`が"㊵㊶"

**実行**:
1. GASの`syncBuyerList()`関数を実行

**期待結果**:
- データベースの`buyers.desired_area`が"㊵"になる

### Test Case 3: 既存の同期フィールドの動作確認

**前提条件**:
- スプレッドシートの「★最新状況」が"追客中"から"A"に変更された買主が存在

**実行**:
1. GASの`syncBuyerList()`関数を実行

**期待結果**:
- データベースの`buyers.latest_status`が"A"になる
- `desired_area`フィールドも正しく同期される

### Test Case 4: 手動入力優先ロジックの確認

**前提条件**:
- データベースの`buyers.desired_area`が"㊵"（手動更新）
- `db_updated_at`が`last_synced_at`より新しい
- スプレッドシートのT列「★エリア」が"㊵㊶"

**実行**:
1. バックエンドの`EnhancedAutoSyncService.updateSingleBuyer()`を実行

**期待結果**:
- データベースの`buyers.desired_area`が"㊵"のまま（上書きされない）

---

## Implementation Notes

### 修正箇所

1. **`gas_buyer_complete_code.js`の`syncUpdatesToSupabase_()`関数**:
   - `desired_area`フィールドの同期処理を追加
   - スプレッドシートのT列「★エリア」の値を取得
   - データベースの`buyers.desired_area`カラムと比較
   - 値が異なる場合、`updateData.desired_area`に新しい値を設定

2. **`gas_buyer_complete_code.js`の`fetchAllBuyersFromSupabase_()`関数**:
   - `select`句に`desired_area`フィールドを追加

### 注意事項

- `EnhancedAutoSyncService.ts`の`manualPriorityFields`配列は変更しない（手動入力優先ロジックを維持）
- 既存の同期フィールドの動作を変更しない
- サイドバーカウント更新の動作を変更しない

---

**最終更新日**: 2026年4月2日  
**作成理由**: 買主リストの「★エリア」フィールドがスプレッドシートからデータベースに同期されていない問題を修正するため
