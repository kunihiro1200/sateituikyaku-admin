# 媒介作成完了日付表示バグ修正 設計ドキュメント

## Overview

`mediation_completed`フィールドがフロントエンドの2箇所で正しく日付表示されないバグを修正する。

- `WorkTaskDetailModal.tsx`: `EditableField`コンポーネントに`type="date"`が指定されていないため、ISO 8601文字列（`2026-04-11T00:00:00.000Z`）がそのまま表示・テキスト入力になっている
- `WorkTaskSection.tsx`: `formatValue`関数の日付判定条件（`key.includes('date') || key.includes('deadline')`）が`mediation_completed`にマッチしないため、日付フォーマットが適用されない

修正方針は最小限の変更に留め、既存の日付フィールドへのリグレッションを防ぐ。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `mediation_completed`フィールドに日付データが存在し、かつ日付フォーマット処理が適用されない状態
- **Property (P)**: 期待される正しい動作 — 日本語ロケール形式（`2026/4/11`）で表示され、編集時はDATE型ピッカーが表示される
- **Preservation**: 修正によって変更してはならない既存の動作 — 他の日付フィールド（`mediation_deadline`等）の表示・編集動作
- **EditableField**: `WorkTaskDetailModal.tsx`内のコンポーネント。`type`プロパティで入力種別を制御する
- **formatValue**: `WorkTaskSection.tsx`内の関数。フィールドキー名と値を受け取り、表示用文字列を返す

## Bug Details

### Bug Condition

バグは以下の2つの箇所で発現する。

**箇所1: WorkTaskDetailModal.tsx（行386）**
`EditableField`コンポーネントの`type`プロパティが省略されているため、デフォルトの`type="text"`が使用される。
DBから返るISO 8601形式の文字列がそのまま表示・編集される。

**箇所2: WorkTaskSection.tsx（formatValue関数）**
日付判定条件が`key.includes('date') || key.includes('deadline')`のみであり、
`mediation_completed`はどちらの条件にもマッチしない。

**Formal Specification:**
```
FUNCTION isBugCondition(fieldKey, fieldValue)
  INPUT: fieldKey: string, fieldValue: string | null
  OUTPUT: boolean

  RETURN fieldKey === 'mediation_completed'
         AND fieldValue IS NOT NULL
         AND fieldValue IS NOT EMPTY
         AND (
           -- WorkTaskDetailModal: type指定なし → テキスト表示
           fieldRenderedAsText(fieldKey)
           OR
           -- WorkTaskSection: formatValueが日付フォーマットを適用しない
           NOT dateFormatApplied(fieldKey)
         )
END FUNCTION
```

### Examples

- `mediation_completed = '2026-04-11T00:00:00.000Z'` → 現在: `2026-04-11T00:00:00.000Z` 表示 / 期待: `2026/4/11` 表示
- `mediation_completed = '2025-12-31T00:00:00.000Z'` → 現在: テキスト入力フィールド / 期待: DATEピッカー
- `mediation_completed = null` → 現在: `-` 表示（正常） / 期待: `-` 表示（変更なし）
- `mediation_deadline = '2026-04-11T00:00:00.000Z'` → 現在: `2026/4/11` 表示（正常） / 期待: `2026/4/11` 表示（変更なし）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `mediation_deadline`など既存の日付フィールドの表示・編集動作は変更しない
- `mediation_completed`がnullまたは空の場合は引き続き `-` を表示する
- 「媒介契約」タブの他のフィールド（`mediation_type`、`mediation_creator`、`mediation_notes`等）の動作は変更しない
- `mediation_completed`フィールドへの日付入力・保存動作は変更しない

**スコープ:**
`mediation_completed`フィールドの表示・編集に関わる2箇所のみを修正する。
他のフィールドや他のコンポーネントには一切変更を加えない。

## Hypothesized Root Cause

1. **WorkTaskDetailModal.tsx — type指定の漏れ**
   - `mediation_deadline`には`type="date"`が指定されているが（行386）、直後の`mediation_completed`（行386）には指定が漏れている
   - `EditableField`コンポーネントは`type`のデフォルト値が`'text'`のため、テキスト入力として動作する

2. **WorkTaskSection.tsx — formatValue関数の日付判定条件の不足**
   - 日付フィールドの判定が`key.includes('date') || key.includes('deadline')`のみ
   - `mediation_completed`は`date`も`deadline`も含まないためマッチしない
   - `mediation_deadline`は`deadline`を含むため正常に動作している

## Correctness Properties

Property 1: Bug Condition - mediation_completedの日付フォーマット適用

_For any_ `mediation_completed`フィールドの値が非null・非空文字列である入力に対して、
修正後の`formatValue`関数はISO 8601形式の文字列を日本語ロケール形式（`toLocaleDateString('ja-JP')`）に変換した文字列を返す。

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - 既存日付フィールドの動作維持

_For any_ `mediation_completed`以外の日付フィールドキー（`date`または`deadline`を含むキー）に対して、
修正後の`formatValue`関数は修正前と同一の結果を返す。

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

**ファイル1: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`**

**変更箇所:** `MediationSection`コンポーネント内（行386付近）

**変更内容:**
```tsx
// 修正前
<EditableField label="媒介作成完了" field="mediation_completed" />

// 修正後
<EditableField label="媒介作成完了" field="mediation_completed" type="date" />
```

---

**ファイル2: `frontend/frontend/src/components/WorkTaskSection.tsx`**

**変更箇所:** `formatValue`関数内の日付判定条件

**変更内容:**
```tsx
// 修正前
if (key.includes('date') || key.includes('deadline')) {

// 修正後
if (key.includes('date') || key.includes('deadline') || key.includes('completed')) {
```

**注意:** `key.includes('completed')`を追加することで`mediation_completed`にマッチするようになる。
`panorama_completed`など他の`completed`フィールドが日付型でない場合は影響を受ける可能性があるため、
より限定的な条件として`key === 'mediation_completed'`を使用することも検討する。

**最終判断:** `WorkTaskSection.tsx`の`CATEGORIES`定義を確認すると、`completed`を含む日付フィールドは
`mediation_completed`と`floor_plan_completed_date`（`date`を含むため既にマッチ）のみ。
`panorama_completed`はCATEGORIESに含まれていないため、`key.includes('completed')`の追加で問題ない。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを確認し、次に修正後の動作とリグレッションがないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `formatValue`関数に`mediation_completed`キーとISO日付文字列を渡し、
日付フォーマットが適用されないことを確認する。

**Test Cases**:
1. **formatValue未修正テスト**: `formatValue('mediation_completed', '2026-04-11T00:00:00.000Z')` → `'2026-04-11T00:00:00.000Z'`が返ることを確認（バグの再現）
2. **EditableField type確認**: `MediationSection`の`mediation_completed`フィールドに`type="date"`がないことを確認
3. **既存フィールド正常確認**: `formatValue('mediation_deadline', '2026-04-11T00:00:00.000Z')` → `'2026/4/11'`が返ることを確認

**Expected Counterexamples**:
- `formatValue('mediation_completed', '2026-04-11T00:00:00.000Z')`が`'2026-04-11T00:00:00.000Z'`を返す（日付フォーマット未適用）

### Fix Checking

**Goal**: 修正後、バグ条件に該当する入力で正しい動作をすることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition('mediation_completed', input) DO
  result := formatValue_fixed('mediation_completed', input)
  ASSERT result === new Date(input).toLocaleDateString('ja-JP')
END FOR
```

### Preservation Checking

**Goal**: 修正後、既存の日付フィールドの動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL key WHERE key.includes('date') OR key.includes('deadline') DO
  FOR ALL value WHERE value IS valid ISO date string DO
    ASSERT formatValue_original(key, value) === formatValue_fixed(key, value)
  END FOR
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。様々な日付フィールドキーと日付値の組み合わせを自動生成して検証できる。

**Test Cases**:
1. **mediation_deadlineの保持**: `formatValue('mediation_deadline', '2026-04-11T00:00:00.000Z')` → `'2026/4/11'`（変化なし）
2. **floor_plan_completed_dateの保持**: `formatValue('floor_plan_completed_date', '2026-04-11T00:00:00.000Z')` → `'2026/4/11'`（変化なし）
3. **null値の保持**: `formatValue('mediation_completed', null)` → `'-'`（変化なし）
4. **空文字列の保持**: `formatValue('mediation_completed', '')` → `'-'`（変化なし）

### Unit Tests

- `formatValue('mediation_completed', '2026-04-11T00:00:00.000Z')` → `'2026/4/11'`
- `formatValue('mediation_completed', null)` → `'-'`
- `formatValue('mediation_completed', '')` → `'-'`
- `formatValue('mediation_deadline', '2026-04-11T00:00:00.000Z')` → `'2026/4/11'`（リグレッション確認）

### Property-Based Tests

- 任意の有効なISO日付文字列に対して、`formatValue('mediation_completed', value)`が`toLocaleDateString('ja-JP')`の結果を返すことを検証
- `date`または`deadline`を含む任意のキーに対して、修正前後で`formatValue`の結果が同一であることを検証

### Integration Tests

- WorkTaskSectionの「媒介契約」カテゴリで`mediation_completed`が`2026/4/11`形式で表示されることを確認
- WorkTaskDetailModalの「媒介契約」タブで`mediation_completed`フィールドがDATEピッカーとして表示されることを確認
- WorkTaskDetailModalで日付を選択・保存後、正しくDBに保存されることを確認
