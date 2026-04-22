# 設計ドキュメント

## 概要

`BuyerViewingResultPage`（`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`）において、「内覧後売主連絡」フィールドの表示位置を変更するUI改善。

現状は「内覧後売主連絡」フィールドがヒアリング項目セクション内のテキストエリア上部に条件付きで表示されている。これを「内覧未確定」フィールドの右隣（内覧情報行内）に移動し、関連フィールドを横並びにまとめることで視認性と操作効率を向上させる。

### 変更前後の比較

**変更前のレイアウト**:
```
内覧情報行: [内覧日] [時間] [内覧形態] [後続担当] [内覧未確定]
ヒアリング項目セクション:
  - ヒアリング項目ラベル + クイック入力ボタン
  - [内覧後売主連絡] ← ここにある（条件付き）
  - RichTextEditor
  - 保存ボタン
```

**変更後のレイアウト**:
```
内覧情報行: [内覧日] [時間] [内覧形態] [後続担当] [内覧未確定] [内覧後売主連絡] ← 移動
ヒアリング項目セクション:
  - ヒアリング項目ラベル + クイック入力ボタン
  - RichTextEditor
  - 保存ボタン
```

---

## アーキテクチャ

本変更はフロントエンドのみの変更であり、バックエンドへの影響はない。

- 変更対象: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` のみ
- バックエンドAPI: 変更なし（`post_viewing_seller_contact` フィールドの保存ロジックは既存の `handleInlineFieldSave` をそのまま使用）
- 状態管理: 変更なし（`buyer` ステートおよび `buyerRef` をそのまま使用）

---

## コンポーネントとインターフェース

### 変更対象コンポーネント

**`BuyerViewingResultPage`** (`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`)

変更箇所は2か所のみ：

#### 変更箇所1: 内覧情報行への追加

内覧未確定フィールドの `</Box>` 直後に、内覧後売主連絡フィールドのJSXブロックを移動する。

```
内覧情報行（display: flex の Box）
  ├── 内覧日 Box
  ├── 時間 Box
  ├── 内覧形態 Box（条件付き）
  ├── 後続担当 Box
  ├── 内覧未確定 Box  ← 既存
  └── 内覧後売主連絡 Box  ← ここに移動（一般媒介条件付き）
```

#### 変更箇所2: ヒアリング項目セクションからの削除

ヒアリング項目セクション内の内覧後売主連絡フィールドのJSXブロック（`{/* 内覧後売主連絡 */}` コメントから始まる `{(() => { ... })()}` ブロック全体）を削除する。

---

## データモデル

変更なし。`post_viewing_seller_contact` フィールドは既存のまま使用する。

| フィールド名 | 型 | 説明 |
|---|---|---|
| `post_viewing_seller_contact` | `string \| null` | 内覧後売主連絡の値（「済」「未」「不要」または空） |
| `viewing_mobile` | `string \| null` | 内覧形態（専任物件用）。「一般」を含む場合に内覧後売主連絡を表示 |
| `viewing_type_general` | `string \| null` | 内覧形態（一般媒介用）。「一般」を含む場合に内覧後売主連絡を表示 |

### 一般媒介条件（表示・非表示ロジック）

変更なし。以下の条件を満たす場合のみ内覧後売主連絡フィールドを表示する：

```typescript
const showPostViewingSellerContact =
  (buyer.viewing_mobile && buyer.viewing_mobile.includes('一般')) ||
  (buyer.viewing_type_general && buyer.viewing_type_general.includes('一般'));
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述である。*

本機能はUIレイアウト変更が主体であり、ほとんどの受け入れ基準はUIレンダリングのexampleテストが適切である。ただし以下の2つのロジックはプロパティベーステストが有効である。

### プロパティ1: 選択済みボタンの再クリックによるクリア

*任意の* `post_viewing_seller_contact` の選択値（「済」「未」「不要」）に対して、同じボタンを再クリックすると値が空文字列にクリアされる。

**Validates: Requirements 2.5**

### プロパティ2: 保存失敗時のロールバック

*任意の* `post_viewing_seller_contact` の初期値に対して、バックエンドへの保存が失敗した場合、UIの選択状態は元の値に戻る。

**Validates: Requirements 3.3**

---

## エラーハンドリング

既存の `handleInlineFieldSave` のエラーハンドリングをそのまま使用する。変更なし。

- 保存失敗時: `previousBuyer` にロールバック（楽観的UI更新の巻き戻し）
- エラーメッセージ: `throw new Error(error.response?.data?.error || '更新に失敗しました')` で上位に伝播

---

## テスト戦略

### UIレンダリングテスト（Exampleテスト）

以下の項目をexampleベースのテストで検証する：

1. **配置確認**: 一般媒介条件を満たす場合、内覧後売主連絡フィールドが内覧未確定フィールドと同一の横並び行内に存在すること
2. **表示条件（表示）**: `viewing_mobile` に「一般」を含む値を設定したとき、内覧後売主連絡フィールドが表示されること
3. **表示条件（非表示）**: `viewing_mobile` に「一般」を含まない値を設定したとき、内覧後売主連絡フィールドが表示されないこと
4. **ヒアリング項目セクション**: ヒアリング項目セクション内に内覧後売主連絡フィールドが存在しないこと
5. **ラベル**: 「内覧後売主連絡」ラベルが表示されること
6. **必須表示**: 必須条件を満たす場合にラベルに「*」が付くこと
7. **ボタン存在**: 「済」「未」「不要」の3ボタンが存在すること
8. **選択スタイル**: 選択済みボタンが `contained` スタイルになること
9. **注意書き**: 「*一般媒介は内覧後に、全ての売り主に結果報告をしてください」が表示されること
10. **保存呼び出し**: ボタンクリック時に `buyerApi.update` が `post_viewing_seller_contact` フィールドで呼ばれること
11. **保存成功後のUI更新**: API成功後にUIの選択状態が更新されること

### プロパティベーステスト

プロパティテストライブラリ: **fast-check**（TypeScript/JavaScript向け）

各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1テスト実装方針

```
// Feature: buyer-viewing-result-field-reorder, Property 1: 選択済みボタンの再クリックによるクリア
fc.property(
  fc.constantFrom('済', '未', '不要'),
  (selectedValue) => {
    // selectedValue が選択済みの状態でボタンをクリックすると
    // newValue = isSelected ? '' : option の結果が '' になることを検証
    const isSelected = true; // 選択済み状態
    const newValue = isSelected ? '' : selectedValue;
    return newValue === '';
  }
)
```

#### プロパティ2テスト実装方針

```
// Feature: buyer-viewing-result-field-reorder, Property 2: 保存失敗時のロールバック
fc.property(
  fc.constantFrom('済', '未', '不要', ''),
  async (initialValue) => {
    // 初期値を設定し、API失敗をモックし、
    // ロールバック後の値が initialValue と等しいことを検証
  }
)
```

### 統合テスト

バックエンドAPIへの変更はないため、統合テストは不要。既存の `post_viewing_seller_contact` フィールドの保存・取得テストは変更なし。
