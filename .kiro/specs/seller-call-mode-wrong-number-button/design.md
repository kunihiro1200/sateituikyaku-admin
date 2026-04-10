# 設計書: 電話番号間違いボタン（seller-call-mode-wrong-number-button）

## 概要

売主リスト通話モードページ（`/sellers/:id/call`）の「Email送信確認」ダイアログに「電話番号間違い」ボタンを追加する。

対象テンプレート（「査定額案内メール」系・「不通で電話時間確認」系）を選択した際にボタンが表示され、押下するとメール本文中の「いふうです。」または「"いふう"です。」の直後に電話番号間違い確認文を自動挿入する。

バックエンド変更は不要。フロントエンドのみの変更。

---

## アーキテクチャ

変更対象は1ファイルのみ。

```
frontend/frontend/src/pages/CallModePage.tsx
```

### 変更の概要

1. **state追加**: `wrongNumberButtonDisabled` (boolean) — ボタンの無効化状態を管理
2. **純粋関数追加**: `isTargetTemplateForWrongNumber(label)` — 対象テンプレート判定
3. **純粋関数追加**: `generateWrongNumberText(phoneNumber)` — 挿入文生成
4. **純粋関数追加**: `insertWrongNumberText(body, insertionText)` — 本文への挿入
5. **ハンドラー追加**: `handleWrongNumberButtonClick()` — ボタン押下時の処理
6. **JSX追加**: 「電話番号間違い」ボタンをダイアログ内の「画像を添付」ボタンの下・Alertの上に配置

---

## コンポーネントとインターフェース

### 純粋関数

#### `isTargetTemplateForWrongNumber(label: string): boolean`

対象テンプレートかどうかを判定する。

```typescript
export function isTargetTemplateForWrongNumber(label: string): boolean {
  return label.includes('査定額案内メール') || label.includes('不通で電話時間確認');
}
```

#### `generateWrongNumberText(phoneNumber: string | null | undefined): string`

挿入文を生成する。電話番号が空・未設定の場合は「（電話番号未登録）」を使用する。

```typescript
export function generateWrongNumberText(phoneNumber: string | null | undefined): string {
  const phone = phoneNumber && phoneNumber.trim() !== '' 
    ? phoneNumber 
    : '（電話番号未登録）';
  return `ご登録いただいている電話番号${phone}が別の方？のようですので、正確な番号を教えて頂ければ助かります。`;
}
```

#### `insertWrongNumberText(body: string, insertionText: string): string`

本文中のトリガー文字列の直後に `<br>` + 挿入文を追加する。

- トリガー1: `いふうです。`
- トリガー2: `"いふう"です。`
- 両方存在する場合: 最初に出現する方の直後に挿入
- どちらも存在しない場合: 本文末尾に追加

```typescript
export function insertWrongNumberText(body: string, insertionText: string): string {
  const trigger1 = 'いふうです。';
  const trigger2 = '"いふう"です。';

  const idx1 = body.indexOf(trigger1);
  const idx2 = body.indexOf(trigger2);

  let insertPos = -1;
  let triggerLength = 0;

  if (idx1 !== -1 && idx2 !== -1) {
    // 両方存在する場合は最初に出現する方
    if (idx1 <= idx2) {
      insertPos = idx1 + trigger1.length;
    } else {
      insertPos = idx2 + trigger2.length;
    }
  } else if (idx1 !== -1) {
    insertPos = idx1 + trigger1.length;
  } else if (idx2 !== -1) {
    insertPos = idx2 + trigger2.length;
  }

  const insertion = `<br>${insertionText}`;

  if (insertPos === -1) {
    // トリガーが存在しない場合は末尾に追加
    return body + insertion;
  }

  return body.slice(0, insertPos) + insertion + body.slice(insertPos);
}
```

### ハンドラー

#### `handleWrongNumberButtonClick()`

```typescript
const handleWrongNumberButtonClick = () => {
  const insertionText = generateWrongNumberText(seller?.phoneNumber);
  const newBody = insertWrongNumberText(editableEmailBody, insertionText);
  setEditableEmailBody(newBody);
  setWrongNumberButtonDisabled(true);
};
```

### state

```typescript
const [wrongNumberButtonDisabled, setWrongNumberButtonDisabled] = useState(false);
```

ダイアログが閉じられる際（`handleCancelSend` / 送信完了後）にリセットする。

---

## データモデル

新規のデータモデルは不要。既存の state を利用する。

| state | 型 | 用途 |
|---|---|---|
| `editableEmailBody` | `string` | 編集可能なメール本文（HTML文字列） |
| `confirmDialog.template.label` | `string` | 対象テンプレート判定に使用 |
| `seller.phoneNumber` | `string \| undefined` | 挿入文の電話番号部分 |
| `wrongNumberButtonDisabled` | `boolean` | ボタンの無効化状態（新規追加） |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: 対象テンプレート判定の正確性

*任意の* ラベル文字列に対して、`isTargetTemplateForWrongNumber(label)` は「査定額案内メール」または「不通で電話時間確認」を含む場合にのみ `true` を返す。

**Validates: Requirements 1.1, 1.2, 1.3**

### プロパティ2: 挿入文の電話番号置換

*任意の* 非空の電話番号文字列に対して、`generateWrongNumberText(phoneNumber)` は「●●●●～」を含まず、その電話番号を含む文字列を返す。

**Validates: Requirements 2.2**

### プロパティ3: 未設定電話番号のフォールバック

*任意の* 空文字列・null・undefinedに対して、`generateWrongNumberText(phoneNumber)` は「（電話番号未登録）」を含む文字列を返す。

**Validates: Requirements 2.3**

### プロパティ4: トリガー直後への挿入

*任意の* 「いふうです。」または「"いふう"です。」を含むHTML本文と挿入文に対して、`insertWrongNumberText(body, insertionText)` はトリガー文字列の直後に `<br>` + 挿入文を追加した文字列を返す。

**Validates: Requirements 2.1, 2.7**

### プロパティ5: 最初のトリガーへの挿入

*任意の* 両方のトリガーを含むHTML本文に対して、`insertWrongNumberText(body, insertionText)` は最初に出現するトリガーの直後に挿入する。

**Validates: Requirements 2.4**

### プロパティ6: トリガー不在時の末尾挿入

*任意の* トリガーを含まないHTML本文に対して、`insertWrongNumberText(body, insertionText)` は本文末尾に挿入文を追加する。

**Validates: Requirements 2.5**

### プロパティ7: 他フィールドへの非干渉

*任意の* 送信先・件名の状態において、`handleWrongNumberButtonClick()` を呼び出しても `editableEmailRecipient` と `editableEmailSubject` は変更されない。

**Validates: Requirements 3.2**

---

## エラーハンドリング

| ケース | 対応 |
|---|---|
| `seller.phoneNumber` が null / undefined / 空文字 | 「（電話番号未登録）」で代替（要件2.3） |
| `editableEmailBody` が空文字 | トリガーが存在しないため末尾に挿入（要件2.5の自然な動作） |
| ボタンの2回押し | `wrongNumberButtonDisabled` で防止（要件2.6） |

---

## テスト戦略

### PBT適用判断

本機能の中核ロジック（`isTargetTemplateForWrongNumber`、`generateWrongNumberText`、`insertWrongNumberText`）は純粋関数であり、入力の変化によって動作が変わるため、プロパティベーステスト（PBT）が適切。

使用ライブラリ: **fast-check**（TypeScript/JavaScript向けPBTライブラリ）

### ユニットテスト（例示テスト）

- 「画像を添付」ボタンの下・Alertの上にボタンが配置されること（要件1.4）
- ボタンクリック後に `disabled` になること（要件2.6）
- ボタンクリック後に `editableEmailBody` が更新されること（要件3.1）

### プロパティテスト（fast-check）

各テストは最低100回のイテレーションで実行する。

```typescript
// Feature: seller-call-mode-wrong-number-button, Property 1: 対象テンプレート判定の正確性
fc.assert(fc.property(
  fc.string(),
  (label) => {
    const result = isTargetTemplateForWrongNumber(label);
    const expected = label.includes('査定額案内メール') || label.includes('不通で電話時間確認');
    return result === expected;
  }
), { numRuns: 100 });

// Feature: seller-call-mode-wrong-number-button, Property 2: 挿入文の電話番号置換
fc.assert(fc.property(
  fc.string({ minLength: 1 }).filter(s => s.trim() !== ''),
  (phoneNumber) => {
    const result = generateWrongNumberText(phoneNumber);
    return result.includes(phoneNumber) && !result.includes('●●●●～');
  }
), { numRuns: 100 });

// Feature: seller-call-mode-wrong-number-button, Property 3: 未設定電話番号のフォールバック
fc.assert(fc.property(
  fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined), fc.string().filter(s => s.trim() === '')),
  (phoneNumber) => {
    const result = generateWrongNumberText(phoneNumber as any);
    return result.includes('（電話番号未登録）');
  }
), { numRuns: 100 });

// Feature: seller-call-mode-wrong-number-button, Property 4: トリガー直後への挿入
fc.assert(fc.property(
  fc.string(),
  fc.constantFrom('いふうです。', '"いふう"です。'),
  fc.string(),
  fc.string({ minLength: 1 }),
  (prefix, trigger, suffix, insertionText) => {
    const body = prefix + trigger + suffix;
    const result = insertWrongNumberText(body, insertionText);
    const triggerIdx = body.indexOf(trigger);
    const afterTrigger = body.slice(0, triggerIdx + trigger.length) + `<br>${insertionText}`;
    return result.startsWith(afterTrigger);
  }
), { numRuns: 100 });

// Feature: seller-call-mode-wrong-number-button, Property 6: トリガー不在時の末尾挿入
fc.assert(fc.property(
  fc.string().filter(s => !s.includes('いふうです。') && !s.includes('"いふう"です。')),
  fc.string({ minLength: 1 }),
  (body, insertionText) => {
    const result = insertWrongNumberText(body, insertionText);
    return result === body + `<br>${insertionText}`;
  }
), { numRuns: 100 });
```

### 統合テスト

- 対象テンプレートを選択した際にボタンが表示されること
- 非対象テンプレートを選択した際にボタンが表示されないこと
- ダイアログを閉じて再度開いた際にボタンが有効状態に戻ること
