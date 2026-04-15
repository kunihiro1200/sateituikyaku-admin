# 設計書：買主内覧結果ページ機能拡張

## 概要

`BuyerViewingResultPage`（`/buyers/:buyer_number/viewing`）に対して、以下の3つの機能を追加する。

1. 後続担当ボタン群の末尾に「業者」ボタンを追加し、カレンダー送信先を `tenant@ifoo-oita.com` に設定する
2. 内覧日（最新）に日付が入力されたとき、時間・内覧形態・後続担当を必須として視覚的に強調表示する
3. 必須4項目（内覧日・時間・内覧形態・後続担当）がすべて入力された場合のみ「カレンダーで開く」ボタンを有効化する

---

## アーキテクチャ

変更はフロントエンドのみ。バックエンドへの変更は不要。

```
frontend/frontend/src/pages/BuyerViewingResultPage.tsx
```

変更対象は1ファイルのみ。既存の `handleCalendarButtonClick` 関数と後続担当ボタン群のJSXを修正する。

---

## コンポーネントとインターフェース

### 変更対象コンポーネント

`BuyerViewingResultPage` 内の以下の部分を変更する。

#### 1. 後続担当ボタン群（JSX）

現在の実装：`staffInitials` の配列をマップしてボタンを生成している。

変更後：配列の末尾に「業者」ボタンを追加する。「業者」ボタンは他のボタンと同じトグル動作（選択済みで再クリックするとクリア）を持つ。

```tsx
{/* 業者ボタン（末尾に追加） */}
<Button
  variant={buyer.follow_up_assignee === '業者' ? 'contained' : 'outlined'}
  color="warning"
  size="small"
  onClick={async () => {
    const newValue = buyer.follow_up_assignee === '業者' ? '' : '業者';
    setBuyer(prev => prev ? { ...prev, follow_up_assignee: newValue } : prev);
    buyerRef.current = buyer ? { ...buyer, follow_up_assignee: newValue } : null;
    try {
      await handleInlineFieldSave('follow_up_assignee', newValue);
    } catch (error) {
      setBuyer(prev => prev ? { ...prev, follow_up_assignee: buyer.follow_up_assignee } : prev);
      buyerRef.current = buyer;
    }
  }}
  sx={{ minWidth: '32px', padding: '2px 6px', fontSize: '0.7rem' }}
>
  業者
</Button>
```

#### 2. `handleCalendarButtonClick` 関数

現在の実装：`follow_up_assignee` の値で従業員マスタを検索し、メールアドレスを取得する。

変更後：`follow_up_assignee === '業者'` の場合は従業員マスタ検索をスキップし、`tenant@ifoo-oita.com` を直接使用する。

```typescript
// 業者の場合は直接メールアドレスを設定
if (followUpAssignee === '業者') {
  assignedEmail = 'tenant@ifoo-oita.com';
} else {
  // 既存の従業員マスタ検索ロジック
  // ...
}
```

#### 3. カレンダーボタン有効/無効の判定ロジック

現在の実装：`buyer.viewing_date` が存在する場合にボタンを表示し、`shouldHighlight` フラグで見た目を変えている。

変更後：`isCalendarEnabled` という計算値を導入し、4条件がすべて揃った場合のみボタンを有効化する。

```typescript
// カレンダーボタン有効化条件
const viewingTypeValue =
  (linkedProperties?.[0]?.atbb_status?.includes('専任') ? buyer?.viewing_mobile : null) ||
  (linkedProperties?.[0]?.atbb_status?.includes('一般') ? buyer?.viewing_type_general : null) ||
  buyer?.viewing_mobile ||
  buyer?.viewing_type_general;

const isCalendarEnabled = !!(
  buyer?.viewing_date &&
  buyer?.viewing_time &&
  buyer?.follow_up_assignee &&
  viewingTypeValue
);
```

#### 4. 必須強調表示ロジック

内覧日が入力されている場合、各フィールドの必須強調表示を制御する計算値を追加する。

```typescript
const hasViewingDate = !!(buyer?.viewing_date && buyer.viewing_date.trim() !== '');
const isTimeRequired = hasViewingDate && !(buyer?.viewing_time && buyer.viewing_time.trim() !== '');
const isViewingTypeRequired = hasViewingDate && !viewingTypeValue;
const isFollowUpRequired = hasViewingDate && !(buyer?.follow_up_assignee && buyer.follow_up_assignee.trim() !== '');
```

---

## データモデル

既存の `buyer` オブジェクトのフィールドをそのまま使用する。新規フィールドの追加は不要。

| フィールド | 型 | 用途 |
|---|---|---|
| `follow_up_assignee` | `string \| null` | 後続担当。`'業者'` を新たな有効値として扱う |
| `viewing_date` | `string \| null` | 内覧日（最新）。必須判定のトリガー |
| `viewing_time` | `string \| null` | 内覧時間。必須3項目の1つ |
| `viewing_mobile` | `string \| null` | 内覧形態（専任物件用）。必須3項目の1つ |
| `viewing_type_general` | `string \| null` | 内覧形態（一般媒介物件用）。必須3項目の1つ |

---

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性または振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1：4条件が揃った場合のみカレンダーボタンが有効になる

*任意の* `viewing_date`・`viewing_time`・`follow_up_assignee`・内覧形態の組み合わせに対して、4つすべてが非空の場合かつその場合のみ `isCalendarEnabled` が `true` になる。

**Validates: Requirements 3.1, 3.2**

### プロパティ2：内覧形態の参照フィールドは物件種別に依存する

*任意の* 物件種別（専任・一般）と内覧形態フィールドの値の組み合わせに対して、専任物件の場合は `viewing_mobile`、一般媒介物件の場合は `viewing_type_general` を参照してカレンダーボタンの有効/無効が決まる。

**Validates: Requirements 3.5**

---

## エラーハンドリング

### 「業者」選択時のカレンダー処理

- `follow_up_assignee === '業者'` の場合、従業員マスタ検索を完全にスキップする
- `tenant@ifoo-oita.com` を直接 `assignedEmail` に設定する
- 従業員マスタに「業者」が存在しないことによるエラーメッセージは表示しない

### カレンダーボタン無効時のクリック防止

- `disabled` プロパティを使用してボタンを無効化する
- 無効状態では `onClick` ハンドラーが呼ばれないため、追加のガード処理は不要

---

## テスト戦略

### ユニットテスト（例ベース）

以下の具体的なシナリオをテストする。

1. 「業者」ボタンをクリックすると `follow_up_assignee` が `'業者'` になる
2. 「業者」が選択済みの状態で再クリックすると `follow_up_assignee` が空文字になる
3. `follow_up_assignee === '業者'` の状態でカレンダーボタンをクリックすると `tenant@ifoo-oita.com` がURLに含まれる
4. `viewing_date` が設定されると時間・内覧形態・後続担当に赤枠・赤ラベルが表示される
5. `viewing_date` が空の場合、必須強調表示が表示されない
6. 各必須フィールドが入力されると対応する強調表示が解除される
7. カレンダーボタンが無効の場合、グレーアウトスタイルが適用される
8. カレンダーボタンが有効の場合、`calendarPulse` アニメーションが適用される

### プロパティベーステスト

PBTライブラリ：`fast-check`（TypeScript/React プロジェクトの標準的な選択）

各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1のテスト実装方針

```typescript
// Feature: buyer-viewing-result-enhancements, Property 1: 4条件が揃った場合のみカレンダーボタンが有効になる
fc.assert(fc.property(
  fc.record({
    viewing_date: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
    viewing_time: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
    follow_up_assignee: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
    viewing_mobile: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
    viewing_type_general: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
  }),
  (buyer) => {
    const viewingTypeValue = buyer.viewing_mobile || buyer.viewing_type_general;
    const expected = !!(buyer.viewing_date && buyer.viewing_time && buyer.follow_up_assignee && viewingTypeValue);
    const actual = isCalendarEnabled(buyer);
    return actual === expected;
  }
), { numRuns: 100 });
```

#### プロパティ2のテスト実装方針

```typescript
// Feature: buyer-viewing-result-enhancements, Property 2: 内覧形態の参照フィールドは物件種別に依存する
fc.assert(fc.property(
  fc.record({
    atbb_status: fc.oneof(fc.constant('専任媒介'), fc.constant('一般媒介'), fc.constant('')),
    viewing_mobile: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
    viewing_type_general: fc.oneof(fc.constant(''), fc.string({ minLength: 1 })),
  }),
  ({ atbb_status, viewing_mobile, viewing_type_general }) => {
    const result = getViewingTypeValue(atbb_status, viewing_mobile, viewing_type_general);
    if (atbb_status.includes('専任')) return result === viewing_mobile;
    if (atbb_status.includes('一般')) return result === viewing_type_general;
    return true; // どちらでもない場合はどちらでもよい
  }
), { numRuns: 100 });
```

### 統合テスト

- 実際のAPIを呼び出して `follow_up_assignee` が `'業者'` で保存・取得できることを確認する（1例）
