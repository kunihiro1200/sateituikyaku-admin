# 設計ドキュメント：seller-exclusion-date-auto-next-contact

## 概要

売主リスト（通話モードページ）において、サイト＝H（ホームズ）の売主に対して「除外日にすること」フィールドに値が設定された場合、以下の2つの自動処理を追加する。

1. 反響日（`inquiryDate`）から5日後の日付を「次電日」（`editedNextCallDate`）に自動設定する
2. コメントエリアの `⚠️ {exclusionAction}` マークの隣に「（なりすまし）として除外してください」ラベルを表示する

H以外のサイトは既存の動作（次電日を除外日そのものに設定、追加ラベル非表示）を維持する。

---

## アーキテクチャ

### 対象システム

- **フロントエンド**: `frontend/frontend/` （売主管理システム、ポート5173）
- **バックエンド**: 変更なし（今回の変更はフロントエンドのみ）

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/CallModePage.tsx` | ①ボタンクリックハンドラーの条件分岐追加、②exclusionActionマーク表示部分への追加ラベル |

バックエンドへのAPIリクエスト・レスポンス形式は変更なし。`inquiryDate` と `site` はすでにAPIから取得済みのため、新規エンドポイントは不要。

---

## コンポーネントとインターフェース

### 変更箇所1：除外日にすることボタンのクリックハンドラー

**現在の実装**（`CallModePage.tsx` 約7349行）:

```tsx
onClick={() => {
  const value = exclusionAction === option ? '' : option;
  setExclusionAction(value);
  // 除外日が設定されている場合、次電日を除外日に設定
  if (value && exclusionDate) {
    setEditedNextCallDate(exclusionDate);
  }
  setStatusChanged(true);
  statusChangedRef.current = true;
}}
```

**変更後**:

```tsx
onClick={() => {
  const value = exclusionAction === option ? '' : option;
  setExclusionAction(value);
  if (value) {
    // サイト=H かつ inquiryDate が存在する場合：反響日+5日を次電日に設定
    if (seller?.site === 'H' && seller?.inquiryDate) {
      const nextDate = calcInquiryDatePlusDays(seller.inquiryDate, 5);
      if (nextDate) {
        setEditedNextCallDate(nextDate);
      }
    } else if (exclusionDate) {
      // H以外：既存動作（除外日そのものを次電日に設定）
      setEditedNextCallDate(exclusionDate);
    }
  }
  setStatusChanged(true);
  statusChangedRef.current = true;
}}
```

### 変更箇所2：exclusionActionマーク表示部分

**現在の実装**（`CallModePage.tsx` 約6440行）:

```tsx
{exclusionAction && (
  <Typography
    variant="h5"
    sx={{
      color: 'error.main',
      fontWeight: 'bold',
      backgroundColor: 'white',
      px: 2,
      py: 0.5,
      borderRadius: 1,
      border: 2,
      borderColor: 'error.main',
    }}
  >
    ⚠️ {exclusionAction}
  </Typography>
)}
```

**変更後**:

```tsx
{exclusionAction && (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
    <Typography
      variant="h5"
      sx={{
        color: 'error.main',
        fontWeight: 'bold',
        backgroundColor: 'white',
        px: 2,
        py: 0.5,
        borderRadius: 1,
        border: 2,
        borderColor: 'error.main',
      }}
    >
      ⚠️ {exclusionAction}
    </Typography>
    {seller?.site === 'H' && (
      <Chip
        label="（なりすまし）として除外してください"
        color="warning"
        size="small"
        sx={{ fontWeight: 'bold' }}
      />
    )}
  </Box>
)}
```

### ヘルパー関数：calcInquiryDatePlusDays

日付計算ロジックを純粋関数として切り出す。`CallModePage.tsx` 内のコンポーネント外（またはユーティリティファイル）に定義する。

```typescript
/**
 * 反響日から指定日数後の日付をYYYY-MM-DD形式で返す
 * @param inquiryDate 反響日（string | Date）
 * @param days 加算日数
 * @returns YYYY-MM-DD形式の文字列、または null（無効な日付の場合）
 */
export function calcInquiryDatePlusDays(
  inquiryDate: string | Date,
  days: number
): string | null {
  try {
    const date = new Date(inquiryDate);
    if (isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}
```

> **設計判断**: `new Date(inquiryDate).getTime() + days * 86400000` ではなく `setDate(getDate() + days)` を使用する。ミリ秒加算はDSTの影響を受ける可能性があるため、日付オブジェクトのメソッドを使う方が安全。

---

## データモデル

今回の変更でデータモデルの変更はない。既存フィールドのみを使用する。

| フィールド | 型 | 用途 |
|-----------|---|------|
| `seller.site` | `string \| undefined` | サイト判定（`'H'` = ホームズ） |
| `seller.inquiryDate` | `string \| Date \| undefined` | 反響日（5日後計算の基準） |
| `exclusionDate` | `string`（state） | 除外日（H以外の場合の次電日設定に使用） |
| `exclusionAction` | `string`（state） | 除外日にすること（ラベル表示条件） |
| `editedNextCallDate` | `string`（state） | 次電日（自動設定の対象） |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする形式的な記述です。*

### Property 1: サイト=Hの場合、次電日は反響日+5日になる

*任意の* 有効な日付文字列（`inquiryDate`）に対して、`calcInquiryDatePlusDays(inquiryDate, 5)` の結果は、入力日付の正確に5日後をYYYY-MM-DD形式で返す

**Validates: Requirements 1.1, 1.5**

### Property 2: サイト=HかつexclusionActionが存在する場合、なりすましラベルが表示される

*任意の* 非空の `exclusionAction` 文字列と `site='H'` の組み合わせでレンダリングした場合、「（なりすまし）として除外してください」テキストが画面に存在する

**Validates: Requirements 2.1**

---

## エラーハンドリング

| ケース | 対応 |
|-------|------|
| `inquiryDate` が空または無効な日付 | `calcInquiryDatePlusDays` が `null` を返す。`null` の場合は `setEditedNextCallDate` を呼ばない（次電日は変更しない） |
| `seller` が `null` | `seller?.site` のオプショナルチェーンにより安全にスキップ |
| ボタン選択解除（トグルオフ） | `value` が空文字になるため、条件 `if (value)` に入らず次電日は変更しない |

---

## テスト戦略

### ユニットテスト

`calcInquiryDatePlusDays` ヘルパー関数のテスト:

- 通常の日付（月中）で+5日が正しく計算されること
- 月末（例: 1月28日 → 2月2日）で月をまたぐこと
- 年末（12月28日 → 1月2日）で年をまたぐこと
- うるう年（2月24日 → 2月29日）が正しく計算されること
- 空文字・無効な日付で `null` を返すこと

### プロパティベーステスト

**使用ライブラリ**: `fast-check`（TypeScript/JavaScript向けPBTライブラリ）

**最小実行回数**: 各プロパティテストにつき100回以上

#### Property 1 の実装方針

```typescript
// Feature: seller-exclusion-date-auto-next-contact, Property 1: サイト=Hの場合、次電日は反響日+5日になる
fc.assert(
  fc.property(
    fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
    (date) => {
      const input = date.toISOString().split('T')[0];
      const result = calcInquiryDatePlusDays(input, 5);
      const expected = new Date(date);
      expected.setDate(expected.getDate() + 5);
      return result === expected.toISOString().split('T')[0];
    }
  ),
  { numRuns: 100 }
);
```

#### Property 2 の実装方針

```typescript
// Feature: seller-exclusion-date-auto-next-contact, Property 2: サイト=HかつexclusionActionが存在する場合、なりすましラベルが表示される
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),
    (exclusionAction) => {
      const { getByText } = render(
        <ExclusionActionLabel exclusionAction={exclusionAction} site="H" />
      );
      return !!getByText('（なりすまし）として除外してください');
    }
  ),
  { numRuns: 100 }
);
```

### インテグレーションテスト（手動確認）

- サイト=Hの売主で「除外日に不通であれば除外」ボタンを押した際、次電日フィールドに反響日+5日が表示されること
- サイト=H以外（例: ウ）の売主で同ボタンを押した際、次電日フィールドに除外日が表示されること
- コメントエリアにChipラベルが表示されること（サイト=Hのみ）
