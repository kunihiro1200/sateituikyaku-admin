# 設計ドキュメント: メール・SMS履歴本文展開表示

## 概要

売主管理システムの通話モードページ（CallModePage）の左列にある「メール・SMS履歴」セクションにおいて、各ログエントリをクリックすることで送信内容（メール件名・本文、SMSメッセージ）を展開表示する機能を追加する。

バックエンドAPIはすでに `metadata.subject`、`metadata.body`（メール）および `content`（SMS）フィールドを返しているため、変更はフロントエンドのみとなる。

## アーキテクチャ

### 変更対象

- **ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`
- **変更範囲**: メール・SMS履歴セクション（行 4199〜4244 付近）のみ
- **バックエンド変更**: なし（APIはすでに必要なデータを返している）

### データフロー

```
API /api/sellers/:id/activities
  └─ activity.metadata.subject  (メール件名)
  └─ activity.metadata.body     (メール本文)
  └─ activity.content           (SMS内容 / メール概要)
       ↓
CallModePage の activities state (Activity[])
       ↓
メール・SMS履歴セクション（展開パネル付き）
```

### 状態管理

展開状態は `CallModePage` コンポーネント内のローカル state で管理する。

```typescript
// 展開中のエントリIDのSet（複数同時展開を許可）
const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(new Set());
```

トグル関数:

```typescript
const toggleActivityExpand = useCallback((activityId: string) => {
  setExpandedActivityIds(prev => {
    const next = new Set(prev);
    if (next.has(activityId)) {
      next.delete(activityId);
    } else {
      next.add(activityId);
    }
    return next;
  });
}, []);
```

## コンポーネントと インターフェース

### Activity 型（既存・変更なし）

```typescript
export interface Activity {
  id: string;
  sellerId: string;
  employeeId: string;
  type: ActivityType;
  content: string;
  result?: string;
  metadata?: Record<string, any>;  // subject, body を含む
  createdAt: string;
  employee?: { id: string; email: string; name: string; } | null;
}
```

### 展開パネルのレンダリングロジック

メール・SMS履歴セクション内の各エントリに対して、以下のロジックで展開パネルを表示する。

```typescript
// 展開パネルの内容を決定するヘルパー関数（コンポーネント内に定義）
const renderActivityBody = (activity: Activity): React.ReactNode => {
  if (activity.type === 'email') {
    const subject = activity.metadata?.subject;
    const body = activity.metadata?.body;
    return (
      <Box>
        {subject && (
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>件名:</Typography>
            <Typography variant="caption" sx={{ ml: 0.5 }}>{subject}</Typography>
          </Box>
        )}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>本文:</Typography>
          <Typography
            variant="caption"
            component="pre"
            sx={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.3 }}
          >
            {body ?? '本文データなし（旧形式）'}
          </Typography>
        </Box>
      </Box>
    );
  }
  if (activity.type === 'sms') {
    return (
      <Typography
        variant="caption"
        component="pre"
        sx={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {activity.content || 'メッセージ内容なし'}
      </Typography>
    );
  }
  return null;
};
```

### 展開パネルのUI構造

```
┌─────────────────────────────────────────┐
│ 📧 Email  担当者名 2025/01/15 10:30     │ ← クリック可能なカード（既存）
│ 件名テキスト（activity.content）         │   + 矢印アイコン（▼/▶）
├─────────────────────────────────────────┤
│ 件名: ○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○ │ ← 展開パネル（新規）
│ 本文:                                   │   白背景、最大高さ200px
│ ○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○ │   スクロール可能
│ ○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○ │
└─────────────────────────────────────────┘
```

## データモデル

### APIレスポンスの Activity オブジェクト（既存）

メール種別の場合:
```json
{
  "id": "uuid",
  "type": "email",
  "content": "【査定理由別３後Eメ】を送信",
  "metadata": {
    "subject": "○○様の不動産査定について",
    "body": "○○様\n\nお世話になっております。\n..."
  },
  "created_at": "2025-01-15T10:30:00Z",
  "employee": { "id": "...", "name": "担当者名" }
}
```

SMS種別の場合:
```json
{
  "id": "uuid",
  "type": "sms",
  "content": "○○様、先日はお電話ありがとうございました。...",
  "metadata": {},
  "created_at": "2025-01-15T10:30:00Z",
  "employee": { "id": "...", "name": "担当者名" }
}
```

### 展開状態の管理

```typescript
// Set<string> で展開中のactivity IDを管理
// 初期値: 空のSet（全て折りたたみ）
const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(new Set());
```

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: トグルのラウンドトリップ

*任意の* ActivityエントリIDに対して、展開操作を2回繰り返すと（展開→折りたたみ）、展開状態が元の状態（折りたたみ）に戻る。

**Validates: Requirements 1.2**

### Property 2: 展開状態の独立性

*任意の* 2つの異なるActivityエントリに対して、一方のエントリの展開/折りたたみ操作は、他方のエントリの展開状態に影響を与えない。

**Validates: Requirements 1.3**

### Property 3: メール本文の表示

*任意の* `metadata.body` 文字列を持つメール種別のActivityに対して、展開後にその文字列がプレーンテキストとして表示される（HTMLタグはレンダリングされない）。

**Validates: Requirements 2.2, 2.5**

### Property 4: SMS内容の表示

*任意の* `content` 文字列を持つSMS種別のActivityに対して、展開後にその文字列が表示される。

**Validates: Requirements 3.1**

### Property 5: メールラベルの表示

*任意の* メール種別のActivityに対して、展開後に「件名:」「本文:」ラベルが表示される（subjectが存在する場合は「件名:」も表示される）。

**Validates: Requirements 4.5**

## エラーハンドリング

### metadata が存在しない場合

古い形式のActivityレコードでは `metadata` が `null` または `{}` の場合がある。

- `metadata?.body` が `undefined` / `null` → 「本文データなし（旧形式）」を表示
- `metadata?.subject` が `undefined` / `null` → 件名欄を省略

### content が空の場合（SMS）

- `content` が空文字列または `undefined` → 「メッセージ内容なし」を表示

### XSS防止

- 本文・件名の表示には `dangerouslySetInnerHTML` を使用しない
- MUIの `Typography` コンポーネントと `component="pre"` を使用してプレーンテキストとして表示
- これにより、HTMLタグを含む文字列もエスケープされてテキストとして表示される

## テスト戦略

### PBT適用性の評価

本機能はUIコンポーネントのレンダリングロジックが中心であり、純粋な関数（`renderActivityBody`）と状態管理ロジック（`toggleActivityExpand`）が含まれる。これらは入力に対して決定論的な出力を持つため、プロパティベーステストが適用可能。

プロパティベーステストライブラリ: **fast-check**（プロジェクトで既に使用中）

### ユニットテスト（具体例）

1. メールエントリをクリックすると展開パネルが表示される
2. 展開済みエントリを再クリックすると折りたたまれる
3. `metadata.body` が未設定の場合「本文データなし（旧形式）」が表示される
4. `metadata.subject` が未設定の場合、件名欄が表示されない
5. SMS の `content` が空の場合「メッセージ内容なし」が表示される
6. 展開パネルに `maxHeight: 200px`、`overflow: auto` が設定されている
7. 本文表示要素に `white-space: pre-wrap` が設定されている

### プロパティベーステスト（fast-check）

各テストは最低100回のイテレーションで実行する。

**Property 1: トグルのラウンドトリップ**
```typescript
// Feature: seller-email-sms-history-body-view, Property 1: トグルのラウンドトリップ
fc.assert(fc.property(
  fc.string({ minLength: 1 }),  // activityId
  (activityId) => {
    const initial = new Set<string>();
    const afterFirst = toggle(initial, activityId);
    const afterSecond = toggle(afterFirst, activityId);
    return !afterSecond.has(activityId);  // 元の状態（折りたたみ）に戻る
  }
), { numRuns: 100 });
```

**Property 2: 展開状態の独立性**
```typescript
// Feature: seller-email-sms-history-body-view, Property 2: 展開状態の独立性
fc.assert(fc.property(
  fc.string({ minLength: 1 }),
  fc.string({ minLength: 1 }),
  (idA, idB) => {
    fc.pre(idA !== idB);
    const state = new Set<string>();
    const afterToggleA = toggle(state, idA);
    return afterToggleA.has(idA) && !afterToggleA.has(idB);
  }
), { numRuns: 100 });
```

**Property 3: メール本文のXSS防止**
```typescript
// Feature: seller-email-sms-history-body-view, Property 3: メール本文の表示
fc.assert(fc.property(
  fc.string(),  // HTMLタグを含む可能性のある任意の文字列
  (bodyText) => {
    const { container } = render(<EmailBodyPanel body={bodyText} />);
    // innerHTML ではなく textContent で確認（HTMLがレンダリングされていない）
    const pre = container.querySelector('pre');
    return pre?.textContent === bodyText;
  }
), { numRuns: 100 });
```

**Property 4: SMS内容の表示**
```typescript
// Feature: seller-email-sms-history-body-view, Property 4: SMS内容の表示
fc.assert(fc.property(
  fc.string({ minLength: 1 }),  // 非空のcontent文字列
  (content) => {
    const { getByText } = render(<SmsBodyPanel content={content} />);
    return !!getByText(content);
  }
), { numRuns: 100 });
```

### 統合テスト

- CallModePageの実際のAPIレスポンスを使用した展開動作の確認（手動テスト）
