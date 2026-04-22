# 設計書：業務詳細タブ自動切り替え

## 概要

業務一覧（`WorkTasksPage`）でカテゴリーをクリックして案件を開いた際に、選択中のカテゴリーに応じて `WorkTaskDetailModal` の表示タブを自動的に切り替える機能。

現状はモーダルが常にタブ 0（「媒介契約」タブ）で開くため、「サイト登録」や「契約決済」カテゴリーを選択した担当者が毎回手動でタブを切り替える必要がある。本機能により、カテゴリーに対応するタブが自動的に表示され、操作効率が向上する。

---

## アーキテクチャ

変更は純粋にフロントエンド（`frontend/frontend/src/`）のみ。バックエンドへの変更は不要。

```
WorkTasksPage
  ├── selectedCategory (state)
  ├── getInitialTabIndexFromCategory(category) → number  ← 新規追加
  ├── handleRowClick(task)
  │     └── getInitialTabIndexFromCategory(selectedCategory) を呼び出し
  │           → initialTabIndex として WorkTaskDetailModal に渡す
  └── WorkTaskDetailModal
        ├── initialTabIndex?: number  ← 新規プロパティ
        └── useEffect([open]) → tabIndex を initialTabIndex でリセット
```

データフロー：

```
カテゴリークリック
  → selectedCategory 更新
  → 行クリック
  → getInitialTabIndexFromCategory(selectedCategory)
  → initialTabIndex として WorkTaskDetailModal に渡す
  → useEffect(open 変化を監視) → setTabIndex(initialTabIndex)
```

---

## コンポーネントとインターフェース

### WorkTaskDetailModal のプロパティ変更

```typescript
interface WorkTaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  propertyNumber: string | null;
  onUpdate?: () => void;
  initialData?: Partial<WorkTaskData> | null;
  initialTabIndex?: number;  // 新規追加（省略可能、デフォルト 0）
}
```

### WorkTaskDetailModal 内の useEffect 追加

```typescript
// モーダルが開くたびに initialTabIndex でタブをリセット
useEffect(() => {
  if (open) {
    setTabIndex(initialTabIndex ?? 0);
  }
}, [open]);
```

既存の `useEffect([open, propertyNumber])` はデータ取得用であり、タブリセット用の `useEffect` は別途追加する。

### WorkTasksPage に追加する関数

```typescript
/**
 * カテゴリーキー文字列からタブインデックスを返す
 * - 「媒介」で始まる → 0（媒介契約タブ）
 * - 「サイト」で始まる → 1（サイト登録タブ）
 * - 「売買契約」「決済」「要台帳」で始まる → 2（契約決済タブ）
 * - それ以外（「all」含む）・null・空文字 → 0
 */
function getInitialTabIndexFromCategory(category: string | null): number {
  if (!category) return 0;
  if (category.startsWith('媒介')) return 0;
  if (category.startsWith('サイト')) return 1;
  if (
    category.startsWith('売買契約') ||
    category.startsWith('決済') ||
    category.startsWith('要台帳')
  ) return 2;
  return 0;
}
```

### handleRowClick の変更

```typescript
const handleRowClick = (task: WorkTask) => {
  setSelectedPropertyNumber(task.property_number);
  setSelectedTaskData(task);
  setInitialTabIndex(getInitialTabIndexFromCategory(selectedCategory)); // 新規
  setModalOpen(true);
};
```

`initialTabIndex` を state として保持し、`WorkTaskDetailModal` に渡す。

---

## データモデル

新規のデータモデル変更はなし。

`WorkTasksPage` に `initialTabIndex` state を追加する：

```typescript
const [initialTabIndex, setInitialTabIndex] = useState(0);
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性・振る舞いを形式的に記述したものです。プロパティは人間が読める仕様と機械検証可能な正確性保証の橋渡しとなります。*

### Property 1: カテゴリープレフィックスによるタブインデックスマッピング

*For any* カテゴリー文字列に対して、`getInitialTabIndexFromCategory` は以下のマッピングを常に返す：
- 「媒介」で始まる文字列 → 0
- 「サイト」で始まる文字列 → 1
- 「売買契約」「決済」「要台帳」で始まる文字列 → 2
- それ以外（null・空文字を含む） → 0

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.2, 3.3**

### Property 2: initialTabIndex でのタブ初期表示

*For any* 有効なタブインデックス（0〜3）を `initialTabIndex` として渡してモーダルを開いたとき、そのタブインデックスが選択された状態で表示される。

**Validates: Requirements 2.1, 2.2, 2.4**

### Property 3: モーダル再オープン時のタブリセット

*For any* 2 つの異なるタブインデックス `a` と `b` に対して、`initialTabIndex=a` でモーダルを開いて閉じ、`initialTabIndex=b` で再度開いたとき、表示されるタブインデックスは `b` である（前回の状態を引き継がない）。

**Validates: Requirements 2.3**

---

## エラーハンドリング

- `initialTabIndex` に 0〜3 の範囲外の値が渡された場合、MUI の `Tabs` コンポーネントが未選択状態になる可能性がある。ただし、`getInitialTabIndexFromCategory` は常に 0・1・2 のいずれかを返すため、通常の使用では発生しない。
- `selectedCategory` が `null` または空文字の場合、`getInitialTabIndexFromCategory` は 0 を返す（安全なデフォルト）。

---

## テスト戦略

### 単体テスト（例示テスト）

`getInitialTabIndexFromCategory` 関数に対して：

- `null` → 0
- `''`（空文字）→ 0
- `'all'` → 0
- `'媒介作成_締日'` → 0
- `'サイト登録依頼してください'` → 1
- `'売買契約締結'` → 2
- `'決済完了'` → 2
- `'要台帳登録'` → 2
- `'その他'` → 0

### プロパティテスト

プロパティテストライブラリとして **fast-check**（TypeScript/JavaScript 向け）を使用する。各プロパティテストは最低 100 回のイテレーションで実行する。

**Property 1 のテスト実装方針**:

```typescript
// Feature: business-detail-tab-auto-switch, Property 1: カテゴリープレフィックスによるタブインデックスマッピング
fc.assert(fc.property(
  fc.string().map(s => '媒介' + s),
  (category) => getInitialTabIndexFromCategory(category) === 0
));

fc.assert(fc.property(
  fc.string().map(s => 'サイト' + s),
  (category) => getInitialTabIndexFromCategory(category) === 1
));

fc.assert(fc.property(
  fc.oneof(
    fc.string().map(s => '売買契約' + s),
    fc.string().map(s => '決済' + s),
    fc.string().map(s => '要台帳' + s),
  ),
  (category) => getInitialTabIndexFromCategory(category) === 2
));
```

**Property 2・3 のテスト実装方針**:

React Testing Library を使用してコンポーネントレベルでテストする。`initialTabIndex` に任意の有効値（0〜3）を渡し、対応するタブが `aria-selected="true"` になっていることを検証する。

### 統合テスト（手動確認）

- 「サイト登録依頼してください」カテゴリーを選択 → 行クリック → タブ 1（「サイト登録」）が表示されることを確認
- 「売買契約締結」カテゴリーを選択 → 行クリック → タブ 2（「契約決済」）が表示されることを確認
- モーダルを閉じて別カテゴリーで再度開いたとき、タブがリセットされることを確認
- モーダルを開いた後に手動でタブを切り替えられることを確認
