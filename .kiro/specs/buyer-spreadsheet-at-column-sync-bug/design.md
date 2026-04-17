# 買主スプレッドシートAT列同期バグ Bugfix Design

## Overview

買主リストのAT列（物件番号）に値が入力されているにもかかわらず、AU列（物件所在地）・AY列（住居表示）・BQ列（価格）・BR列（物件担当者）に値が同期されないバグの修正設計。

Git履歴調査により、以下の2つの欠落が根本原因として特定された：

1. **`BuyerService.ts`の`updateWithSync`と`create`**: `property_listings`テーブルから`sales_assignee`（物件担当者）を取得していない
2. **`buyer-column-mapping.json`の`databaseToSpreadsheet`**: `property_assignee`（物件担当者）のマッピングが存在しない

修正方針は最小限の変更で、上記2箇所に`sales_assignee`の取得と`property_assignee`のマッピングを追加する。

## Glossary

- **Bug_Condition (C)**: AT列（`property_number`）に値があるにもかかわらず、AU列・AY列・BQ列・BR列に値が同期されない状態
- **Property (P)**: `property_number`が存在する場合、`property_listings`テーブルから対応する物件情報を取得し、AU列・AY列・BQ列・BR列に書き込む
- **Preservation**: AT列が空の場合・物件番号以外のフィールド更新・物件が存在しない場合の既存動作は変更しない
- **`updateWithSync`**: `backend/src/services/BuyerService.ts`内の買主更新＋スプレッドシート同期関数
- **`create`**: `backend/src/services/BuyerService.ts`内の買主新規登録＋スプレッドシート追記関数
- **`databaseToSpreadsheet`**: `backend/src/config/buyer-column-mapping.json`内のDB→スプレッドシート列名マッピング
- **`sales_assignee`**: `property_listings`テーブルの物件担当者カラム
- **`property_assignee`**: `buyers`テーブルおよびスプレッドシートの物件担当者カラム（BR列）

## Bug Details

### Bug Condition

AT列（`property_number`）に値があるにもかかわらず、AU列（物件所在地）・AY列（住居表示）・BQ列（価格）・BR列（物件担当者）に値が同期されない。

`updateWithSync`と`create`の両関数で`property_listings`から`address, display_address, price`のみを取得しており、`sales_assignee`（物件担当者）を取得していない。さらに`databaseToSpreadsheet`マッピングに`property_assignee`が存在しないため、たとえ値を設定しても書き込まれない。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerUpdateInput または BuyerCreateInput
  OUTPUT: boolean

  RETURN X.property_number が非null かつ 非空文字
    AND property_listings に X.property_number に対応するレコードが存在する
    AND スプレッドシートの BR列（物件担当者）が空白
END FUNCTION
```

### Examples

- **例1（更新時）**: 買主詳細画面で物件番号「AA1234」を入力して保存 → AU列・AY列・BQ列は同期されるが、BR列（物件担当者）は空白のまま
- **例2（新規登録時）**: 買主新規登録時に物件番号「AA5678」を入力 → AU列・AY列・BQ列は同期されるが、BR列は空白のまま
- **例3（他フィールド更新時）**: 物件番号が既にDBに保存済みの状態で内覧日を更新 → `property_number`が`allowedData`に含まれないため、AU列・AY列・BQ列・BR列すべて同期されない
- **エッジケース**: `property_listings`に対応物件が存在しない場合 → エラーなく処理継続（既存動作を維持）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- AT列（物件番号）が空白の場合、AU列・AY列・BQ列・BR列を変更しない
- 物件番号以外のフィールド（内覧日・最新状況など）を更新する場合、対応するスプレッドシート列を正常に同期する
- `property_listings`に対応物件が存在しない場合、エラーを発生させずに処理を継続し、物件番号のみを保存する
- マウスクリックや他のフィールド更新など、物件番号同期以外の処理は完全に影響を受けない

**Scope:**
`property_number`が含まれない更新リクエスト、または`property_number`が空の場合は、この修正の影響を受けない。

## Hypothesized Root Cause

Git履歴調査（コミット`09c44921`、`8906a48a`）により、以下の2つの欠落が確認された：

1. **`sales_assignee`の取得漏れ**: `updateWithSync`（Line 837）と`create`（Line 604）の両方で、`property_listings`から`select('address, display_address, price')`のみを取得しており、`sales_assignee`が含まれていない。コミット`09c44921`と`8906a48a`で物件情報取得処理が追加された際に、`sales_assignee`が漏れた。

2. **`databaseToSpreadsheet`マッピングの欠落**: `buyer-column-mapping.json`の`databaseToSpreadsheet`セクションに`property_assignee`（物件担当者）のエントリが存在しない。`spreadsheetToDatabase`には`"物件担当者": "property_assignee"`が存在するが、逆方向のマッピングが追加されていない。コミット`933f0aa8`で`property_number`が追加された際に、`property_assignee`が漏れた。

3. **既存物件番号での他フィールド更新時の非同期**: `updateWithSync`の物件情報取得ロジックは`allowedData.property_number`が存在する場合のみ実行される。物件番号が既にDBに保存済みで他のフィールドのみ更新する場合、`property_number`が`allowedData`に含まれないため、物件情報の同期が実行されない（これは仕様の可能性もあるが、bugfix.mdの要件3.2に関連）。

## Correctness Properties

Property 1: Bug Condition - 物件番号に紐づく全列の同期

_For any_ 買主更新・新規登録リクエストで`property_number`が非null・非空文字であり、`property_listings`に対応レコードが存在する場合、修正後の`updateWithSync`および`create`関数は SHALL `property_listings`から`address`・`display_address`・`price`・`sales_assignee`を取得し、スプレッドシートのAU列（物件所在地）・AY列（住居表示）・BQ列（価格）・BR列（物件担当者）に値を書き込む。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 物件番号なし・他フィールド更新の動作維持

_For any_ 買主更新・新規登録リクエストで`property_number`が含まれない、または空文字・nullの場合、修正後の関数は SHALL 元の関数と同一の結果を生成し、AU列・AY列・BQ列・BR列を変更しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**修正1: `backend/src/services/BuyerService.ts`**

**Function**: `updateWithSync`（Line 837付近）および `create`（Line 604付近）

**Specific Changes**:
1. **`sales_assignee`の取得追加**: `select('address, display_address, price')` → `select('address, display_address, price, sales_assignee')`
2. **`property_assignee`への代入追加**: `propertyListing.sales_assignee`を`allowedData.property_assignee`に設定

```typescript
// 修正前
.select('address, display_address, price')
// ...
allowedData.property_address = propertyListing.address ?? null;
allowedData.display_address = propertyListing.display_address ?? null;
allowedData.price = propertyListing.price ?? null;

// 修正後
.select('address, display_address, price, sales_assignee')
// ...
allowedData.property_address = propertyListing.address ?? null;
allowedData.display_address = propertyListing.display_address ?? null;
allowedData.price = propertyListing.price ?? null;
allowedData.property_assignee = propertyListing.sales_assignee ?? null;
```

---

**修正2: `backend/src/config/buyer-column-mapping.json`**

**Section**: `databaseToSpreadsheet`

**Specific Changes**:
1. **`property_assignee`マッピングの追加**: `"property_assignee": "物件担当者"` を`databaseToSpreadsheet`セクションに追加

```json
// 修正前（databaseToSpreadsheetセクション末尾付近）
"price": "価格",
"display_address": "住居表示"

// 修正後
"price": "価格",
"display_address": "住居表示",
"property_assignee": "物件担当者"
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ：まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後の正常動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `updateWithSync`を呼び出して`property_number`を含む更新データを渡し、スプレッドシートへの書き込み内容に`property_assignee`が含まれないことを確認する。

**Test Cases**:
1. **更新時BR列欠落テスト**: `property_number`を含む`updateWithSync`呼び出しで、`writeService.updateFields`に渡される`allowedData`に`property_assignee`が含まれないことを確認（未修正コードで失敗）
2. **新規登録時BR列欠落テスト**: `property_number`を含む`create`呼び出しで、`writeService.appendNewBuyer`に渡される`appendData`に`property_assignee`が含まれないことを確認（未修正コードで失敗）
3. **マッピング欠落テスト**: `buyer-column-mapping.json`の`databaseToSpreadsheet`に`property_assignee`が存在しないことを確認（未修正コードで失敗）
4. **AU/AY/BQ列は同期されるテスト**: `property_address`・`display_address`・`price`は正常に同期されることを確認（未修正コードで成功）

**Expected Counterexamples**:
- `allowedData`に`property_assignee`が含まれない
- `databaseToSpreadsheet`に`"property_assignee"`キーが存在しない

### Fix Checking

**Goal**: 修正後、`property_number`が存在する全ケースでBR列（物件担当者）が同期されることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := updateWithSync_fixed(X)
  ASSERT result.allowedData.property_assignee = property_listings[X.property_number].sales_assignee
  ASSERT databaseToSpreadsheet["property_assignee"] = "物件担当者"
  ASSERT スプレッドシートのBR列 = property_listings[X.property_number].sales_assignee
END FOR
```

### Preservation Checking

**Goal**: `property_number`が含まれない更新リクエストで、修正前後の動作が同一であることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT updateWithSync_original(X) = updateWithSync_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由：
- 多様な入力パターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 物件番号なし・空文字・nullなど多様な入力に対して保持を保証できる

**Test Cases**:
1. **物件番号なし更新の保持**: `property_number`を含まない更新で、AU列・AY列・BQ列・BR列が変更されないことを確認
2. **空文字物件番号の保持**: `property_number = ''`の場合、物件情報取得処理がスキップされることを確認
3. **物件不存在時の保持**: `property_listings`に対応物件がない場合、エラーなく処理継続することを確認
4. **他フィールド同期の保持**: 内覧日・最新状況など他フィールドの同期が正常に動作することを確認

### Unit Tests

- `updateWithSync`で`property_number`を含む更新時に`property_assignee`が`allowedData`に追加されることをテスト
- `create`で`property_number`を含む新規登録時に`property_assignee`が`appendData`に追加されることをテスト
- `buyer-column-mapping.json`の`databaseToSpreadsheet`に`property_assignee`が存在することをテスト
- `property_listings`に対応物件がない場合、`property_assignee`が設定されないことをテスト

### Property-Based Tests

- ランダムな`property_number`を持つ買主更新データを生成し、`property_assignee`が常に`allowedData`に含まれることを検証
- `property_number`が空・null・未定義の場合、物件情報取得処理がスキップされることを検証
- 多様な`property_listings`レコードに対して、`sales_assignee`が正しく`property_assignee`にマッピングされることを検証

### Integration Tests

- 買主詳細画面で物件番号を入力して保存し、スプレッドシートのBR列に物件担当者が書き込まれることを確認
- 買主新規登録時に物件番号を入力し、スプレッドシートのAU・AY・BQ・BR列すべてに値が書き込まれることを確認
- 物件番号なしで他フィールドを更新し、BR列が変更されないことを確認
