# Call Mode Status Update Fix - Bugfix Design

## Overview

通話モードページ（CallModePage）のステータスセクションで「ステータスを更新」ボタンを押すと500エラーが発生するバグを修正する。

根本原因は `SellerService.updateSeller()` 内で `updates.site = data.site` としているが、Supabaseの `sellers` テーブルのカラム名は `inquiry_site` であるため、存在しないカラムへの更新が試みられてエラーになっている。

また、除外日計算のクエリでも `currentSeller?.site` を参照しているが、DBには `site` カラムが存在しないため `inquiry_site` に修正が必要。

あわせて、ステータスセクションの「ステータスを更新」ボタンのUIを他の保存ボタンと統一し、スプレッドシートへの即時同期が正常に動作することを確認する。

## Glossary

- **Bug_Condition (C)**: `data.site` が含まれる `updateSeller()` 呼び出し — `updates.site = data.site` が存在しないカラムへの更新を引き起こす条件
- **Property (P)**: 正しい動作 — `updates.inquiry_site = data.site` として正しいカラム名でSupabaseを更新し、200レスポンスを返す
- **Preservation**: ステータスセクション以外の保存処理（物件情報、売主情報、コメント等）が影響を受けないこと
- **updateSeller**: `backend/src/services/SellerService.supabase.ts` 内の売主更新メソッド
- **inquiry_site**: `sellers` テーブルにおけるサイト（反響元）フィールドの正しいカラム名
- **handleUpdateStatus**: `CallModePage.tsx` 内のステータスセクション保存ハンドラー
- **パルスアニメーション**: フィールド変更時に保存ボタンをオレンジ色でアニメーション表示するUI効果

## Bug Details

### Bug Condition

`SellerService.updateSeller()` が `data.site` を受け取った際に `updates.site = data.site` として存在しないカラム名でSupabaseを更新しようとする。`sellers` テーブルに `site` カラムは存在せず、正しいカラム名は `inquiry_site` である。

また、除外日計算のクエリ `SELECT inquiry_date, site FROM sellers` も `site` カラムが存在しないため、このクエリ自体もエラーになる可能性がある。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UpdateSellerRequest
  OUTPUT: boolean

  RETURN input.site IS NOT UNDEFINED
         AND updateSeller() executes updates.site = input.site
         AND NOT updates.inquiry_site = input.site
END FUNCTION
```

### Examples

- **例1（バグあり）**: ユーザーが状況（当社）を「追客中」→「専任媒介」に変更して保存 → `data.site` が含まれる場合に500エラー
- **例2（バグあり）**: ユーザーが確度を「B」→「A」に変更して保存 → `data.site` が同時に送信される場合に500エラー
- **例3（バグあり）**: 除外日計算クエリ `SELECT inquiry_date, site FROM sellers` が `site` カラム不存在でエラー
- **例4（正常）**: `data.site` が `undefined` の場合（siteを変更しない更新）は正常に動作する

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `data.site` を含まない更新（物件情報、売主情報、コメント、訪問予約など）は引き続き正常に動作する
- コメント保存ボタンの既存パルスアニメーション動作は変わらない
- 専任・他決ステータス選択時の競合名・要因・決定日の保存処理は正常に動作し続ける
- スプレッドシートからDBへのGAS定期同期（10分トリガー）は引き続き正常に動作する

**Scope:**
`data.site` フィールドを含まない全ての更新リクエストはこの修正の影響を受けない。

## Hypothesized Root Cause

1. **カラム名の不一致**: `updateSeller()` の `// Site field` セクション（約543行目）で `updates.site = data.site` としているが、DBカラム名は `inquiry_site`。`decryptSeller()` では正しく `inquirySite: seller.inquiry_site` / `site: seller.inquiry_site` としているが、更新時のマッピングが漏れている。

2. **除外日計算クエリの不一致**: 除外日計算のために `SELECT inquiry_date, site FROM sellers` を実行しているが、`site` カラムが存在しないため、このクエリも失敗する可能性がある（約593行目）。

3. **UIの仕様不統一**: 「ステータスを更新」ボタンが `variant="outlined"` で固定されており、他の保存ボタン（コメント保存など）のように変更検知によるパルスアニメーション付きオレンジ色への切り替えが実装されていない。

## Correctness Properties

Property 1: Bug Condition - inquiry_site カラム名修正

_For any_ `UpdateSellerRequest` において `data.site` が定義されている場合、修正後の `updateSeller()` は `updates.inquiry_site = data.site` として正しいカラム名でSupabaseを更新し、200レスポンスを返す。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - site非含有更新の動作保持

_For any_ `UpdateSellerRequest` において `data.site` が `undefined` である場合（siteフィールドを変更しない更新）、修正後の `updateSeller()` は修正前と全く同じ動作をし、既存の更新処理に影響を与えない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File 1**: `backend/src/services/SellerService.supabase.ts`

**Function**: `updateSeller`

**Specific Changes**:

1. **Site field のカラム名修正**（約543行目）:
   ```typescript
   // 修正前
   if (data.site !== undefined) {
     updates.site = data.site;
   }

   // 修正後
   if (data.site !== undefined) {
     updates.inquiry_site = data.site;
   }
   ```

2. **除外日計算クエリのカラム名修正**（約593行目）:
   ```typescript
   // 修正前
   const { data: currentSeller } = await this.table('sellers')
     .select('inquiry_date, site')
     .eq('id', sellerId)
     .single();
   const siteForCalc = data.site !== undefined ? data.site : currentSeller?.site;

   // 修正後
   const { data: currentSeller } = await this.table('sellers')
     .select('inquiry_date, inquiry_site')
     .eq('id', sellerId)
     .single();
   const siteForCalc = data.site !== undefined ? data.site : currentSeller?.inquiry_site;
   ```

**File 2**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: ステータスセクションの保存ボタン部分

**Specific Changes**:

3. **ステータス変更検知の状態追加**: `statusChanged` state を追加し、ステータスセクションのフィールド（状況（当社）、確度、次電日、除外日にすること）が初期値から変更された場合に `true` にする。

4. **ボタン仕様の統一**: 「ステータスを更新」ボタンを以下の仕様に変更:
   - 未変更時: `variant="outlined"` グレー（disabled状態）
   - 変更あり時: `variant="contained"` オレンジ色 + パルスアニメーション（コメント保存ボタンと同じ仕様）

5. **保存後のリセット**: 保存成功後に `statusChanged` を `false` にリセットする。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを再現するテストを書き、次に修正後の正常動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `updates.site = data.site` が500エラーを引き起こすことを確認する。

**Test Plan**: `updateSeller()` に `site` フィールドを含むリクエストを送り、Supabaseが `column "site" of relation "sellers" does not exist` エラーを返すことを確認する。

**Test Cases**:
1. **site含有更新テスト**: `updateSeller(id, { status: '追客中', site: 'ウ' })` を呼び出す（未修正コードで失敗する）
2. **除外日計算クエリテスト**: `site` カラムを参照するクエリが失敗することを確認（未修正コードで失敗する）
3. **site非含有更新テスト**: `updateSeller(id, { status: '追客中' })` を呼び出す（未修正コードでも成功する）

**Expected Counterexamples**:
- `updates.site = data.site` が `column "site" of relation "sellers" does not exist` エラーを引き起こす
- 原因: DBカラム名は `inquiry_site` であり `site` ではない

### Fix Checking

**Goal**: 修正後に `data.site` を含む更新が正常に動作することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := updateSeller_fixed(input)
  ASSERT result.status === 200
  ASSERT result.seller.site === input.site
  ASSERT result.seller.inquirySite === input.site
END FOR
```

### Preservation Checking

**Goal**: `data.site` を含まない更新が修正前後で同じ動作をすることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateSeller_original(input) = updateSeller_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストで多様な `UpdateSellerRequest`（site未含有）を生成し、修正前後で同じ結果になることを検証する。

**Test Cases**:
1. **status更新の保持**: `{ status: '専任媒介' }` のみの更新が正常に動作することを確認
2. **confidence更新の保持**: `{ confidence: 'A' }` のみの更新が正常に動作することを確認
3. **nextCallDate更新の保持**: `{ nextCallDate: '2026-04-01' }` のみの更新が正常に動作することを確認
4. **スプレッドシート同期の保持**: 更新後にSyncQueueが正常にエンキューされることを確認

### Unit Tests

- `updateSeller()` に `site` フィールドを含むリクエストを送った場合、`updates.inquiry_site` が設定されることを確認
- `updateSeller()` に `site` フィールドを含まないリクエストを送った場合、`updates.inquiry_site` が設定されないことを確認
- 除外日計算クエリが `inquiry_site` カラムを参照することを確認

### Property-Based Tests

- ランダムな `UpdateSellerRequest`（site含有）を生成し、修正後に全て200レスポンスを返すことを確認
- ランダムな `UpdateSellerRequest`（site非含有）を生成し、修正前後で同じ動作をすることを確認

### Integration Tests

- 通話モードページでステータスセクションのフィールドを変更して保存し、DBに正しく保存されることを確認
- 保存後にスプレッドシートに即時同期されることを確認（`SyncQueue` 経由）
- 「ステータスを更新」ボタンのUI変化（未変更時グレー、変更時オレンジパルス）を確認
