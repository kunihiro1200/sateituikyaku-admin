# 設計ドキュメント: business-list-sidebar-category-order

## 概要

業務依頼画面（`WorkTasksPage`）のサイドバーカテゴリー表示順番を、業務フローに沿った順番に整理する。

対象ファイルは `frontend/frontend/src/utils/workTaskStatusUtils.ts` のみであり、変更箇所は以下の2点：

1. **`CATEGORY_ORDER` 配列**: カテゴリーの表示順番を業務フロー順（媒介契約 → サイト登録 → 売買契約 → 台帳作成 → その他 → 保留）に変更
2. **`CATEGORY_GROUP_COLORS` 配列**: 新しい順番に合わせてグループ背景色マッピングを整合させる

バックエンドへの変更は一切なし。フロントエンドのみの変更。

---

## アーキテクチャ

```mermaid
graph TD
    A[WorkTasksPage] -->|tasks prop| B[getStatusCategories]
    B -->|calculateTaskStatus| C[ステータス文字列生成]
    C -->|getCategoryOrder| D[CATEGORY_ORDER でソート]
    D --> E[StatusCategory[] 返却]
    E -->|label| F[getCategoryGroupColor]
    F -->|CATEGORY_GROUP_COLORS| G[背景色適用]
    E --> H[サイドバー表示]
```

### 変更範囲

本変更はフロントエンドのユーティリティファイル1ファイルのみの変更であり、既存のロジック（`calculateTaskStatus`、`filterTasksByStatus`、`getStatusCategories`）には一切手を加えない。

| 変更対象 | 変更内容 |
|---------|---------|
| `CATEGORY_ORDER` 配列 | 要素の並び順を業務フロー順に変更（要素数・内容は変更なし） |
| `CATEGORY_GROUP_COLORS` 配列 | 要素の並び順を新しい `CATEGORY_ORDER` と整合させる（マッピング内容は変更なし） |

---

## コンポーネントとインターフェース

### 変更対象: `workTaskStatusUtils.ts`

#### `CATEGORY_ORDER` 配列（変更後）

```typescript
const CATEGORY_ORDER = [
  '媒介作成_締日',
  'サイト登録依頼してください',
  'サイト依頼済み納品待ち',
  'サイト登録要確認',
  '売買契約 依頼未',
  '売買契約　営業確認中',
  '売買契約 入力待ち',
  '売買契約 製本待ち',
  '要台帳作成',
  '決済完了チャット送信未',
  '入金確認未',
  '保留',
];
```

**変更前後の対応**:

| 変更前の順番 | 変更後の順番 | 業務フェーズ |
|------------|------------|------------|
| 11. 媒介作成_締日 | 1. 媒介作成_締日 | 媒介契約フェーズ |
| 3. サイト登録依頼してください | 2. サイト登録依頼してください | サイト登録依頼未フェーズ |
| 9. サイト依頼済み納品待ち | 3. サイト依頼済み納品待ち | サイト登録関係フェーズ |
| 10. サイト登録要確認 | 4. サイト登録要確認 | サイト登録関係フェーズ |
| 8. 売買契約 依頼未 | 5. 売買契約 依頼未 | 売買契約依頼未フェーズ |
| 1. 売買契約　営業確認中 | 6. 売買契約　営業確認中 | 売買契約関係フェーズ |
| 2. 売買契約 入力待ち | 7. 売買契約 入力待ち | 売買契約関係フェーズ |
| 7. 売買契約 製本待ち | 8. 売買契約 製本待ち | 売買契約関係フェーズ |
| 6. 要台帳作成 | 9. 要台帳作成 | 台帳作成フェーズ |
| 4. 決済完了チャット送信未 | 10. 決済完了チャット送信未 | その他フェーズ |
| 5. 入金確認未 | 11. 入金確認未 | その他フェーズ |
| 12. 保留 | 12. 保留 | 保留（最後） |

#### `CATEGORY_GROUP_COLORS` 配列（変更後）

```typescript
const CATEGORY_GROUP_COLORS: [string, string][] = [
  ['媒介作成_締日',              '#e8f5e9'],  // 緑系
  ['サイト登録依頼してください', '#f3e5f5'],  // 紫系
  ['サイト依頼済み納品待ち',     '#f3e5f5'],  // 紫系
  ['サイト登録要確認',           '#f3e5f5'],  // 紫系
  ['売買契約 依頼未',            '#e3f2fd'],  // 青系
  ['売買契約　営業確認中',       '#e3f2fd'],  // 青系
  ['売買契約 入力待ち',          '#e3f2fd'],  // 青系
  ['売買契約 製本待ち',          '#e3f2fd'],  // 青系
  ['要台帳作成',                 '#fce4ec'],  // ピンク系
  ['決済完了チャット送信未',     '#fff8e1'],  // 黄系
  ['入金確認未',                 '#fff8e1'],  // 黄系
  ['保留',                       '#f5f5f5'],  // グレー系
];
```

> **注意**: `CATEGORY_GROUP_COLORS` のマッピング内容（プレフィックス → 色）は変更前と同一。並び順のみ `CATEGORY_ORDER` と整合させる。

#### 変更しないもの

以下の関数・型・ロジックは一切変更しない：

- `calculateTaskStatus(task)` — ステータス文字列生成ロジック
- `getStatusCategories(tasks)` — カテゴリーリスト生成ロジック
- `filterTasksByStatus(tasks, statusKey)` — フィルタリングロジック
- `getCategoryGroupColor(label)` — 背景色取得関数（内部ロジック）
- `getCategoryOrder(status)` — 順番取得関数（内部ロジック）
- `WorkTask` インターフェース
- `StatusCategory` インターフェース

---

## データモデル

変更なし。既存の `WorkTask` および `StatusCategory` インターフェースをそのまま使用する。

### `CATEGORY_ORDER` の不変条件

- 要素数: 12（変更前後で同一）
- 要素の内容: 変更なし（並び順のみ変更）

### `CATEGORY_GROUP_COLORS` の不変条件

- 要素数: 12（変更前後で同一）
- プレフィックス → 色のマッピング: 変更なし（並び順のみ変更）

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いを表す形式的な記述です。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: カテゴリー表示順番の正確性

*任意の* タスクデータセットに対して、`getStatusCategories()` が返すカテゴリーリスト（`All` を除く）の順番が `CATEGORY_ORDER` 配列の順番と一致する

**Validates: Requirements 1.1**

### Property 2: `All` エントリーの最上部表示

*任意の* タスクデータセット（空配列を含む）に対して、`getStatusCategories()` が返すリストの最初の要素のラベルが `'All'` である

**Validates: Requirements 1.3**

### Property 3: 0件カテゴリーの非表示

*任意の* タスクデータセットに対して、`getStatusCategories()` が返すカテゴリーリスト（`All` を除く）の全エントリーの `count` が 1 以上である

**Validates: Requirements 1.4**

### Property 4: プレフィックスマッチングによる背景色適用

*任意の* `CATEGORY_ORDER` 内のプレフィックスと *任意の* サフィックス文字列を結合したラベルに対して、`getCategoryGroupColor()` がそのプレフィックスに対応する色コードを返す

**Validates: Requirements 2.2**

### Property 5: フィルタリング結果の正確性

*任意の* タスクデータセットと *任意の* ステータスキーに対して、`filterTasksByStatus()` が返す全タスクの `calculateTaskStatus()` の返り値がそのステータスキーと一致する

**Validates: Requirements 3.1**

### Property 6: カウントとフィルタリング結果の一致

*任意の* タスクデータセットに対して、`getStatusCategories()` の各カテゴリーの `count` と、同じカテゴリーの `filter` 関数でフィルタリングした結果の件数が一致する

**Validates: Requirements 3.2**

---

## エラーハンドリング

本変更は配列の並び順変更のみであり、新たなエラーケースは発生しない。

既存のエラーハンドリングをそのまま維持する：

- `calculateTaskStatus()` が空文字列を返した場合、そのタスクはカテゴリーに含まれない（既存動作）
- `getCategoryGroupColor()` がマッチするプレフィックスを見つけられない場合、`undefined` を返す（既存動作）

---

## テスト戦略

### 単体テスト（Exampleベース）

以下の項目をexampleベースのテストで検証する：

| テスト対象 | テスト内容 |
|-----------|-----------|
| `CATEGORY_ORDER` | 配列の要素数が12であること |
| `CATEGORY_ORDER` | 最初の要素が `'媒介作成_締日'` であること |
| `CATEGORY_ORDER` | 最後の要素が `'保留'` であること |
| `getCategoryGroupColor` | `'媒介作成_締日'` → `'#e8f5e9'` |
| `getCategoryGroupColor` | `'サイト登録依頼してください 5/1'` → `'#f3e5f5'`（プレフィックスマッチ） |
| `getCategoryGroupColor` | `'売買契約 依頼未 締日5/1 山田'` → `'#e3f2fd'`（プレフィックスマッチ） |
| `getCategoryGroupColor` | `'All'` → `undefined` |
| `getStatusCategories` | 空配列を渡した場合、`[{ label: 'All', count: 0 }]` のみ返ること |
| `getStatusCategories` | 返却リストの最初の要素が `All` であること |

### プロパティベーステスト

プロパティテストライブラリ: **fast-check**（TypeScript/JavaScript向け）

各プロパティテストは最低100回のイテレーションで実行する。

#### Property 1 テスト実装方針

```typescript
// Feature: business-list-sidebar-category-order, Property 1: カテゴリー表示順番の正確性
fc.assert(fc.property(
  fc.array(fc.record({ /* WorkTask の任意フィールド */ })),
  (tasks) => {
    const categories = getStatusCategories(tasks).filter(c => c.label !== 'All');
    for (let i = 0; i < categories.length - 1; i++) {
      const orderA = getCategoryOrder(categories[i].label);
      const orderB = getCategoryOrder(categories[i + 1].label);
      if (orderA > orderB) return false;
    }
    return true;
  }
), { numRuns: 100 });
```

#### Property 2 テスト実装方針

```typescript
// Feature: business-list-sidebar-category-order, Property 2: All エントリーの最上部表示
fc.assert(fc.property(
  fc.array(fc.record({ /* WorkTask の任意フィールド */ })),
  (tasks) => {
    const categories = getStatusCategories(tasks);
    return categories.length > 0 && categories[0].label === 'All';
  }
), { numRuns: 100 });
```

#### Property 3 テスト実装方針

```typescript
// Feature: business-list-sidebar-category-order, Property 3: 0件カテゴリーの非表示
fc.assert(fc.property(
  fc.array(fc.record({ /* WorkTask の任意フィールド */ })),
  (tasks) => {
    const categories = getStatusCategories(tasks).filter(c => c.label !== 'All');
    return categories.every(c => c.count >= 1);
  }
), { numRuns: 100 });
```

#### Property 4 テスト実装方針

```typescript
// Feature: business-list-sidebar-category-order, Property 4: プレフィックスマッチングによる背景色適用
fc.assert(fc.property(
  fc.constantFrom(...CATEGORY_ORDER),
  fc.string(),
  (prefix, suffix) => {
    const label = prefix + suffix;
    const color = getCategoryGroupColor(label);
    return color !== undefined;
  }
), { numRuns: 100 });
```

#### Property 6 テスト実装方針

```typescript
// Feature: business-list-sidebar-category-order, Property 6: カウントとフィルタリング結果の一致
fc.assert(fc.property(
  fc.array(fc.record({ /* WorkTask の任意フィールド */ })),
  (tasks) => {
    const categories = getStatusCategories(tasks).filter(c => c.label !== 'All');
    return categories.every(c => {
      const filtered = tasks.filter(c.filter);
      return filtered.length === c.count;
    });
  }
), { numRuns: 100 });
```

### 手動確認チェックリスト

- [ ] サイドバーの最上部に `All` が表示されること
- [ ] `媒介作成_締日` が最初のカテゴリーとして表示されること
- [ ] `保留` が最後のカテゴリーとして表示されること
- [ ] サイト登録関係（`サイト登録依頼してください`、`サイト依頼済み納品待ち`、`サイト登録要確認`）が紫系（`#f3e5f5`）で表示されること
- [ ] 売買契約関係（`売買契約 依頼未`、`売買契約　営業確認中`、`売買契約 入力待ち`、`売買契約 製本待ち`）が青系（`#e3f2fd`）で表示されること
- [ ] 各カテゴリーをクリックしたとき、表示されるタスク件数とバッジの件数が一致すること
- [ ] 0件のカテゴリーが表示されないこと

### 実装方法（エンコーディング保護）

`workTaskStatusUtils.ts` は日本語文字列を含むため、`file-encoding-protection.md` のルールに従い **Pythonスクリプトで変更を適用する**。

```python
# apply_category_order_change.py
with open('frontend/frontend/src/utils/workTaskStatusUtils.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CATEGORY_ORDER の変更
old_order = """const CATEGORY_ORDER = [
  '売買契約　営業確認中',
  '売買契約 入力待ち',
  'サイト登録依頼してください',
  '決済完了チャット送信未',
  '入金確認未',
  '要台帳作成',
  '売買契約 製本待ち',
  '売買契約 依頼未',
  'サイト依頼済み納品待ち',
  'サイト登録要確認',
  '媒介作成_締日',
  '保留',
];"""

new_order = """const CATEGORY_ORDER = [
  '媒介作成_締日',
  'サイト登録依頼してください',
  'サイト依頼済み納品待ち',
  'サイト登録要確認',
  '売買契約 依頼未',
  '売買契約　営業確認中',
  '売買契約 入力待ち',
  '売買契約 製本待ち',
  '要台帳作成',
  '決済完了チャット送信未',
  '入金確認未',
  '保留',
];"""

text = text.replace(old_order, new_order)

# CATEGORY_GROUP_COLORS の変更
old_colors = """const CATEGORY_GROUP_COLORS: [string, string][] = [
  ['売買契約　営業確認中',   '#e3f2fd'],
  ['売買契約 入力待ち',      '#e3f2fd'],
  ['売買契約 製本待ち',      '#e3f2fd'],
  ['売買契約 依頼未',        '#e3f2fd'],
  ['サイト登録依頼してください', '#f3e5f5'],
  ['サイト依頼済み納品待ち', '#f3e5f5'],
  ['サイト登録要確認',       '#f3e5f5'],
  ['決済完了チャット送信未', '#fff8e1'],
  ['入金確認未',             '#fff8e1'],
  ['媒介作成_締日',          '#e8f5e9'],
  ['要台帳作成',             '#fce4ec'],
  ['保留',                   '#f5f5f5'],
];"""

new_colors = """const CATEGORY_GROUP_COLORS: [string, string][] = [
  ['媒介作成_締日',              '#e8f5e9'],
  ['サイト登録依頼してください', '#f3e5f5'],
  ['サイト依頼済み納品待ち',     '#f3e5f5'],
  ['サイト登録要確認',           '#f3e5f5'],
  ['売買契約 依頼未',            '#e3f2fd'],
  ['売買契約　営業確認中',       '#e3f2fd'],
  ['売買契約 入力待ち',          '#e3f2fd'],
  ['売買契約 製本待ち',          '#e3f2fd'],
  ['要台帳作成',                 '#fce4ec'],
  ['決済完了チャット送信未',     '#fff8e1'],
  ['入金確認未',                 '#fff8e1'],
  ['保留',                       '#f5f5f5'],
];"""

text = text.replace(old_colors, new_colors)

with open('frontend/frontend/src/utils/workTaskStatusUtils.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
```
