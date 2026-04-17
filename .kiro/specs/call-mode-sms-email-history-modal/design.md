# 設計ドキュメント: CallModePage SMS・メール送信履歴モーダル表示機能

## 概要

CallModePageのサイドバーに表示される「📋 メール・SMS履歴」セクションにおいて、現在のインライン展開表示をMUI Dialogモーダルに変更する。あわせて、本文中の `<BR>` / `<br>` 文字列を改行として正しく表示する。

### 変更の目的

- 狭いサイドバー内でのスクロール不要な本文閲覧体験の向上
- `<BR>` 文字列が視覚的に改行として表示されない問題の解消
- 不要な状態管理（`expandedActivityIds`）の削除によるコードの簡素化

---

## アーキテクチャ

### 対象ファイル

- **変更対象**: `frontend/frontend/src/pages/CallModePage.tsx`
  - 売主管理システム（ポート3000）のフロントエンド
  - バックエンド変更なし（表示ロジックのみ）

### 変更の全体像

```
【変更前】
履歴アイテムクリック
  → expandedActivityIds に ID を追加
  → 同一アイテム直下にインライン展開パネルを表示

【変更後】
履歴アイテムクリック
  → selectedActivity に Activity オブジェクトをセット
  → SmsEmailHistoryModal を開く（MUI Dialog）
```

---

## コンポーネントと インターフェース

### 新規追加: `SmsEmailHistoryModal` コンポーネント

CallModePage 内にインラインコンポーネントとして定義する（または同ファイル内の独立関数コンポーネント）。

#### Props

```typescript
interface SmsEmailHistoryModalProps {
  open: boolean;
  activity: ActivityWithEmployee | null;
  onClose: () => void;
}
```

#### 表示内容

| 項目 | 条件 | データソース |
|------|------|-------------|
| タイトル（種別） | 常時 | `activity.type === 'sms'` → `💬 SMS` / `📧 メール` |
| 送信日時 | 常時 | `activity.createdAt` |
| 送信者名 | 常時 | `activity.employee?.name` または `getDisplayName(activity.employee)` |
| 件名 | メールのみ | `activity.metadata?.subject` |
| 本文 | 常時 | SMS: `activity.content` / メール: `activity.metadata?.body` |

### 削除対象

| 削除対象 | 種別 |
|---------|------|
| `expandedActivityIds` state | `useState<Set<string>>` |
| `toggleActivityExpand` 関数 | `useCallback` |
| `renderActivityBody` 関数 | ヘルパー関数 |
| 展開パネル JSX | `{expandedActivityIds.has(activity.id) && <Box>...}` |
| `ExpandMoreIcon` / `ExpandLessIcon` の使用箇所（履歴セクション） | JSX |

> **注意**: `ExpandMoreIcon` / `ExpandLessIcon` は他の箇所でも使用されている可能性があるため、インポート削除は使用箇所を確認してから判断する。

### 追加対象

| 追加対象 | 種別 |
|---------|------|
| `selectedActivity` state | `useState<ActivityWithEmployee \| null>(null)` |
| `handleActivityClick` 関数 | クリックハンドラー |
| `handleModalClose` 関数 | モーダルクローズハンドラー |
| `SmsEmailHistoryModal` コンポーネント | JSX |

---

## データモデル

### 使用する既存型

```typescript
// frontend/frontend/src/types/index.ts
interface Activity {
  id: string;
  sellerId: string;
  employeeId: string;
  type: ActivityType;  // 'sms' | 'email' | ...
  content: string;
  result?: string;
  metadata?: Record<string, any>;  // email: { subject, body }
  createdAt: string;
  employee?: {
    id: string;
    email: string;
    name: string;
  } | null;
}
```

### BR変換ユーティリティ関数

```typescript
/**
 * 本文中の <BR> / <br> を改行文字 \n に変換する
 */
function convertBrToNewline(text: string | null | undefined): string {
  if (text == null) return '';
  return text.replace(/<BR>/gi, '\n');
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: BR変換の完全性

*For any* 文字列（`<BR>` または `<br>` を0個以上含む）に対して `convertBrToNewline` を適用した結果は、`<BR>` も `<br>` も含まない。

**Validates: Requirements 2.1, 2.3, 2.4**

### Property 2: モーダルに種別ラベルが表示される

*For any* `type` が `'sms'` または `'email'` の Activity に対してモーダルをレンダリングしたとき、タイトル領域に種別を示すラベル（"SMS" または "メール"）が含まれる。

**Validates: Requirements 1.2, 3.3**

### Property 3: モーダルに送信者情報が表示される

*For any* Activity（`employee.name` を持つ）に対してモーダルをレンダリングしたとき、モーダル内に送信日時と送信者名が表示される。

**Validates: Requirements 1.3**

### Property 4: メール種別では件名が表示される

*For any* `type === 'email'` かつ `metadata.subject` を持つ Activity に対してモーダルをレンダリングしたとき、件名がモーダル内に表示される。

**Validates: Requirements 1.4**

---

## エラーハンドリング

| ケース | 対応 |
|--------|------|
| `activity.content` が null / undefined | `'本文データなし（旧形式）'` を表示 |
| `activity.metadata?.body` が null / undefined | `'本文データなし（旧形式）'` を表示 |
| `activity.employee` が null | `getDisplayName(null)` の既存ロジックに委譲 |
| `activity.metadata?.subject` が null / undefined | 件名行を非表示（メールのみ） |

---

## テスト戦略

### PBT適用判断

本機能はUIレンダリングと純粋な文字列変換関数（`convertBrToNewline`）を含む。文字列変換関数はPBTに適しており、UIレンダリングはスナップショットテスト・例ベーステストが適切。

### ユニットテスト（例ベース）

- 履歴アイテムクリック → モーダルが開くことを確認
- 閉じるボタンクリック → モーダルが閉じることを確認
- `expandedActivityIds` / `toggleActivityExpand` が存在しないことを確認
- 展開アイコン（ExpandMoreIcon / ExpandLessIcon）が履歴セクションに存在しないことを確認
- `whiteSpace: 'pre-wrap'` スタイルが本文要素に適用されていることを確認
- null/undefined 本文 → `'本文データなし（旧形式）'` が表示されることを確認

### プロパティベーステスト（fast-check）

**ライブラリ**: [fast-check](https://github.com/dubzzz/fast-check)（プロジェクトで既に使用中の可能性が高い TypeScript 向け PBT ライブラリ）

**最小イテレーション数**: 各テスト 100 回以上

#### Property 1: BR変換の完全性

```typescript
// Feature: call-mode-sms-email-history-modal, Property 1: BR変換の完全性
it('convertBrToNewline: 任意の文字列から <BR>/<br> が除去される', () => {
  fc.assert(fc.property(
    fc.string(),
    (text) => {
      const result = convertBrToNewline(text);
      expect(result).not.toMatch(/<BR>/i);
    }
  ), { numRuns: 100 });
});
```

#### Property 2: モーダルに種別ラベルが表示される

```typescript
// Feature: call-mode-sms-email-history-modal, Property 2: モーダルに種別ラベルが表示される
it('任意のSMS/メールActivityに対してモーダルタイトルに種別ラベルが含まれる', () => {
  fc.assert(fc.property(
    fc.record({
      id: fc.uuid(),
      type: fc.constantFrom('sms', 'email'),
      content: fc.string(),
      createdAt: fc.date().map(d => d.toISOString()),
      employee: fc.record({ id: fc.uuid(), name: fc.string(), email: fc.emailAddress() }),
      metadata: fc.record({ subject: fc.option(fc.string()), body: fc.option(fc.string()) }),
    }),
    (activity) => {
      const { getByText } = render(
        <SmsEmailHistoryModal open activity={activity} onClose={() => {}} />
      );
      const expectedLabel = activity.type === 'sms' ? 'SMS' : 'メール';
      expect(getByText(new RegExp(expectedLabel))).toBeInTheDocument();
    }
  ), { numRuns: 100 });
});
```

#### Property 3: モーダルに送信者情報が表示される

```typescript
// Feature: call-mode-sms-email-history-modal, Property 3: モーダルに送信者情報が表示される
it('任意のActivityに対してモーダル内に送信者名が表示される', () => {
  fc.assert(fc.property(
    fc.record({
      id: fc.uuid(),
      type: fc.constantFrom('sms', 'email'),
      content: fc.string(),
      createdAt: fc.date().map(d => d.toISOString()),
      employee: fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1 }), email: fc.emailAddress() }),
      metadata: fc.constant({}),
    }),
    (activity) => {
      const { getByText } = render(
        <SmsEmailHistoryModal open activity={activity} onClose={() => {}} />
      );
      expect(getByText(new RegExp(activity.employee.name))).toBeInTheDocument();
    }
  ), { numRuns: 100 });
});
```

#### Property 4: メール種別では件名が表示される

```typescript
// Feature: call-mode-sms-email-history-modal, Property 4: メール種別では件名が表示される
it('任意のemail型Activityに対してモーダル内に件名が表示される', () => {
  fc.assert(fc.property(
    fc.record({
      id: fc.uuid(),
      type: fc.constant('email'),
      content: fc.string(),
      createdAt: fc.date().map(d => d.toISOString()),
      employee: fc.record({ id: fc.uuid(), name: fc.string(), email: fc.emailAddress() }),
      metadata: fc.record({ subject: fc.string({ minLength: 1 }), body: fc.option(fc.string()) }),
    }),
    (activity) => {
      const { getByText } = render(
        <SmsEmailHistoryModal open activity={activity} onClose={() => {}} />
      );
      expect(getByText(new RegExp(activity.metadata.subject))).toBeInTheDocument();
    }
  ), { numRuns: 100 });
});
```
