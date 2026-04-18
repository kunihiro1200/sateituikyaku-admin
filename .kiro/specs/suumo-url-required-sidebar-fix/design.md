# SUUMO URL 要登録サイドバー表示バグ デザインドキュメント

## Overview

物件リストのサイドバーカテゴリーに「SUUMO URL 要登録」（一般・公開中）および「レインズ登録＋SUUMO URL 要登録」（専任・公開中）が表示されないバグ。

対象物件番号 AA3959 で確認されており、4条件をすべて満たすにもかかわらずサイドバーに表示されない。

**修正方針**: `calculateSidebarStatus()` が返すラベル文字列と、フロントエンドのカテゴリー定義・フィルタリングロジックの不一致を修正する。修正は最小限にとどめ、既存の動作を保持する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 4条件をすべて満たす物件がサイドバーに表示されない
- **Property (P)**: 期待される動作 — 4条件を満たす物件が正しいカテゴリーラベルでサイドバーに表示される
- **Preservation**: 修正によって変えてはいけない既存の動作
- **calculateSidebarStatus()**: `backend/src/services/PropertyListingSyncService.ts` 内のメソッド。物件行データと業務依頼データからサイドバーステータス文字列を計算する
- **PROPERTY_STATUS_DEFINITIONS**: `frontend/frontend/src/utils/propertyListingStatusUtils.ts` 内の配列。フロントエンドのサイドバーカテゴリー表示ラベルを定義する
- **gyomuListData**: `work_tasks` テーブルから取得した公開予定日データ。`calculateSidebarStatus()` の条件⑥で参照される
- **atbb_status**: 物件の公開ステータス（「一般・公開中」「専任・公開中」など）

## Bug Details

### Bug Condition

4条件をすべて満たす物件が、サイドバーの「SUUMO URL 要登録」または「レインズ登録＋SUUMO URL 要登録」カテゴリーに表示されない。

根本原因の仮説：`calculateSidebarStatus()` が返すラベル文字列（`'レインズ登録＋SUUMO登録'`）と、フロントエンドのカテゴリー定義ラベル（`'レインズ登録＋SUUMO登録'`）は一致しているが、要件で定義された正しいラベル（`'レインズ登録＋SUUMO URL 要登録'`）と不一致である。

**Formal Specification:**
```
FUNCTION isBugCondition(property)
  INPUT: property — property_listings テーブルの1レコード
  OUTPUT: boolean

  atbbStatus    := property.atbb_status
  suumoUrl      := property.suumo_url
  suumoReg      := property.suumo_registered
  publishDate   := work_tasks.publish_scheduled_date WHERE property_number = property.property_number

  isPublicStatus := atbbStatus IN ['一般・公開中', '専任・公開中']
  hasOldDate     := publishDate IS NOT NULL AND publishDate <= TODAY() - 1
  isSuumoEmpty   := suumoUrl IS NULL OR TRIM(suumoUrl) = ''
  isNotExempt    := suumoReg != 'S不要'

  RETURN isPublicStatus
         AND hasOldDate
         AND isSuumoEmpty
         AND isNotExempt
         AND property.sidebar_status NOT IN ['SUUMO URL　要登録', 'レインズ登録＋SUUMO URL 要登録']
END FUNCTION
```

### Examples

- **AA3959（一般・公開中、suumo_url空、S不要でない、公開予定日が昨日以前）**
  - 期待: サイドバーに「SUUMO URL 要登録」として表示される
  - 実際: サイドバーに表示されない（sidebar_status が正しく設定されていない）

- **専任・公開中、suumo_url空、S不要でない、公開予定日が昨日以前**
  - 期待: サイドバーに「レインズ登録＋SUUMO URL 要登録」として表示される
  - 実際: サイドバーに表示されない

- **一般・公開中、suumo_url入力済み**
  - 期待: 「SUUMO URL 要登録」カテゴリーに表示されない（変わらない動作）
  - 実際: 正しく表示されない（変わらない）

- **Suumo登録 = 'S不要'**
  - 期待: どちらのカテゴリーにも表示されない（変わらない動作）
  - 実際: 正しく表示されない（変わらない）

## Expected Behavior

### Preservation Requirements

**変わらない動作:**
- Suumo URL が入力済みの物件は「SUUMO URL 要登録」カテゴリーに含まれない
- Suumo登録 が「S不要」の物件はどちらのカテゴリーにも含まれない
- atbb_status が「一般・公開中」でも「専任・公開中」でもない物件はどちらのカテゴリーにも含まれない
- 業務依頼テーブルに公開予定日が TODAY()-1 以前のレコードが存在しない物件はどちらのカテゴリーにも含まれない
- 他のサイドバーカテゴリー（「未報告」「本日公開予定」「買付申込み（内覧なし）２」など）の表示は変わらない
- `calculateSidebarStatus()` の優先度順（①未報告 → ②未完了 → ... → ⑥SUUMO/レインズ）は変わらない

**スコープ:**
バグ条件に該当しない全ての入力（Suumo URL 入力済み、S不要、公開中以外のステータス、公開予定日が未来など）は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

コードベースの調査結果に基づく根本原因の仮説：

1. **ラベル文字列の不一致（最有力）**: `calculateSidebarStatus()` の条件⑥で専任・公開中の場合に返すラベルが `'レインズ登録＋SUUMO登録'` であるが、要件で定義された正しいラベルは `'レインズ登録＋SUUMO URL 要登録'` である。
   - `backend/src/services/PropertyListingSyncService.ts` 行1323: `'レインズ登録＋SUUMO登録'` を返している
   - フロントエンドの `PROPERTY_STATUS_DEFINITIONS` も `'レインズ登録＋SUUMO登録'` で定義されている
   - 要件の正しいラベルは `'レインズ登録＋SUUMO URL 要登録'`

2. **フロントエンドのカテゴリーフィルタリング不一致**: フロントエンドのサイドバーフィルタリングが `sidebar_status` の文字列でマッチングしている場合、バックエンドが返すラベルとフロントエンドの定義ラベルが一致していても、要件のラベルと異なれば表示されない。

3. **PropertyListingService.update での再計算漏れ**: `suumo_url` が空になった場合（空文字列で更新）、`sidebar_status` の再計算が行われない可能性がある。現在のコードは `suumo_url` が**空でない**場合のみ再計算している（行264: `if ('suumo_url' in updates && updates.suumo_url && ...)`）。

4. **DB上の sidebar_status が古い値のまま**: 過去に正しくないラベルで保存された `sidebar_status` が、スプレッドシート同期や手動更新のタイミングで再計算されず古い値のままになっている可能性がある。

## Correctness Properties

Property 1: Bug Condition - SUUMO URL 要登録カテゴリーへの正しい表示

_For any_ 物件において、バグ条件が成立する（isBugCondition が true を返す）場合、修正後の `calculateSidebarStatus()` は以下を返さなければならない：
- atbb_status が「一般・公開中」の場合: `'SUUMO URL　要登録'`
- atbb_status が「専任・公開中」の場合: `'レインズ登録＋SUUMO URL 要登録'`

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - バグ条件に該当しない物件の動作保持

_For any_ 物件において、バグ条件が成立しない（isBugCondition が false を返す）場合、修正後の `calculateSidebarStatus()` は修正前と同じ結果を返さなければならない。具体的には：
- Suumo URL が入力済みの場合は「SUUMO URL 要登録」系カテゴリーに含まれない
- Suumo登録 が「S不要」の場合はどちらのカテゴリーにも含まれない
- 他のカテゴリー（未報告、未完了、本日公開予定など）の計算結果は変わらない

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因の仮説が正しい場合、以下の変更が必要：

**File 1**: `backend/src/services/PropertyListingSyncService.ts`

**Function**: `calculateSidebarStatus()`

**Specific Changes**:
1. **ラベル文字列の修正**: 条件⑥の専任・公開中の場合に返すラベルを `'レインズ登録＋SUUMO登録'` から `'レインズ登録＋SUUMO URL 要登録'` に変更する
   ```typescript
   // 修正前
   return atbbStatus === '一般・公開中'
     ? 'SUUMO URL　要登録'
     : 'レインズ登録＋SUUMO登録';
   
   // 修正後
   return atbbStatus === '一般・公開中'
     ? 'SUUMO URL　要登録'
     : 'レインズ登録＋SUUMO URL 要登録';
   ```

---

**File 2**: `frontend/frontend/src/utils/propertyListingStatusUtils.ts`

**Object**: `PROPERTY_STATUS_DEFINITIONS`

**Specific Changes**:
2. **フロントエンドのカテゴリーラベル修正**: `reins_suumo_required` のラベルを `'レインズ登録＋SUUMO登録'` から `'レインズ登録＋SUUMO URL 要登録'` に変更する
   ```typescript
   // 修正前
   { key: 'reins_suumo_required', label: 'レインズ登録＋SUUMO登録', color: '#3f51b5' },
   
   // 修正後
   { key: 'reins_suumo_required', label: 'レインズ登録＋SUUMO URL 要登録', color: '#3f51b5' },
   ```

---

**File 3**: `backend/src/services/PropertyListingService.ts`

**Function**: `update()`

**Specific Changes**:
3. **suumo_url が空になった場合の再計算追加**: `suumo_url` が空文字列で更新された場合も `sidebar_status` を再計算するよう条件を修正する
   ```typescript
   // 修正前
   if ('suumo_url' in updates && updates.suumo_url && String(updates.suumo_url).trim() !== '') {
   
   // 修正後
   if ('suumo_url' in updates) {
   ```

4. **既存DBデータの一括修正**: バグ条件を満たす物件の `sidebar_status` を正しいラベルに一括更新するマイグレーションスクリプトを実行する（または `PropertyListingSyncService` の定期同期で自動修正される）

---

**注意**: 既存テストが `'レインズ登録＋SUUMO登録'` というラベルを期待している箇所も合わせて修正が必要。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず修正前のコードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しく動作することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `calculateSidebarStatus()` を直接呼び出し、バグ条件を満たす入力に対して返されるラベルを確認する。修正前のコードでは `'レインズ登録＋SUUMO URL 要登録'` ではなく `'レインズ登録＋SUUMO登録'` が返されることを観察する。

**Test Cases**:
1. **専任・公開中バグ確認**: 専任・公開中、suumo_url空、S不要でない、公開予定日が昨日以前 → `'レインズ登録＋SUUMO登録'` が返される（修正前のコードで失敗）
2. **一般・公開中バグ確認**: 一般・公開中、suumo_url空、S不要でない、公開予定日が昨日以前 → `'SUUMO URL　要登録'` が返される（修正前のコードで成功 — 一般・公開中は既に正しい）
3. **AA3959の実データ確認**: AA3959の実際のsidebar_statusを確認し、バグ条件を満たしているか検証する（修正前のコードで失敗）
4. **フロントエンドラベルマッチング確認**: バックエンドが返すラベルとフロントエンドの定義ラベルが一致しているか確認する

**Expected Counterexamples**:
- `calculateSidebarStatus()` が専任・公開中の場合に `'レインズ登録＋SUUMO URL 要登録'` ではなく `'レインズ登録＋SUUMO登録'` を返す
- フロントエンドのカテゴリーフィルタリングで `'レインズ登録＋SUUMO URL 要登録'` にマッチする物件が0件になる

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が正しいラベルを返すことを検証する。

**Pseudocode:**
```
FOR ALL property WHERE isBugCondition(property) DO
  result := calculateSidebarStatus_fixed(property, gyomuListData)
  IF property.atbb_status = '一般・公開中' THEN
    ASSERT result = 'SUUMO URL　要登録'
  ELSE IF property.atbb_status = '専任・公開中' THEN
    ASSERT result = 'レインズ登録＋SUUMO URL 要登録'
  END IF
END FOR
```

### Preservation Checking

**Goal**: バグ条件に該当しない全ての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL property WHERE NOT isBugCondition(property) DO
  ASSERT calculateSidebarStatus_original(property, gyomuListData)
       = calculateSidebarStatus_fixed(property, gyomuListData)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な入力パターン（suumo_url の様々な値、atbb_status の各種値）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強く保証できる

**Test Cases**:
1. **Suumo URL 入力済みの保持**: suumo_url が入力済みの物件は「SUUMO URL 要登録」系カテゴリーに含まれないことを確認
2. **S不要の保持**: suumo_registered = 'S不要' の物件はどちらのカテゴリーにも含まれないことを確認
3. **他カテゴリーの保持**: 未報告、未完了、本日公開予定などの他カテゴリーの計算結果が変わらないことを確認
4. **公開予定日が未来の保持**: 公開予定日が今日以降の物件はカテゴリーに含まれないことを確認

### Unit Tests

- `calculateSidebarStatus()` に専任・公開中のバグ条件入力を渡し、`'レインズ登録＋SUUMO URL 要登録'` が返されることを確認
- `calculateSidebarStatus()` に一般・公開中のバグ条件入力を渡し、`'SUUMO URL　要登録'` が返されることを確認
- suumo_url が入力済みの場合に「SUUMO URL 要登録」系カテゴリーが返されないことを確認
- suumo_registered = 'S不要' の場合にどちらのカテゴリーも返されないことを確認
- 公開予定日が今日以降の場合にカテゴリーが返されないことを確認

### Property-Based Tests

- ランダムな suumo_url パターン（null、空文字、スペースのみ、URL文字列）を生成し、バグ条件の成否を検証
- ランダムな atbb_status 値を生成し、「一般・公開中」「専任・公開中」以外では条件⑥が発動しないことを検証
- ランダムな公開予定日を生成し、TODAY()-1 以前の場合のみ条件⑥が発動することを検証
- 修正前後の `calculateSidebarStatus()` の結果を比較し、バグ条件以外の入力では同一結果を返すことを検証

### Integration Tests

- AA3959 の実データを使用し、修正後に正しいカテゴリーに表示されることを確認
- フロントエンドのサイドバーで「SUUMO URL 要登録」「レインズ登録＋SUUMO URL 要登録」カテゴリーが表示されることを確認
- suumo_url を空にした場合に sidebar_status が正しく再計算されることを確認
- 他のサイドバーカテゴリーが引き続き正しく表示されることを確認
