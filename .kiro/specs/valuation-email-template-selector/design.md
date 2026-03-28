# Design Document

## Overview

査定計算セクションの「査定メール送信」ボタンに、ヘッダーのEmail送信ボタンと同様のテンプレート選択UI・添付ファイル機能を追加する。

現在の「査定メール送信」ボタンは `handleShowValuationEmailConfirm` を呼び出し、固定の本文を直接 `confirmDialog` に設定している。これを、`sellerEmailTemplates` から「査定額案内メール（相続）」または「査定額案内メール（相続以外）」を `seller.valuationReason` に基づいてフィルタリングし、ドロップダウン形式で選択させる方式に変更する。

既存の `handleEmailTemplateSelect`・`replaceEmailPlaceholders`・`confirmDialog` state・添付ファイルUI（`ImageSelectorModal`）はそのまま再利用し、新規コードを最小限に抑える。

## Architecture

変更対象は `frontend/frontend/src/pages/CallModePage.tsx` の1ファイルのみ。

```
[査定計算セクション]
  └─ 「査定メール送信」ボタン（現在: onClick → handleShowValuationEmailConfirm）
       ↓ 変更後
  └─ Select ドロップダウン（ヘッダーのEmail送信と同じ形式）
       ├─ フィルタリング: getValuationEmailTemplates() で絞り込み
       └─ onChange → handleEmailTemplateSelect(templateId)（既存関数を再利用）

[既存の共有UI]
  └─ confirmDialog（既存 state）
       ├─ RichTextEmailEditor（本文編集）
       ├─ 画像添付ボタン → ImageSelectorModal（既存）
       └─ 送信ボタン → handleConfirmSend（既存）
```

バックエンドへの変更は不要。`sellerEmailTemplates` は既存の `/api/email-templates/seller` エンドポイントから取得済みのものを使用する。

## Components and Interfaces

### 変更箇所: 査定計算セクションのボタン部分

**変更前:**
```tsx
<Button
  size="small"
  variant="outlined"
  startIcon={<Email />}
  onClick={handleShowValuationEmailConfirm}
  disabled={sendingEmail}
>
  査定メール送信
</Button>
```

**変更後:**
```tsx
<FormControl size="small" sx={{ minWidth: 160 }}>
  <InputLabel>査定メール送信</InputLabel>
  <Select
    value=""
    label="査定メール送信"
    onChange={(e) => handleEmailTemplateSelect(e.target.value)}
    disabled={!seller?.email || sendingTemplate || sellerEmailTemplatesLoading}
    startAdornment={<Email sx={{ mr: 0.5, fontSize: 18 }} />}
  >
    {getValuationEmailTemplates().map((template) => (
      <MenuItem key={template.id} value={template.id}>
        {template.name}
      </MenuItem>
    ))}
  </Select>
</FormControl>
```

### 新規関数: getValuationEmailTemplates

```typescript
const getValuationEmailTemplates = useCallback((): Array<{id: string; name: string; subject: string; body: string}> => {
  const INHERITANCE_KEYWORD = '相続';
  const INHERITANCE_TEMPLATE_NAME = '査定額案内メール（相続）';
  const NON_INHERITANCE_TEMPLATE_NAME = '査定額案内メール（相続以外）';

  const isInheritance = seller?.valuationReason?.includes(INHERITANCE_KEYWORD) ?? false;
  const targetName = isInheritance ? INHERITANCE_TEMPLATE_NAME : NON_INHERITANCE_TEMPLATE_NAME;

  const filtered = sellerEmailTemplates.filter(t => t.name === targetName);

  // フォールバック: フィルタリング結果が0件の場合は全テンプレートを返す
  return filtered.length > 0 ? filtered : sellerEmailTemplates;
}, [seller?.valuationReason, sellerEmailTemplates]);
```

この関数は `seller.valuationReason` と `sellerEmailTemplates` に依存するため `useCallback` でメモ化する。

## Data Models

新規のデータモデル変更はなし。既存の型・stateをそのまま使用する。

| 既存 state / 関数 | 用途 |
|---|---|
| `sellerEmailTemplates` | スプレッドシートから取得済みのテンプレートリスト |
| `sellerEmailTemplatesLoading` | テンプレート取得中フラグ（ローディング中は選択無効化） |
| `handleEmailTemplateSelect(templateId)` | テンプレート選択時の処理（プレースホルダー置換・confirmDialog表示） |
| `confirmDialog` state | 確認・編集ダイアログの状態 |
| `selectedImages` state | 添付ファイルの状態 |
| `imageSelectorOpen` state | 画像選択モーダルの開閉状態 |

`seller.valuationReason` フィールドは既存の `Seller` 型に存在し、`seller` state から参照する。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: valuationReasonによるテンプレートフィルタリング

*For any* `sellerEmailTemplates` リストと `valuationReason` 文字列に対して、`getValuationEmailTemplates()` が返すテンプレートは以下を満たす:
- `valuationReason` に「相続」が含まれる場合、返されるテンプレートは全て `name` が「査定額案内メール（相続）」である
- `valuationReason` に「相続」が含まれない（空文字・null・その他の文字列）場合、返されるテンプレートは全て `name` が「査定額案内メール（相続以外）」である

**Validates: Requirements 2.1, 2.2**

### Property 2: フィルタリング結果0件時のフォールバック

*For any* `sellerEmailTemplates` リストに対して、フィルタリング後の結果が0件になる場合（対象テンプレートが存在しない場合）、`getValuationEmailTemplates()` は元の `sellerEmailTemplates` リスト全体を返す

**Validates: Requirements 2.4**

### Property 3: プレースホルダー置換の完全性

*For any* テンプレート本文（`body`）に対して、`replaceEmailPlaceholders` を適用した結果に `<<` と `>>` で囲まれたプレースホルダー文字列が残っていない

**Validates: Requirements 3.4**

## Error Handling

| 状況 | 対応 |
|---|---|
| `seller.email` が未設定 | Select を `disabled` にする（既存の `handleEmailTemplateSelect` と同じ条件） |
| `sellerEmailTemplatesLoading` が true | Select を `disabled` にする |
| `sellerEmailTemplates` が空（API取得失敗） | `getValuationEmailTemplates()` が空配列を返し、Select に選択肢が表示されない |
| フィルタリング後0件 | フォールバックとして全テンプレートを表示（Requirements 2.4） |

## Testing Strategy

### ユニットテスト

`getValuationEmailTemplates` 関数の具体的な動作を検証する:

- `valuationReason = "相続"` の場合、相続テンプレートのみが返される
- `valuationReason = "相続（遺産分割）"` の場合、相続テンプレートのみが返される
- `valuationReason = ""` の場合、相続以外テンプレートのみが返される
- `valuationReason = null/undefined` の場合、相続以外テンプレートのみが返される
- `valuationReason = "住み替え"` の場合、相続以外テンプレートのみが返される
- フィルタリング後0件の場合、全テンプレートが返される（フォールバック）

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript/JavaScript向けPBTライブラリ）を使用する。各テストは最低100回のランダム入力で実行する。

**Property 1: valuationReasonによるフィルタリング**

```typescript
// Feature: valuation-email-template-selector, Property 1: valuationReasonによるテンプレートフィルタリング
it('相続を含むvaluationReasonは相続テンプレートのみを返す', () => {
  fc.assert(fc.property(
    fc.string().map(s => '相続' + s), // 「相続」を含む任意の文字列
    fc.array(fc.record({ id: fc.string(), name: fc.string(), subject: fc.string(), body: fc.string() })),
    (valuationReason, templates) => {
      const result = getValuationEmailTemplates(valuationReason, templates);
      if (result.length > 0 && templates.some(t => t.name === '査定額案内メール（相続）')) {
        return result.every(t => t.name === '査定額案内メール（相続）');
      }
      return true; // フォールバックケース
    }
  ), { numRuns: 100 });
});
```

**Property 2: フォールバック**

```typescript
// Feature: valuation-email-template-selector, Property 2: フィルタリング結果0件時のフォールバック
it('フィルタリング後0件の場合は全テンプレートを返す', () => {
  fc.assert(fc.property(
    fc.array(fc.record({ id: fc.string(), name: fc.constant('その他テンプレート'), subject: fc.string(), body: fc.string() })),
    (templates) => {
      // 相続・相続以外テンプレートが存在しない場合
      const result = getValuationEmailTemplates('相続', templates);
      return result.length === templates.length;
    }
  ), { numRuns: 100 });
});
```

**Property 3: プレースホルダー置換の完全性**

```typescript
// Feature: valuation-email-template-selector, Property 3: プレースホルダー置換の完全性
it('replaceEmailPlaceholdersはプレースホルダーを全て置換する', () => {
  fc.assert(fc.property(
    fc.string(), // 任意のテンプレート本文
    (body) => {
      const result = replaceEmailPlaceholders(body);
      return !result.match(/<<[^>]+>>/);
    }
  ), { numRuns: 100 });
});
```
