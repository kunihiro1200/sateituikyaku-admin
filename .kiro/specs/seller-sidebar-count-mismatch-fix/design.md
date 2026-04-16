# 物件リスト「未報告林」サイドバーカウント不一致バグ 設計書

## Overview

物件リスト（売主管理システム）のサイドバーにおいて、「未報告林」カテゴリのカウントとフィルタリング後の表示件数が一致しないバグを修正する。

根本原因は `frontend/frontend/src/utils/propertyListingStatusUtils.ts` の `getAssigneeInitial()` 関数内の `initialMap` に `'林田'` のマッピングが存在しないことである。`getAssigneeInitial('林田')` がフォールバックにより `'林田'` をそのまま返すため、ラベルが `'未報告林田'` となり、サイドバーキー `'未報告林'` と一致しない。

修正方針は最小限の変更として、`initialMap` に `'林田': '林'` を追加するのみとする。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `report_assignee` が `'林田'` であり、かつ `report_date` が今日以前に存在する物件
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作 — `getAssigneeInitial('林田')` が `'林'` を返し、ラベルが `'未報告林'` となること
- **Preservation**: 修正によって変更してはならない既存の動作 — `'林田'` 以外の全担当者のイニシャル変換、null/空文字のフォールバック、その他サイドバーカテゴリのカウント・フィルタリング
- **getAssigneeInitial**: `frontend/frontend/src/utils/propertyListingStatusUtils.ts` 内の関数。担当者名を受け取り、サイドバー表示用のイニシャル文字列を返す
- **initialMap**: `getAssigneeInitial` 内の担当者名→イニシャルのマッピングオブジェクト
- **calculatePropertyStatus**: 物件1件のステータス（key, label, color）を計算して返す関数
- **report_assignee**: 物件リストの「報告担当者」フィールド

## Bug Details

### Bug Condition

`report_assignee` が `'林田'` の物件に対して `getAssigneeInitial()` を呼び出すと、`initialMap` にキーが存在しないためフォールバック動作が発動し、`'林田'` をそのまま返す。その結果、ラベルが `'未報告林田'` となり、サイドバーキー `'未報告林'` と不一致が生じる。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListing
  OUTPUT: boolean

  RETURN X.report_assignee = '林田'
    AND X.report_date IS NOT NULL
    AND X.report_date <= today
END FUNCTION
```

### Examples

- `report_assignee = '林田'`、`report_date = '2025-01-10'`（今日以前）の物件
  - 実際: `getAssigneeInitial('林田')` → `'林田'`、ラベル `'未報告林田'`
  - 期待: `getAssigneeInitial('林田')` → `'林'`、ラベル `'未報告林'`
- `report_assignee = '林田'`、`report_date = null` の物件
  - バグ条件不成立（report_dateがnullのため未報告ステータスにならない）
- `report_assignee = '林'`、`report_date = '2025-01-10'` の物件
  - バグ条件不成立（`'林'` は既にinitialMapに存在し `'林'` を返す）
  - 修正後も動作変化なし（Preservation対象）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `'山本'` → `'Y'`、`'生野'` → `'生'`、`'久'` → `'久'`、`'裏'` → `'U'`、`'林'` → `'林'`、`'国広'` → `'K'`、`'木村'` → `'R'`、`'角井'` → `'I'` の既存イニシャル変換は変更しない
- `report_assignee` が `null` または空文字列の場合、`''` を返すフォールバック動作は変更しない
- `initialMap` に存在しない未知の担当者名の場合、担当者名をそのまま返すフォールバック動作は変更しない（`'林田'` 以外）
- 「未報告林」以外のサイドバーカテゴリ（要値下げ、未完了、非公開予定、買付申込み、公開前情報、非公開、一般公開中物件など）のカウント・フィルタリングは変更しない

**スコープ:**
バグ条件（`report_assignee = '林田'` かつ `report_date` が今日以前）に該当しない全ての入力は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

`initialMap` に `'林田'` のエントリが存在しないことが直接の原因である。

1. **マッピング漏れ**: `'林'` 担当者のマッピングは存在するが、`'林田'` 担当者が後から追加された際に `initialMap` への追記が漏れた
   - `'林'` → `'林'` は登録済み
   - `'林田'` → `'林'` が未登録

2. **フォールバック動作の副作用**: `initialMap[assignee] || assignee` というフォールバックにより、マッピング未登録の場合は担当者名をそのまま返す。これ自体は意図した設計だが、`'林田'` の場合に `'林田'` が返ることでサイドバーキーと不一致が生じる

3. **カウントとフィルタリングの二重不一致**: サイドバーカウント計算（`calculateStatusCounts`）とリストフィルタリング（`filterByStatus`）の両方が `calculatePropertyStatus` を経由するため、ラベル生成の誤りが両方に波及する

## Correctness Properties

Property 1: Bug Condition - 林田担当者の未報告ラベル正規化

_For any_ 物件 X において `isBugCondition(X)` が true（`report_assignee = '林田'` かつ `report_date` が今日以前）の場合、修正後の `calculatePropertyStatus(X)` は `label.replace(/\s+/g, '') === '未報告林'` かつ `key === 'unreported'` を返さなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存担当者・その他入力の動作保持

_For any_ 物件 X において `isBugCondition(X)` が false（`report_assignee` が `'林田'` 以外、または `report_date` が null/未来）の場合、修正後の `calculatePropertyStatus(X)` は修正前と同一の結果を返さなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/utils/propertyListingStatusUtils.ts`

**Function**: `getAssigneeInitial`

**Specific Changes**:

1. **initialMapへのエントリ追加**: `initialMap` に `'林田': '林'` を追加する
   - 追加位置: `'林': '林'` の直後（可読性のため隣接させる）
   - 変更前:
     ```typescript
     const initialMap: Record<string, string> = {
       '山本': 'Y',
       '生野': '生',
       '久': '久',
       '裏': 'U',
       '林': '林',
       '国広': 'K',
       '木村': 'R',
       '角井': 'I',
     };
     ```
   - 変更後:
     ```typescript
     const initialMap: Record<string, string> = {
       '山本': 'Y',
       '生野': '生',
       '久': '久',
       '裏': 'U',
       '林': '林',
       '林田': '林',
       '国広': 'K',
       '木村': 'R',
       '角井': 'I',
     };
     ```

この1行の追加のみで修正完了。他のファイルへの変更は不要。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず未修正コードでバグを再現するテストを実行してバグを確認し、次に修正後のコードでバグが解消され既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `getAssigneeInitial('林田')` が `'林田'` を返すことを確認し、`calculatePropertyStatus` が `'未報告林田'` ラベルを生成することを確認する。未修正コードでこれらのテストが失敗（または期待通りのバグ動作を示す）することを観察する。

**Test Cases**:
1. **林田イニシャル変換テスト**: `getAssigneeInitial('林田')` が `'林田'` を返すことを確認（未修正コードでのバグ動作）
2. **未報告ラベル生成テスト**: `report_assignee='林田'`、`report_date=今日以前` の物件で `calculatePropertyStatus` が `'未報告林田'` を返すことを確認
3. **サイドバーカウント不一致テスト**: `'林田'` 担当物件が `'未報告林'` キーではなく `'未報告林田'` キーでカウントされることを確認

**Expected Counterexamples**:
- `getAssigneeInitial('林田')` が `'林'` ではなく `'林田'` を返す
- 原因: `initialMap` に `'林田'` エントリが存在しないためフォールバックが発動

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := calculatePropertyStatus_fixed(X)
  ASSERT result.key = 'unreported'
    AND result.label.replace(/\s+/g, '') = '未報告林'
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT calculatePropertyStatus_original(X) = calculatePropertyStatus_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 多様な担当者名・日付の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケースを網羅できる
- 既存担当者（山本、生野、久、裏、林、国広、木村、角井）全員の動作保持を強力に保証できる

**Test Cases**:
1. **既存担当者イニシャル保持テスト**: 既存8担当者それぞれで `getAssigneeInitial` が修正前後で同一結果を返すことを確認
2. **null/空文字フォールバック保持テスト**: `getAssigneeInitial(null)` と `getAssigneeInitial('')` が `''` を返すことを確認
3. **未知担当者フォールバック保持テスト**: `initialMap` に存在しない担当者名（`'林田'` 以外）がそのまま返ることを確認
4. **他カテゴリカウント保持テスト**: 「未報告林」以外のサイドバーカテゴリのカウントが変化しないことを確認

### Unit Tests

- `getAssigneeInitial('林田')` が `'林'` を返すことを確認
- `getAssigneeInitial('林')` が引き続き `'林'` を返すことを確認（既存動作保持）
- 既存8担当者全員のイニシャル変換が正しいことを確認
- `report_assignee='林田'` の物件で `calculatePropertyStatus` が `key='unreported'`、`label='未報告 林'` を返すことを確認

### Property-Based Tests

- ランダムな担当者名を生成し、`'林田'` 以外の場合は修正前後で同一結果を返すことを検証
- ランダムな物件データを生成し、`isBugCondition` が false の場合は修正前後で同一ステータスを返すことを検証
- 既存担当者名の全組み合わせで `calculatePropertyStatus` の結果が変化しないことを検証

### Integration Tests

- `report_assignee='林田'` の物件を含むリストで `calculateStatusCounts` を実行し、`'未報告林'` キーのカウントが正しいことを確認
- サイドバーの `'未報告林'` をクリックした際のフィルタリングで、`'林田'` 担当物件が正しく表示されることを確認
- `'林田'` 担当物件と `'林'` 担当物件が混在する場合に、両者が `'未報告林'` として正しく集計されることを確認
