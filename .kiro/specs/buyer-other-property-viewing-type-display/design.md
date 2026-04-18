# 設計ドキュメント

## 概要

`BuyerViewingResultPage`（内覧ページ）において、`linkedProperties` が空（他社物件の買主）の場合でも内覧形態選択ボタン群を表示し、カレンダー送信を可能にする。

現状の問題：内覧形態の表示判定が `linkedProperties` の `atbb_status` に依存しているため、他社物件の買主では内覧形態が表示されず、カレンダー送信ボタンが有効にならない。

本設計では、`linkedProperties` が空の場合を「他社物件」として扱い、専任物件と同じ `viewing_mobile` フィールドの選択肢を表示するよう表示ロジックを拡張する。

---

## アーキテクチャ

変更はフロントエンドのみ。バックエンド・DBスキーマの変更は不要。

```
BuyerViewingResultPage.tsx
  ├── 内覧形態表示ロジック（IIFE内）
  │     現状: hasExclusiveProperty || hasGeneralProperty のみ表示
  │     変更: linkedProperties が空の場合も viewing_mobile 選択肢を表示
  │
  ├── viewingTypeValue 計算
  │     現状: atbbStatus が空のとき viewing_mobile || viewing_type_general
  │     変更: linkedProperties が空のとき viewing_mobile を優先参照（既存ロジックで対応済み）
  │
  └── isCalendarEnabled 計算
        変更なし（viewingTypeValue が正しく計算されれば自動的に動作）
```

スプレッドシート同期は既存の `SYNC_FIELDS` に `viewing_mobile` が含まれているため、追加対応不要。

---

## コンポーネントとインターフェース

### 変更対象ファイル

**`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`**

#### 内覧形態表示ロジック（IIFE内）

現状の分岐：
```
hasViewingDate が false → null
hasExclusiveProperty が true → 専任向けボタン
hasGeneralProperty が true → 一般媒介向けボタン
それ以外 → null（← ここが問題）
```

変更後の分岐：
```
hasViewingDate が false → null
hasExclusiveProperty が true → 専任向けボタン（既存）
hasGeneralProperty が true → 一般媒介向けボタン（既存）
linkedProperties が空（他社物件）→ viewing_mobile 選択肢ボタン（新規追加）
それ以外 → null
```

#### 表示する選択肢（他社物件の場合）

専任物件と同じ `VIEWING_FORM_EXCLUSIVE_OPTIONS` を使用：
```typescript
const VIEWING_FORM_EXCLUSIVE_OPTIONS = [
  '【内覧_専（自社物件）】',
  '【内覧（他社物件）】',
  '準不【内覧_専（立会）】',
  '準不【内覧_専（立会不要）】',
];
```

保存フィールド：`viewing_mobile`（専任物件と同じ）

#### isCalendarEnabled への影響

`viewingTypeValue` の計算は既存コードで以下のように定義されている：

```typescript
const atbbStatus = linkedProperties?.[0]?.atbb_status || '';
const viewingTypeValue =
  atbbStatus.includes('専任')
    ? (buyer?.viewing_mobile || null)
    : atbbStatus.includes('一般')
    ? (buyer?.viewing_type_general || null)
    : (buyer?.viewing_mobile || buyer?.viewing_type_general || null);
```

`linkedProperties` が空の場合、`atbbStatus` は `''` になり、3番目の分岐（`viewing_mobile || viewing_type_general`）が適用される。つまり `viewing_mobile` が非空であれば `viewingTypeValue` が非空になり、`isCalendarEnabled` が `true` になる。**この計算ロジックは変更不要。**

#### generateCalendarTitle への影響

既存の呼び出しコード：
```typescript
const baseTitle = generateCalendarTitle(
  buyer.viewing_mobile,
  buyer.viewing_type_general,
  property?.address,
  buyer.name
);
```

`linkedProperties` が空の場合、`property` は `null` になるが、`buyer.viewing_mobile` は正しく渡される。`generateCalendarTitle` 内で `viewingType || viewingTypeGeneral || ''` として処理されるため、**変更不要。**

---

## データモデル

DBスキーマの変更なし。

| フィールド | DBカラム | スプレッドシート列 | 説明 |
|-----------|---------|-----------------|------|
| 内覧形態（専任・他社物件） | `viewing_mobile` | BI列（0-indexed: 60） | 他社物件の場合もこのフィールドを使用 |
| 内覧形態（一般媒介） | `viewing_type_general` | FQ列（0-indexed: 172） | 既存のまま変更なし |

スプレッドシート同期は `SYNC_FIELDS` に `viewing_mobile` が既に含まれているため、追加対応不要：
```typescript
const SYNC_FIELDS = [
  // ...
  'viewing_mobile',
  'viewing_type_general',
  // ...
];
```

---

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において成立すべき特性または動作のことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述です。*

### Property 1: 他社物件（linkedProperties 空）での内覧形態表示

*For any* 内覧日が非空の買主データと空の linkedProperties に対して、内覧形態表示判定ロジックは `true`（表示する）を返し、表示される選択肢は `VIEWING_FORM_EXCLUSIVE_OPTIONS` の4種類と一致する。

**Validates: Requirements 1.1, 1.2**

### Property 2: 内覧日なしでは内覧形態を表示しない

*For any* 内覧日が空（空文字・null・undefined・空白のみ）の買主データに対して、内覧形態表示判定ロジックは `false`（非表示）を返す。

**Validates: Requirements 1.3**

### Property 3: linkedProperties の状態に応じた表示分岐

*For any* linkedProperties の状態（専任物件あり・一般媒介物件あり・空）と内覧日ありの組み合わせに対して、表示判定ロジックは正しい分岐（専任→専任ボタン、一般→一般ボタン、空→他社物件ボタン）を返す。

**Validates: Requirements 1.4, 1.5**

### Property 4: 他社物件での viewingTypeValue 計算

*For any* 非空の `viewing_mobile` 値と空の linkedProperties に対して、`viewingTypeValue` の計算結果は `buyer.viewing_mobile` と等しくなり、`isCalendarEnabled` は4条件（内覧日・時間・後続担当・viewingTypeValue）がすべて非空のとき `true` になる。

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: 内覧形態ボタンのトグル動作

*For any* `VIEWING_FORM_EXCLUSIVE_OPTIONS` の選択肢に対して、未選択状態でクリックすると `viewing_mobile` にその値が設定され、選択済み状態で再クリックすると `viewing_mobile` が空文字列にクリアされる（ラウンドトリップ）。

**Validates: Requirements 3.1, 3.2**

### Property 6: 選択済みボタンの contained スタイル

*For any* `VIEWING_FORM_EXCLUSIVE_OPTIONS` の値が `viewing_mobile` に設定されている場合、対応するボタンの `variant` 判定は `'contained'` を返し、それ以外の値が設定されている場合は `'outlined'` を返す。

**Validates: Requirements 3.3**

### Property 7: 内覧形態未選択時の必須強調表示

*For any* 非空の内覧日と空の `viewing_mobile` の組み合わせに対して、`isRequired` 計算は `true` を返す。

**Validates: Requirements 3.4**

---

## エラーハンドリング

本機能はフロントエンドの表示ロジック変更のみであり、新たなエラーケースは発生しない。

既存のエラーハンドリングをそのまま継承：
- `handleInlineFieldSave` の失敗時はオプティミスティックUIのロールバックが動作する
- スプレッドシート同期失敗時は既存の Snackbar エラー表示が動作する

---

## テスト戦略

### 単体テスト（例示ベース）

- `SYNC_FIELDS` 配列に `'viewing_mobile'` が含まれていることを確認（要件 3.5）
- `linkedProperties` が空のとき `generateCalendarTitle` に `buyer.viewing_mobile` が渡されることを確認（要件 2.4）

### プロパティベーステスト

**ライブラリ**: `fast-check`（既存プロジェクトで使用中）

**設定**: 各プロパティテストは最低100回実行

**テストファイル**: `frontend/frontend/src/pages/__tests__/BuyerViewingResultPage.otherProperty.test.ts`

各プロパティテストのタグ形式：
`Feature: buyer-other-property-viewing-type-display, Property {番号}: {プロパティ内容}`

#### Property 1 のテスト実装方針
- `fc.string({ minLength: 1 })` で任意の非空内覧日を生成
- 空の `linkedProperties = []` を固定
- 表示判定ロジックを純粋関数として抽出してテスト

#### Property 2 のテスト実装方針
- `fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined), fc.string().map(s => s.trim() === '' ? s : ''))` で空の内覧日を生成
- 表示判定が false を返すことを検証

#### Property 3 のテスト実装方針
- `fc.record({ atbb_status: fc.oneof(fc.constant('専任・公開中'), fc.constant('一般・公開中')) })` で物件データを生成
- 分岐判定ロジックを純粋関数として抽出してテスト

#### Property 4 のテスト実装方針
- `fc.string({ minLength: 1 })` で任意の viewing_mobile 値を生成
- `viewingTypeValue` 計算ロジックを純粋関数として抽出してテスト

#### Property 5 のテスト実装方針
- `fc.constantFrom(...VIEWING_FORM_EXCLUSIVE_OPTIONS)` で任意の選択肢を生成
- トグルロジック `newValue = current === option ? '' : option` を検証

#### Property 6 のテスト実装方針
- `fc.constantFrom(...VIEWING_FORM_EXCLUSIVE_OPTIONS)` で任意の選択肢を生成
- `variant` 判定 `buyer.viewing_mobile === option ? 'contained' : 'outlined'` を検証

#### Property 7 のテスト実装方針
- `fc.string({ minLength: 1 })` で任意の非空内覧日を生成
- `viewing_mobile = ''` を固定
- `isRequired` 計算が true を返すことを検証
