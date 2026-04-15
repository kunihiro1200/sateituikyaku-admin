# 設計書：除外日設定時の査定方法自動選択

## 概要

CallModePage（`/sellers/:id/call`）において、「除外日にすること」フィールドにいずれかの値が選択されたとき、「査定方法」フィールドが空欄であれば自動的に「不要」を設定する機能を追加する。

この機能はフロントエンドのみの変更で完結する。既存の `handleValuationMethodChange` 関数を再利用することで、APIへの保存とUIへの即時反映を一貫して行う。

---

## アーキテクチャ

### 変更対象

- **フロントエンドのみ**: `frontend/frontend/src/pages/CallModePage.tsx`
- バックエンドへの変更は不要（既存の `PUT /api/sellers/:id` エンドポイントをそのまま利用）

### 変更の位置

「除外日にすること」ボタンの `onClick` ハンドラー内（行 7382〜7393 付近）に、査定方法の自動設定ロジックを追加する。

---

## コンポーネントとインターフェース

### 既存の関連状態

```typescript
// 除外日にすること（既存）
const [exclusionAction, setExclusionAction] = useState<string>('');

// 査定方法（既存）
const [editedValuationMethod, setEditedValuationMethod] = useState<string>('');
const [savingValuationMethod, setSavingValuationMethod] = useState(false);
```

### 既存の関連ハンドラー

```typescript
// 査定方法更新ハンドラー（既存 - 再利用する）
const handleValuationMethodChange = async (method: string) => {
  // API呼び出し + ローカル状態更新
};
```

### 変更箇所：exclusionAction の onClick ハンドラー

現在の実装（抜粋）:

```typescript
onClick={() => {
  const value = exclusionAction === option ? '' : option;
  setExclusionAction(value);
  if (value) {
    // 次電日の自動設定ロジック（既存）
    if (seller?.site === 'H' && seller?.inquiryDate) {
      ...
    } else if (exclusionDate) {
      setEditedNextCallDate(exclusionDate);
    }
  }
  setStatusChanged(true);
  statusChangedRef.current = true;
}}
```

変更後（追加するロジック）:

```typescript
onClick={() => {
  const value = exclusionAction === option ? '' : option;
  setExclusionAction(value);
  if (value) {
    // 【新規追加】査定方法が空欄の場合のみ「不要」を自動設定
    if (!editedValuationMethod) {
      handleValuationMethodChange('不要');
    }
    // 次電日の自動設定ロジック（既存）
    if (seller?.site === 'H' && seller?.inquiryDate) {
      ...
    } else if (exclusionDate) {
      setEditedNextCallDate(exclusionDate);
    }
  }
  setStatusChanged(true);
  statusChangedRef.current = true;
}}
```

---

## データモデル

### 変更なし

既存のデータモデルをそのまま使用する。

| フィールド | DB カラム | 型 | 説明 |
|---|---|---|---|
| `exclusionAction` | `exclusion_action` | `string` | 除外日にすること（「除外日に不通であれば除外」「除外日になにもせず除外」） |
| `editedValuationMethod` | `valuation_method` | `string` | 査定方法（「机上査定（メール希望）」「机上査定（不通）」「机上査定（郵送）」「机上査定（電話）」「不要」） |

### 自動設定の条件

| 条件 | 動作 |
|---|---|
| `value !== ''` かつ `editedValuationMethod === ''` | `handleValuationMethodChange('不要')` を呼び出す |
| `value !== ''` かつ `editedValuationMethod !== ''` | 何もしない（既存値を保持） |
| `value === ''`（解除） | 何もしない（査定方法を変更しない） |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 査定方法が空欄の場合、除外日アクション選択で「不要」が自動設定される

*For any* 「除外日にすること」の選択肢（「除外日に不通であれば除外」「除外日になにもせず除外」）と、査定方法が空欄の状態において、選択操作を行うと査定方法が「不要」に設定される。

**Validates: Requirements 1.1, 1.5**

### Property 2: 査定方法に既存値がある場合、除外日アクション選択で値が変更されない

*For any* 「除外日にすること」の選択肢と、任意の既存査定方法値（「机上査定（メール希望）」「机上査定（不通）」「机上査定（郵送）」「机上査定（電話）」「不要」）の組み合わせにおいて、選択操作を行っても査定方法は変更されない。

**Validates: Requirements 1.2**

### Property 3: 除外日アクション解除時、査定方法は変更されない

*For any* 査定方法の状態（空欄または設定済み）において、「除外日にすること」を解除（空欄に戻す）操作を行っても査定方法は変更されない。

**Validates: Requirements 1.3**

---

## エラーハンドリング

### API呼び出し失敗時

`handleValuationMethodChange` は既存の try/catch を持っており、失敗時は `setError` でエラーメッセージを表示する。自動設定の場合も同じエラーハンドリングが適用される。

```typescript
} catch (err: any) {
  setError(err.response?.data?.error?.message || '査定方法の更新に失敗しました');
} finally {
  setSavingValuationMethod(false);
}
```

### 競合状態

`handleValuationMethodChange` は `savingValuationMethod` フラグで保存中の状態を管理している。自動設定の呼び出しも同じフラグを使用するため、二重送信は防止される。

---

## テスト戦略

### ユニットテスト（例ベース）

- 「除外日にすること」選択時に査定方法が空欄の場合、`handleValuationMethodChange('不要')` が呼ばれること（要件 1.4）
- 「除外日にすること」選択時に査定方法が設定済みの場合、`handleValuationMethodChange` が呼ばれないこと（要件 1.2）
- 「除外日にすること」解除時（value = ''）に `handleValuationMethodChange` が呼ばれないこと（要件 1.3）

### プロパティベーステスト

対象言語: TypeScript  
ライブラリ: [fast-check](https://github.com/dubzzz/fast-check)（既存プロジェクトで使用中）  
最小実行回数: 100回/プロパティ

**Property 1: 査定方法が空欄の場合の自動設定**

```typescript
// Feature: seller-exclusion-date-assessment-auto-select, Property 1: 査定方法が空欄の場合、除外日アクション選択で「不要」が自動設定される
fc.assert(
  fc.property(
    fc.constantFrom('除外日に不通であれば除外', '除外日になにもせず除外'),
    (exclusionOption) => {
      // 査定方法が空欄の状態でexclusionActionを選択
      const result = applyAutoValuationMethod(exclusionOption, '');
      expect(result).toBe('不要');
    }
  )
);
```

**Property 2: 査定方法に既存値がある場合は変更しない**

```typescript
// Feature: seller-exclusion-date-assessment-auto-select, Property 2: 査定方法に既存値がある場合、除外日アクション選択で値が変更されない
fc.assert(
  fc.property(
    fc.constantFrom('除外日に不通であれば除外', '除外日になにもせず除外'),
    fc.constantFrom('机上査定（メール希望）', '机上査定（不通）', '机上査定（郵送）', '机上査定（電話）', '不要'),
    (exclusionOption, existingMethod) => {
      const result = applyAutoValuationMethod(exclusionOption, existingMethod);
      expect(result).toBe(existingMethod);
    }
  )
);
```

**Property 3: 解除時は査定方法を変更しない**

```typescript
// Feature: seller-exclusion-date-assessment-auto-select, Property 3: 除外日アクション解除時、査定方法は変更されない
fc.assert(
  fc.property(
    fc.constantFrom('', '机上査定（メール希望）', '机上査定（不通）', '机上査定（郵送）', '机上査定（電話）', '不要'),
    (currentMethod) => {
      // value = '' は解除を意味する
      const result = applyAutoValuationMethod('', currentMethod);
      expect(result).toBe(currentMethod);
    }
  )
);
```

### テスト対象の純粋関数

プロパティテストのために、自動設定ロジックを純粋関数として抽出する：

```typescript
/**
 * 除外日アクション選択時の査定方法自動設定ロジック
 * @param newExclusionAction 新しい除外日アクション値（''は解除）
 * @param currentValuationMethod 現在の査定方法値
 * @returns 更新後の査定方法値
 */
export function applyAutoValuationMethod(
  newExclusionAction: string,
  currentValuationMethod: string
): string {
  // 解除時または査定方法が設定済みの場合は変更しない
  if (!newExclusionAction || currentValuationMethod) {
    return currentValuationMethod;
  }
  // 査定方法が空欄の場合のみ「不要」を設定
  return '不要';
}
```

### 統合テスト

- CallModePageをレンダリングし、「除外日にすること」ボタンをクリックしたとき、「不要」ボタンがハイライト（`variant="contained"`）されることを確認
- APIモックを使用して `PUT /api/sellers/:id` が `{ valuationMethod: '不要' }` で呼ばれることを確認
