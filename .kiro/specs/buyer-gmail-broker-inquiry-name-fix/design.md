# buyer-gmail-broker-inquiry-name-fix Bugfix Design

## Overview

買主詳細画面の「GMAIL送信」機能において、`<<●氏名・会社名>>` プレースホルダーを置換する際、
`broker_inquiry === '業者問合せ'` の場合でも法人名（`company_name`）が宛名に付加されてしまうバグを修正する。

**修正対象**:
1. `frontend/frontend/src/components/BuyerGmailSendButton.tsx` — `buyer` オブジェクトに `broker_inquiry` フィールドを追加
2. `backend/src/services/EmailTemplateService.ts` — `mergeAngleBracketPlaceholders` 内の `buyerName` 生成ロジックを修正

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `broker_inquiry === '業者問合せ'` かつ `company_name` が存在する場合に `<<●氏名・会社名>>` が `{name}・{company_name}` 形式に置換されてしまう
- **Property (P)**: 期待される正しい動作 — `broker_inquiry === '業者問合せ'` の場合、`<<●氏名・会社名>>` は `buyer.name` のみに置換される
- **Preservation**: 修正によって変更してはならない既存の動作 — `broker_inquiry` が `'業者問合せ'` 以外の場合の従来の置換ロジック
- **mergeAngleBracketPlaceholders**: `backend/src/services/EmailTemplateService.ts` 内のメソッド。`<<>>` 形式のプレースホルダーを実際のデータで置換する
- **broker_inquiry**: 買主の問合せ種別を示すフィールド。`'業者問合せ'` の場合は業者からの問合せを意味する
- **isBrokerInquiry**: `broker_inquiry === '業者問合せ'` かどうかを判定するフラグ

## Bug Details

### Bug Condition

バグは `broker_inquiry` が `'業者問合せ'` であり、かつ `company_name` が存在する場合に発生する。
`mergeAngleBracketPlaceholders` メソッドは `broker_inquiry` の値を考慮せず、`company_name` が存在すれば
常に `{name}・{company_name}` 形式で置換してしまう。

さらに、`BuyerGmailSendButton` が `mergeMultiple` エンドポイントへ送信する `buyer` オブジェクトに
`broker_inquiry` フィールドが含まれていないため、バックエンドで判定できない状態になっている。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerEmailMergeInput
  OUTPUT: boolean

  RETURN X.broker_inquiry = '業者問合せ' AND X.company_name ≠ ''
END FUNCTION
```

### Examples

- **例1（バグあり）**: `broker_inquiry='業者問合せ'`, `name='田中太郎'`, `company_name='株式会社ABC'`
  - 現在: `<<●氏名・会社名>>` → `田中太郎・株式会社ABC`
  - 期待: `<<●氏名・会社名>>` → `田中太郎`

- **例2（バグあり）**: `broker_inquiry='業者問合せ'`, `name='山田花子'`, `company_name='不動産会社XYZ'`
  - 現在: `<<●氏名・会社名>>` → `山田花子・不動産会社XYZ`
  - 期待: `<<●氏名・会社名>>` → `山田花子`

- **例3（正常ケース）**: `broker_inquiry=''`, `name='鈴木一郎'`, `company_name='株式会社DEF'`
  - 現在: `<<●氏名・会社名>>` → `鈴木一郎・株式会社DEF`
  - 期待: `<<●氏名・会社名>>` → `鈴木一郎・株式会社DEF`（変更なし）

- **例4（エッジケース）**: `broker_inquiry='業者問合せ'`, `name='佐藤次郎'`, `company_name=''`
  - 現在: `<<●氏名・会社名>>` → `佐藤次郎`（company_nameが空なので既に正常）
  - 期待: `<<●氏名・会社名>>` → `佐藤次郎`（変更なし）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `broker_inquiry` が `'業者問合せ'` 以外（空文字・`null`・その他の値）で `company_name` が存在する場合、`<<●氏名・会社名>>` は `{name}・{company_name}` 形式に置換される
- `broker_inquiry` が `'業者問合せ'` 以外で `company_name` が存在しない場合、`<<●氏名・会社名>>` は `buyer.name`（または `buyer.buyerName`）のみに置換される
- `<<氏名>>` プレースホルダーは `broker_inquiry` の値に関わらず常に `buyer.name` のみに置換される
- マウスクリックによるボタン操作など、メール送信フロー全体の動作は変更されない

**スコープ:**
`broker_inquiry` フィールドの追加と `buyerName` 生成ロジックの変更のみが対象。
他のプレースホルダー（`<<氏名>>`, `<<買主番号>>`, `<<メールアドレス>>` 等）の置換ロジックは一切変更しない。

## Hypothesized Root Cause

バグの根本原因は2箇所に存在する:

1. **フロントエンドの送信データ不足**: `BuyerGmailSendButton.tsx` の `handleTemplateSelect` メソッドで
   `buyer` オブジェクトを構築する際、コンポーネントが `brokerInquiry` プロパティを受け取っているにもかかわらず、
   `mergeMultiple` エンドポイントへのリクエストに `broker_inquiry` フィールドが含まれていない

2. **バックエンドの条件分岐欠如**: `EmailTemplateService.ts` の `mergeAngleBracketPlaceholders` メソッドで
   `buyerName` を生成する際、`broker_inquiry` の値を考慮した条件分岐が存在しない。
   現在のロジックは `company_name` の有無のみで判定している

3. **フィールド名の不一致**: フロントエンドのプロパティ名は `brokerInquiry`（camelCase）だが、
   バックエンドへ送信する際は `broker_inquiry`（snake_case）に変換する必要がある

## Correctness Properties

Property 1: Bug Condition - 業者問合せ時の宛名に法人名が含まれない

_For any_ `BuyerEmailMergeInput` において `isBugCondition` が true（`broker_inquiry === '業者問合せ'` かつ `company_name` が存在する）の場合、
修正後の `mergeAngleBracketPlaceholders` は `<<●氏名・会社名>>` を `buyer.name` のみに置換し、
`company_name` を付加しない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非業者問合せ時の従来動作が維持される

_For any_ `BuyerEmailMergeInput` において `isBugCondition` が false（`broker_inquiry !== '業者問合せ'`）の場合、
修正後の `mergeAngleBracketPlaceholders` は修正前と同一の結果を返し、
`company_name` が存在する場合は `{name}・{company_name}` 形式、存在しない場合は `name` のみを返す。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File 1**: `frontend/frontend/src/components/BuyerGmailSendButton.tsx`

**Function**: `handleTemplateSelect`

**Specific Changes**:
1. **`broker_inquiry` フィールドの追加**: `buyer` オブジェクトに `broker_inquiry: brokerInquiry || ''` を追加する
   - `company_name` フィールドの直後に配置する（アルファベット順）

```typescript
// 変更前
buyer: {
  buyerName,
  name: buyerName,
  company_name: buyerCompanyName || '',
  buyer_number: buyerNumber || '',
  email: buyerEmail,
  pre_viewing_notes: preViewingNotes || '',
  follow_up_assignee: followUpAssignee || '',
},

// 変更後
buyer: {
  buyerName,
  name: buyerName,
  company_name: buyerCompanyName || '',
  broker_inquiry: brokerInquiry || '',
  buyer_number: buyerNumber || '',
  email: buyerEmail,
  pre_viewing_notes: preViewingNotes || '',
  follow_up_assignee: followUpAssignee || '',
},
```

---

**File 2**: `backend/src/services/EmailTemplateService.ts`

**Function**: `mergeAngleBracketPlaceholders`

**Specific Changes**:
1. **`isBrokerInquiry` フラグの追加**: `buyer.broker_inquiry === '業者問合せ'` を判定するフラグを追加
2. **`buyerName` 生成ロジックの変更**: `isBrokerInquiry` が true の場合は `company_name` を付加しない

```typescript
// 変更前
const buyerName = buyer.company_name
  ? `${buyer.name || ''}・${buyer.company_name}`
  : (buyer.name || buyer.buyerName || '');

// 変更後
const isBrokerInquiry = buyer.broker_inquiry === '業者問合せ';
const buyerName = (!isBrokerInquiry && buyer.company_name)
  ? `${buyer.name || ''}・${buyer.company_name}`
  : (buyer.name || buyer.buyerName || '');
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される:
1. 修正前のコードでバグを再現するテストを実行し、根本原因を確認する（探索的バグ条件チェック）
2. 修正後のコードでバグが解消され、既存動作が保全されることを確認する（修正チェック・保全チェック）

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `mergeAngleBracketPlaceholders` に `broker_inquiry='業者問合せ'` かつ `company_name` が存在する入力を渡し、
`<<●氏名・会社名>>` の置換結果に `company_name` が含まれることを確認する（修正前コードでの失敗を観察）。

**Test Cases**:
1. **業者問合せ + 法人名あり**: `broker_inquiry='業者問合せ'`, `company_name='株式会社ABC'` を渡す（修正前コードで失敗）
2. **業者問合せ + 法人名あり（別パターン）**: `broker_inquiry='業者問合せ'`, `company_name='不動産会社XYZ'` を渡す（修正前コードで失敗）
3. **フロントエンドの送信データ確認**: `BuyerGmailSendButton` が送信する `buyer` オブジェクトに `broker_inquiry` が含まれないことを確認（修正前コードで失敗）

**Expected Counterexamples**:
- `<<●氏名・会社名>>` の置換結果が `{name}・{company_name}` 形式になっている（`company_name` が含まれる）
- 原因: `mergeAngleBracketPlaceholders` が `broker_inquiry` を考慮していない、かつフロントエンドが `broker_inquiry` を送信していない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全入力に対して期待動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result ← mergeAngleBracketPlaceholders'(X)
  ASSERT result.buyerName = X.name  // 法人名なし
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全入力に対して修正前と同一の結果が得られることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT mergeAngleBracketPlaceholders(X) = mergeAngleBracketPlaceholders'(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 多様な `broker_inquiry` 値（空文字、null、`'業者問合せ'` 以外の文字列）を自動生成できる
- `company_name` の有無・内容の組み合わせを網羅的にテストできる
- 手動テストでは見落としがちなエッジケースを検出できる

**Test Cases**:
1. **非業者問合せ + 法人名あり**: `broker_inquiry=''`, `company_name='株式会社ABC'` → `{name}・{company_name}` 形式が維持される
2. **非業者問合せ + 法人名なし**: `broker_inquiry=''`, `company_name=''` → `name` のみが維持される
3. **`<<氏名>>` プレースホルダー**: `broker_inquiry='業者問合せ'` でも `<<氏名>>` は `name` のみに置換される
4. **その他プレースホルダー**: `<<買主番号>>`, `<<メールアドレス>>` 等は影響を受けない

### Unit Tests

- `broker_inquiry='業者問合せ'` かつ `company_name` あり → `<<●氏名・会社名>>` が `name` のみに置換されることを確認
- `broker_inquiry=''` かつ `company_name` あり → `<<●氏名・会社名>>` が `{name}・{company_name}` 形式に置換されることを確認
- `broker_inquiry='業者問合せ'` かつ `company_name` なし → `<<●氏名・会社名>>` が `name` のみに置換されることを確認
- `<<氏名>>` プレースホルダーは `broker_inquiry` に関わらず `name` のみに置換されることを確認

### Property-Based Tests

- ランダムな `broker_inquiry` 値（`'業者問合せ'` 以外）と `company_name` を生成し、`{name}・{company_name}` 形式が維持されることを確認（保全チェック）
- `broker_inquiry='業者問合せ'` と任意の `company_name` を生成し、結果に `company_name` が含まれないことを確認（修正チェック）
- 多様な入力パターンで `<<氏名>>` プレースホルダーが常に `name` のみに置換されることを確認

### Integration Tests

- `BuyerGmailSendButton` から `mergeMultiple` エンドポイントへのリクエストに `broker_inquiry` が含まれることを確認
- 業者問合せの買主に対してGmail送信フローを実行し、メール本文の宛名に法人名が含まれないことを確認
- 通常の買主（非業者問合せ）に対してGmail送信フローを実行し、メール本文の宛名が従来通り `{name}・{company_name}` 形式であることを確認
