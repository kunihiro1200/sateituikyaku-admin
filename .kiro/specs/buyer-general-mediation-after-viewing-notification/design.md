# 設計ドキュメント

## 概要

買主リストの内覧ページ（`BuyerViewingResultPage`）に、一般媒介契約における売主への内覧結果報告義務を担当者に周知するための注意書きを追加する。

本機能は以下の2点で構成される：

1. **サイドバーカテゴリーの維持**：既存の「一般媒介_内覧後売主連絡未」カテゴリー（`BuyerStatusCalculator.ts` Priority 8）を変更せず維持する
2. **注意書きの常時表示**：`BuyerViewingResultPage` の「内覧後売主連絡」フィールド直下に赤字で注意書きを常時表示する

### 背景

一般媒介契約の物件を内覧した後、担当者は全ての売主に内覧結果を報告する義務がある。現状、この報告漏れが発生しやすいため、内覧ページの「内覧後売主連絡」フィールド付近に注意書きを常時表示し、担当者に報告義務を周知する。

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` | 「内覧後売主連絡」フィールド直下に注意書き `Typography` を追加 |

### 変更しないファイル

| ファイル | 理由 |
|---------|------|
| `backend/src/services/BuyerStatusCalculator.ts` | Priority 8 判定ロジックは既存実装を維持 |
| `frontend/frontend/src/components/BuyerStatusSidebar.tsx` | サイドバー表示ロジックは既存実装を維持 |

### 技術スタック

- フロントエンド: React + TypeScript + Material UI (MUI)
- 注意書きコンポーネント: MUI `Typography`（`color="error"` を使用）

---

## コンポーネントとインターフェース

### 注意書きコンポーネント

新規コンポーネントは作成せず、既存の `BuyerViewingResultPage.tsx` 内に直接 `Typography` を追加する。

```tsx
<Typography
  variant="caption"
  color="error"
  sx={{ display: 'block', mt: 0.5 }}
>
  *一般媒介は内覧後に、全ての売り主に結果報告をしてください
</Typography>
```

### 配置場所

`BuyerViewingResultPage.tsx` 内の「内覧後売主連絡」フィールドを囲む `Box` の直後（`return` 文の中）に追加する。

現在の構造（抜粋）：

```tsx
{/* 内覧後売主連絡フィールド */}
<Box sx={{ mt: 1, mb: 1 }}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Typography variant="caption" ...>
      内覧後売主連絡{isPostViewingSellerContactRequired ? '*' : ''}
    </Typography>
    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
      {(['済', '未', '不要'] as const).map((option) => { ... })}
    </Box>
  </Box>
  {/* ← ここに注意書きを追加 */}
</Box>
```

変更後の構造：

```tsx
{/* 内覧後売主連絡フィールド */}
<Box sx={{ mt: 1, mb: 1 }}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Typography variant="caption" ...>
      内覧後売主連絡{isPostViewingSellerContactRequired ? '*' : ''}
    </Typography>
    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
      {(['済', '未', '不要'] as const).map((option) => { ... })}
    </Box>
  </Box>
  {/* 注意書き（常時表示） */}
  <Typography
    variant="caption"
    color="error"
    sx={{ display: 'block', mt: 0.5 }}
  >
    *一般媒介は内覧後に、全ての売り主に結果報告をしてください
  </Typography>
</Box>
```

### 表示条件

注意書きは「内覧後売主連絡」フィールドが表示される条件（`showPostViewingSellerContact` が `true`）と同じスコープ内に配置されるため、以下の条件で表示される：

- `buyer.viewing_mobile` に「一般」が含まれる、または
- `buyer.viewing_type_general` に「一般」が含まれる

この条件は既存の `showPostViewingSellerContact` 変数で制御されており、注意書きはその `Box` 内に追加するため、追加の条件分岐は不要。

`post_viewing_seller_contact` の値（済・未・不要・空欄）に関わらず、上記条件を満たす場合は常に表示される。

---

## データモデル

本機能はフロントエンドの表示のみの変更であり、データモデルの変更はない。

### 関連フィールド（参照のみ）

| フィールド名 | 型 | 説明 |
|------------|-----|------|
| `post_viewing_seller_contact` | `string \| null` | 内覧後売主連絡の値（済・未・不要・空欄） |
| `viewing_mobile` | `string \| null` | 内覧形態（専任物件用） |
| `viewing_type_general` | `string \| null` | 内覧形態_一般媒介（一般媒介物件用） |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性または振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述である。*

### プロパティ1: 注意書きの常時表示

*任意の* `post_viewing_seller_contact` の値（済・未・不要・空欄）に対して、「内覧後売主連絡」フィールドが表示されている場合、注意書きテキスト「*一般媒介は内覧後に、全ての売り主に結果報告をしてください」が常に表示されなければならない

**検証対象: 要件 2.1, 2.4**

---

## エラーハンドリング

本機能は静的なテキスト表示のみであり、エラーハンドリングは不要。

- 注意書きは条件付きレンダリングブロック内に配置されるため、`buyer` オブジェクトが `null` の場合は表示されない（既存の `if (!buyer)` ガードが機能する）
- 日本語テキストを含むため、ファイル編集時は必ずPythonスクリプトを使用してUTF-8エンコーディングを保護する

---

## テスト戦略

### 単体テスト（例示ベース）

以下のケースを手動または自動テストで確認する：

1. **表示確認**: `viewing_type_general` に「一般」を含む値が設定されている場合、注意書きが表示される
2. **非表示確認**: `viewing_type_general` が空欄または「一般」を含まない場合、注意書きが表示されない（フィールド自体が非表示のため）
3. **色確認**: 注意書きが赤字（`color="error"` = `#d32f2f`）で表示される

### プロパティベーステスト

**プロパティ1の実装**:

```typescript
// Feature: buyer-general-mediation-after-viewing-notification, Property 1: 注意書きの常時表示
// post_viewing_seller_contact の任意の値に対して注意書きが表示されることを確認
const postViewingSellerContactValues = ['済', '未', '不要', '', null];

postViewingSellerContactValues.forEach((value) => {
  it(`post_viewing_seller_contact="${value}" でも注意書きが表示される`, () => {
    const buyer = {
      viewing_type_general: '【内覧_一般（自社物件）】',
      post_viewing_seller_contact: value,
    };
    // レンダリング後、注意書きテキストが存在することを確認
    // expect(screen.getByText('*一般媒介は内覧後に、全ての売り主に結果報告をしてください')).toBeInTheDocument();
  });
});
```

### 回帰テスト

- `BuyerStatusCalculator.ts` の Priority 8 判定ロジックが変更されていないことを確認
- `BuyerStatusSidebar.tsx` の `generalViewingSellerContactPending` 表示ロジックが変更されていないことを確認

### 実装時の注意事項

- 日本語テキストを含むため、`BuyerViewingResultPage.tsx` の編集は必ずPythonスクリプトを使用する（UTF-8保護）
- `strReplace` ツールによる直接編集は禁止
