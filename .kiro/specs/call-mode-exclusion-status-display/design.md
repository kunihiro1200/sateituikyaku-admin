# 設計ドキュメント：通話モード除外ステータス表示

## 概要

売主管理システムの通話モードページ（`/sellers/:id/call`）において、コメント欄の隣に表示される除外関連UIの表示ロジックを拡張する。

現在は `exclusionAction` に値がある場合に常に赤枠・赤字・警告アイコン付きのバナー（ExclusionActionBanner）を表示している。新機能として、`editedStatus`（状況（当社））に「除外」が含まれる場合は ExclusionActionBanner を非表示にし、代わりに `editedStatus` の値を赤字・赤枠なし・通常フォントサイズで表示する ExclusionStatusDisplay を表示する。

## アーキテクチャ

本機能はフロントエンドのみの変更であり、バックエンドへの変更は不要。

```
frontend/frontend/src/pages/CallModePage.tsx
  └── 表示判定ロジック（isExcluded, showBanner, showStatusDisplay）
      ├── ExclusionActionBanner（既存インラインJSX → 条件変更）
      └── ExclusionStatusDisplay（新規インラインJSX）
```

対象ファイル：
- `frontend/frontend/src/pages/CallModePage.tsx`（唯一の変更対象）

バックエンド変更：なし（`editedStatus` は既存の `status` フィールドから取得済み）

## コンポーネントとインターフェース

### 表示判定ロジック

CallModePage 内に以下の派生値を定義する：

```typescript
// editedStatusに「除外」が含まれるかどうか
const isExcluded = editedStatus?.includes('除外') ?? false;

// ExclusionActionBannerを表示するか
const showBanner = !isExcluded && !!exclusionAction;

// ExclusionStatusDisplayを表示するか
const showStatusDisplay = isExcluded;
```

### ExclusionActionBanner（既存・条件変更）

現在の表示条件 `{exclusionAction && (...)}` を `{showBanner && (...)}` に変更する。

既存のJSX構造（スタイル・内容）は変更しない：
- `variant="h5"`
- `color: 'error.main'`
- `border: 2`, `borderColor: 'error.main'`
- `⚠️ {exclusionAction}` テキスト
- サイト「H」の場合のChip表示

### ExclusionStatusDisplay（新規）

ExclusionActionBanner の直後（または代替位置）に追加するインラインJSX：

```tsx
{showStatusDisplay && (
  <Typography
    variant="body2"
    sx={{
      color: 'error.main',
    }}
  >
    {editedStatus}
  </Typography>
)}
```

要件：
- `variant="body2"`：周囲と同じフォントサイズ
- `color: 'error.main'`：赤字
- `border` プロパティなし：赤枠なし
- 表示内容：`editedStatus` の値そのまま

## データモデル

新規のデータモデル変更はなし。既存の状態変数を使用する：

| 状態変数 | 型 | 用途 |
|---------|-----|------|
| `editedStatus` | `string` | 「状況（当社）」の現在値。「除外」を含むかどうかの判定に使用 |
| `exclusionAction` | `string` | 除外日アクションの値。ExclusionActionBanner の表示に使用 |

派生値（新規）：

| 変数名 | 型 | 算出方法 |
|--------|-----|---------|
| `isExcluded` | `boolean` | `editedStatus?.includes('除外') ?? false` |
| `showBanner` | `boolean` | `!isExcluded && !!exclusionAction` |
| `showStatusDisplay` | `boolean` | `isExcluded` |

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述です。*

### プロパティ1：排他制御の不変条件

*任意の* `editedStatus` 文字列と `exclusionAction` 文字列の組み合わせに対して、`showBanner` と `showStatusDisplay` が同時に `true` になることはない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### プロパティ2：除外状態の部分一致判定

*任意の* 「除外」という文字列を含む `editedStatus`（例：「除外」「除外後追客中」「除外済み」など）に対して、`isExcluded` は `true` となり、`showStatusDisplay` は `true`、`showBanner` は `false` になる。

**Validates: Requirements 1.1, 1.3, 2.1, 3.2**

### プロパティ3：非除外状態でのバナー表示

*任意の* 「除外」を含まない `editedStatus` と、空でない `exclusionAction` の組み合わせに対して、`showBanner` は `true`、`showStatusDisplay` は `false` になる。

**Validates: Requirements 1.2, 2.5, 3.3**

## エラーハンドリング

- `editedStatus` が `undefined` または `null` の場合：`?.includes()` によりエラーにならず `false` を返す（`?? false` でフォールバック）
- `exclusionAction` が空文字列の場合：`!!exclusionAction` が `false` となりバナーは非表示

## テスト戦略

本機能はフロントエンドの純粋な表示判定ロジックであり、プロパティベーステストが適用可能。

### ユニットテスト（例ベース）

`ExclusionStatusDisplay` のスタイル要件を検証：

- `color: 'error.main'` が適用されていること（要件2.2）
- `border` プロパティが設定されていないこと（要件2.3）
- `variant="body2"` が適用されていること（要件2.4）

### プロパティベーステスト

ライブラリ：`fast-check`（既存プロジェクトで使用中）

各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1のテスト実装方針

```typescript
// Feature: call-mode-exclusion-status-display, Property 1: 排他制御の不変条件
fc.assert(
  fc.property(
    fc.string(),  // editedStatus
    fc.string(),  // exclusionAction
    (editedStatus, exclusionAction) => {
      const isExcluded = editedStatus?.includes('除外') ?? false;
      const showBanner = !isExcluded && !!exclusionAction;
      const showStatusDisplay = isExcluded;
      // 同時にtrueにならないことを検証
      return !(showBanner && showStatusDisplay);
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ2のテスト実装方針

```typescript
// Feature: call-mode-exclusion-status-display, Property 2: 除外状態の部分一致判定
fc.assert(
  fc.property(
    fc.string().map(s => s + '除外' + fc.string()),  // 「除外」を含む文字列
    fc.string(),  // exclusionAction
    (editedStatus, exclusionAction) => {
      const isExcluded = editedStatus?.includes('除外') ?? false;
      const showBanner = !isExcluded && !!exclusionAction;
      const showStatusDisplay = isExcluded;
      return isExcluded && showStatusDisplay && !showBanner;
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ3のテスト実装方針

```typescript
// Feature: call-mode-exclusion-status-display, Property 3: 非除外状態でのバナー表示
fc.assert(
  fc.property(
    fc.string().filter(s => !s.includes('除外')),  // 「除外」を含まない文字列
    fc.string().filter(s => s.length > 0),          // 空でないexclusionAction
    (editedStatus, exclusionAction) => {
      const isExcluded = editedStatus?.includes('除外') ?? false;
      const showBanner = !isExcluded && !!exclusionAction;
      const showStatusDisplay = isExcluded;
      return showBanner && !showStatusDisplay;
    }
  ),
  { numRuns: 100 }
);
```
