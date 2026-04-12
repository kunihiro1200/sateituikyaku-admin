# 技術設計書: seller-followup-navigation-block

## 概要

売主リストの通話モードページ（CallModePage）において、「状況（当社）」フィールドに「追客中」が含まれる場合、「次電日」フィールドを必須入力とし、未入力のまま別ページへ遷移することを完全にブロックする機能を追加する。

既存の `navigationWarningDialog`（確度未入力警告・1番電話未入力警告）は「このまま移動する」ボタンで遷移を許可するが、本機能では遷移を完全にブロックし、次電日を入力するまで他のページへ移動できないようにする。

## アーキテクチャ

### 変更対象ファイル

```
frontend/frontend/src/
├── components/
│   └── NavigationBlockDialog.tsx   ← 新規作成
└── pages/
    └── CallModePage.tsx             ← 既存ファイルに追加
```

### 設計方針

- `NavigationBlockDialog` を独立したコンポーネントとして新規作成する
- `CallModePage` に遷移ブロックロジックを追加する
- 既存の `navigateWithWarningCheck` 関数を拡張し、次電日ブロックを最優先チェックとして追加する
- ブラウザ戻るボタン対応には `window.history.pushState` + `popstate` イベントを使用する
- Escキー対応は既存の `handleKeyDown` useEffect を修正する

### 遷移ブロックの優先順位

```
1. 次電日ブロック（NavigationBlockDialog）← 新規・最優先
2. 確度未入力警告（navigationWarningDialog）← 既存
3. 1番電話未入力警告（navigationWarningDialog）← 既存
4. 遷移許可
```

## コンポーネントとインターフェース

### NavigationBlockDialog（新規）

```tsx
interface NavigationBlockDialogProps {
  open: boolean;
  onGoToNextCallDate: () => void; // 「次電日を入力する」ボタンのコールバック
}
```

- `open`: ダイアログの表示状態
- `onGoToNextCallDate`: 次電日フィールドへのフォーカス移動処理
- 「このまま移動する」ボタンは提供しない（遷移を許可するボタンなし）
- `onClose` プロップは持たない（Dialogの `onClose` も無効化する）

### CallModePage への追加

#### 新規 state

```tsx
const [navigationBlockDialog, setNavigationBlockDialog] = useState<{
  open: boolean;
}>({ open: false });
```

#### 新規ヘルパー関数

```tsx
// 追客中かつ次電日未入力かどうかを判定
const shouldBlockNavigation = (): boolean => {
  const isFollowingUp = seller?.status?.includes('追客中') ?? false;
  const hasNextCallDate = !!editedNextCallDate;
  return isFollowingUp && !hasNextCallDate;
};
```

#### 既存関数の変更

`handleBack` および `navigateWithWarningCheck` の先頭に次電日ブロックチェックを追加する。

```tsx
// 変更前: 確度チェックから始まる
// 変更後: 次電日ブロックチェックを最初に実行
if (shouldBlockNavigation()) {
  setNavigationBlockDialog({ open: true });
  return;
}
// 以降は既存の確度・1番電話チェック
```

#### ブラウザ戻るボタン対応

```tsx
useEffect(() => {
  // ダミーのhistoryエントリを追加してブラウザ戻るボタンをキャプチャ
  window.history.pushState(null, '', window.location.href);
  
  const handlePopState = () => {
    if (shouldBlockNavigation()) {
      // ブラウザ戻るボタンを無効化（再度pushStateで戻す）
      window.history.pushState(null, '', window.location.href);
      setNavigationBlockDialog({ open: true });
    } else {
      // 遷移を許可（navigateWithWarningCheckを経由）
      navigateWithWarningCheck(() => navigate('/sellers'));
    }
  };
  
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [seller?.status, editedNextCallDate]);
```

#### Escキー対応

既存の `handleKeyDown` useEffect を修正する。

```tsx
// 変更前
if (e.key === 'Escape') {
  e.preventDefault();
  handleBack();
}

// 変更後（handleBack内でブロックチェックが行われるため変更不要）
// handleBack() が shouldBlockNavigation() を呼ぶため、自動的にブロックされる
```

#### 次電日フィールドへのフォーカス移動

既存の `nextCallDateRef` を使用する。

```tsx
const handleGoToNextCallDate = () => {
  setNavigationBlockDialog({ open: false });
  // 次電日フィールドへスクロール＆フォーカス
  nextCallDateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  nextCallDateRef.current?.focus();
};
```

### PageNavigation コンポーネントの対応

`PageNavigation` は `onNavigate` プロップを受け取り、CallModePageから `navigateWithWarningCheck` を渡す。

```tsx
// CallModePage内
<PageNavigation
  onNavigate={(path) => navigateWithWarningCheck(() => navigate(path))}
/>
```

### SellerStatusSidebar コンポーネントの対応

`SellerStatusSidebar` の `handleSellerClick` は `navigate()` を直接呼ぶため、CallModePageから遷移ハンドラーを渡す必要がある。

```tsx
// SellerStatusSidebarProps に追加
onSellerNavigate?: (sellerId: string) => void;

// CallModePage内
<SellerStatusSidebar
  onSellerNavigate={(sellerId) =>
    navigateWithWarningCheck(() => navigate(`/sellers/${sellerId}/call`))
  }
/>
```

## データモデル

### 判定ロジック

```
isFollowingUp(status: string): boolean
  = status.includes('追客中')

shouldBlockNavigation(status: string, nextCallDate: string): boolean
  = isFollowingUp(status) && nextCallDate === ''
```

### 状態遷移

```
[追客中 + 次電日未入力] → 遷移試行 → NavigationBlockDialog表示 → 次電日入力 → 遷移許可
[追客中 + 次電日入力済] → 遷移試行 → 既存の確度/1番電話チェック → 遷移
[追客中以外]            → 遷移試行 → 既存の確度/1番電話チェック → 遷移
```

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性または振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述である。*

### Property 1: 追客中判定の部分一致

*For any* 文字列 v において、`isFollowingUp(v)` が true を返す場合かつその場合に限り、v に「追客中」が含まれること。

**Validates: Requirements 1.1, 1.3, 1.4**

### Property 2: 遷移ブロック条件の完全性

*For any* 状況（当社）の値 v と次電日の値 d において、`shouldBlockNavigation(v, d)` の結果は `v.includes('追客中') && d === ''` と等しいこと。

**Validates: Requirements 2.1, 5.4**

### Property 3: 次電日ブロックの優先順位

*For any* 売主状態（追客中 + 次電日未入力 + 確度未入力）において、`getNavigationBlockType()` は `'nextCallDate'` を返し、`'confidence'` や `'firstCall'` を返さないこと。

**Validates: Requirements 4.1, 4.3**

## エラーハンドリング

- `nextCallDateRef.current` が null の場合（DOMが未マウント）: フォーカス移動をスキップし、ダイアログのみ閉じる
- `seller` が null の場合: `shouldBlockNavigation()` は false を返す（ブロックしない）
- `popstate` イベントが連続して発火した場合: `shouldBlockNavigation()` の結果に基づいて毎回判定する

## テスト戦略

### ユニットテスト（example-based）

- `NavigationBlockDialog` のレンダリング: 「このまま移動する」ボタンが存在しないこと
- `NavigationBlockDialog` のレンダリング: 「次電日を入力する」ボタンが存在すること
- `NavigationBlockDialog` のレンダリング: 適切なメッセージが表示されること
- `handleGoToNextCallDate`: `scrollIntoView` と `focus` が呼ばれること

### プロパティベーステスト（property-based）

プロパティベーステストには **fast-check**（TypeScript/JavaScript向けPBTライブラリ）を使用する。各テストは最低100回のイテレーションで実行する。

#### Property 1 のテスト

```typescript
// Feature: seller-followup-navigation-block, Property 1: 追客中判定の部分一致
it('isFollowingUp: 任意の文字列に対して部分一致判定が正確であること', () => {
  fc.assert(
    fc.property(fc.string(), (v) => {
      expect(isFollowingUp(v)).toBe(v.includes('追客中'));
    }),
    { numRuns: 100 }
  );
});
```

#### Property 2 のテスト

```typescript
// Feature: seller-followup-navigation-block, Property 2: 遷移ブロック条件の完全性
it('shouldBlockNavigation: 任意のstatus/nextCallDateに対してブロック条件が正確であること', () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), (v, d) => {
      expect(shouldBlockNavigation(v, d)).toBe(v.includes('追客中') && d === '');
    }),
    { numRuns: 100 }
  );
});
```

#### Property 3 のテスト

```typescript
// Feature: seller-followup-navigation-block, Property 3: 次電日ブロックの優先順位
it('getNavigationBlockType: 追客中+次電日未入力の場合は常にnextCallDateを返すこと', () => {
  fc.assert(
    fc.property(
      fc.string().filter(s => s.includes('追客中')), // 追客中を含む任意のstatus
      fc.string().filter(s => s === ''),              // 空の次電日
      fc.string(),                                    // 任意の確度
      fc.string(),                                    // 任意の1番電話
      (status, nextCallDate, confidence, firstCallPerson) => {
        expect(getNavigationBlockType(status, nextCallDate, confidence, firstCallPerson))
          .toBe('nextCallDate');
      }
    ),
    { numRuns: 100 }
  );
});
```

### 統合テスト

- `handleBack` 呼び出し時に追客中+次電日未入力の場合、`NavigationBlockDialog` が表示されること
- `navigateWithWarningCheck` 呼び出し時に追客中+次電日未入力の場合、遷移がブロックされること
- `PageNavigation` の各ボタンクリック時に遷移ブロックが機能すること
- `SellerStatusSidebar` の売主クリック時に遷移ブロックが機能すること
