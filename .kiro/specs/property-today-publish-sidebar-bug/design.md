# 本日公開予定サイドバーバグ Bugfix Design

## Overview

物件リストのサイドバーカテゴリー「本日公開予定」に、公開予定日が今日以前の物件が表示されないバグを修正する。

原因は2つのバグが重なっている：

1. **バグ1（フロントエンド）**: `PropertyListingsPage.tsx` が `/api/work-tasks` のレスポンス形式を誤って処理し、`workTasksData` が常に空配列になる
2. **バグ2（バックエンド）**: `WorkTaskService.ts` の `list()` メソッドのSELECT句に `publish_scheduled_date` が含まれておらず、APIレスポンスに公開予定日が含まれない

この2つのバグにより、`calculatePropertyStatus()` が `workTaskMap` から公開予定日を取得できず、「本日公開予定」ステータスが一切返されない状態になっている。

修正方針は最小限の変更に留める：
- フロントエンド: `workTasksRes.data` → `workTasksRes.data.data` に修正
- バックエンド: SELECT句に `publish_scheduled_date` を追加

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `workTaskMap` が空のため `calculatePropertyStatus()` が「本日公開予定」を返せない状態
- **Property (P)**: 期待される正しい動作 — `atbb_status` が「公開前」を含み、かつ `publish_scheduled_date` が今日以前の物件が「本日公開予定」として表示される
- **Preservation**: 修正によって変更してはならない既存の動作 — 他のサイドバーカテゴリーの表示、マウスクリック操作、その他のステータス判定ロジック
- **workTaskMap**: `createWorkTaskMap(workTasks)` で生成される `Map<string, Date | null>` — 物件番号をキーに公開予定日を保持する
- **calculatePropertyStatus()**: `frontend/frontend/src/utils/propertyListingStatusUtils.ts` 内の関数 — 物件のステータスを優先度順に判定して返す
- **WorkTaskService.list()**: `backend/src/services/WorkTaskService.ts` 内のメソッド — `work_tasks` テーブルから一覧を取得する
- **publish_scheduled_date**: `work_tasks` テーブルのカラム — 物件の公開予定日（YYYY-MM-DD形式）

## Bug Details

### Bug Condition

バグは2つの条件が重なったときに発現する。

**バグ1**: フロントエンドが `/api/work-tasks` のレスポンスを処理する際、`workTasksRes.data` はレスポンスオブジェクト全体（`{ data: [...], total, limit, offset }`）であるため、`Array.isArray(workTasksRes.data)` が `false` になり、`workTasksData` が常に空配列 `[]` になる。

**バグ2**: バックエンドの `WorkTaskService.list()` のSELECT句に `publish_scheduled_date` が含まれていないため、APIレスポンスの各レコードに公開予定日が含まれない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { workTasksResData: any, selectClause: string }
  OUTPUT: boolean

  // バグ1: レスポンスデータが配列として認識されない
  bug1 := NOT Array.isArray(input.workTasksResData)
          AND input.workTasksResData HAS PROPERTY 'data'
          AND Array.isArray(input.workTasksResData.data)

  // バグ2: publish_scheduled_dateがSELECT句に含まれていない
  bug2 := NOT input.selectClause CONTAINS 'publish_scheduled_date'

  RETURN bug1 OR bug2
END FUNCTION
```

### Examples

- **バグ1の例**: `workTasksRes.data` が `{ data: [{property_number: 'AA0001', publish_scheduled_date: '2025-01-01'}], total: 1, limit: 100, offset: 0 }` のとき、`Array.isArray(workTasksRes.data)` → `false` → `workTasksData = []`（期待値: `[{property_number: 'AA0001', ...}]`）
- **バグ2の例**: バックエンドのSELECT句が `publish_scheduled_date` を含まないため、APIレスポンスが `{property_number: 'AA0001'}` となる（期待値: `{property_number: 'AA0001', publish_scheduled_date: '2025-01-01'}`）
- **複合バグの例**: `atbb_status` が「一般・公開前」で `publish_scheduled_date` が今日以前の物件 → `workTaskMap` が空のため `calculatePropertyStatus()` が「本日公開予定」を返せず、サイドバーに表示されない（期待値: 「本日公開予定」カテゴリーに表示される）
- **エッジケース**: `publish_scheduled_date` が null の物件 → 修正後も「本日公開予定」には表示されない（正常動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- マウスクリックによる物件行のクリック操作は修正前と同じく動作し続ける
- 「本日公開予定」以外のサイドバーカテゴリー（未報告、未完了、公開中など）の物件数表示は変更されない
- バックエンドの `/api/work-tasks` エンドポイントのレスポンス形式（`{ data: [...], total, limit, offset }`）は変更しない
- `calculatePropertyStatus()` のステータス判定ロジック（優先度順）は変更しない
- `WorkTaskService.list()` の他のSELECTカラムは変更しない

**Scope:**
`publish_scheduled_date` の取得・処理に関係しない全ての入力は、この修正によって完全に影響を受けない。これには以下が含まれる：
- マウスクリックによるボタン操作
- 検索フィールドへの入力
- ページネーション操作
- 「本日公開予定」以外のサイドバーカテゴリーの選択

## Hypothesized Root Cause

バグの説明に基づき、最も可能性の高い原因は以下の通り：

1. **レスポンス形式の不一致（バグ1）**: `/api/work-tasks` エンドポイントはページネーション対応のため `{ data: [...], total, limit, offset }` 形式でレスポンスを返すが、フロントエンドの処理コードが `workTasksRes.data` を直接配列として扱っている
   - `workTasksRes.data` はAxiosのレスポンスデータ（オブジェクト全体）
   - 正しくは `workTasksRes.data.data` が配列

2. **SELECTカラムの欠落（バグ2）**: `WorkTaskService.list()` のSELECT句が明示的にカラムを列挙しているが、`publish_scheduled_date` が追加されていない
   - `getByPropertyNumber()` は `select('*')` を使用しているため問題なし
   - `list()` メソッドのみパフォーマンス最適化のため明示的なカラム指定を使用しており、そこに `publish_scheduled_date` が漏れている

3. **2つのバグの相乗効果**: バグ1だけでも `workTaskMap` が空になるため「本日公開予定」は表示されない。バグ2だけでも `publish_scheduled_date` が null になるため同様に表示されない。両方を修正して初めて正常動作する。

## Correctness Properties

Property 1: Bug Condition - 本日公開予定ステータスの正常表示

_For any_ 物件において `atbb_status` が「公開前」を含み（`isPrePublish = true`）、かつ `work_tasks` テーブルの `publish_scheduled_date` が今日以前の日付である場合、修正後のシステムは `calculatePropertyStatus()` が「本日公開予定」ステータスを返し、サイドバーカテゴリーに当該物件が表示される SHALL。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 非バグ条件の動作保持

_For any_ 入力において `publish_scheduled_date` の取得・処理に関係しない操作（マウスクリック、他のサイドバーカテゴリー選択、検索など）は、修正後のシステムが修正前のシステムと同一の結果を返す SHALL。具体的には、他のサイドバーカテゴリーの物件数、ステータス判定ロジック、APIレスポンス形式が変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正：

**File 1**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**Function**: `fetchAllData()`（約222行目）

**Specific Changes**:
1. **レスポンスデータの取得方法を修正**: `workTasksRes.data` を `workTasksRes.data.data` に変更
   - 修正前: `const workTasksData = Array.isArray(workTasksRes.data) ? workTasksRes.data : [];`
   - 修正後: `const workTasksData = Array.isArray(workTasksRes.data?.data) ? workTasksRes.data.data : [];`

---

**File 2**: `backend/src/services/WorkTaskService.ts`

**Function**: `list()`（約79行目）

**Specific Changes**:
1. **SELECT句に `publish_scheduled_date` を追加**: 既存のカラムリストの末尾に追加
   - 修正前: `...on_hold,created_at,updated_at`
   - 修正後: `...on_hold,created_at,updated_at,publish_scheduled_date`

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズのアプローチに従う：まず未修正コードでバグを実証するカウンターサンプルを表面化し、次に修正が正しく動作し既存の動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正コードでバグを実証するカウンターサンプルを表面化する。根本原因分析を確認または反証する。反証された場合は再仮説が必要。

**Test Plan**: `/api/work-tasks` のレスポンスをモックして `fetchAllData()` を呼び出し、`workTasks` ステートが正しく設定されるかを検証するテストを書く。また、`WorkTaskService.list()` の戻り値に `publish_scheduled_date` が含まれるかを検証するテストを書く。これらのテストを未修正コードで実行して失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **レスポンス形式テスト**: `workTasksRes.data` が `{ data: [{property_number: 'AA0001', publish_scheduled_date: '2025-01-01'}], total: 1 }` のとき、`workTasksData` が `[{property_number: 'AA0001', ...}]` になることを検証（未修正コードでは失敗する）
2. **SELECTカラムテスト**: `WorkTaskService.list()` の戻り値に `publish_scheduled_date` フィールドが含まれることを検証（未修正コードでは失敗する）
3. **統合テスト**: `atbb_status` が「一般・公開前」で `publish_scheduled_date` が今日以前の物件が「本日公開予定」カテゴリーに表示されることを検証（未修正コードでは失敗する）
4. **エッジケーステスト**: `publish_scheduled_date` が null の物件が「本日公開予定」に表示されないことを検証（未修正コードでも成功する可能性あり）

**Expected Counterexamples**:
- `workTasksData` が常に空配列 `[]` になる
- `WorkTaskService.list()` の戻り値に `publish_scheduled_date` が含まれない（`undefined`）
- 可能性のある原因: レスポンス形式の不一致、SELECTカラムの欠落

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE isBugCondition(listing) DO
  // listing.atbb_status contains '公開前'
  // listing.publish_scheduled_date <= today
  result := calculatePropertyStatus_fixed(listing, workTaskMap_fixed)
  ASSERT result.key === 'today_publish'
  ASSERT result.label === '本日公開予定'
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前の関数と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE NOT isBugCondition(listing) DO
  ASSERT calculatePropertyStatus_original(listing, workTaskMap) 
       = calculatePropertyStatus_fixed(listing, workTaskMap_fixed)
END FOR
```

**Testing Approach**: 保持チェックにプロパティベーステストを推奨する理由：
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストが見逃すエッジケースを検出できる
- 非バグ入力に対して動作が変更されていないことを強く保証できる

**Test Plan**: まず未修正コードでマウスクリックや他のカテゴリー選択の動作を観察し、その動作をキャプチャするプロパティベーステストを書く。

**Test Cases**:
1. **他カテゴリー保持テスト**: 「未報告」「未完了」「公開中」などのカテゴリーの物件数が修正前後で変わらないことを検証
2. **ステータス判定保持テスト**: `publish_scheduled_date` が null または将来の日付の物件のステータスが変わらないことを検証
3. **APIレスポンス形式保持テスト**: `/api/work-tasks` のレスポンス形式（`{ data, total, limit, offset }`）が変わらないことを検証
4. **他のSELECTカラム保持テスト**: `WorkTaskService.list()` の他のカラム（`id`, `property_number` など）が引き続き返されることを検証

### Unit Tests

- `fetchAllData()` が `workTasksRes.data.data` を正しく配列として取得することをテスト
- `WorkTaskService.list()` の戻り値に `publish_scheduled_date` が含まれることをテスト
- `calculatePropertyStatus()` が `workTaskMap` に公開予定日がある場合に「本日公開予定」を返すことをテスト
- `createWorkTaskMap()` が `publish_scheduled_date` を正しくパースしてマップに格納することをテスト

### Property-Based Tests

- ランダムな `atbb_status` と `publish_scheduled_date` の組み合わせを生成し、「本日公開予定」判定が正しく動作することを検証
- ランダムな物件リストを生成し、`publish_scheduled_date` が null または将来の日付の物件が「本日公開予定」に含まれないことを検証
- 多数のシナリオにわたって、修正前後で「本日公開予定」以外のステータス判定が変わらないことを検証

### Integration Tests

- `atbb_status` が「一般・公開前」で `publish_scheduled_date` が今日以前の物件がサイドバーの「本日公開予定」カテゴリーに表示されることをテスト
- `atbb_status` が「専任・公開前」で `publish_scheduled_date` が今日以前の物件も同様に表示されることをテスト
- 修正後も他のサイドバーカテゴリー（未報告、未完了など）の物件数が正しく表示されることをテスト
