# 設計書

## 概要

新規買主登録ページ（`/buyers/new`）の物件情報エリアに、物件詳細画面へのリンクを追加する機能を実装します。このリンクにより、ユーザーは買主登録中に物件の詳細情報を新しいタブで素早く確認できるようになります。

この機能は、既存の`NewBuyerPage`コンポーネントに最小限の変更を加えることで実現します。

## アーキテクチャ

### システム構成

```
NewBuyerPage (frontend/frontend/src/pages/NewBuyerPage.tsx)
  ├─ 物件情報エリア（左側）
  │   ├─ 買付状況バッジ
  │   ├─ タイトル「物件情報」
  │   ├─ 【新規】物件詳細リンクボタン ← 今回追加
  │   ├─ 物件番号入力フィールド
  │   └─ 物件情報表示エリア
  └─ 買主入力フォーム（右側）
```

### データフロー

```
ユーザーが物件番号を入力
  ↓
fetchPropertyInfo(propertyNumber) 実行
  ↓
API: GET /api/property-listings/:propertyNumber
  ↓
propertyInfo state 更新
  ↓
物件詳細リンクボタン表示（条件付き）
  ↓
ユーザーがリンクをクリック
  ↓
新しいタブで /property-listings/:propertyNumber を開く
```

## コンポーネントとインターフェース

### 変更対象コンポーネント

**ファイル**: `frontend/frontend/src/pages/NewBuyerPage.tsx`

**変更内容**:
1. Material-UIの`OpenInNew`アイコンをインポート
2. 物件情報エリアのタイトル「物件情報」の直下にリンクボタンを追加
3. リンクボタンの表示条件を実装

### リンクボタンの実装仕様

**コンポーネント**: Material-UI `Button`

**プロパティ**:
- `variant="outlined"` - アウトラインスタイル
- `size="small"` - 小サイズ
- `fullWidth` - 全幅表示
- `startIcon={<OpenInNew />}` - 左側にアイコン表示
- `component="a"` - aタグとしてレンダリング
- `href={`/property-listings/${propertyInfo.property_number}`}` - 遷移先URL
- `target="_blank"` - 新しいタブで開く
- `rel="noopener noreferrer"` - セキュリティ対策
- `aria-label="物件詳細を新しいタブで開く"` - アクセシビリティ対応
- `sx={{ mb: 2 }}` - 下部マージン16px

### 表示条件ロジック

リンクボタンは以下の条件を全て満たす場合のみ表示されます:

```typescript
const shouldShowPropertyLink = 
  propertyInfo &&           // 物件情報が存在する
  !loadingProperty &&       // 読み込み中でない
  propertyNumberField;      // 物件番号フィールドが空でない
```

## データモデル

### PropertyInfo インターフェース（既存）

```typescript
interface PropertyInfo {
  property_number: string;      // 物件番号（リンク生成に使用）
  address: string;
  property_type: string;
  sales_price: number | null;
  land_area: number | null;
  building_area: number | null;
  floor_plan?: string;
  current_status?: string;
  pre_viewing_notes?: string;
  property_tax?: number;
  management_fee?: number;
  reserve_fund?: number;
  parking?: string;
  parking_fee?: number;
  delivery?: string;
  viewing_key?: string;
  viewing_parking?: string;
  viewing_notes?: string;
  special_notes?: string;
  memo?: string;
  broker_response?: string | number;
  offer_status?: string;
}
```

今回の機能では、既存の`PropertyInfo`インターフェースの`property_number`フィールドを使用してリンクURLを生成します。新しいデータモデルの追加は不要です。

## Correctness Properties

*プロパティとは、システムの全ての有効な実行において真であるべき特性や動作のことです。プロパティは、人間が読める仕様と機械が検証可能な正確性保証の橋渡しとなります。*

### Property 1: 物件情報取得時のリンク表示

*任意の*有効な物件番号に対して、物件情報が正常に取得された場合、物件詳細リンクボタンが表示されるべきである。

**検証要件**: Requirements 1.1, 3.4

### Property 2: リンクURLの正確性

*任意の*物件番号に対して、生成されるリンクのhref属性は `/property-listings/{物件番号}` のパターンに一致するべきである。

**検証要件**: Requirements 2.3

### Property 3: リンクの表示内容

リンクボタンは以下の要素を含むべきである:
- ラベルテキスト「物件詳細を見る」
- OpenInNewアイコン

**検証要件**: Requirements 1.2, 1.3

### Property 4: セキュリティとアクセシビリティ属性

リンクボタンは以下の属性を持つべきである:
- `target="_blank"` - 新しいタブで開く
- `rel="noopener noreferrer"` - セキュリティ対策
- `aria-label="物件詳細を新しいタブで開く"` - スクリーンリーダー対応

**検証要件**: Requirements 2.1, 5.1, 5.4

### エッジケース

以下のエッジケースは、プロパティテストのジェネレータで適切に処理されることを確認します:

- **物件番号が空**: リンクが表示されない（Requirements 3.1）
- **物件情報取得失敗**: リンクが表示されない（Requirements 3.2）
- **読み込み中**: リンクが表示されない（Requirements 3.3）

## エラーハンドリング

### エラーケース1: 物件情報取得失敗

**状況**: APIリクエストが失敗した場合

**処理**:
```typescript
try {
  const response = await api.get(`/api/property-listings/${propNum}`);
  setPropertyInfo(response.data);
} catch (error) {
  console.error('Failed to fetch property info:', error);
  setPropertyInfo(null);  // nullに設定してリンクを非表示
}
```

**結果**: リンクボタンは表示されない（`propertyInfo`が`null`のため）

### エラーケース2: 物件番号が空

**状況**: ユーザーが物件番号を入力していない、または削除した場合

**処理**: 表示条件ロジックで`propertyNumberField`をチェック

**結果**: リンクボタンは表示されない

### エラーケース3: 読み込み中

**状況**: 物件情報を取得中

**処理**: 表示条件ロジックで`loadingProperty`をチェック

**結果**: リンクボタンは表示されない（ローディングスピナーのみ表示）

## テスト戦略

### ユニットテスト

**テスト対象**: リンクボタンの表示条件とレンダリング

**テストケース**:
1. 物件情報が存在する場合、リンクボタンが表示される
2. 物件番号が空の場合、リンクボタンが表示されない
3. 読み込み中の場合、リンクボタンが表示されない
4. 物件情報がnullの場合、リンクボタンが表示されない
5. リンクボタンのラベルが「物件詳細を見る」である
6. リンクボタンにOpenInNewアイコンが含まれる
7. リンクボタンに`target="_blank"`属性が設定されている
8. リンクボタンに`rel="noopener noreferrer"`属性が設定されている
9. リンクボタンに`aria-label`属性が設定されている

**テストファイル**: `frontend/frontend/src/__tests__/NewBuyerPage.test.tsx`

### プロパティベーステスト

**テスト対象**: リンクURLの生成ロジック

**テストケース**:
1. 任意の有効な物件番号に対して、リンクのhrefが正しいパターンに一致する
2. 任意の物件情報に対して、物件情報が存在する場合はリンクが表示される

**テストファイル**: `frontend/frontend/src/__tests__/NewBuyerPage.pbt.test.ts`

**プロパティテスト設定**:
- テストライブラリ: `fast-check`（JavaScript/TypeScript用）
- 最小実行回数: 100回
- タグ形式: `Feature: buyer-registration-property-link, Property {番号}: {プロパティテキスト}`

**実装例**:
```typescript
import fc from 'fast-check';
import { render, screen } from '@testing-library/react';

// Property 1: 物件情報取得時のリンク表示
// Feature: buyer-registration-property-link, Property 1: 物件情報が正常に取得された場合、物件詳細リンクボタンが表示されるべきである
test('Property 1: Link displays when property info is loaded', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 5, maxLength: 10 }), // 物件番号
      (propertyNumber) => {
        // テストロジック
        // propertyInfoが存在し、loadingPropertyがfalseの場合、リンクが表示される
      }
    ),
    { numRuns: 100 }
  );
});

// Property 2: リンクURLの正確性
// Feature: buyer-registration-property-link, Property 2: リンクのhref属性は /property-listings/{物件番号} のパターンに一致するべきである
test('Property 2: Link href matches correct URL pattern', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 5, maxLength: 10 }), // 物件番号
      (propertyNumber) => {
        // テストロジック
        // リンクのhrefが `/property-listings/${propertyNumber}` に一致する
      }
    ),
    { numRuns: 100 }
  );
});
```

### 統合テスト

**テスト対象**: リンククリック後の動作

**テストケース**:
1. リンクをクリックすると、新しいタブで物件詳細画面が開く
2. 現在のタブの入力内容が保持される

**注意**: 新しいタブで開く動作は、ブラウザの動作に依存するため、E2Eテストで確認することを推奨します。

### 手動テスト

**テスト項目**:
1. リンクボタンの配置位置が「物件情報」タイトルの直下、物件番号入力フィールドの上であることを確認
2. リンクボタンの下部マージンが適切（16px）であることを確認
3. リンクボタンが全幅で表示されることを確認
4. キーボードのTabキーでリンクにフォーカスできることを確認
5. フォーカス時にアウトラインが表示されることを確認
6. EnterキーまたはSpaceキーでリンクが動作することを確認
