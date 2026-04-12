# デザインドキュメント

## 概要

本ドキュメントは、社内管理システム（sateituikyaku-admin）の業務詳細画面「サイト登録」タブに対する3つのUI改善のデザインを定義します。

対象コンポーネント: `frontend/frontend/src/components/WorkTaskDetailModal.tsx` 内の `SiteRegistrationSection`

### 改善内容

1. **条件付き非表示**: `property_type` が「土」以外の場合、RedNoteと「道路寸法」フィールドを非表示
2. **フォントサイズ拡大**: 「【登録関係】」「【確認関係】」のTypographyを `subtitle2` → `subtitle1` に変更
3. **セクション背景色**: 5つのセクションにそれぞれ異なる薄い背景色を適用

---

## アーキテクチャ

### 対象コンポーネント構造

```
WorkTaskDetailModal
└── SiteRegistrationSection（行427〜）
    ├── 左側パネル（登録関係）
    │   ├── Typography「【登録関係】」（variant="subtitle2" → subtitle1 に変更）
    │   ├── 【サイト登録依頼】セクション
    │   │   ├── RedNote（条件付き非表示対象）
    │   │   └── 各フィールド
    │   └── 【図面作成依頼】セクション
    │       ├── EditableField「道路寸法」（条件付き非表示対象）
    │       └── 各フィールド
    └── 右側パネル（確認関係）
        ├── Typography「【確認関係】」（variant="subtitle2" → subtitle1 に変更）
        ├── 【★サイト登録確認】セクション
        ├── 【★図面確認】セクション
        └── 【確認後処理】セクション
```

### データフロー

`property_type` の値は `getValue('property_type')` で取得されます。これは `WorkTaskDetailModal` の `handleFieldChange` / `getValue` 関数を通じてリアクティブに管理されており、値が変更されると即座に再レンダリングが発生します。

---

## コンポーネントとインターフェース

### 変更1: 条件付き非表示

**現在の実装（問題箇所）:**

```tsx
// 【サイト登録依頼】セクション内
<RedNote text={'地積測量図や字図を格納→「リンク知っている人全員」\nの共有URLをスプシの「内覧前伝達事項」に貼り付ける'} />

// 【図面作成依頼】セクション内
<EditableField label="道路寸法" field="road_dimensions" />
```

**変更後の実装:**

```tsx
// property_type === '土' の場合のみ表示
{getValue('property_type') === '土' && (
  <RedNote text={'地積測量図や字図を格納→「リンク知っている人全員」\nの共有URLをスプシの「内覧前伝達事項」に貼り付ける'} />
)}

// 【図面作成依頼】セクション内
{getValue('property_type') === '土' && (
  <EditableField label="道路寸法" field="road_dimensions" />
)}
```

**設計判断**: 既存の `property_type === '土'` 条件（字図・地積測量図URLフィールドの表示制御）と同じパターンを使用することで、コードの一貫性を保ちます。

### 変更2: フォントサイズ拡大

**現在の実装:**

```tsx
<Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0' }}>【登録関係】</Typography>
<Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32' }}>【確認関係】</Typography>
```

**変更後の実装:**

```tsx
<Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1565c0' }}>【登録関係】</Typography>
<Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2e7d32' }}>【確認関係】</Typography>
```

**設計判断**: `subtitle1`（16px）を選択。`h6`（20px）は他のセクションヘッダーとの視覚的バランスを考慮すると大きすぎる可能性があるため、`subtitle1` が適切です。

### 変更3: セクション背景色

各セクションを `Box` コンポーネントでラップし、`bgcolor` を適用します。

**セクションと背景色のマッピング:**

| セクション | 背景色 | 理由 |
|-----------|--------|------|
| 【サイト登録依頼】 | `#e3f2fd`（薄い青） | 登録関係の青系統に合わせる |
| 【図面作成依頼】 | `#e8f5e9`（薄い緑） | 自然・図面のイメージ |
| 【★サイト登録確認】 | `#f3e5f5`（薄い紫） | 確認作業の区別 |
| 【★図面確認】 | `#fff3e0`（薄いオレンジ） | 注意・確認のイメージ |
| 【確認後処理】 | `#fafafa`（薄いグレー） | 完了・後処理のイメージ |

**実装パターン:**

```tsx
<Box sx={{ bgcolor: '#e3f2fd', borderRadius: 1, p: 1, mb: 1 }}>
  <SectionHeader label="【サイト登録依頼】" />
  {/* セクション内フィールド */}
</Box>
```

---

## データモデル

本機能はUIの表示制御のみであり、データモデルの変更はありません。

- `property_type`: 既存のDBカラム（`work_tasks` テーブル）。値「土」の場合に特定フィールドを表示。
- `road_dimensions`: 既存のDBカラム。表示制御のみ変更。

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: 種別「土」以外での条件付き非表示

*任意の* `property_type` 値（「土」以外または空）に対して、`SiteRegistrationSection` はRedNoteコンポーネントと「道路寸法」フィールドを非表示にする

**Validates: Requirements 1.1, 1.2**

### プロパティ2: 種別「土」での条件付き表示

*任意の* `property_type` 値が「土」の場合、`SiteRegistrationSection` はRedNoteコンポーネントと「道路寸法」フィールドを表示する

**Validates: Requirements 1.3**

### プロパティ3: property_type変更時のリアルタイム切り替え

*任意の* `property_type` 値の変更（「土」→他の値、または他の値→「土」）に対して、RedNoteと「道路寸法」フィールドの表示状態が即座に切り替わる

**Validates: Requirements 1.4**

---

## エラーハンドリング

### 考慮すべきエッジケース

1. **`property_type` が `null` または `undefined` の場合**
   - `getValue('property_type') === '土'` は `false` を返すため、自動的に非表示になる
   - 追加の null チェックは不要

2. **`property_type` が空文字列の場合**
   - 同様に `false` を返すため非表示になる（要件1の「または空」に対応）

3. **背景色の適用によるレイアウト崩れ**
   - `borderRadius: 1` と `p: 1` を適用することで、フィールドとの間隔を適切に保つ
   - 既存の `mb: 1.5` を持つフィールドとの整合性を確認する

---

## テスト戦略

### ユニットテスト（例ベース）

以下の具体的なシナリオをテストします：

1. **フォントサイズ変更の確認**
   - 「【登録関係】」Typographyの `variant` が `subtitle1` であることを確認
   - 「【確認関係】」Typographyの `variant` が `subtitle1` であることを確認
   - 既存の `color` と `fontWeight` が維持されていることを確認

2. **背景色の適用確認**
   - 5つのセクションそれぞれに `bgcolor` が設定されていることを確認
   - 5つの背景色が全て異なることを確認
   - SectionHeaderが背景色を持つBoxの内部にあることを確認

### プロパティベーステスト

プロパティ1〜3は、Reactコンポーネントのレンダリングテストとして実装します。

**使用ライブラリ**: `@testing-library/react` + `fast-check`（TypeScript/React向けPBTライブラリ）

**テスト設定**: 各プロパティテストは最低100回のイテレーションを実行

**タグ形式**: `Feature: business-site-registration-tab-ui-improvement, Property {番号}: {プロパティテキスト}`

#### プロパティ1のテスト実装方針

```typescript
// Feature: business-site-registration-tab-ui-improvement, Property 1: 種別「土」以外での条件付き非表示
fc.assert(
  fc.property(
    fc.string().filter(s => s !== '土'), // 「土」以外の任意の文字列
    (propertyType) => {
      const { queryByText, queryByLabelText } = render(
        <SiteRegistrationSection propertyType={propertyType} />
      );
      // RedNoteが非表示
      expect(queryByText(/地積測量図や字図を格納/)).toBeNull();
      // 道路寸法フィールドが非表示
      expect(queryByLabelText('道路寸法')).toBeNull();
    }
  ),
  { numRuns: 100 }
);
```

#### プロパティ2のテスト実装方針

```typescript
// Feature: business-site-registration-tab-ui-improvement, Property 2: 種別「土」での条件付き表示
// property_type === '土' の場合、RedNoteと道路寸法フィールドが表示されることを確認
```

#### プロパティ3のテスト実装方針

```typescript
// Feature: business-site-registration-tab-ui-improvement, Property 3: property_type変更時のリアルタイム切り替え
// property_typeを「土」から別の値に変更した後、非表示になることを確認
// property_typeを別の値から「土」に変更した後、表示されることを確認
```

### 手動確認項目

- [ ] `property_type` が「土」の場合: RedNoteと道路寸法フィールドが表示される
- [ ] `property_type` が「建物」「マンション」等の場合: RedNoteと道路寸法フィールドが非表示になる
- [ ] `property_type` が空の場合: RedNoteと道路寸法フィールドが非表示になる
- [ ] 「【登録関係】」「【確認関係】」のフォントが大きくなっている（16px以上）
- [ ] 各セクションに異なる背景色が適用されている
- [ ] 背景色によってテキストの可読性が損なわれていない
- [ ] 既存の機能（保存、フィールド編集等）が正常に動作する
