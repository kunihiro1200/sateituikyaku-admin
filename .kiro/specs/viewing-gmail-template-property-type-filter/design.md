# 設計書：内覧Gmailテンプレート物件種別フィルタリング

## Overview

内覧詳細画面（BuyerDetailPage）および問い合わせ履歴画面（BuyerInquiryHistoryPage）のGmail送信ボタンから開くテンプレート選択モーダル（TemplateSelectionModal）において、紐づき物件の種別（property_type）に応じてテンプレートを絞り込む機能を追加する。

フロントエンドのみの変更であり、バックエンドへの追加リクエストは不要。クライアントサイドでフィルタリングを実行することで、担当者が物件種別に適したテンプレートのみを選択できるようにする。

## Architecture

```mermaid
graph TD
    A[BuyerDetailPage] -->|linkedProperties[0]?.property_type| B[BuyerGmailSendButton]
    C[BuyerInquiryHistoryPage] -->|linkedPropertyType なし| B
    B -->|propertyType| D[TemplateSelectionModal]
    D -->|フィルタリング| E[filterTemplatesByPropertyType]
    E -->|フィルタ済みリスト| F[テンプレート一覧表示]
```

### データフロー

1. `BuyerDetailPage` が `linkedProperties[0]?.property_type` を取得
2. `BuyerGmailSendButton` の `linkedPropertyType` プロパティとして渡す
3. `BuyerGmailSendButton` が `TemplateSelectionModal` の `propertyType` プロパティに転送
4. `TemplateSelectionModal` 内でフィルタリングロジックを実行し、表示テンプレートを絞り込む

## Components and Interfaces

### BuyerGmailSendButton

`linkedPropertyType?: string` プロパティを追加する。

```typescript
interface BuyerGmailSendButtonProps {
  // 既存プロパティ（省略）
  linkedPropertyType?: string; // 追加
}
```

`TemplateSelectionModal` に `propertyType` として転送する：

```tsx
<TemplateSelectionModal
  open={templateModalOpen}
  onSelect={handleTemplateSelect}
  onCancel={handleCancel}
  propertyType={linkedPropertyType} // 追加
/>
```

### TemplateSelectionModal

`propertyType?: string` プロパティを追加し、フィルタリングロジックを内包する。

```typescript
interface TemplateSelectionModalProps {
  open: boolean;
  onSelect: (template: EmailTemplate) => void;
  onCancel: () => void;
  propertyType?: string; // 追加
}
```

### BuyerDetailPage

`BuyerGmailSendButton` に `linkedPropertyType` を渡す：

```tsx
<BuyerGmailSendButton
  // 既存プロパティ
  linkedPropertyType={linkedProperties[0]?.property_type}
/>
```

### BuyerInquiryHistoryPage

`BuyerInquiryHistoryPage` では紐づき物件情報を取得していないため、`linkedPropertyType` は渡さない（`undefined` のままとし、全テンプレートを表示する）。

## Data Models

### EmailTemplate（既存）

```typescript
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}
```

### フィルタリングロジック

`TemplateSelectionModal` 内に `filterTemplatesByPropertyType` 関数を実装する。

```typescript
function filterTemplatesByPropertyType(
  templates: EmailTemplate[],
  propertyType?: string
): EmailTemplate[] {
  if (!propertyType) return templates;

  // 括弧内の文字列を抽出する関数
  function extractBracketContent(name: string): string[] {
    // 全角括弧
    const fullWidth = name.match(/（[^）]*）/g) || [];
    // 半角括弧
    const halfWidth = name.match(/\([^)]*\)/g) || [];
    return [...fullWidth, ...halfWidth].map(m => m.slice(1, -1));
  }

  return templates.filter(template => {
    const bracketContents = extractBracketContent(template.name);
    if (bracketContents.length === 0) return true; // 括弧なし → 常に表示

    const allContent = bracketContents.join('');

    // 戸建て
    if (propertyType === '戸' || propertyType === '戸建て') {
      return !allContent.includes('土');
    }
    // 土地
    if (propertyType === '土') {
      return !allContent.includes('戸') && !allContent.includes('マ');
    }
    // マンション
    if (propertyType === 'マ' || propertyType === 'マンション') {
      return !allContent.includes('土');
    }

    return true; // 上記以外の種別 → 全表示
  });
}
```

### フィルタリングルール一覧

| property_type | 非表示条件（括弧内に含む文字） |
|--------------|-------------------------------|
| 「戸」「戸建て」 | 「土」 |
| 「土」 | 「戸」または「マ」 |
| 「マ」「マンション」 | 「土」 |
| その他・未定義 | なし（全表示） |

括弧なしテンプレートは全種別で常に表示する。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: propertyType未指定時は全テンプレートを返す

*For any* テンプレートリストに対して、`propertyType` が `undefined` または空文字の場合、`filterTemplatesByPropertyType` の戻り値は入力リストと同一でなければならない。

**Validates: Requirements 2.2**

### Property 2: 戸建て物件フィルタリングの正確性

*For any* テンプレートリストと `propertyType` が「戸」または「戸建て」の場合、フィルタリング後のリストには括弧内に「土」を含むテンプレートが存在せず、括弧内に「土」を含まないテンプレートおよび括弧なしテンプレートは全て含まれなければならない。

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: 土地物件フィルタリングの正確性

*For any* テンプレートリストと `propertyType` が「土」の場合、フィルタリング後のリストには括弧内に「戸」または「マ」を含むテンプレートが存在せず、どちらも含まないテンプレートおよび括弧なしテンプレートは全て含まれなければならない。

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 4: マンション物件フィルタリングの正確性

*For any* テンプレートリストと `propertyType` が「マ」または「マンション」の場合、フィルタリング後のリストには括弧内に「土」を含むテンプレートが存在せず、括弧内に「土」を含まないテンプレートおよび括弧なしテンプレートは全て含まれなければならない。

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: 括弧内文字列抽出の正確性

*For any* テンプレート名に対して、`extractBracketContent` は全角括弧（）および半角括弧()の両方の内容を正しく抽出し、括弧が複数存在する場合は全ての括弧内文字列を返さなければならない。

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 6: 括弧なしテンプレートは常に表示

*For any* テンプレートリストと任意の `propertyType` に対して、テンプレート名に括弧が存在しないテンプレートはフィルタリング後のリストに必ず含まれなければならない。

**Validates: Requirements 6.4, 3.3, 4.4, 5.3**

## Error Handling

- `linkedProperties` が空配列または未定義の場合、`linkedProperties[0]?.property_type` は `undefined` となり、フィルタリングなしで全テンプレートを表示する（要件2.2）
- フィルタリング後に0件になった場合、既存の「利用可能なテンプレートがありません」メッセージを表示する（要件7.1）
- `propertyType` が想定外の値（「収益物件」「他」など）の場合、フィルタリングを適用せず全テンプレートを表示する

## Testing Strategy

### ユニットテスト

`filterTemplatesByPropertyType` 関数を独立してテストする：

- `propertyType` が `undefined` の場合、全テンプレートを返すこと
- `propertyType` が空文字の場合、全テンプレートを返すこと
- 戸建て（「戸」「戸建て」）で「土」を含む括弧ありテンプレートが除外されること
- 土地（「土」）で「戸」「マ」を含む括弧ありテンプレートが除外されること
- マンション（「マ」「マンション」）で「土」を含む括弧ありテンプレートが除外されること
- 括弧なしテンプレートが全種別で表示されること
- 全角括弧・半角括弧の両方が正しく処理されること
- 複数括弧が存在する場合に全括弧内容が判定対象になること
- フィルタリング後0件の場合のUI表示

### プロパティベーステスト

プロパティベーステストには [fast-check](https://github.com/dubzzz/fast-check) を使用する。各テストは最低100回のイテレーションで実行する。

```typescript
// Feature: viewing-gmail-template-property-type-filter, Property 1: propertyType未指定時は全テンプレートを返す
fc.assert(fc.property(
  fc.array(fc.record({ id: fc.string(), name: fc.string(), subject: fc.string(), body: fc.string() })),
  fc.oneof(fc.constant(undefined), fc.constant('')),
  (templates, propertyType) => {
    const result = filterTemplatesByPropertyType(templates, propertyType);
    return result.length === templates.length;
  }
), { numRuns: 100 });

// Feature: viewing-gmail-template-property-type-filter, Property 2: 戸建て物件フィルタリングの正確性
// Feature: viewing-gmail-template-property-type-filter, Property 3: 土地物件フィルタリングの正確性
// Feature: viewing-gmail-template-property-type-filter, Property 4: マンション物件フィルタリングの正確性
// Feature: viewing-gmail-template-property-type-filter, Property 5: 括弧内文字列抽出の正確性
// Feature: viewing-gmail-template-property-type-filter, Property 6: 括弧なしテンプレートは常に表示
```

各プロパティに対して1つのプロパティベーステストを実装する。テストファイルは `frontend/frontend/src/__tests__/templatePropertyTypeFilter.property.test.ts` に配置する。
