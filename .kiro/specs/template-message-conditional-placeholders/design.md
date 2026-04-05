# 設計書：売主リストのテンプレートメッセージ条件分岐機能

## Overview

売主リストのテンプレートメッセージ機能において、売主番号に基づいた条件分岐機能を実装します。現在、テンプレートメッセージ内のプレースホルダーは固定値に置き換えられていますが、売主番号に「FI」が含まれるかどうかで異なる内容に置き換える必要があります。

### 背景

現在のテンプレートメッセージ生成関数（`smsTemplateGenerators.ts`）は、固定の文字列を返すのみで、プレースホルダーの置換機能を持っていません。しかし、実際のテンプレートメッセージには`<<当社住所>>`や`<<売買実績ｖ>>`などのプレースホルダーが含まれており、これらを売主番号に応じて動的に置き換える必要があります。

### 目標

- 売主番号に「FI」が含まれる場合と含まれない場合で、異なる住所と売買実績URLを表示
- 既存のテンプレートメッセージ生成関数との互換性を維持
- 汎用的なプレースホルダー置換機能を提供

---

## Architecture

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│ CallModePage (通話モードページ)                              │
│  - テンプレートメッセージ選択                                 │
│  - プレースホルダー置換後のメッセージ表示                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ smsTemplateGenerators.ts                                    │
│  - generateInitialCancellationGuidance()                    │
│  - generateCancellationGuidance()                           │
│  - generateValuationSMS()                                   │
│  - generateVisitReminderSMS()                               │
│  - generatePostVisitThankYouSMS()                           │
│  - generateLongTermCustomerSMS()                            │
│  - generateCallReminderSMS()                                │
│  - replacePlaceholders() ← 新規追加                         │
│  - convertLineBreaks()                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Seller オブジェクト                                          │
│  - sellerNumber: string (例: AA13501, FI12345)             │
│  - name: string                                             │
│  - address: string                                          │
│  - ...                                                      │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **ユーザー操作**: 通話モードページでテンプレートメッセージを選択
2. **テンプレート生成**: 対応する生成関数が呼び出される
3. **プレースホルダー置換**: `replacePlaceholders()`が売主番号に基づいて置換
4. **改行変換**: `convertLineBreaks()`が`[改行]`を`\n`に変換
5. **表示**: 置換後のメッセージがテキストエリアに表示

---

## Components and Interfaces

### 1. `replacePlaceholders` 関数

**シグネチャ**:
```typescript
export const replacePlaceholders = (
  message: string,
  seller: Seller
): string
```

**説明**: メッセージ内のプレースホルダーを売主情報に基づいて置き換えます。

**パラメータ**:
- `message`: プレースホルダーを含むメッセージ文字列
- `seller`: 売主オブジェクト（`sellerNumber`フィールドを含む）

**戻り値**: プレースホルダーが置き換えられたメッセージ文字列

**処理フロー**:
```typescript
1. 売主番号を取得（seller.sellerNumber）
2. 売主番号がnullまたは空の場合、デフォルト値を使用
3. 売主番号に「FI」が含まれるか判定（大文字・小文字を区別しない）
4. 条件に応じてプレースホルダーを置換
   - <<当社住所>> → 福岡支店 or 大分本社
   - <<売買実績ｖ>> → 空文字列 or 売買実績URL
5. 置換後のメッセージを返す
```

**エラーハンドリング**:
- 売主オブジェクトがnullの場合、デフォルト値を使用
- 売主番号がundefinedの場合、デフォルト値を使用
- 例外が発生した場合、元のメッセージを返す
- エラーログをコンソールに出力

---

### 2. 既存テンプレート生成関数の更新

**対象関数**:
1. `generateInitialCancellationGuidance`
2. `generateCancellationGuidance`
3. `generateValuationSMS`
4. `generateVisitReminderSMS`
5. `generatePostVisitThankYouSMS`
6. `generateLongTermCustomerSMS`
7. `generateCallReminderSMS`

**更新内容**:
```typescript
// 変更前
export const generateXXX = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  // メッセージ生成
  const message = `...`;
  return message;
};

// 変更後
export const generateXXX = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  // メッセージ生成
  let message = `...`;
  
  // プレースホルダー置換
  message = replacePlaceholders(message, seller);
  
  return message;
};
```

**重要**: `convertLineBreaks()`は呼び出し側（CallModePage）で実行されるため、生成関数内では実行しません。

---

## Data Models

### Seller 型（既存）

```typescript
interface Seller {
  id: string;
  sellerNumber: string;  // 売主番号（例: AA13501, FI12345）
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
  site: string;
  inquirySite: string;
  // ... その他のフィールド
}
```

**重要フィールド**:
- `sellerNumber`: 売主番号（条件分岐の判定に使用）

---

### プレースホルダーマッピング

| プレースホルダー | 条件 | 置換後の値 |
|----------------|------|-----------|
| `<<当社住所>>` | 売主番号に「FI」が含まれる | `住所：福岡市中央区六本松４丁目３－２` |
| `<<当社住所>>` | 売主番号に「FI」が含まれない | `住所：大分市舞鶴町1-3-30STビル１F` |
| `<<売買実績ｖ>>` | 売主番号に「FI」が含まれる | `""` (空文字列) |
| `<<売買実績ｖ>>` | 売主番号に「FI」が含まれない | `売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map` |

**デフォルト値**（売主番号がnullまたは空の場合）:
- `<<当社住所>>` → `住所：大分市舞鶴町1-3-30STビル１F`
- `<<売買実績ｖ>>` → `売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map`

---

## 研究が必要な領域

### 1. 既存テンプレートメッセージの調査

**目的**: 現在使用されているテンプレートメッセージに、どのようなプレースホルダーが含まれているかを確認する。

**調査方法**:
- スプレッドシートまたはデータベースに保存されているテンプレートメッセージを確認
- ユーザーヒアリング

**調査結果**（要件定義書より）:
- `<<当社住所>>`
- `<<売買実績ｖ>>`

**今後の拡張性**: 新しいプレースホルダーが追加される可能性があるため、汎用的な設計が必要。

---

### 2. 売主番号のフォーマット調査

**目的**: 売主番号に「FI」が含まれるパターンを確認する。

**調査方法**:
- データベースの`sellers`テーブルから売主番号のサンプルを取得
- 「FI」が含まれる売主番号の形式を確認

**想定されるパターン**:
- `FI12345` - 先頭に「FI」
- `AA13501FI` - 末尾に「FI」
- `AAFI13501` - 中間に「FI」

**実装方針**: 大文字・小文字を区別せずに「FI」を検索する（`toUpperCase()`を使用）。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: 当社住所プレースホルダーの条件分岐

*For any* 売主オブジェクト、`<<当社住所>>`プレースホルダーを含むメッセージに対して、売主番号に「FI」が含まれる場合は福岡支店の住所に置き換えられ、含まれない場合は大分本社の住所に置き換えられる

**Validates: Requirements 1.1, 1.2**

---

### Property 2: 売買実績プレースホルダーの条件分岐

*For any* 売主オブジェクト、`<<売買実績ｖ>>`プレースホルダーを含むメッセージに対して、売主番号に「FI」が含まれる場合は空文字列に置き換えられ、含まれない場合は売買実績URLに置き換えられる

**Validates: Requirements 2.1, 2.2**

---

### Property 3: 大文字・小文字を区別しない検索

*For any* 売主番号、「FI」「fi」「Fi」「fI」のいずれの大文字・小文字の組み合わせでも、同じ条件分岐結果が得られる

**Validates: Requirements 1.3, 2.3**

---

### Property 4: 全てのプレースホルダーを検出して置き換える

*For any* メッセージ、複数のプレースホルダー（`<<当社住所>>`と`<<売買実績ｖ>>`）が含まれる場合、全てのプレースホルダーが正しく置き換えられる

**Validates: Requirements 3.2**

---

### Property 5: `[改行]`プレースホルダーを保持する

*For any* メッセージ、`[改行]`プレースホルダーが含まれる場合、`replacePlaceholders()`関数は`[改行]`をそのまま保持する（`convertLineBreaks()`関数で後処理されるため）

**Validates: Requirements 3.4, 5.2**

---

### Property 6: 未知のプレースホルダーをそのまま残す

*For any* メッセージ、未知のプレースホルダー（例: `<<未定義>>`）が含まれる場合、そのプレースホルダーはそのまま残され、エラーを発生させない

**Validates: Requirements 3.5**

---

### Property 7: 各テンプレート生成関数でプレースホルダー置換を実行する

*For any* テンプレート生成関数（`generateInitialCancellationGuidance`, `generateCancellationGuidance`, `generateValuationSMS`, `generateVisitReminderSMS`, `generatePostVisitThankYouSMS`, `generateLongTermCustomerSMS`, `generateCallReminderSMS`）、プレースホルダーを含むメッセージが正しく置き換えられる

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

---

### Property 8: プレースホルダーが含まれないメッセージは変更しない

*For any* メッセージ、プレースホルダーが含まれない場合、`replacePlaceholders()`関数はメッセージを変更せずにそのまま返す（ラウンドトリップ的なプロパティ）

**Validates: Requirements 5.1**

---

### Property 9: 例外を発生させない

*For any* 入力（不正な入力を含む）、`replacePlaceholders()`関数は例外を発生させず、常に文字列を返す

**Validates: Requirements 7.3**

---

### Property 10: エラー時は元のメッセージを返す

*For any* メッセージ、内部エラーが発生した場合、`replacePlaceholders()`関数は元のメッセージをそのまま返す

**Validates: Requirements 7.4**

---

## Error Handling

### エラーケース

1. **売主オブジェクトがnull**
   - 動作: デフォルト値を使用（大分本社の住所、売買実績URLあり）
   - エラーログ: `console.error('[replacePlaceholders] Seller object is null, using default values')`

2. **売主番号がundefined**
   - 動作: デフォルト値を使用（大分本社の住所、売買実績URLあり）
   - エラーログ: `console.error('[replacePlaceholders] Seller number is undefined, using default values')`

3. **売主番号が空文字列**
   - 動作: デフォルト値を使用（大分本社の住所、売買実績URLあり）
   - エラーログ: `console.warn('[replacePlaceholders] Seller number is empty, using default values')`

4. **内部エラー（例外）**
   - 動作: 元のメッセージをそのまま返す
   - エラーログ: `console.error('[replacePlaceholders] Error occurred:', error)`

### エラーハンドリング実装

```typescript
export const replacePlaceholders = (
  message: string,
  seller: Seller
): string => {
  try {
    // 売主オブジェクトのnullチェック
    if (!seller) {
      console.error('[replacePlaceholders] Seller object is null, using default values');
      return replaceWithDefaults(message);
    }
    
    // 売主番号の取得
    const sellerNumber = seller.sellerNumber;
    
    // 売主番号のundefined/空文字列チェック
    if (!sellerNumber || sellerNumber.trim() === '') {
      console.warn('[replacePlaceholders] Seller number is empty, using default values');
      return replaceWithDefaults(message);
    }
    
    // 条件分岐処理
    const hasFI = sellerNumber.toUpperCase().includes('FI');
    
    // プレースホルダー置換
    let result = message;
    
    // <<当社住所>>の置換
    if (hasFI) {
      result = result.replace(/<<当社住所>>/g, '住所：福岡市中央区六本松４丁目３－２');
    } else {
      result = result.replace(/<<当社住所>>/g, '住所：大分市舞鶴町1-3-30STビル１F');
    }
    
    // <<売買実績ｖ>>の置換
    if (hasFI) {
      result = result.replace(/<<売買実績ｖ>>/g, '');
    } else {
      result = result.replace(/<<売買実績ｖ>>/g, '売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    }
    
    return result;
  } catch (error) {
    console.error('[replacePlaceholders] Error occurred:', error);
    return message; // 元のメッセージを返す
  }
};

// デフォルト値で置換するヘルパー関数
const replaceWithDefaults = (message: string): string => {
  let result = message;
  result = result.replace(/<<当社住所>>/g, '住所：大分市舞鶴町1-3-30STビル１F');
  result = result.replace(/<<売買実績ｖ>>/g, '売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
  return result;
};
```

---

## Testing Strategy

### デュアルテストアプローチ

このプロジェクトでは、**ユニットテスト**と**プロパティベーステスト**の両方を使用します。

#### ユニットテスト

**目的**: 特定の例、エッジケース、エラー条件を検証

**対象**:
- 売主番号に「FI」が含まれる場合の具体例（例: `FI12345`）
- 売主番号に「FI」が含まれない場合の具体例（例: `AA13501`）
- 売主番号がnullの場合
- 売主番号が空文字列の場合
- 売主オブジェクトがnullの場合
- 未知のプレースホルダーが含まれる場合

**テストフレームワーク**: Jest

**テストファイル**: `frontend/frontend/src/utils/__tests__/smsTemplateGenerators.test.ts`

**テスト例**:
```typescript
describe('replacePlaceholders', () => {
  it('should replace <<当社住所>> with Fukuoka address when seller number contains FI', () => {
    const seller = { sellerNumber: 'FI12345', name: 'テスト売主' };
    const message = 'こんにちは。<<当社住所>>です。';
    const result = replacePlaceholders(message, seller);
    expect(result).toContain('住所：福岡市中央区六本松４丁目３－２');
  });
  
  it('should replace <<当社住所>> with Oita address when seller number does not contain FI', () => {
    const seller = { sellerNumber: 'AA13501', name: 'テスト売主' };
    const message = 'こんにちは。<<当社住所>>です。';
    const result = replacePlaceholders(message, seller);
    expect(result).toContain('住所：大分市舞鶴町1-3-30STビル１F');
  });
  
  it('should use default values when seller number is null', () => {
    const seller = { sellerNumber: null, name: 'テスト売主' };
    const message = '<<当社住所>>と<<売買実績ｖ>>';
    const result = replacePlaceholders(message, seller);
    expect(result).toContain('住所：大分市舞鶴町1-3-30STビル１F');
    expect(result).toContain('売買実績はこちら：');
  });
  
  it('should preserve [改行] placeholder', () => {
    const seller = { sellerNumber: 'AA13501', name: 'テスト売主' };
    const message = 'こんにちは。[改行]<<当社住所>>です。';
    const result = replacePlaceholders(message, seller);
    expect(result).toContain('[改行]');
  });
  
  it('should leave unknown placeholders unchanged', () => {
    const seller = { sellerNumber: 'AA13501', name: 'テスト売主' };
    const message = 'こんにちは。<<未定義>>です。';
    const result = replacePlaceholders(message, seller);
    expect(result).toContain('<<未定義>>');
  });
});
```

#### プロパティベーステスト

**目的**: 普遍的なプロパティを全ての入力に対して検証

**対象**:
- Property 1: 当社住所プレースホルダーの条件分岐
- Property 2: 売買実績プレースホルダーの条件分岐
- Property 3: 大文字・小文字を区別しない検索
- Property 4: 全てのプレースホルダーを検出して置き換える
- Property 5: `[改行]`プレースホルダーを保持する
- Property 6: 未知のプレースホルダーをそのまま残す
- Property 7: 各テンプレート生成関数でプレースホルダー置換を実行する
- Property 8: プレースホルダーが含まれないメッセージは変更しない
- Property 9: 例外を発生させない
- Property 10: エラー時は元のメッセージを返す

**テストフレームワーク**: fast-check（JavaScriptのプロパティベーステストライブラリ）

**テストファイル**: `frontend/frontend/src/utils/__tests__/smsTemplateGenerators.property.test.ts`

**設定**:
- 最小イテレーション数: 100回
- タグ形式: `Feature: template-message-conditional-placeholders, Property {number}: {property_text}`

**テスト例**:
```typescript
import fc from 'fast-check';
import { replacePlaceholders } from '../smsTemplateGenerators';

describe('replacePlaceholders - Property-Based Tests', () => {
  // Feature: template-message-conditional-placeholders, Property 1: 当社住所プレースホルダーの条件分岐
  it('Property 1: should replace <<当社住所>> based on FI in seller number', () => {
    fc.assert(
      fc.property(
        fc.record({
          sellerNumber: fc.string(),
          name: fc.string(),
        }),
        (seller) => {
          const message = '<<当社住所>>';
          const result = replacePlaceholders(message, seller);
          
          const hasFI = seller.sellerNumber && seller.sellerNumber.toUpperCase().includes('FI');
          
          if (hasFI) {
            return result.includes('住所：福岡市中央区六本松４丁目３－２');
          } else {
            return result.includes('住所：大分市舞鶴町1-3-30STビル１F');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: template-message-conditional-placeholders, Property 3: 大文字・小文字を区別しない検索
  it('Property 3: should be case-insensitive when searching for FI', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('FI', 'fi', 'Fi', 'fI'),
        fc.string(),
        (fiVariant, prefix) => {
          const seller = { sellerNumber: prefix + fiVariant, name: 'テスト' };
          const message = '<<当社住所>>';
          const result = replacePlaceholders(message, seller);
          
          return result.includes('住所：福岡市中央区六本松４丁目３－２');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: template-message-conditional-placeholders, Property 8: プレースホルダーが含まれないメッセージは変更しない
  it('Property 8: should not change messages without placeholders', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !s.includes('<<') && !s.includes('>>')),
        fc.record({
          sellerNumber: fc.string(),
          name: fc.string(),
        }),
        (message, seller) => {
          const result = replacePlaceholders(message, seller);
          return result === message;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: template-message-conditional-placeholders, Property 9: 例外を発生させない
  it('Property 9: should never throw exceptions', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.anything(),
        (message, seller) => {
          try {
            replacePlaceholders(String(message), seller as any);
            return true;
          } catch {
            return false;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### テストカバレッジ目標

- **ユニットテスト**: 全ての関数とブランチをカバー（100%）
- **プロパティベーステスト**: 全てのCorrectness Propertiesをカバー（10個）

---

## Implementation Plan

### Phase 1: `replacePlaceholders`関数の実装

**ファイル**: `frontend/frontend/src/utils/smsTemplateGenerators.ts`

**タスク**:
1. `replacePlaceholders`関数を実装
2. エラーハンドリングを追加
3. JSDocコメントを追加

**所要時間**: 1時間

---

### Phase 2: 既存テンプレート生成関数の更新

**ファイル**: `frontend/frontend/src/utils/smsTemplateGenerators.ts`

**タスク**:
1. 各テンプレート生成関数に`replacePlaceholders`呼び出しを追加
2. 既存の動作を維持（後方互換性）

**所要時間**: 1時間

---

### Phase 3: ユニットテストの実装

**ファイル**: `frontend/frontend/src/utils/__tests__/smsTemplateGenerators.test.ts`

**タスク**:
1. `replacePlaceholders`関数のユニットテストを実装
2. エッジケースのテストを追加
3. 各テンプレート生成関数のテストを更新

**所要時間**: 2時間

---

### Phase 4: プロパティベーステストの実装

**ファイル**: `frontend/frontend/src/utils/__tests__/smsTemplateGenerators.property.test.ts`

**タスク**:
1. fast-checkをインストール
2. 10個のCorrectness Propertiesをプロパティベーステストとして実装
3. 各テストに100回のイテレーションを設定

**所要時間**: 3時間

---

### Phase 5: ドキュメント更新

**ファイル**: `frontend/frontend/src/utils/smsTemplateGenerators.ts`（JSDocコメント）

**タスク**:
1. `replacePlaceholders`関数のJSDocコメントを追加
2. サポートされているプレースホルダーの一覧を記載
3. 条件分岐のロジックを説明
4. 使用例を提供

**所要時間**: 30分

---

### Phase 6: 統合テスト

**タスク**:
1. CallModePageで実際にテンプレートメッセージを生成
2. プレースホルダーが正しく置き換えられることを確認
3. 既存の機能が壊れていないことを確認

**所要時間**: 1時間

---

## 総所要時間

**合計**: 約8.5時間

---

## Dependencies

### 外部ライブラリ

- **fast-check**: プロパティベーステストライブラリ
  - インストール: `npm install --save-dev fast-check`
  - バージョン: 最新安定版

### 内部依存

- `Seller`型（`frontend/frontend/src/types/index.ts`）
- `PropertyInfo`型（`frontend/frontend/src/types/index.ts`）
- `convertLineBreaks`関数（`frontend/frontend/src/utils/smsTemplateGenerators.ts`）

---

## Risks and Mitigations

### リスク1: 既存のテンプレートメッセージが壊れる

**影響**: 既存のテンプレートメッセージが正しく生成されなくなる

**軽減策**:
- 既存のテンプレート生成関数のユニットテストを実行
- 後方互換性を維持（プレースホルダーが含まれないメッセージは変更しない）
- 段階的なロールアウト（まず開発環境でテスト）

---

### リスク2: プレースホルダーの形式が変更される

**影響**: 新しいプレースホルダー形式に対応できない

**軽減策**:
- プレースホルダーの形式を正規表現で柔軟に検出
- 未知のプレースホルダーはそのまま残す（エラーを発生させない）
- ドキュメントにサポートされているプレースホルダーを明記

---

### リスク3: パフォーマンスの低下

**影響**: テンプレートメッセージ生成が遅くなる

**軽減策**:
- 正規表現を最適化（グローバルフラグ`/g`を使用）
- 不要な文字列操作を避ける
- パフォーマンステストを実施

---

## Appendix

### A. サポートされているプレースホルダー一覧

| プレースホルダー | 説明 | 条件 | 置換後の値 |
|----------------|------|------|-----------|
| `<<当社住所>>` | 当社の住所 | 売主番号に「FI」が含まれる | `住所：福岡市中央区六本松４丁目３－２` |
| `<<当社住所>>` | 当社の住所 | 売主番号に「FI」が含まれない | `住所：大分市舞鶴町1-3-30STビル１F` |
| `<<売買実績ｖ>>` | 売買実績URL | 売主番号に「FI」が含まれる | `""` (空文字列) |
| `<<売買実績ｖ>>` | 売買実績URL | 売主番号に「FI」が含まれない | `売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map` |
| `[改行]` | 改行 | - | `\n`（`convertLineBreaks()`で変換） |

---

### B. 使用例

```typescript
import { replacePlaceholders, convertLineBreaks } from './smsTemplateGenerators';

// 売主オブジェクト（福岡支店）
const sellerFI = {
  sellerNumber: 'FI12345',
  name: '山田太郎',
  address: '福岡市中央区...',
};

// 売主オブジェクト（大分本社）
const sellerAA = {
  sellerNumber: 'AA13501',
  name: '佐藤花子',
  address: '大分市舞鶴町...',
};

// テンプレートメッセージ
const template = `こんにちは。[改行]<<当社住所>>です。[改行]<<売買実績ｖ>>`;

// プレースホルダー置換（福岡支店）
const messageFI = replacePlaceholders(template, sellerFI);
console.log(messageFI);
// 出力: こんにちは。[改行]住所：福岡市中央区六本松４丁目３－２です。[改行]

// プレースホルダー置換（大分本社）
const messageAA = replacePlaceholders(template, sellerAA);
console.log(messageAA);
// 出力: こんにちは。[改行]住所：大分市舞鶴町1-3-30STビル１Fです。[改行]売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map

// 改行変換
const finalMessageFI = convertLineBreaks(messageFI);
console.log(finalMessageFI);
// 出力:
// こんにちは。
// 住所：福岡市中央区六本松４丁目３－２です。
//
```

---

**最終更新日**: 2026年4月6日  
**作成者**: Kiro AI  
**レビュー状態**: 未レビュー
