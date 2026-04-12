# 設計ドキュメント

## 概要

業務詳細画面（WorkTaskDetailModal）の「契約決済」タブにおいて、業務フローの変更により不要となった6つのフィールドをフロントエンドから非表示にする。

対象ファイル: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

変更はフロントエンドのみで完結し、バックエンドAPI・DBスキーマ・データモデルへの変更は一切行わない。

## アーキテクチャ

### 変更範囲

```
frontend/frontend/src/components/WorkTaskDetailModal.tsx
└── ContractSettlementSection相当のJSX（WorkTaskDetailModal内のインライン実装）
    ├── [削除] EditableYesNo: hirose_request_sales
    ├── [削除] EditableYesNo: cw_request_sales
    ├── [削除] Grid container: work_content（ボタングループ）
    ├── [削除] EditableField: attachment_prep_deadline
    ├── [削除] EditableField: attachment_completed
    └── [削除] EditableField: attachment_printed
```

### 変更方針

対象の6フィールドに対応するJSXを**コードから削除**する。`display: none` や条件分岐による非表示ではなく、JSXそのものを除去することで、不要なレンダリングを完全に排除する。

## コンポーネントとインターフェース

### 対象コンポーネント

`WorkTaskDetailModal.tsx` 内の「契約決済」タブ描画部分（約780〜840行付近）。

### 削除対象JSX

#### 1. 広瀬さんへ依頼（売買契約関連）

```tsx
// 削除対象
<EditableYesNo label="広瀬さんへ依頼（売買契約関連）" field="hirose_request_sales" />
```

#### 2. CWへ依頼（売買契約関連）

```tsx
// 削除対象
<EditableYesNo label="CWへ依頼（売買契約関連）" field="cw_request_sales" />
```

#### 3. 作業内容（Gridコンテナ＋ボタングループ）

```tsx
// 削除対象（Grid container全体）
<Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
  <Grid item xs={4}>
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>作業内容</Typography>
  </Grid>
  <Grid item xs={8}>
    <ButtonGroup size="small" variant="outlined">
      <Button ...>書類取得のみ</Button>
      <Button ...>入力のみ</Button>
      <Button ...>両方</Button>
    </ButtonGroup>
  </Grid>
</Grid>
```

#### 4. 添付資料準備納期

```tsx
// 削除対象
<EditableField label="添付資料準備納期" field="attachment_prep_deadline" type="date" />
```

#### 5. 添付資料完了

```tsx
// 削除対象
<EditableField label="添付資料完了" field="attachment_completed" />
```

#### 6. 添付資料印刷

```tsx
// 削除対象
<EditableField label="添付資料印刷" field="attachment_printed" />
```

### 削除後の残存フィールド順序

削除後、「契約決済」タブには以下のフィールドが元の順序を維持して表示される：

1. 契約形態
2. CW（浅沼様）全エリア・種別依頼OK（表示のみ）
3. 重説・契約書入力納期*
4. 事前確認チェックボタン（PreRequestCheckButton）
5. コメント（売買契約）
6. ~~広瀬さんへ依頼（売買契約関連）~~ ← 削除
7. ~~CWへ依頼（売買契約関連）~~ ← 削除
8. 社員が契約書作成
9. ~~作業内容~~ ← 削除
10. ~~添付資料準備納期~~ ← 削除
11. ~~添付資料完了~~ ← 削除
12. ~~添付資料印刷~~ ← 削除
13. 製本予定日
14. 製本完了
15. 決済日
16. 決済予定月
17. 売買価格
18. 仲介手数料（売）
19. 通常仲介手数料（売）
20. キャンペーン
21. 減額理由
22. 減額理由他
23. 売・支払方法
24. 入金確認（売）
25. 仲介手数料（買）
26. 通常仲介手数料（買）
27. 買・支払方法
28. 入金確認（買）
29. 経理確認済み

## データモデル

変更なし。バックエンドAPI・DBスキーマ・TypeScriptの型定義（`WorkTaskData` インターフェース）はすべて現状維持。

非表示にするフィールドのデータは引き続きDBに保存されており、APIレスポンスにも含まれるが、UIには表示しない。

## 正確性プロパティ

このフィーチャーはUIレンダリングの変更（特定JSXの削除）であり、純粋関数・パーサー・シリアライザー・ビジネスロジックを含まない。すべての受け入れ基準はUIの存在確認（EXAMPLE）またはインフラ確認（INTEGRATION/SMOKE）に分類されるため、プロパティベーステストは適用しない。

代わりに、スナップショットテストとexampleベースのユニットテストを使用する。

## エラーハンドリング

フロントエンドのJSX削除のみのため、新たなエラーハンドリングは不要。

削除後も残存フィールドの保存・更新処理は変更なく動作する。`handleFieldChange` および `handleSave` 関数は対象フィールドを参照していないため、影響なし。

## テスト戦略

### 方針

PBTは適用しない（UIレンダリング変更のため）。スナップショットテストとexampleベースのテストで対応する。

### テスト項目

#### 非表示確認（EXAMPLE）

| テスト | 確認内容 |
|--------|---------|
| hirose_request_sales非表示 | `field="hirose_request_sales"` を持つ要素が存在しないこと |
| cw_request_sales非表示 | `field="cw_request_sales"` を持つ要素が存在しないこと |
| work_content非表示 | 「作業内容」ラベルを持つGridが存在しないこと |
| attachment_prep_deadline非表示 | `field="attachment_prep_deadline"` を持つ要素が存在しないこと |
| attachment_completed非表示 | `field="attachment_completed"` を持つ要素が存在しないこと |
| attachment_printed非表示 | `field="attachment_printed"` を持つ要素が存在しないこと |

#### 残存フィールド確認（EXAMPLE）

| テスト | 確認内容 |
|--------|---------|
| 残存フィールド表示 | 製本予定日・決済日・売買価格など残存フィールドが正常に表示されること |

#### バックエンド変更なし確認（SMOKE）

コードレビューにより、バックエンドファイル（`backend/`配下）への変更がないことを確認する。

### 手動確認手順

1. ローカル環境で `npm run dev` を起動
2. 業務詳細画面を開き「契約決済」タブを選択
3. 以下6フィールドが表示されないことを確認：
   - 広瀬さんへ依頼（売買契約関連）
   - CWへ依頼（売買契約関連）
   - 作業内容
   - 添付資料準備納期
   - 添付資料完了
   - 添付資料印刷
4. 残存フィールド（製本予定日・決済日・売買価格など）が正常に表示・編集できることを確認
5. 残存フィールドを編集して保存し、データが正常に保存されることを確認
