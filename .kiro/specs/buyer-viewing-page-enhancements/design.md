# 設計書：buyer-viewing-page-enhancements

## Overview

本設計書は、以下の2つのフロントエンド機能拡張を対象とする。

1. **内覧ページのヘッダーに問合せ物件の所在地を表示する**  
   `BuyerViewingResultPage` のヘッダーに、`GET /api/buyers/:buyer_number/properties` で取得した紐づき物件の `address` を表示する。

2. **「内覧日前日」カテゴリー選択中のクリックで内覧ページへ遷移する**  
   `BuyersPage` の `handleRowClick` を拡張し、サイドバーで「内覧日前日」が選択されている場合は `/buyers/:buyer_number/viewing` へ遷移する。

どちらも純粋なフロントエンド変更であり、バックエンドAPIの変更は不要。

---

## Architecture

```mermaid
graph TD
    A[BuyersPage] -->|selectedCalculatedStatus| B[handleRowClick]
    B -->|"内覧日前日"| C[navigate /buyers/:id/viewing]
    B -->|その他| D[navigate /buyers/:id]

    E[BuyerViewingResultPage] -->|fetchLinkedProperties| F[GET /api/buyers/:id/properties]
    F -->|linkedProperties[0].address| G[ヘッダーに住所表示]
```

変更対象ファイルは以下の2ファイルのみ。

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/BuyersPage.tsx` | `handleRowClick` にナビゲーション分岐を追加 |
| `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` | ヘッダーに物件所在地の表示を追加 |

---

## Components and Interfaces

### 1. BuyersPage — handleRowClick の変更

現在の実装：

```typescript
const handleRowClick = (buyerId: string) => {
  navigate(`/buyers/${buyerId}`);
};
```

変更後：

```typescript
const handleRowClick = (buyerId: string) => {
  if (selectedCalculatedStatus === '内覧日前日') {
    navigate(`/buyers/${buyerId}/viewing`);
  } else {
    navigate(`/buyers/${buyerId}`);
  }
};
```

`selectedCalculatedStatus` は既に `BuyersPage` のステートとして管理されており、追加のデータ取得は不要。

モバイル（カードリスト）とデスクトップ（テーブル）の両方で同じ `handleRowClick` を呼び出しているため、1箇所の変更で両方に適用される。

### 2. BuyerViewingResultPage — ヘッダーへの物件所在地表示

`linkedProperties` は既に `fetchLinkedProperties()` で取得・ステート管理されている。

表示条件：
- `linkedProperties.length > 0` かつ
- `linkedProperties[0].address` が非空文字列

表示位置：既存ヘッダー `Box` 内の買主番号 `Chip` の直後に追加する。

```tsx
{/* 物件所在地（紐づき物件が存在しaddressが非空の場合のみ表示） */}
{linkedProperties.length > 0 && linkedProperties[0].address && (
  <Typography
    variant="body2"
    color="text.secondary"
    sx={{ ml: 1 }}
  >
    {linkedProperties[0].address}
  </Typography>
)}
```

---

## Data Models

### 既存データ構造（変更なし）

**linkedProperties の要素（`GET /api/buyers/:buyer_number/properties` レスポンス）**

```typescript
interface LinkedProperty {
  id?: string;
  property_listing_id?: string;
  property_number?: string;
  address?: string;          // ← 表示対象フィールド
  property_address?: string; // ← フォールバック（seller-table-column-definition.md 参照）
  atbb_status?: string;
  google_map_url?: string;
  // ...その他フィールド
}
```

> **注意**: `seller-table-column-definition.md` のルールに従い、`properties` テーブルには `address` カラムが存在しない場合がある。APIレスポンスの実際のフィールド名は `address` または `property_address` のいずれかである可能性があるため、実装時は `property.address || property.property_address` の形式で参照する。

**BuyersPage の selectedCalculatedStatus**

```typescript
const [selectedCalculatedStatus, setSelectedCalculatedStatus] = useState<string | null>(null);
// null = All、'内覧日前日' = 内覧日前日カテゴリー
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 物件所在地の表示条件

*For any* 内覧ページのレンダリングにおいて、`linkedProperties` が1件以上存在しかつ最初の物件の `address` が非空文字列である場合、ヘッダーにその `address` が表示される。逆に、`linkedProperties` が空、または `address` が空文字列・null・undefined の場合、物件所在地の表示エリアはレンダリングされない。

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: ナビゲーション先の決定ロジック

*For any* 買主番号に対して `handleRowClick` が呼び出された場合、`selectedCalculatedStatus` が `'内覧日前日'` であれば遷移先は `/buyers/:buyer_number/viewing` となり、それ以外（`null` を含む任意の値）であれば遷移先は `/buyers/:buyer_number` となる。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

## Error Handling

### 物件所在地の取得失敗

`fetchLinkedProperties` が失敗した場合、`linkedProperties` は空配列のまま（初期値）となる。表示条件 `linkedProperties.length > 0` が false になるため、物件所在地エリアは表示されない。エラーは既存の `console.error` で記録される。

### address フィールドが存在しない場合

APIレスポンスに `address` フィールドが含まれない場合、`linkedProperties[0].address` は `undefined` となり、表示条件が false になるため表示されない。`property_address` フォールバックを実装することで対応する。

---

## Testing Strategy

### Unit Tests（具体例・エッジケース）

- `linkedProperties` が空配列の場合、物件所在地エリアが DOM に存在しないこと
- `linkedProperties[0].address` が空文字列の場合、物件所在地エリアが DOM に存在しないこと
- `selectedCalculatedStatus` が `null` の場合、`handleRowClick` が `/buyers/1234` に遷移すること
- `selectedCalculatedStatus` が `'内覧日前日'` 以外の文字列の場合、`handleRowClick` が `/buyers/1234` に遷移すること

### Property-Based Tests（普遍的プロパティ）

プロパティテストには **fast-check**（TypeScript/JavaScript 向け PBT ライブラリ）を使用する。各テストは最低 100 回のランダム入力で実行する。

**Property 1 のテスト実装方針**

```typescript
// Feature: buyer-viewing-page-enhancements, Property 1: 物件所在地の表示条件
fc.assert(
  fc.property(
    fc.array(fc.record({ address: fc.oneof(fc.string(), fc.constant(''), fc.constant(null)) })),
    (properties) => {
      const firstAddress = properties[0]?.address;
      const shouldShow = properties.length > 0 && !!firstAddress;
      // render して DOM に address が存在するかを確認
      // shouldShow === (DOM に address テキストが存在する)
    }
  ),
  { numRuns: 100 }
);
```

**Property 2 のテスト実装方針**

```typescript
// Feature: buyer-viewing-page-enhancements, Property 2: ナビゲーション先の決定ロジック
fc.assert(
  fc.property(
    fc.string(), // buyerNumber
    fc.oneof(fc.constant('内覧日前日'), fc.string(), fc.constant(null)),
    (buyerNumber, status) => {
      const expectedPath = status === '内覧日前日'
        ? `/buyers/${buyerNumber}/viewing`
        : `/buyers/${buyerNumber}`;
      // handleRowClick(buyerNumber) を呼び出し、navigate の引数が expectedPath と一致するか確認
    }
  ),
  { numRuns: 100 }
);
```

各プロパティテストは1つのテストファイルにまとめ、タグコメントで設計書のプロパティ番号を参照する。
