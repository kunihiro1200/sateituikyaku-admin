# 買主詳細画面「他社物件情報」セクション条件表示バグ修正記録

## 修正日
2026年4月9日

## 問題

### 問題1: 他社物件情報セクションの条件表示バグ
買主詳細画面において、「他社物件」フィールドと「建物名/価格」フィールドの両方が空の場合でも「他社物件情報」セクションが表示されていた。

### 問題2: 他社物件フィールドのプレースホルダー表示
「他社物件」フィールドに説明文をプレースホルダーとして表示する必要があった。

## 根本原因

### 原因1: 条件式の誤り
`BuyerDetailPage.tsx`の`hasOtherCompanyPropertyData`ヘルパー関数が、「他社物件」と「建物名/価格」の両方をチェックしていたが、ユーザーの要件は「他社物件」フィールドのみをチェックすることだった。

### 原因2: プレースホルダーの重複表示
`placeholder`と`helperText`の両方を設定したため、説明文が2箇所に表示されていた。

## 修正内容

### 1. 他社物件情報セクションの条件表示修正（コミット: 106833f1）

**修正前**:
```typescript
const hasOtherCompanyPropertyData = (buyer: Buyer | null): boolean => {
  if (!buyer) return false;
  const hasOtherProperty = !!(buyer.other_company_property && buyer.other_company_property.trim() !== '');
  const hasBuildingNamePrice = !!(buyer.building_name_price && buyer.building_name_price.trim() !== '');
  return hasOtherProperty || hasBuildingNamePrice;
};
```

**修正後**:
```typescript
const hasOtherCompanyPropertyData = (buyer: Buyer | null): boolean => {
  if (!buyer) return false;
  // 「他社物件」フィールドのみをチェック（「建物名/価格」は条件に含めない）
  const hasOtherProperty = !!(buyer.other_company_property && buyer.other_company_property.trim() !== '');
  return hasOtherProperty;
};
```

### 2. プレースホルダー表示の実装（コミット: aa43c858, 80f141ad, b8837122）

#### InlineEditableField.tsxに`helperText`プロパティを追加
```typescript
export interface InlineEditableFieldProps {
  // ... 既存のプロパティ
  helperText?: string;  // フィールド下部に表示する説明文
}
```

#### NewBuyerPage.tsxの修正
**最終版**:
```typescript
<TextField
  fullWidth
  label="他社物件"
  multiline
  rows={3}
  value={otherCompanyProperty}
  onChange={(e) => setOtherCompanyProperty(e.target.value)}
  helperText="こちらは詳細な住所のみにしてください。お客様に物件情報として表示されます。他社名や価格は「建物名/価格」欄に書いてください。"
  InputLabelProps={{ shrink: true }}
  sx={{ bgcolor: 'white' }}
/>
```

#### BuyerDetailPage.tsxの修正
**最終版**:
```typescript
<InlineEditableField
  label="他社物件"
  value={buyer?.other_company_property || ''}
  fieldName="other_company_property"
  fieldType="textarea"
  onSave={handleInlineFieldSave}
  onChange={(fieldName, newValue) => handleFieldChange('他社物件情報', fieldName, newValue)}
  buyerId={buyer_number}
  enableConflictDetection={false}
  showEditIndicator={true}
  alwaysShowBorder={true}
  helperText="こちらは詳細な住所のみにしてください。お客様に物件情報として表示されます。他社名や価格は「建物名/価格」欄に書いてください。"
/>
```

## テスト結果

### バグ条件探索テスト
- ✅ 両フィールドが空の場合、セクションが非表示になることを確認
- ✅ 「他社物件」フィールドに値がある場合、セクションが表示されることを確認
- ✅ 「建物名/価格」フィールドのみに値がある場合、セクションが非表示になることを確認

### 保存プロパティテスト
- ✅ 新規買主登録画面では常にセクションが表示されることを確認
- ✅ 他のセクションの表示・保存機能に影響がないことを確認

## 影響範囲
- `frontend/frontend/src/pages/BuyerDetailPage.tsx` - 条件表示ロジックの修正
- `frontend/frontend/src/pages/NewBuyerPage.tsx` - プレースホルダー表示の追加
- `frontend/frontend/src/components/InlineEditableField.tsx` - `helperText`プロパティの追加

## コミット番号
- **106833f1** - 他社物件情報セクションの条件表示を修正（`building_name_price`のチェックを削除）
- **aa43c858** - 他社物件フィールドに`helperText`を追加してプレースホルダーを表示
- **80f141ad** - `borderPlaceholder`を削除して重複表示を修正
- **b8837122** - `NewBuyerPage`の`placeholder`を削除して重複表示を完全に修正

## 教訓
1. ユーザー要件を正確に理解する（「他社物件」のみをチェック）
2. Material-UIの`TextField`で`label`がある場合、`placeholder`は表示されない
3. `helperText`を使用してフィールド下部に説明文を表示する
4. `placeholder`と`helperText`を同時に使用すると重複表示される

---

**最終更新日**: 2026年4月9日
**作成理由**: 買主詳細画面の他社物件情報セクション条件表示バグとプレースホルダー表示の実装記録
