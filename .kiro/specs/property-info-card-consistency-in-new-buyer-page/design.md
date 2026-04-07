# Design Document

## Overview

買主新規作成ページ（NewBuyerPage）の物件情報表示を、買主詳細ページ（BuyerDetailPage）と同じ`PropertyInfoCard`コンポーネントに統一する設計です。現在、NewBuyerPageでは独自の物件情報表示を実装していますが、これを`PropertyInfoCard`に置き換えることで、以下のメリットを実現します：

- **表示の一貫性**: BuyerDetailPageと同じUIで物件情報を表示
- **機能の統一**: atbb_status（ステータス）とdistribution_date（配信日）を表示
- **コードの簡素化**: 重複コードを削除し、メンテナンス性を向上
- **バグの削減**: 共通コンポーネントを使用することで、バグ修正が一箇所で済む

## Architecture

### コンポーネント構成

```
NewBuyerPage
├── Container
│   ├── Header（戻るボタン、タイトル、ナビゲーションボタン）
│   ├── Alert（エラー表示）
│   ├── Success Box（登録完了後のボタン表示）
│   └── Grid Container
│       ├── Grid Item (xs=12 md=5) - 左側
│       │   ├── TextField（物件番号入力）
│       │   └── PropertyInfoCard（物件情報表示）← 新規追加
│       └── Grid Item (xs=12 md=7) - 右側
│           └── Paper（買主入力フォーム）
```

### データフロー

```
NewBuyerPage
  ↓ propertyNumberField (state)
  ↓ onChange → setPropertyNumberField
  ↓
PropertyInfoCard
  ↓ propertyId prop
  ↓ 内部でfetchPropertyDetails()
  ↓ api.get(`/api/property-listings/${propertyId}`)
  ↓
物件情報表示（atbb_status, distribution_date含む）
```

## Components and Interfaces

### 1. NewBuyerPage（変更）

**変更内容**:
- `PropertyInfoCard`コンポーネントをインポート
- 独自の物件情報表示コードを削除
- `PropertyInfoCard`を配置

**削除するコード**:
```typescript
// 削除: PropertyInfo interface
interface PropertyInfo {
  property_number: string;
  address: string;
  property_type: string;
  sales_price: number | null;
  land_area: number | null;
  building_area: number | null;
  floor_plan?: string;
  current_status?: string;
  pre_viewing_notes?: string;
  property_tax?: number;
  management_fee?: number;
  reserve_fund?: number;
  parking?: string;
  parking_fee?: number;
  delivery?: string;
  viewing_key?: string;
  viewing_parking?: string;
  viewing_notes?: string;
  special_notes?: string;
  memo?: string;
  broker_response?: string | number;
  offer_status?: string;
}

// 削除: propertyInfo state
const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null);

// 削除: loadingProperty state
const [loadingProperty, setLoadingProperty] = useState(false);

// 削除: fetchPropertyInfo関数
const fetchPropertyInfo = async (propNum: string) => {
  setLoadingProperty(true);
  try {
    const response = await api.get(`/api/property-listings/${propNum}`);
    setPropertyInfo(response.data);
  } catch (error) {
    console.error('Failed to fetch property info:', error);
    setPropertyInfo(null);
  } finally {
    setLoadingProperty(false);
  }
};

// 削除: useEffect内のfetchPropertyInfo呼び出し
useEffect(() => {
  if (propertyNumber) {
    fetchPropertyInfo(propertyNumber); // ← 削除
  }
  // ...
}, [propertyNumber]);

// 削除: 物件番号入力フィールドのonChange内のfetchPropertyInfo呼び出し
<TextField
  fullWidth
  label="物件番号"
  value={propertyNumberField}
  onChange={(e) => {
    setPropertyNumberField(e.target.value);
    if (e.target.value) {
      fetchPropertyInfo(e.target.value); // ← 削除
    } else {
      setPropertyInfo(null); // ← 削除
    }
  }}
  sx={{ mb: 2 }}
/>

// 削除: 独自の物件情報表示コード（約500行）
{loadingProperty && (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
    <CircularProgress size={32} />
  </Box>
)}

{propertyInfo && !loadingProperty && (
  <Box>
    {/* 業者への対応日付表示 */}
    {/* 特記・備忘録 */}
    {/* 内覧前伝達事項 */}
    {/* 内覧情報 */}
    {/* 基本情報 */}
    {/* よく聞かれる項目 */}
  </Box>
)}

{!propertyInfo && !loadingProperty && propertyNumberField && (
  <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
    <Typography variant="body2">物件情報が見つかりませんでした</Typography>
  </Box>
)}

{!propertyNumberField && (
  <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
    <Typography variant="body2">物件番号を入力すると物件情報が表示されます</Typography>
  </Box>
)}
```

**追加するコード**:
```typescript
// 追加: PropertyInfoCardのインポート
import PropertyInfoCard from '../components/PropertyInfoCard';

// 追加: PropertyInfoCardの配置
<Grid item xs={12} md={5}>
  <Box sx={{ position: 'sticky', top: 16 }}>
    {/* 物件番号入力フィールド */}
    <TextField
      fullWidth
      label="物件番号"
      value={propertyNumberField}
      onChange={(e) => setPropertyNumberField(e.target.value)}
      sx={{ mb: 2 }}
    />
    
    {/* PropertyInfoCard */}
    {propertyNumberField && (
      <PropertyInfoCard
        propertyId={propertyNumberField}
        buyer={{ latest_status: latestStatus }}
        showCloseButton={false}
      />
    )}
    
    {/* 物件番号が空の場合のメッセージ */}
    {!propertyNumberField && (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>物件情報</Typography>
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            物件番号を入力すると物件情報が表示されます
          </Typography>
        </Box>
      </Paper>
    )}
  </Box>
</Grid>
```

### 2. PropertyInfoCard（変更なし）

**現在の実装**:
- `showCloseButton` propは既に実装済み（デフォルト値: `true`）
- `buyer` propを受け取り、`latest_status`を使用して買付状況バッジを表示
- `propertyId` propを受け取り、内部で物件情報を取得

**使用方法**:
```typescript
<PropertyInfoCard
  propertyId={propertyNumberField}
  buyer={{ latest_status: latestStatus }}
  showCloseButton={false}
/>
```

**Props**:
```typescript
interface PropertyInfoCardProps {
  propertyId: string;           // 物件番号
  buyer?: Buyer;                // 買主情報（latest_statusを使用）
  onClose?: () => void;         // 閉じるボタンのハンドラ
  showCloseButton?: boolean;    // 閉じるボタンの表示/非表示（デフォルト: true）
}
```

## Data Models

### PropertyInfo（PropertyInfoCard内部で使用）

```typescript
interface PropertyFullDetails {
  id: number;
  property_number: string;
  atbb_status?: string;          // ステータス（「専任・公開中」「一般・公開中」等）
  status?: string;               // atbb成約済み/非公開
  distribution_date?: string;    // 配信日
  address?: string;              // 所在地
  display_address?: string;      // 住居表示
  property_type?: string;        // 種別
  sales_assignee?: string;       // 担当名
  price?: number;                // 価格
  listing_price?: number;        // 売出価格
  monthly_loan_payment?: number; // 月々ローン支払い
  offer_status?: string;         // 買付有無
  price_reduction_history?: string; // 値下げ履歴
  sale_reason?: string;          // 理由
  suumo_url?: string;            // Suumo URL
  google_map_url?: string;       // Google Map URL
  confirmation_status?: string;  // 確済
  structure?: string;
  floor_plan?: string;
  land_area?: number;
  building_area?: number;
  pre_viewing_notes?: string;    // 内覧前伝達事項
  broker_response?: string;      // 業者対応日付
}
```

### Buyer（NewBuyerPageで使用）

```typescript
interface Buyer {
  latest_status?: string;  // 最新状況（買付状況バッジの表示に使用）
}
```

## Error Handling

### 1. 物件情報の取得エラー

**発生条件**: 
- 物件番号が存在しない
- APIエラー
- ネットワークエラー

**処理**:
- `PropertyInfoCard`内部で`error` stateを管理
- エラーメッセージを表示
- 「再試行」ボタンを表示

**実装**（PropertyInfoCard内部）:
```typescript
if (error) {
  return (
    <Paper sx={{ p: 3, mb: 3, position: 'relative', bgcolor: '#fff3f3' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold" color="error">
          物件情報
        </Typography>
        {showCloseButton && onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
      <Button variant="outlined" size="small" onClick={fetchPropertyDetails}>
        再試行
      </Button>
    </Paper>
  );
}
```

### 2. 物件番号が空の場合

**発生条件**: 
- ユーザーが物件番号を入力していない
- 物件番号を削除した

**処理**:
- `PropertyInfoCard`を非表示
- 「物件番号を入力すると物件情報が表示されます」メッセージを表示

**実装**（NewBuyerPage）:
```typescript
{!propertyNumberField && (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>物件情報</Typography>
    <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
      <Typography variant="body2">
        物件番号を入力すると物件情報が表示されます
      </Typography>
    </Box>
  </Paper>
)}
```

### 3. ローディング状態

**発生条件**: 
- 物件情報を取得中

**処理**:
- `PropertyInfoCard`内部で`loading` stateを管理
- `CircularProgress`を表示

**実装**（PropertyInfoCard内部）:
```typescript
if (loading) {
  return (
    <Paper sx={{ p: 3, mb: 3, position: 'relative' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    </Paper>
  );
}
```

## Testing Strategy

### Unit Tests

#### 1. NewBuyerPage

**テスト対象**:
- `PropertyInfoCard`が正しくレンダリングされるか
- 物件番号が空の場合、`PropertyInfoCard`が非表示になるか
- 物件番号が入力された場合、`PropertyInfoCard`が表示されるか
- `showCloseButton` propが`false`に設定されているか

**テストケース**:
```typescript
describe('NewBuyerPage - PropertyInfoCard Integration', () => {
  it('物件番号が空の場合、PropertyInfoCardが非表示になる', () => {
    render(<NewBuyerPage />);
    expect(screen.queryByTestId('property-info-card')).not.toBeInTheDocument();
    expect(screen.getByText('物件番号を入力すると物件情報が表示されます')).toBeInTheDocument();
  });

  it('物件番号が入力された場合、PropertyInfoCardが表示される', async () => {
    render(<NewBuyerPage />);
    const input = screen.getByLabelText('物件番号');
    fireEvent.change(input, { target: { value: 'AA9926' } });
    await waitFor(() => {
      expect(screen.getByTestId('property-info-card')).toBeInTheDocument();
    });
  });

  it('PropertyInfoCardのshowCloseButtonがfalseに設定されている', () => {
    render(<NewBuyerPage />);
    const input = screen.getByLabelText('物件番号');
    fireEvent.change(input, { target: { value: 'AA9926' } });
    // PropertyInfoCard内の閉じるボタンが存在しないことを確認
    expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument();
  });

  it('物件番号を削除すると、PropertyInfoCardが非表示になる', async () => {
    render(<NewBuyerPage />);
    const input = screen.getByLabelText('物件番号');
    fireEvent.change(input, { target: { value: 'AA9926' } });
    await waitFor(() => {
      expect(screen.getByTestId('property-info-card')).toBeInTheDocument();
    });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByTestId('property-info-card')).not.toBeInTheDocument();
  });
});
```

#### 2. PropertyInfoCard

**テスト対象**:
- `showCloseButton` propが正しく動作するか
- `buyer.latest_status`が正しく買付状況バッジに反映されるか
- `atbb_status`と`distribution_date`が表示されるか

**テストケース**:
```typescript
describe('PropertyInfoCard', () => {
  it('showCloseButtonがfalseの場合、閉じるボタンが非表示になる', () => {
    render(
      <PropertyInfoCard
        propertyId="AA9926"
        showCloseButton={false}
      />
    );
    expect(screen.queryByLabelText('閉じる')).not.toBeInTheDocument();
  });

  it('showCloseButtonがtrueの場合、閉じるボタンが表示される', () => {
    render(
      <PropertyInfoCard
        propertyId="AA9926"
        showCloseButton={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByLabelText('閉じる')).toBeInTheDocument();
  });

  it('atbb_statusが表示される', async () => {
    // モックAPIレスポンス
    mockApi.get.mockResolvedValue({
      data: {
        property_number: 'AA9926',
        atbb_status: '専任・公開中',
        distribution_date: '2026-01-01',
      },
    });

    render(<PropertyInfoCard propertyId="AA9926" />);
    
    await waitFor(() => {
      expect(screen.getByText('専任・公開中')).toBeInTheDocument();
    });
  });

  it('distribution_dateが表示される', async () => {
    // モックAPIレスポンス
    mockApi.get.mockResolvedValue({
      data: {
        property_number: 'AA9926',
        distribution_date: '2026-01-01',
      },
    });

    render(<PropertyInfoCard propertyId="AA9926" />);
    
    await waitFor(() => {
      expect(screen.getByText('2026/01/01')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

#### 1. NewBuyerPage全体のフロー

**テストシナリオ**:
1. NewBuyerPageを開く
2. 物件番号を入力
3. PropertyInfoCardが表示される
4. atbb_statusとdistribution_dateが表示される
5. 買主情報を入力
6. 登録ボタンをクリック
7. 登録完了メッセージが表示される

**テストケース**:
```typescript
describe('NewBuyerPage - Full Flow', () => {
  it('物件番号入力から買主登録までの一連の流れ', async () => {
    // モックAPIレスポンス
    mockApi.get.mockResolvedValue({
      data: {
        property_number: 'AA9926',
        atbb_status: '専任・公開中',
        distribution_date: '2026-01-01',
        address: '東京都渋谷区',
      },
    });

    mockApi.post.mockResolvedValue({
      data: { buyer_number: 'BY_001' },
    });

    render(<NewBuyerPage />);

    // 物件番号を入力
    const propertyInput = screen.getByLabelText('物件番号');
    fireEvent.change(propertyInput, { target: { value: 'AA9926' } });

    // PropertyInfoCardが表示されるまで待機
    await waitFor(() => {
      expect(screen.getByText('専任・公開中')).toBeInTheDocument();
      expect(screen.getByText('2026/01/01')).toBeInTheDocument();
    });

    // 買主情報を入力
    const nameInput = screen.getByLabelText('氏名・会社名');
    fireEvent.change(nameInput, { target: { value: '山田太郎' } });

    // 登録ボタンをクリック
    const submitButton = screen.getByRole('button', { name: '登録' });
    fireEvent.click(submitButton);

    // 登録完了メッセージが表示されるまで待機
    await waitFor(() => {
      expect(screen.getByText(/買主番号 BY_001 を登録しました/)).toBeInTheDocument();
    });
  });
});
```

### Manual Testing Checklist

#### 1. 基本機能

- [ ] 物件番号を入力すると、PropertyInfoCardが表示される
- [ ] 物件番号を削除すると、PropertyInfoCardが非表示になる
- [ ] PropertyInfoCardに閉じるボタンが表示されない
- [ ] atbb_statusが表示される
- [ ] distribution_dateが表示される

#### 2. エラーハンドリング

- [ ] 存在しない物件番号を入力すると、エラーメッセージが表示される
- [ ] 「再試行」ボタンをクリックすると、再度物件情報を取得する
- [ ] ネットワークエラー時にエラーメッセージが表示される

#### 3. レイアウト

- [ ] 物件情報カードが左側（Grid item xs={12} md={5}）に配置される
- [ ] 買主入力フォームが右側（Grid item xs={12} md={7}）に配置される
- [ ] sticky positioningが正しく動作する
- [ ] モバイル表示で正しくレイアウトされる

#### 4. 後方互換性

- [ ] BuyerDetailPageでPropertyInfoCardが正しく表示される
- [ ] BuyerDetailPageで閉じるボタンが表示される
- [ ] 他のページでPropertyInfoCardを使用している場合、影響がない

## Implementation Notes

### 1. 削除するコード量

**削除対象**:
- `PropertyInfo` interface: 約20行
- `propertyInfo` state: 1行
- `loadingProperty` state: 1行
- `fetchPropertyInfo` 関数: 約15行
- 独自の物件情報表示コード: 約500行

**合計**: 約537行

### 2. 追加するコード量

**追加対象**:
- `PropertyInfoCard`のインポート: 1行
- `PropertyInfoCard`の配置: 約20行
- 物件番号が空の場合のメッセージ: 約10行

**合計**: 約31行

**削減量**: 約506行（約94%削減）

### 3. 実装順序

1. **ステップ1**: `PropertyInfoCard`のインポートを追加
2. **ステップ2**: 物件番号入力フィールドを`PropertyInfoCard`の外に移動
3. **ステップ3**: `PropertyInfoCard`を配置
4. **ステップ4**: 独自の物件情報表示コードを削除
5. **ステップ5**: `PropertyInfo` interface、`propertyInfo` state、`loadingProperty` state、`fetchPropertyInfo` 関数を削除
6. **ステップ6**: テストを実行して動作確認

### 4. 注意事項

#### 物件番号入力フィールドの配置

**現在の実装**:
```typescript
<Paper sx={{ p: 3, position: 'sticky', top: 16 }}>
  <Typography variant="h6" gutterBottom>物件情報</Typography>
  <TextField
    fullWidth
    label="物件番号"
    value={propertyNumberField}
    onChange={(e) => {
      setPropertyNumberField(e.target.value);
      if (e.target.value) {
        fetchPropertyInfo(e.target.value);
      } else {
        setPropertyInfo(null);
      }
    }}
    sx={{ mb: 2 }}
  />
  {/* 独自の物件情報表示 */}
</Paper>
```

**新しい実装**:
```typescript
<Box sx={{ position: 'sticky', top: 16 }}>
  <TextField
    fullWidth
    label="物件番号"
    value={propertyNumberField}
    onChange={(e) => setPropertyNumberField(e.target.value)}
    sx={{ mb: 2 }}
  />
  
  {propertyNumberField && (
    <PropertyInfoCard
      propertyId={propertyNumberField}
      buyer={{ latest_status: latestStatus }}
      showCloseButton={false}
    />
  )}
  
  {!propertyNumberField && (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>物件情報</Typography>
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          物件番号を入力すると物件情報が表示されます
        </Typography>
      </Box>
    </Paper>
  )}
</Box>
```

**変更点**:
- `Paper`を`Box`に変更（`PropertyInfoCard`が独自の`Paper`を持つため）
- `onChange`ハンドラを簡素化（`fetchPropertyInfo`の呼び出しを削除）
- `PropertyInfoCard`を条件付きでレンダリング

#### sticky positioningの維持

**重要**: `position: 'sticky', top: 16`を`Box`に設定することで、物件番号入力フィールドと`PropertyInfoCard`が一緒にスクロールに追従します。

#### 買付状況バッジの表示

**現在の実装**（NewBuyerPage）:
```typescript
<PurchaseStatusBadge
  statusText={getPurchaseStatusText(latestStatus, propertyInfo?.offer_status)}
/>
```

**新しい実装**（PropertyInfoCard内部）:
```typescript
<PurchaseStatusBadge
  statusText={getPurchaseStatusText(
    propertyHasBuyerPurchase || buyer?.latest_status,
    property?.offer_status
  )}
/>
```

**変更点**:
- NewBuyerPageから`PurchaseStatusBadge`を削除
- `PropertyInfoCard`内部で買付状況バッジを表示
- `buyer.latest_status`を`PropertyInfoCard`に渡す

## Deployment Considerations

### 1. デプロイ前の確認事項

- [ ] ローカル環境でテストを実行
- [ ] BuyerDetailPageでの表示を確認
- [ ] NewBuyerPageでの表示を確認
- [ ] モバイル表示を確認
- [ ] エラーハンドリングを確認

### 2. デプロイ手順

1. **ステップ1**: フロントエンドをビルド
   ```bash
   cd frontend/frontend
   npm run build
   ```

2. **ステップ2**: ビルドエラーがないか確認
   ```bash
   # エラーがある場合は修正
   ```

3. **ステップ3**: Vercelにデプロイ
   ```bash
   vercel --prod
   ```

4. **ステップ4**: デプロイ後の動作確認
   - NewBuyerPageで物件番号を入力
   - PropertyInfoCardが表示されることを確認
   - atbb_statusとdistribution_dateが表示されることを確認
   - BuyerDetailPageでの表示を確認

### 3. ロールバック手順

**問題が発生した場合**:
1. Vercelの管理画面から前のデプロイメントにロールバック
2. または、Gitで前のコミットに戻してデプロイ

```bash
git revert HEAD
git push
vercel --prod
```

## Summary

この設計により、NewBuyerPageの物件情報表示をBuyerDetailPageと統一し、以下を実現します：

1. **コードの削減**: 約506行（94%）のコードを削減
2. **表示の一貫性**: BuyerDetailPageと同じUIで物件情報を表示
3. **機能の追加**: atbb_statusとdistribution_dateを表示
4. **メンテナンス性の向上**: 共通コンポーネントを使用することで、バグ修正が一箇所で済む
5. **後方互換性の維持**: BuyerDetailPageや他のページに影響を与えない

実装は約31行のコード追加で完了し、大幅なコード削減とメンテナンス性の向上を実現します。
