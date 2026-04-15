# 設計ドキュメント: ATBB状況変更時の買付情報「状況」必須バリデーション

## 概要

物件リスト詳細ページ（PropertyListingDetailPage）において、サマリー情報セクションのATBB状況フィールドを変更して保存する際に、特定の条件下で買付情報セクションの「状況」（`offer_status`）フィールドを必須バリデーションの対象とする機能を追加する。

「公開前→公開中」への変更（専任・公開前→専任・公開中、または一般・公開前→一般・公開中）はスキップし、それ以外のATBB状況変更時には `offer_status` が空の場合に保存をブロックする。

## アーキテクチャ

本機能はフロントエンドのみの変更で完結する。バックエンドAPIへの変更は不要。

```
PropertyListingDetailPage
  ├── handleSaveHeader()          ← ATBB状況変更バリデーションを追加
  ├── isPreToPublicTransition()   ← 新規: 公開前→公開中判定ロジック
  ├── validateOfferFields()       ← 既存: 買付情報バリデーション（変更なし）
  ├── offerErrors state           ← 既存: エラー状態（offer_status エラーを追加）
  └── isOfferEditMode state       ← 既存: 買付情報編集モード（自動切替を追加）
```

変更の流れ:

```
[保存ボタン押下]
      ↓
handleSaveHeader()
      ↓
editedData.atbb_status が存在するか？
  No → 既存の保存処理を実行
  Yes ↓
isPreToPublicTransition(prevAtbbStatus, newAtbbStatus) を呼ぶ
  true → 既存の保存処理を実行（スキップ）
  false ↓
offer_status が空か？
  No → 既存の保存処理を実行
  Yes ↓
offerErrors.offer_status = '必須項目です'
isOfferEditMode = true
保存処理を中断（return）
```

## コンポーネントとインターフェース

### 新規関数: `isPreToPublicTransition`

ATBB状況の変更が「公開前→公開中」への変更かどうかを判定する純粋関数。

```typescript
/**
 * ATBB状況の変更が「公開前→公開中」への変更かどうかを判定する
 * スキップすべき2パターン:
 *   - 専任・公開前 → 専任・公開中
 *   - 一般・公開前 → 一般・公開中
 * 媒介種別が変わる場合（専任・公開前 → 一般・公開中 など）はfalseを返す
 */
const isPreToPublicTransition = (
  prevStatus: string | null | undefined,
  nextStatus: string | null | undefined
): boolean => {
  return (
    (prevStatus === '専任・公開前' && nextStatus === '専任・公開中') ||
    (prevStatus === '一般・公開前' && nextStatus === '一般・公開中')
  );
};
```

### 変更: `handleSaveHeader`

既存の `handleSaveHeader` 関数に、ATBB状況変更時の `offer_status` バリデーションを追加する。

```typescript
const handleSaveHeader = async () => {
  if (!propertyNumber || Object.keys(editedData).length === 0) return;

  // ATBB状況が変更されている場合、offer_status バリデーションを実行
  if (editedData.atbb_status !== undefined) {
    const prevAtbbStatus = data?.atbb_status;
    const nextAtbbStatus = editedData.atbb_status;

    // 「公開前→公開中」への変更はスキップ
    if (!isPreToPublicTransition(prevAtbbStatus, nextAtbbStatus)) {
      // offer_status の現在値を取得
      const currentOfferStatus = editedData.offer_status !== undefined
        ? editedData.offer_status
        : (data?.offer_status ?? '');

      if (!currentOfferStatus || currentOfferStatus.trim() === '') {
        // エラーをセットして買付情報セクションを編集モードに切り替え
        setOfferErrors(prev => ({ ...prev, offer_status: '必須項目です' }));
        setIsOfferEditMode(true);
        return; // 保存処理を中断
      }
    }
  }

  // 既存の保存処理
  try {
    await api.put(`/api/property-listings/${propertyNumber}`, editedData);
    // ...
  } catch (error) {
    // ...
  }
};
```

### 既存: `offerErrors` state と `offer_status` フィールドのエラー表示

`offerErrors.offer_status` は既に実装済みで、`offer_status` フィールドの `error` プロパティと `helperText` に連動している。本機能では `handleSaveHeader` からこの既存の仕組みを利用する。

`offer_status` フィールドの値が選択されたときにエラーを即時消去する処理も既に実装済み:

```typescript
onChange={(e) => {
  handleFieldChange('offer_status', e.target.value);
  // 値が選択されたらエラーを即時消去（既存実装）
  if (e.target.value) {
    setOfferErrors(prev => ({ ...prev, offer_status: undefined }));
  }
}}
```

## データモデル

本機能で新たに追加・変更するデータモデルはない。既存の state を利用する。

| state | 型 | 用途 |
|---|---|---|
| `editedData.atbb_status` | `string \| undefined` | 変更後のATBB状況（変更がない場合はundefined） |
| `data.atbb_status` | `string \| undefined` | 変更前のATBB状況（サーバーから取得した現在値） |
| `offerErrors.offer_status` | `string \| undefined` | offer_statusのエラーメッセージ |
| `isOfferEditMode` | `boolean` | 買付情報セクションの編集モード |

### ATBB状況の選択肢

```
専任・公開中
一般・公開中
専任・公開前
一般・公開前
非公開（専任）
非公開（一般）
他社物件
非公開（配信メールのみ）
```

### 「公開前→公開中」判定マトリクス

| 変更前 | 変更後 | スキップ判定 |
|---|---|---|
| 専任・公開前 | 専任・公開中 | ✅ スキップ |
| 一般・公開前 | 一般・公開中 | ✅ スキップ |
| 専任・公開前 | 一般・公開中 | ❌ バリデーション実行（媒介種別が変わる） |
| 一般・公開前 | 専任・公開中 | ❌ バリデーション実行（媒介種別が変わる） |
| 専任・公開中 | 非公開（専任） | ❌ バリデーション実行 |
| 専任・公開前 | 非公開（専任） | ❌ バリデーション実行 |
| 一般・公開中 | 非公開（一般） | ❌ バリデーション実行 |
| その他すべての組み合わせ | - | ❌ バリデーション実行 |

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性または振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: 公開前→公開中判定の排他性

*任意の* ATBB状況の変更前・変更後の組み合わせに対して、`isPreToPublicTransition` 関数が `true` を返すのは「専任・公開前→専任・公開中」と「一般・公開前→一般・公開中」の2パターンのみであり、それ以外のすべての組み合わせに対して `false` を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

### プロパティ2: ATBB状況変更時のoffer_statusバリデーション

*任意の* ATBB状況の変更前・変更後の組み合わせと `offer_status` の値に対して、以下の性質が成立する:
- ATBB状況が変更されており、かつ変更が「公開前→公開中」でなく、かつ `offer_status` が空の場合 → バリデーションエラーが返される
- ATBB状況が変更されており、かつ変更が「公開前→公開中」でなく、かつ `offer_status` に値がある場合 → バリデーションエラーが返されない
- ATBB状況が変更されており、かつ変更が「公開前→公開中」の場合 → バリデーションエラーが返されない（offer_statusの値に関わらず）
- ATBB状況が変更されていない場合 → バリデーションエラーが返されない

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

## エラーハンドリング

### バリデーションエラー発生時の動作

1. `setOfferErrors(prev => ({ ...prev, offer_status: '必須項目です' }))` でエラーをセット
2. `setIsOfferEditMode(true)` で買付情報セクションを編集モードに切り替え
3. `return` で保存処理を中断（APIは呼ばれない）

### エラー解消時の動作

`offer_status` フィールドの `onChange` ハンドラーで値が選択されたとき、既存の実装により即時エラーが消去される:

```typescript
if (e.target.value) {
  setOfferErrors(prev => ({ ...prev, offer_status: undefined }));
}
```

### 既存バリデーションとの関係

既存の `validateOfferFields` 関数（`offer_amount` がある場合に `offer_status` を必須チェック）は変更しない。本機能は `handleSaveHeader` に独立したバリデーションロジックを追加する形で実装する。

## テスト戦略

### ユニットテスト

`isPreToPublicTransition` 関数の具体的なケースを検証する:

- `専任・公開前` → `専任・公開中`: `true`
- `一般・公開前` → `一般・公開中`: `true`
- `専任・公開前` → `一般・公開中`: `false`（媒介種別が変わる）
- `一般・公開前` → `専任・公開中`: `false`（媒介種別が変わる）
- `専任・公開中` → `非公開（専任）`: `false`
- `null` → `専任・公開中`: `false`
- `専任・公開前` → `null`: `false`

`handleSaveHeader` のバリデーション動作を検証する（モック使用）:

- ATBB状況変更あり・スキップ条件外・offer_status空 → APIが呼ばれない、offerErrors.offer_statusにエラーがセットされる、isOfferEditModeがtrueになる
- ATBB状況変更あり・スキップ条件外・offer_status有 → APIが呼ばれる
- ATBB状況変更あり・スキップ条件（専任・公開前→専任・公開中）・offer_status空 → APIが呼ばれる
- ATBB状況変更なし・offer_status空 → APIが呼ばれる

### プロパティベーステスト

プロパティベーステストライブラリとして **fast-check**（TypeScript/JavaScript向け）を使用する。各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1のテスト実装方針

```typescript
// Feature: property-atbb-status-change-validation, Property 1: 公開前→公開中判定の排他性
const allAtbbStatuses = [
  '専任・公開中', '一般・公開中', '専任・公開前', '一般・公開前',
  '非公開（専任）', '非公開（一般）', '他社物件', '非公開（配信メールのみ）', ''
];
const skipPatterns = [
  { from: '専任・公開前', to: '専任・公開中' },
  { from: '一般・公開前', to: '一般・公開中' },
];

// 任意の2つのATBB状況の組み合わせを生成し、
// skipPatternsに含まれる場合のみtrueを返すことを検証
fc.assert(
  fc.property(
    fc.constantFrom(...allAtbbStatuses),
    fc.constantFrom(...allAtbbStatuses),
    (from, to) => {
      const result = isPreToPublicTransition(from, to);
      const shouldSkip = skipPatterns.some(p => p.from === from && p.to === to);
      return result === shouldSkip;
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ2のテスト実装方針

```typescript
// Feature: property-atbb-status-change-validation, Property 2: ATBB状況変更時のoffer_statusバリデーション
// バリデーションロジックを純粋関数として切り出してテストする
// 入力: prevAtbbStatus, nextAtbbStatus, offerStatus
// 出力: エラーあり(true) / エラーなし(false)

fc.assert(
  fc.property(
    fc.option(fc.constantFrom(...allAtbbStatuses)),  // prevAtbbStatus
    fc.option(fc.constantFrom(...allAtbbStatuses)),  // nextAtbbStatus (undefined = 変更なし)
    fc.option(fc.string()),                           // offerStatus
    (prevStatus, nextStatus, offerStatus) => {
      const hasAtbbChange = nextStatus !== undefined;
      const isSkip = hasAtbbChange && isPreToPublicTransition(prevStatus, nextStatus);
      const isOfferStatusEmpty = !offerStatus || offerStatus.trim() === '';

      const shouldHaveError = hasAtbbChange && !isSkip && isOfferStatusEmpty;
      const result = validateAtbbStatusChangeForHeader(prevStatus, nextStatus, offerStatus);

      return shouldHaveError === (result !== null);
    }
  ),
  { numRuns: 100 }
);
```

### 統合テスト

- 実際のPropertyListingDetailPageコンポーネントをレンダリングし、ATBB状況を変更して保存ボタンを押したときの動作を検証する（React Testing Library使用）
- エラーメッセージ「必須項目です」が表示されること
- 買付情報セクションが編集モードに切り替わること
- offer_statusに値を入力するとエラーが消えること
