# 設計ドキュメント: 買主物件番号手動入力機能

## 概要

買主詳細画面（BuyerDetailPage）において、買主の `property_number` が未設定の場合に以下の2つの機能を追加する。

1. **物件番号手動入力フォーム（ManualInputForm）**: 担当者が物件番号を手動入力・保存できるフォームを物件詳細カードエリアに表示する。入力値は `property_listings` テーブルに存在するかバリデーションし、既存の `PUT /api/buyers/:id` エンドポイントで保存する。

2. **他社物件情報セクション（OtherCompanyPropertySection）**: 物件番号が未設定の場合のみ表示される自由記述テキストエリア。`buyers` テーブルに新規追加する `other_company_property_info` カラムに保存する。

既存の「紐づいた物件はありません」表示は ManualInputForm に置き換えられ、同時表示はしない。

---

## アーキテクチャ

### 変更対象ファイル

```
frontend/frontend/src/pages/BuyerDetailPage.tsx   ← 主要変更
backend/src/routes/buyers.ts                       ← バリデーションエンドポイント追加
backend/src/services/BuyerService.ts               ← 物件番号存在確認メソッド追加
```

### 新規ファイル

```
backend/add-other-company-property-info.sql        ← DBマイグレーション
```

### データフロー

```
[担当者] 物件番号入力
    ↓
[フロントエンド] 空文字バリデーション（クライアントサイド）
    ↓
[フロントエンド] GET /api/buyers/validate-property-number?number=XX1234
    ↓
[バックエンド] property_listings テーブルで存在確認
    ↓ 存在する場合
[フロントエンド] PUT /api/buyers/:id { property_number: "XX1234" }
    ↓
[バックエンド] buyers テーブル更新
    ↓
[フロントエンド] fetchLinkedProperties() 再実行 → 物件詳細カード表示
```

---

## コンポーネントとインターフェース

### フロントエンド: ManualInputForm（BuyerDetailPage内インライン実装）

`BuyerDetailPage.tsx` 内に新しいローカル状態とJSXブロックとして実装する（独立コンポーネントファイルは作成しない）。

#### 追加するローカル状態

```typescript
// 物件番号手動入力フォーム用
const [manualPropertyNumber, setManualPropertyNumber] = useState('');
const [manualPropertyNumberError, setManualPropertyNumberError] = useState('');
const [isSavingPropertyNumber, setIsSavingPropertyNumber] = useState(false);

// 他社物件情報セクション用
const [otherCompanyPropertyInfo, setOtherCompanyPropertyInfo] = useState('');
const [isSavingOtherCompanyInfo, setIsSavingOtherCompanyInfo] = useState(false);
const [otherCompanyInfoSaveStatus, setOtherCompanyInfoSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
```

#### 物件番号保存ハンドラ

```typescript
const handleSavePropertyNumber = async () => {
  // 1. 空文字バリデーション
  if (!manualPropertyNumber.trim()) {
    setManualPropertyNumberError('物件番号を入力してください');
    return;
  }
  setIsSavingPropertyNumber(true);
  setManualPropertyNumberError('');
  try {
    // 2. 物件番号存在確認
    const validateRes = await api.get(
      `/api/buyers/validate-property-number?number=${encodeURIComponent(manualPropertyNumber.trim())}`
    );
    if (!validateRes.data.exists) {
      setManualPropertyNumberError(`物件番号「${manualPropertyNumber.trim()}」は存在しません`);
      return;
    }
    // 3. 保存
    await api.put(`/api/buyers/${buyer_number}?sync=false`, {
      property_number: manualPropertyNumber.trim(),
    });
    // 4. 物件詳細カード更新
    await fetchLinkedProperties();
    // 5. buyer状態を更新（フォームを非表示にするため）
    setBuyer(prev => prev ? { ...prev, property_number: manualPropertyNumber.trim() } : prev);
    setManualPropertyNumber('');
  } catch {
    setManualPropertyNumberError('保存に失敗しました。再度お試しください。');
  } finally {
    setIsSavingPropertyNumber(false);
  }
};
```

#### 他社物件情報保存ハンドラ

```typescript
const handleSaveOtherCompanyPropertyInfo = async () => {
  setIsSavingOtherCompanyInfo(true);
  setOtherCompanyInfoSaveStatus('idle');
  try {
    await api.put(`/api/buyers/${buyer_number}?sync=false`, {
      other_company_property_info: otherCompanyPropertyInfo,
    });
    setOtherCompanyInfoSaveStatus('success');
    setBuyer(prev => prev ? { ...prev, other_company_property_info: otherCompanyPropertyInfo } : prev);
  } catch {
    setOtherCompanyInfoSaveStatus('error');
  } finally {
    setIsSavingOtherCompanyInfo(false);
  }
};
```

### バックエンド: 物件番号バリデーションエンドポイント

`backend/src/routes/buyers.ts` に新規エンドポイントを追加する。

```typescript
// GET /api/buyers/validate-property-number?number=XX1234
// 物件番号が property_listings テーブルに存在するか確認
router.get('/validate-property-number', async (req: Request, res: Response) => {
  const { number } = req.query;
  if (!number || typeof number !== 'string') {
    return res.status(400).json({ error: 'number query parameter is required' });
  }
  const exists = await buyerService.validatePropertyNumber(number.trim());
  res.json({ exists });
});
```

`backend/src/services/BuyerService.ts` に `validatePropertyNumber` メソッドを追加する。

```typescript
async validatePropertyNumber(propertyNumber: string): Promise<boolean> {
  const { data, error } = await this.supabase
    .from('property_listings')
    .select('property_number')
    .eq('property_number', propertyNumber)
    .maybeSingle();
  if (error) throw new Error(`Failed to validate property number: ${error.message}`);
  return data !== null;
}
```

---

## データモデル

### DBマイグレーション: other_company_property_info カラム追加

```sql
-- add-other-company-property-info.sql
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS other_company_property_info TEXT;

COMMENT ON COLUMN buyers.other_company_property_info IS
  '他社物件情報（物件番号未設定時に担当者が自由記述で入力する他社物件情報）';
```

### buyers テーブル変更点

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| `other_company_property_info` | TEXT | 許容 | NULL | 他社物件情報（新規追加） |

### 既存カラムとの関係

- `other_company_property`（既存）: 他社物件の住所（公開物件サイト向け表示用）
- `building_name_price`（既存）: 建物名/価格
- `other_company_property_info`（新規）: 担当者向け自由記述の他社物件情報

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ 1: 物件番号の有無によるフォーム表示の排他性

*任意の* 買主データに対して、`property_number` が空/未設定の場合は ManualInputForm が表示され「紐づいた物件はありません」メッセージは非表示になり、`property_number` が設定されている場合はその逆になる。すなわち、ManualInputForm と「紐づいた物件はありません」メッセージは同時に表示されない。

**Validates: Requirements 1.1, 1.2, 5.1, 5.2**

### プロパティ 2: 空白文字列の物件番号バリデーション

*任意の* 空白文字のみで構成された文字列（空文字、スペース、タブ等）を物件番号として入力した場合、バリデーション関数はその入力を無効と判定し、APIコールを実行しない。

**Validates: Requirements 2.1**

### プロパティ 3: 存在しない物件番号のエラーメッセージフォーマット

*任意の* 物件番号文字列が `property_listings` テーブルに存在しない場合、エラーメッセージは「物件番号「{入力値}」は存在しません」の形式になり、入力値がメッセージ内に含まれる。

**Validates: Requirements 2.3**

### プロパティ 4: 保存中のボタン状態制御

*任意の* isSaving 状態において、isSaving=true の間は保存ボタンが disabled かつラベルが「保存中...」になり、isSaving=false の場合は保存ボタンが有効かつ通常ラベルになる。この関係は ManualInputForm と OtherCompanyPropertySection の両方で成立する。

**Validates: Requirements 4.1, 4.2, 4.3, 6.7**

### プロパティ 5: property_number の有無による OtherCompanyPropertySection 表示制御

*任意の* 買主データに対して、`property_number` が空/未設定の場合は OtherCompanyPropertySection が表示され、`property_number` が設定されている場合は非表示になる。

**Validates: Requirements 6.1, 6.2**

### プロパティ 6: OtherCompanyPropertyInfo の初期値表示

*任意の* `other_company_property_info` 値を持つ買主データが BuyerDetailPage に渡された場合、OtherCompanyPropertySection のテキストエリアの初期値はその値と一致する。

**Validates: Requirements 6.8**

---

## エラーハンドリング

| エラーケース | 対応 |
|---|---|
| 空文字で保存ボタン押下 | クライアントサイドで即時エラー表示「物件番号を入力してください」。APIコールなし。 |
| 存在しない物件番号 | バリデーションAPI応答後にエラー表示「物件番号「{入力値}」は存在しません」。保存APIコールなし。 |
| バリデーションAPI失敗 | エラーメッセージ「保存に失敗しました。再度お試しください。」を表示。 |
| 保存API失敗 | エラーメッセージ「保存に失敗しました。再度お試しください。」を表示。 |
| 他社物件情報保存API失敗 | エラーメッセージ「保存に失敗しました。再度お試しください。」を表示。 |

---

## テスト戦略

### ユニットテスト（例示ベース）

- ManualInputForm のレンダリング確認（テキスト入力フィールドと保存ボタンの存在）
- プレースホルダーテキスト「物件番号を入力（例：AA1234）」の確認
- 保存成功後に ManualInputForm が非表示になることの確認
- 保存成功後に fetchLinkedProperties が呼ばれることの確認
- OtherCompanyPropertySection のレンダリング確認（ラベルとテキストエリアの存在）
- 保存成功後の成功フィードバック表示確認
- APIエラー時のエラーメッセージ表示確認

### プロパティベーステスト（fast-check を使用）

各プロパティに対して最低100回のイテレーションを実行する。

```typescript
// テストタグ形式
// Feature: buyer-property-number-manual-input, Property {番号}: {プロパティテキスト}
```

**プロパティ 1 のテスト例**:
```typescript
// Feature: buyer-property-number-manual-input, Property 1: 物件番号の有無によるフォーム表示の排他性
fc.assert(
  fc.property(
    fc.record({
      property_number: fc.oneof(fc.constant(null), fc.constant(''), fc.string({ minLength: 1 })),
    }),
    (buyer) => {
      const hasPropertyNumber = !!(buyer.property_number && buyer.property_number.trim() !== '');
      const showManualForm = !hasPropertyNumber;
      const showNoPropertyMessage = !hasPropertyNumber;
      // ManualFormとnoPropertyMessageは同じ条件で表示される（排他的に「紐づいた物件はありません」と置き換え）
      expect(showManualForm).toBe(!hasPropertyNumber);
      expect(showNoPropertyMessage).toBe(!hasPropertyNumber);
      // 両方同時にtrueにはならない（ManualFormが表示される時は「紐づいた物件はありません」は非表示）
      expect(showManualForm && !showNoPropertyMessage || !showManualForm).toBe(true);
    }
  ),
  { numRuns: 100 }
);
```

### 統合テスト

- `GET /api/buyers/validate-property-number` エンドポイントの動作確認（存在する物件番号/存在しない物件番号）
- `PUT /api/buyers/:id` で `other_company_property_info` が正しく保存されることの確認

### スモークテスト

- `buyers` テーブルに `other_company_property_info` カラムが存在することの確認
