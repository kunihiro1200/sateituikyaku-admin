# 設計ドキュメント：備忘録フィールド拡大機能

## 概要

物件リスト詳細画面（`PropertyListingDetailPage`）の「特記・備忘録」セクションにある備忘録テキストフィールドの表示行数を、現在の `rows={2}` から `rows={6}` 以上に変更する。

この変更は単一ファイルの単一属性値の変更であり、バックエンドへの影響はない。

---

## アーキテクチャ

### 変更対象

| 項目 | 内容 |
|------|------|
| ファイル | `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` |
| 変更箇所 | 行2282付近の備忘録 `TextField` コンポーネントの `rows` 属性 |
| 変更内容 | `rows={2}` → `rows={6}` |
| バックエンド変更 | なし |
| API変更 | なし |
| データモデル変更 | なし |

### 変更の影響範囲

```
PropertyListingDetailPage
└── 特記・備忘録セクション
    ├── 特記フィールド（rows={2}、変更なし）
    └── 備忘録フィールド（rows={2} → rows={6}）← 変更対象
```

---

## コンポーネントとインターフェース

### 変更前

```tsx
<TextField
  fullWidth
  multiline
  rows={2}
  value={editedData.memo !== undefined ? editedData.memo : (data.memo || '')}
  onChange={(e) => handleFieldChange('memo', e.target.value)}
  placeholder="備忘録を入力してください"
  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', lineHeight: 1.8 } }}
/>
```

### 変更後

```tsx
<TextField
  fullWidth
  multiline
  rows={6}
  value={editedData.memo !== undefined ? editedData.memo : (data.memo || '')}
  onChange={(e) => handleFieldChange('memo', e.target.value)}
  placeholder="備忘録を入力してください"
  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', lineHeight: 1.8 } }}
/>
```

変更点は `rows={2}` → `rows={6}` の1箇所のみ。他の属性（`fullWidth`、`multiline`、`value`、`onChange`、`placeholder`、`sx`）はすべて維持する。

---

## データモデル

変更なし。`PropertyListing` インターフェースの `memo?: string` フィールドはそのまま使用する。

---

## エラーハンドリング

変更なし。既存の `handleSaveNotes` 関数のエラーハンドリング（`setSnackbar` によるエラー表示）をそのまま維持する。

---

## テスト戦略

### PBT適用判断

本機能はUIコンポーネントの属性値変更（`rows={2}` → `rows={6}`）のみであり、純粋関数やデータ変換ロジックを含まない。入力値によって動作が変わる普遍的な性質（property）が存在しないため、**プロパティベーステストは適用しない**。

代わりに例ベーステスト（unit test）を使用する。

### 単体テスト方針

以下の観点で例ベーステストを実施する：

1. **行数確認**: 備忘録フィールドの `rows` 属性が6以上であること
2. **行数比較**: 備忘録フィールドの行数が特記フィールドの行数より多いこと
3. **既存属性の維持**: `fullWidth`、`multiline`、`placeholder`、`fontSize` が変更前と同じであること
4. **保存ボタン動作**: `memo` フィールドに値を入力した後、保存ボタンが有効化されること

### 手動確認項目

- 備忘録フィールドが6行分の高さで表示されること
- 長文テキストを入力した際にスクロールなしで内容が確認できること
- 保存ボタンが正常に動作すること（変更検知・パルスアニメーション・API呼び出し）
- 特記フィールドの表示に影響がないこと
