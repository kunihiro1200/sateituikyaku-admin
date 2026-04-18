# 通話モード「状況（当社）」フィールド表示遅延バグ 設計ドキュメント

## Overview

通話モードページ（CallModePage）において、「状況（当社）」フィールドを「一般媒介」に変更したとき、「専任（他決）決定日」フィールドが即座に表示されないバグを修正する。

バグの根本原因は、ページ初期表示時のキャッシュヒットパス（バックグラウンド更新処理）において、`setEditedStatus` は呼ばれるが `setEditedExclusiveDecisionDate`（`contractYearMonth` の初期化）が呼ばれないことにある。これにより、`editedStatus` が `'一般媒介'` に更新されても、`editedExclusiveDecisionDate` の値が正しく初期化されず、フィールドの表示状態が不整合になる。

修正方針は最小限の変更とし、バックグラウンド更新処理に `setEditedExclusiveDecisionDate` の初期化を追加する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — ページがキャッシュヒットで初期表示され、バックグラウンド更新で `editedStatus` が `'一般媒介'` に設定されるが、`editedExclusiveDecisionDate` が初期化されない状態
- **Property (P)**: 期待される動作 — `editedStatus === '一般媒介'` になった瞬間に「専任（他決）決定日」フィールドが即座に表示される
- **Preservation**: 修正によって変更されてはならない既存の動作 — 専任・他決系ステータスでの「専任（他決）決定日」フィールドの表示、マウスクリックによる操作、ページ初期表示時の正しい表示制御
- **editedStatus**: `CallModePage` 内の React state。「状況（当社）」フィールドの現在の編集値を保持する
- **editedExclusiveDecisionDate**: `CallModePage` 内の React state。「専任（他決）決定日」フィールドの現在の編集値を保持する
- **statusChangedRef**: バックグラウンド更新クロージャ用の `useRef`。ユーザーが編集中かどうかを追跡する
- **requiresDecisionDate**: `editedStatus` が専任・他決系かどうかを判定する関数（`label.includes('専任') || label.includes('他決')`）
- **バックグラウンド更新処理**: キャッシュヒット時に、キャッシュデータで即座に画面表示した後、APIから最新データを取得して画面を更新する処理

## Bug Details

### Bug Condition

バグは、ページがキャッシュヒットで初期表示される際に発現する。キャッシュデータで `editedStatus` が設定された後、バックグラウンドで最新データを取得する処理（`api.get('/api/sellers/:id').then(...)`）において、`statusChangedRef.current` が `false` の場合のみ `setEditedStatus(freshData.status)` が呼ばれるが、`setEditedExclusiveDecisionDate` は一切呼ばれない。

その結果、`editedStatus` が `'一般媒介'` に更新されても、`editedExclusiveDecisionDate` が空文字列のままになり、フィールドの表示は正しく行われるが値が空になる。また、キャッシュデータと最新データで `status` が異なる場合（例：キャッシュが古い値、最新が `'一般媒介'`）、バックグラウンド更新後に `editedStatus` が `'一般媒介'` に変わるが、`editedExclusiveDecisionDate` は初期化されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { pageLoadType, freshData }
  OUTPUT: boolean

  RETURN pageLoadType === 'cache_hit'
         AND statusChangedRef.current === false
         AND freshData.status === '一般媒介'
         AND setEditedExclusiveDecisionDate が呼ばれていない
END FUNCTION
```

### Examples

- **例1（バグ発現）**: 売主Aのステータスが「一般媒介」でDBに保存されている。ユーザーが一覧ページから売主Aの通話モードページに遷移する（キャッシュヒット）。キャッシュデータで `editedStatus = '一般媒介'` が設定される。バックグラウンド更新で `setEditedStatus('一般媒介')` が呼ばれるが `setEditedExclusiveDecisionDate` は呼ばれない → `editedExclusiveDecisionDate` が空のまま
- **例2（バグ発現）**: ユーザーが「状況（当社）」を「追客中」から「一般媒介」に変更する。`setEditedStatus('一般媒介')` が呼ばれ、`{editedStatus === '一般媒介'}` の条件が `true` になり「専任（他決）決定日」フィールドが表示される。しかし `editedExclusiveDecisionDate` は空文字列のまま（DBに保存済みの値が反映されない）
- **例3（正常動作）**: キャッシュなしでページを直接開く。`loadAllData` の通常パスで `setEditedExclusiveDecisionDate` が正しく初期化される → 正常表示
- **エッジケース**: `contractYearMonth` が `null` の場合、`editedExclusiveDecisionDate` は空文字列になる（これは正常動作）

## Expected Behavior

### Preservation Requirements

**変更されない動作:**
- 専任媒介・他決→追客・他決→専任・他決→一般・リースバック（専任）・一般→他決などの専任・他決系ステータスでは、引き続き「専任（他決）決定日」フィールドが即座に表示される
- 追客中・追客不要・除外済追客不要などの非対象ステータスでは、引き続き「専任（他決）決定日」フィールドが非表示のまま
- マウスクリックによるボタン操作は引き続き正常に動作する
- ページ初期表示時（キャッシュなし）の正しい表示制御は変わらない
- 「専任（他決）決定日」フィールドへの日付入力値は、保存操作時に正しく送信される

**スコープ:**
「状況（当社）」フィールドの変更に関係しない操作（マウスクリック、他のフィールドの入力、ページ遷移など）は、この修正によって一切影響を受けない。

## Hypothesized Root Cause

コードの調査により、根本原因は以下の通り特定された：

1. **バックグラウンド更新処理での初期化漏れ（最有力）**: `frontend/frontend/src/pages/CallModePage.tsx` の `loadAllData` 関数内、キャッシュヒット時のバックグラウンド更新処理（約1585行目）において、`statusChangedRef.current === false` の場合に `setEditedStatus` は更新されるが、`setEditedExclusiveDecisionDate`（`contractYearMonth` の初期化）が呼ばれていない

   ```typescript
   // 現在のコード（バグあり）
   if (!statusChangedRef.current) {
     setEditedStatus(freshData.status);           // ✅ 更新される
     setEditedConfidence(freshData.confidence || '');
     setEditedNextCallDate(freshData.nextCallDate || '');
     setEditedPinrichStatus(freshData.pinrichStatus || '');
     // ❌ setEditedExclusiveDecisionDate が呼ばれていない
   }
   ```

2. **通常パスとの非対称性**: キャッシュなしの通常パス（約1636行目以降）では `setEditedExclusiveDecisionDate` が正しく初期化されているが、バックグラウンド更新パスでは省略されている

3. **`contractYearMonth` の変換ロジックの重複**: 通常パスでは `contractYearMonth` を `YYYY-MM-DD` 形式に変換する処理があるが、バックグラウンド更新パスにはその処理がない

## Correctness Properties

Property 1: Bug Condition - バックグラウンド更新後の「専任（他決）決定日」フィールド即時表示

_For any_ ページロードがキャッシュヒットで発生し、バックグラウンド更新で `freshData.status === '一般媒介'` かつ `statusChangedRef.current === false` の場合、修正後の `loadAllData` 関数は `setEditedExclusiveDecisionDate` を `freshData.contractYearMonth` から正しく初期化し、「専任（他決）決定日」フィールドが即座に表示されなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 専任・他決系ステータスでの動作維持

_For any_ `editedStatus` が専任・他決系ステータス（`requiresDecisionDate` が `true` を返すステータス）の場合、修正後のコードは修正前と同じ動作を維持し、「専任（他決）決定日」フィールドを引き続き表示しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: `loadAllData` 内のバックグラウンド更新処理（約1585〜1601行目）

**Specific Changes**:

1. **バックグラウンド更新処理に `setEditedExclusiveDecisionDate` の初期化を追加**:
   ```typescript
   // 修正後のコード
   if (!statusChangedRef.current) {
     setEditedStatus(freshData.status);
     setEditedConfidence(freshData.confidence || '');
     setEditedNextCallDate(freshData.nextCallDate || '');
     setEditedPinrichStatus(freshData.pinrichStatus || '');
     
     // ✅ 追加: contractYearMonth の初期化（通常パスと同じロジック）
     if (freshData.contractYearMonth) {
       const rawDate = freshData.contractYearMonth;
       const formattedDecisionDate = typeof rawDate === 'string' && rawDate.length === 7
         ? rawDate + '-01'
         : typeof rawDate === 'string' ? rawDate.split('T')[0] : '';
       setEditedExclusiveDecisionDate(formattedDecisionDate);
     } else {
       setEditedExclusiveDecisionDate('');
     }
   }
   ```

2. **変更箇所**: `loadAllData` 関数内のバックグラウンド更新処理のみ。通常パス（キャッシュなし）は変更不要

3. **変更の最小性**: 他のフィールド（`editedCompetitors`、`editedExclusiveOtherDecisionFactors` など）は、バックグラウンド更新で上書きすると編集中の値が失われる可能性があるため、今回の修正スコープには含めない

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず修正前のコードでバグを実証するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作とPreservationを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグが発現することを確認し、根本原因分析を検証する。

**Test Plan**: バックグラウンド更新処理をシミュレートし、`statusChangedRef.current === false` かつ `freshData.status === '一般媒介'` の場合に `editedExclusiveDecisionDate` が初期化されないことを確認する。修正前のコードで実行してFAILすることを確認する。

**Test Cases**:
1. **キャッシュヒット時のバックグラウンド更新テスト**: `statusChangedRef.current === false` かつ `freshData.status === '一般媒介'` の場合、`editedExclusiveDecisionDate` が `freshData.contractYearMonth` から初期化されることを確認（修正前はFAIL）
2. **`contractYearMonth` が存在する場合のテスト**: `freshData.contractYearMonth = '2025-03'` の場合、`editedExclusiveDecisionDate` が `'2025-03-01'` に設定されることを確認（修正前はFAIL）
3. **`contractYearMonth` が `null` の場合のテスト**: `freshData.contractYearMonth = null` の場合、`editedExclusiveDecisionDate` が `''` に設定されることを確認（修正前はFAIL）
4. **`statusChangedRef.current === true` の場合のテスト**: ユーザーが編集中の場合、`editedExclusiveDecisionDate` が上書きされないことを確認（修正前後ともPASS）

**Expected Counterexamples**:
- 修正前のコードでは、バックグラウンド更新後に `editedExclusiveDecisionDate` が空文字列のまま
- 原因: バックグラウンド更新処理に `setEditedExclusiveDecisionDate` の呼び出しが存在しない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待される動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := loadAllData_fixed(input)
  ASSERT editedExclusiveDecisionDate が freshData.contractYearMonth から正しく初期化されている
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正前後で同じ動作が維持されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT loadAllData_original(input) と loadAllData_fixed(input) が同じ結果を返す
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様なステータス値（専任媒介、他決→追客、追客中など）に対して自動的にテストケースを生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後で動作が変わらないことを強く保証できる

**Test Plan**: 修正前のコードで専任・他決系ステータスの動作を観察し、修正後も同じ動作が維持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **専任媒介のPreservation**: `freshData.status === '専任媒介'` の場合、`requiresDecisionDate` が `true` を返し続けることを確認
2. **他決→追客のPreservation**: `freshData.status === '他決→追客'` の場合、`requiresDecisionDate` が `true` を返し続けることを確認
3. **追客中のPreservation**: `freshData.status === '追客中'` の場合、`requiresDecisionDate` が `false` を返し続けることを確認
4. **通常パス（キャッシュなし）のPreservation**: キャッシュなしの通常パスでは、修正前後で同じ初期化処理が行われることを確認

### Unit Tests

- バックグラウンド更新処理で `setEditedExclusiveDecisionDate` が正しく呼ばれることをテスト
- `contractYearMonth` の各形式（`YYYY-MM`、`YYYY-MM-DD`、`null`）に対する変換ロジックをテスト
- `statusChangedRef.current === true` の場合に `setEditedExclusiveDecisionDate` が呼ばれないことをテスト

### Property-Based Tests

- ランダムな `freshData.status` 値に対して、`requiresDecisionDate` の動作が修正前後で変わらないことを検証
- ランダムな `contractYearMonth` 値に対して、`YYYY-MM-DD` 形式への変換が正しく行われることを検証
- 専任・他決系ステータスの全パターンに対して、`requiresDecisionDate` が `true` を返し続けることを検証

### Integration Tests

- キャッシュヒット時のページ遷移で「一般媒介」ステータスの売主を開き、「専任（他決）決定日」フィールドが即座に表示されることを確認
- 「状況（当社）」を「一般媒介」に変更した後、保存せずに「専任（他決）決定日」フィールドが表示されることを確認
- 専任媒介・他決系ステータスの売主で、修正後も「専任（他決）決定日」フィールドが正常に表示されることを確認
