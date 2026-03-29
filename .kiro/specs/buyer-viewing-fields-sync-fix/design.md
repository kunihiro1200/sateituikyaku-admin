# buyer-viewing-fields-sync-fix Bugfix Design

## Overview

買主詳細画面の内覧ページでフィールドを保存しても、約10分後に値が空欄に戻るバグを修正する。
根本原因は2つあり、それぞれ独立した修正が必要：

1. **Fix 1**: `BuyerColumnMapper.formatValueForSpreadsheet` に `time` 型変換が未実装のため、`viewing_time` がDB→スプシ同期で空欄になる。また `date` 型変換が `new Date()` を使用しているためタイムゾーンずれが発生する。
2. **Fix 2**: GASの `syncBuyers()` が `db_updated_at` をupsertペイロードに含めることで、バックエンドの `db_updated_at > last_synced_at` 保護ロジックが機能しなくなる。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `viewing_time` または `latest_viewing_date` がDBに保存されており、DB→スプシ同期またはGAS定期同期が実行される状況
- **Property (P)**: 期待される正しい動作 — 内覧フィールドの値がスプシに正しく書き込まれ、GASの定期同期で上書きされない
- **Preservation**: 修正によって変更してはいけない既存の動作 — 内覧ページ以外のフィールドの同期、date型フィールドの変換、text型フィールドの変換
- **formatValueForSpreadsheet**: `backend/src/services/BuyerColumnMapper.ts` 内のメソッド。DBの値をスプレッドシート出力用にフォーマットする
- **typeConversions**: `buyer-column-mapping.json` で定義された型変換ルール。`viewing_time` は `"time"` 型、`latest_viewing_date` は `"date"` 型
- **db_updated_at**: DBで手動更新された日時。GASの `last_synced_at` より新しい場合、バックエンドの保護ロジックが内覧フィールドの上書きをスキップする
- **last_synced_at**: GASが最後に同期した日時。GASのupsertペイロードに含まれる

## Bug Details

### Bug Condition

バグは以下の2つの条件のいずれかで発生する：

**条件A（型変換不備）**: `viewing_time` または `latest_viewing_date` がDBに保存されており、DB→スプシ同期が実行される。

**条件B（GAS上書き）**: DBの内覧フィールドに値が保存されており、GASの10分定期同期が実行される。GASが `db_updated_at` をupsertペイロードに含めることで、バックエンドの保護ロジックが機能しなくなる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { field: string, value: any, syncType: 'db_to_sheet' | 'gas_sync' }
  OUTPUT: boolean

  IF input.syncType = 'db_to_sheet' THEN
    RETURN (input.field = 'viewing_time' AND typeConversions[input.field] = 'time')
           OR (input.field = 'latest_viewing_date' AND typeConversions[input.field] = 'date'
               AND input.value MATCHES /^\d{4}-\d{2}-\d{2}$/)
  END IF

  IF input.syncType = 'gas_sync' THEN
    RETURN input.field IN VIEWING_FIELDS
           AND db_updated_at > last_synced_at
           AND db_updated_at IS INCLUDED IN upsert_payload
  END IF

  RETURN false
END FUNCTION

VIEWING_FIELDS = [
  'latest_viewing_date', 'viewing_time', 'follow_up_assignee',
  'inquiry_hearing', 'viewing_result_follow_up', 'pre_viewing_notes',
  'viewing_notes', 'pre_viewing_hearing', 'seller_viewing_contact',
  'buyer_viewing_contact', 'notification_sender'
]
```

### Examples

- `formatValueForSpreadsheet('viewing_time', '10:00')` → 現在: `'10:00'`（type未定義のためそのまま返る）、期待: `'10:00'`（time型として処理）
- `formatValueForSpreadsheet('viewing_time', '14:30')` → 現在: `'14:30'`（偶然正しいが型処理なし）、期待: `'14:30'`
- `formatValueForSpreadsheet('latest_viewing_date', '2026-03-29')` → 現在: `'2026/03/28'`（UTC解釈でJST変換により1日ずれ）、期待: `'2026/03/29'`
- `formatValueForSpreadsheet('viewing_time', null)` → 現在: `''`、期待: `''`（変更なし）
- GASが `db_updated_at: '2026-03-29T10:00:00Z'` を含むupsertを実行 → 現在: バックエンドの保護ロジックが機能しない、期待: `db_updated_at` を除外してupsertし保護ロジックが機能する

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 内覧ページ以外のフィールド（`name`、`phone_number`、`inquiry_confidence` 等）はGASの定期同期でスプシの値をDBに反映し続ける
- `latest_viewing_date` や `viewing_time` がスプシで直接編集され、`db_updated_at <= last_synced_at` の場合はスプシの値をDBに同期し続ける
- `date` 型フィールド（`reception_date`、`next_call_date`、`campaign_date`）のDB→スプシ同期が引き続き正しい日付形式で書き込まれる
- `text` 型の内覧フィールド（`follow_up_assignee`、`pre_viewing_notes` 等）がそのままスプシに書き込まれる
- GASが新規買主レコードを処理する際に全フィールドをDBにupsertし続ける

**スコープ:**
内覧フィールドの型変換（`time`、`date`）と、GASのupsertペイロードから `db_updated_at` を除外する変更のみ。他の全フィールドの動作は変更しない。

## Hypothesized Root Cause

根本原因の分析：

1. **time型変換の未実装**: `formatValueForSpreadsheet` メソッドに `time` 型の処理が存在しない。`typeConversions` には `viewing_time: "time"` が定義されているが、`formatValueForSpreadsheet` は `date` と HTML フィールドの処理しか持たない。`viewing_time` は型チェックをスキップして `return value` に到達するため、DBの値（`"10:00"` 等）がそのまま返る。これは偶然正しい動作に見えるが、型変換として明示的に処理されていない。

2. **date型のUTC解釈問題**: `new Date("2026-03-29")` はISO 8601の日付のみ形式として UTC 00:00:00 と解釈される。JST（UTC+9）環境では `date.getFullYear()` 等のローカル時刻メソッドが UTC 00:00 → JST 09:00 に変換するため問題ないが、UTC-X環境（Vercelのサーバーレス環境等）では前日の日付になる可能性がある。文字列パースで直接処理することで環境依存を排除できる。

3. **GASのdb_updated_at上書き**: GASの `buyerMapRowToRecord` が生成するレコードには `db_updated_at` が含まれない（スプシにそのカラムがないため）。しかし `last_synced_at` を設定してupsertする際、Supabaseの `merge-duplicates` 動作により `db_updated_at` が `null` で上書きされる可能性がある。これによりバックエンドの `db_updated_at > last_synced_at` 保護ロジックが次回以降機能しなくなる。

4. **保護ロジックの依存関係**: バックエンドの `EnhancedAutoSyncService.updateSingleBuyer` には既に `db_updated_at > last_synced_at` の保護ロジックが実装されている。GASのupsertが `db_updated_at` を上書きしないことで、この保護ロジックが正しく機能するようになる。

## Correctness Properties

Property 1: Bug Condition - time型フィールドの正しい変換

_For any_ `viewing_time` フィールドの値（`"HH:mm"` 形式の文字列）において、修正後の `formatValueForSpreadsheet` 関数は `time` 型として認識し、その文字列値をそのままスプレッドシート形式で返す SHALL。null/undefined の場合は `''` を返す。

**Validates: Requirements 2.1**

Property 2: Bug Condition - date型フィールドのタイムゾーンずれなし変換

_For any_ `latest_viewing_date` フィールドの値（`"YYYY-MM-DD"` 形式の文字列）において、修正後の `formatValueForSpreadsheet` 関数はタイムゾーンに依存せず文字列パースで `"YYYY/MM/DD"` 形式に変換する SHALL。`new Date()` のUTC解釈による日付ずれが発生しない。

**Validates: Requirements 2.2**

Property 3: Preservation - 非time/date型フィールドの変換継続

_For any_ `viewing_time` でも `latest_viewing_date` でもないフィールドにおいて、修正後の `formatValueForSpreadsheet` 関数は修正前と同じ結果を返す SHALL。HTMLフィールドのストリップ処理、その他フィールドのパススルーが変わらない。

**Validates: Requirements 3.3, 3.4**

Property 4: Preservation - 既存date型フィールドの変換継続

_For any_ `reception_date`、`next_call_date`、`campaign_date` フィールドの値において、修正後の `formatValueForSpreadsheet` 関数は修正前と同じ `"YYYY/MM/DD"` 形式を返す SHALL。

**Validates: Requirements 3.3**

## Fix Implementation

### Changes Required

**Fix 1: BuyerColumnMapper.formatValueForSpreadsheet**

**File**: `backend/src/services/BuyerColumnMapper.ts`

**Function**: `formatValueForSpreadsheet`

**Specific Changes**:
1. **time型変換の追加**: `type === 'time'` の場合、`String(value)` をそのまま返す処理を追加
2. **date型変換のタイムゾーン修正**: `new Date(value)` の代わりに正規表現で `YYYY-MM-DD` 文字列を直接パースし、`YYYY/MM/DD` 形式に変換する。`new Date()` はフォールバックとして残す

```typescript
private formatValueForSpreadsheet(column: string, value: any): any {
  if (value === null || value === undefined) {
    return '';
  }

  const type = this.typeConversions[column];

  // date型: タイムゾーンずれを防ぐため文字列パースで処理
  if (type === 'date' && value) {
    const str = String(value);
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]}`;
    }
    // フォールバック: Dateオブジェクトで処理
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    }
  }

  // time型: "HH:mm"形式をそのまま返す
  if (type === 'time' && value) {
    return String(value);
  }

  // HTMLを含む可能性があるフィールドはプレーンテキストに変換
  const htmlFields = ['inquiry_hearing', 'viewing_result_follow_up', 'message_to_assignee'];
  if (htmlFields.includes(column) && typeof value === 'string' && value.includes('<')) {
    return this.stripHtml(value);
  }

  return value;
}
```

---

**Fix 2: GASのdb_updated_at除外**

**File**: `gas/buyer-sync/BuyerSync.gs`

**Function**: `buyerMapRowToRecord`（または `syncBuyers` 内のupsertペイロード生成部分）

**Specific Changes**:
1. **db_updated_atをupsertペイロードから除外**: `buyerMapRowToRecord` で生成したレコードから `db_updated_at` を明示的に除外する（スプシにそのカラムがないため通常は含まれないが、念のため削除処理を追加）
2. **last_synced_atは引き続き設定**: `record.last_synced_at = new Date().toISOString()` は維持する

```javascript
// syncBuyers() 内のレコード生成部分
var record = buyerMapRowToRecord(headers, rawValues[i]);
if (!record.buyer_number) {
  skippedCount++;
  continue;
}
record.last_synced_at = new Date().toISOString();
// db_updated_atを除外（バックエンドの保護ロジックを機能させるため）
delete record.db_updated_at;
records.push(record);
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `BuyerColumnMapper.formatValueForSpreadsheet` に対して、`viewing_time` と `latest_viewing_date` の変換をテストする。未修正コードで実行して失敗を確認する。

**Test Cases**:
1. **time型変換テスト**: `formatValueForSpreadsheet('viewing_time', '10:00')` が `'10:00'` を返すことを確認（未修正コードでは型処理なしでパスするが、明示的なtime型処理がないことを確認）
2. **date型タイムゾーンテスト**: `formatValueForSpreadsheet('latest_viewing_date', '2026-03-29')` が `'2026/03/29'` を返すことを確認（UTC環境では `'2026/03/28'` になる可能性）
3. **null値テスト**: `formatValueForSpreadsheet('viewing_time', null)` が `''` を返すことを確認

**Expected Counterexamples**:
- UTC環境で `new Date("2026-03-29").getDate()` が `28` を返す
- `typeConversions['viewing_time']` が `'time'` であるにもかかわらず、`formatValueForSpreadsheet` に `time` 型の処理がない

### Fix Checking

**Goal**: 修正後のコードで全てのバグ条件が解消されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := formatValueForSpreadsheet_fixed(input.field, input.value)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: 修正によって既存の動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT formatValueForSpreadsheet_original(input.field, input.value)
       = formatValueForSpreadsheet_fixed(input.field, input.value)
END FOR
```

**Testing Approach**: プロパティベーステストで多数の入力を自動生成し、修正前後の動作が一致することを検証する。

**Test Cases**:
1. **HTMLフィールド保持**: `inquiry_hearing`、`viewing_result_follow_up`、`message_to_assignee` のHTML変換が変わらない
2. **その他date型フィールド保持**: `reception_date`、`next_call_date`、`campaign_date` の変換が変わらない
3. **text型フィールド保持**: `follow_up_assignee`、`pre_viewing_notes` 等がそのまま返る

### Unit Tests

- `formatValueForSpreadsheet('viewing_time', '10:00')` → `'10:00'`
- `formatValueForSpreadsheet('viewing_time', '14:30')` → `'14:30'`
- `formatValueForSpreadsheet('viewing_time', null)` → `''`
- `formatValueForSpreadsheet('latest_viewing_date', '2026-03-29')` → `'2026/03/29'`（タイムゾーンずれなし）
- `formatValueForSpreadsheet('latest_viewing_date', null)` → `''`
- `formatValueForSpreadsheet('reception_date', '2026-01-15')` → `'2026/01/15'`（既存動作の保持）
- `formatValueForSpreadsheet('inquiry_hearing', '<p>テスト</p>')` → `'テスト'`（HTML変換の保持）

### Property-Based Tests

- 任意の `"HH:mm"` 形式の文字列を `viewing_time` に入力すると、同じ文字列が返る
- 任意の `"YYYY-MM-DD"` 形式の文字列を `latest_viewing_date` に入力すると、`"YYYY/MM/DD"` 形式で返り、日付がずれない
- `viewing_time` でも `latest_viewing_date` でもないフィールドに対して、修正前後で同じ結果が返る（保持プロパティ）
- 任意の `"YYYY-MM-DD"` 形式の文字列を `reception_date`、`next_call_date`、`campaign_date` に入力すると、修正前後で同じ `"YYYY/MM/DD"` 形式が返る

### Integration Tests

- DB→スプシ同期フローで `viewing_time` が正しくスプシに書き込まれる
- DB→スプシ同期フローで `latest_viewing_date` がタイムゾーンずれなくスプシに書き込まれる
- GASのupsertペイロードに `db_updated_at` が含まれないことを確認
- バックエンドの `db_updated_at > last_synced_at` 保護ロジックが正しく機能することを確認
