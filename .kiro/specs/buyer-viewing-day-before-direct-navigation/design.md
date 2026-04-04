# Design Document

## Introduction

本ドキュメントは、買主リストの「内覧日前日」カテゴリから案件をクリックした際に、詳細画面ではなく内覧ページを直接開く機能の設計を記述します。

この機能は**既に実装済み**であり、本ドキュメントは既存実装の設計を記録するものです。

## High-Level Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BuyersPage Component                    │
│                                                               │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │ BuyerStatusSidebar│────────▶│ selectedCalculatedStatus│  │
│  │                   │         │ (カテゴリキー)          │  │
│  └──────────────────┘         └─────────────────────────┘  │
│                                          │                    │
│                                          ▼                    │
│                          ┌──────────────────────────────┐   │
│                          │ categoryKeyToDisplayName     │   │
│                          │ (カテゴリキー → 表示名)     │   │
│                          └──────────────────────────────┘   │
│                                          │                    │
│                                          ▼                    │
│                          ┌──────────────────────────────┐   │
│                          │ handleRowClick()             │   │
│                          │ - displayName判定            │   │
│                          │ - ルーティング決定           │   │
│                          └──────────────────────────────┘   │
│                                          │                    │
│                    ┌─────────────────────┴─────────────┐    │
│                    ▼                                     ▼    │
│         ┌──────────────────┐                 ┌──────────────┐│
│         │ /buyers/:id      │                 │ /buyers/:id/ ││
│         │ /viewing-result  │                 │              ││
│         │ (内覧ページ)     │                 │ (詳細画面)   ││
│         └──────────────────┘                 └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction

1. **BuyerStatusSidebar**: ユーザーがカテゴリを選択
2. **selectedCalculatedStatus**: 選択されたカテゴリキー（例: `viewingDayBefore`）を保持
3. **categoryKeyToDisplayName**: カテゴリキーを日本語表示名（例: `内覧日前日`）に変換
4. **handleRowClick()**: 表示名に基づいて遷移先を決定
5. **React Router**: 決定されたルートに遷移

### Data Flow

```
ユーザーがサイドバーで「内覧日前日」を選択
  ↓
selectedCalculatedStatus = 'viewingDayBefore'
  ↓
ユーザーが買主行をクリック
  ↓
handleRowClick(buyerId) が呼ばれる
  ↓
categoryKeyToDisplayName['viewingDayBefore'] = '内覧日前日'
  ↓
displayName === '内覧日前日' ? true
  ↓
navigate(`/buyers/${buyerId}/viewing-result`)
  ↓
内覧ページが表示される
```

## Low-Level Design

### File Structure

```
frontend/frontend/src/
├── pages/
│   ├── BuyersPage.tsx              # メインコンポーネント（実装済み）
│   └── BuyerViewingResultPage.tsx  # 内覧ページ（既存）
├── components/
│   └── BuyerStatusSidebar.tsx      # サイドバーコンポーネント（既存）
└── App.tsx                          # ルーティング定義（既存）
```

### Component: BuyersPage.tsx

#### State Management

```typescript
// カテゴリキーを保持（サイドバーから設定される）
const [selectedCalculatedStatus, setSelectedCalculatedStatus] = useState<string | null>(null);
```

#### Category Mapping

```typescript
// カテゴリキーを日本語表示名に変換するマッピング
const categoryKeyToDisplayName: Record<string, string> = {
  'viewingDayBefore': '内覧日前日',  // ✅ 買主用（バックエンドと一致）
  'visitCompleted': '内覧済み',
  'todayCall': '当日TEL',
  'todayCallWithInfo': '当日TEL（内容）',
  'unvaluated': '未査定',
  'mailingPending': '査定（郵送）',
  'todayCallNotStarted': '当日TEL_未着手',
  'pinrichEmpty': 'Pinrich空欄',
  'todayCallAssigned': '当日TEL（担当）',
  'visitAssigned': '担当',
};
```

**設計上の注意点**:
- カテゴリキー（`viewingDayBefore`）はバックエンドの`BuyerStatusCalculator.ts`と一致させる
- 日本語表示名（`内覧日前日`）はサイドバーの表示と一致させる
- マッピングは拡張可能な設計（新しいカテゴリを追加しやすい）

#### Navigation Logic

```typescript
const handleRowClick = (buyerId: string) => {
  // selectedCalculatedStatusはカテゴリキー（例: 'viewingDayBefore'）なので、
  // 日本語表示名に変換して比較
  const displayName = categoryKeyToDisplayName[selectedCalculatedStatus || ''] || selectedCalculatedStatus;
  
  if (displayName === '内覧日前日') {
    // 内覧日前日カテゴリの場合は内覧ページを直接開く
    navigate(`/buyers/${buyerId}/viewing-result`);
  } else {
    // それ以外のカテゴリは詳細画面を開く
    navigate(`/buyers/${buyerId}`);
  }
};
```

**設計上の注意点**:
- `selectedCalculatedStatus`はカテゴリキー（英語）なので、必ず日本語表示名に変換してから比較
- フォールバック処理: マッピングが見つからない場合は`selectedCalculatedStatus`をそのまま使用
- 拡張性: 将来的に他のカテゴリでも直接遷移を追加しやすい設計

#### Table Row Click Handler

```typescript
<TableRow
  hover
  onClick={() => handleRowClick(buyer.id)}
  sx={{ cursor: 'pointer' }}
>
  {/* テーブルセルの内容 */}
</TableRow>
```

**設計上の注意点**:
- `onClick`イベントで`handleRowClick`を呼び出す
- `cursor: 'pointer'`でクリック可能であることを視覚的に示す
- モバイル・デスクトップ両方で同じロジックを使用

### Routing Configuration

```typescript
// App.tsx（既存のルーティング定義）
<Route path="/buyers/:id/viewing-result" element={<BuyerViewingResultPage />} />
<Route path="/buyers/:id" element={<BuyerDetailPage />} />
```

**設計上の注意点**:
- `/buyers/:id/viewing-result`が内覧ページ
- `/buyers/:id`が詳細画面
- ルートの順序は重要（より具体的なルートを先に定義）

### Backend Integration

本機能はフロントエンドのみの実装であり、バックエンドAPIの変更は不要です。

ただし、以下のバックエンドコンポーネントとの整合性を保つ必要があります：

#### BuyerStatusCalculator.ts

```typescript
// カテゴリキーの定義（フロントエンドと一致させる）
export type BuyerStatusCategory = 
  | 'viewingDayBefore'  // ✅ フロントエンドの 'viewingDayBefore' と一致
  | 'visitCompleted'
  | 'todayCall'
  | 'todayCallWithInfo'
  | 'unvaluated'
  | 'mailingPending'
  | 'todayCallNotStarted'
  | 'pinrichEmpty'
  | 'todayCallAssigned'
  | 'visitAssigned';
```

**設計上の注意点**:
- カテゴリキーはフロントエンドの`categoryKeyToDisplayName`のキーと完全一致させる
- 新しいカテゴリを追加する場合は、フロントエンド・バックエンド両方を更新

## Design Decisions

### Decision 1: カテゴリキーと表示名の分離

**問題**: サイドバーのカテゴリは日本語表示名（`内覧日前日`）だが、バックエンドはカテゴリキー（`viewingDayBefore`）を使用している。

**選択肢**:
1. フロントエンドで日本語表示名を直接使用
2. カテゴリキーと表示名をマッピングで管理

**決定**: 選択肢2（マッピングで管理）

**理由**:
- バックエンドとの整合性を保つ
- 国際化（i18n）に対応しやすい
- カテゴリキーは変更されにくいが、表示名は変更される可能性がある
- コードの可読性が向上（英語のキーの方が理解しやすい）

### Decision 2: 条件分岐の実装方法

**問題**: 「内覧日前日」カテゴリのみ特別な遷移を行う必要がある。

**選択肢**:
1. `if-else`文で条件分岐
2. マッピングオブジェクトで遷移先を管理
3. カテゴリごとに別々のハンドラーを定義

**決定**: 選択肢1（`if-else`文）

**理由**:
- 現時点では特別な遷移が必要なカテゴリは1つのみ
- シンプルで理解しやすい
- 将来的に複数のカテゴリで特別な遷移が必要になった場合は、選択肢2に移行可能

### Decision 3: 表示名の比較方法

**問題**: カテゴリキーを表示名に変換してから比較する必要がある。

**選択肢**:
1. カテゴリキーを直接比較（`selectedCalculatedStatus === 'viewingDayBefore'`）
2. 表示名に変換してから比較（`displayName === '内覧日前日'`）

**決定**: 選択肢2（表示名に変換してから比較）

**理由**:
- サイドバーの表示と一致させることで、ユーザーの期待に沿った動作になる
- 将来的に表示名が変更された場合、マッピングを更新するだけで対応可能
- デバッグ時に表示名で確認できるため、問題の特定が容易

## Testing Strategy

### Unit Tests

#### Test 1: handleRowClick - 内覧日前日カテゴリ

```typescript
describe('handleRowClick', () => {
  it('should navigate to viewing-result page when category is 内覧日前日', () => {
    const navigate = jest.fn();
    const selectedCalculatedStatus = 'viewingDayBefore';
    const buyerId = '12345';
    
    handleRowClick(buyerId);
    
    expect(navigate).toHaveBeenCalledWith('/buyers/12345/viewing-result');
  });
});
```

#### Test 2: handleRowClick - その他のカテゴリ

```typescript
describe('handleRowClick', () => {
  it('should navigate to detail page when category is not 内覧日前日', () => {
    const navigate = jest.fn();
    const selectedCalculatedStatus = 'todayCall';
    const buyerId = '12345';
    
    handleRowClick(buyerId);
    
    expect(navigate).toHaveBeenCalledWith('/buyers/12345');
  });
});
```

#### Test 3: handleRowClick - カテゴリ未選択

```typescript
describe('handleRowClick', () => {
  it('should navigate to detail page when no category is selected', () => {
    const navigate = jest.fn();
    const selectedCalculatedStatus = null;
    const buyerId = '12345';
    
    handleRowClick(buyerId);
    
    expect(navigate).toHaveBeenCalledWith('/buyers/12345');
  });
});
```

### Integration Tests

#### Test 4: サイドバーからの遷移

```typescript
describe('BuyersPage Integration', () => {
  it('should navigate to viewing-result page when clicking buyer from 内覧日前日 category', async () => {
    render(<BuyersPage />);
    
    // サイドバーで「内覧日前日」を選択
    const sidebarItem = screen.getByText('内覧日前日');
    fireEvent.click(sidebarItem);
    
    // 買主行をクリック
    const buyerRow = screen.getByText('買主12345');
    fireEvent.click(buyerRow);
    
    // 内覧ページに遷移したことを確認
    await waitFor(() => {
      expect(window.location.pathname).toBe('/buyers/12345/viewing-result');
    });
  });
});
```

### Manual Testing

#### Test Case 1: 内覧日前日カテゴリからの遷移

**手順**:
1. 買主リストページ（`/buyers`）を開く
2. サイドバーで「②内覧日前日」をクリック
3. 表示された買主の行をクリック

**期待結果**:
- 内覧ページ（`/buyers/:id/viewing-result`）が開く
- URLが`/buyers/:id/viewing-result`になる
- 内覧情報が表示される

#### Test Case 2: その他のカテゴリからの遷移

**手順**:
1. 買主リストページ（`/buyers`）を開く
2. サイドバーで「当日TEL」をクリック
3. 表示された買主の行をクリック

**期待結果**:
- 詳細画面（`/buyers/:id`）が開く
- URLが`/buyers/:id`になる
- 買主の詳細情報が表示される

#### Test Case 3: カテゴリ未選択時の遷移

**手順**:
1. 買主リストページ（`/buyers`）を開く
2. サイドバーで「All」を選択（またはカテゴリを選択しない）
3. 表示された買主の行をクリック

**期待結果**:
- 詳細画面（`/buyers/:id`）が開く
- URLが`/buyers/:id`になる
- 買主の詳細情報が表示される

## Implementation Notes

### 既存実装の確認

本機能は**既に実装済み**です。以下のコミットで実装されています：

- **ファイル**: `frontend/frontend/src/pages/BuyersPage.tsx`
- **実装箇所**: 
  - `categoryKeyToDisplayName`マッピング（85-95行目）
  - `handleRowClick`関数（334-342行目）

### 実装の品質

既存実装は以下の点で優れています：

1. **拡張性**: 新しいカテゴリを追加しやすい設計
2. **可読性**: コードが明確で理解しやすい
3. **保守性**: マッピングを一箇所で管理
4. **整合性**: バックエンドのカテゴリキーと一致

### 今後の改善案

1. **国際化（i18n）対応**: 表示名を多言語対応にする
2. **テストの追加**: ユニットテスト・統合テストを追加
3. **型安全性の向上**: カテゴリキーの型を厳密に定義

## Correctness Properties

### Property 1: カテゴリ判定の正確性

**Property**: 選択されたカテゴリが「内覧日前日」の場合、必ず内覧ページに遷移する

**Verification**:
```typescript
∀ buyerId, selectedCalculatedStatus:
  categoryKeyToDisplayName[selectedCalculatedStatus] === '内覧日前日'
  ⟹ navigate(`/buyers/${buyerId}/viewing-result`)
```

### Property 2: デフォルト動作の保証

**Property**: 「内覧日前日」以外のカテゴリの場合、必ず詳細画面に遷移する

**Verification**:
```typescript
∀ buyerId, selectedCalculatedStatus:
  categoryKeyToDisplayName[selectedCalculatedStatus] !== '内覧日前日'
  ⟹ navigate(`/buyers/${buyerId}`)
```

### Property 3: カテゴリ未選択時の動作

**Property**: カテゴリが選択されていない場合、必ず詳細画面に遷移する

**Verification**:
```typescript
∀ buyerId:
  selectedCalculatedStatus === null
  ⟹ navigate(`/buyers/${buyerId}`)
```

### Property 4: マッピングの整合性

**Property**: フロントエンドのカテゴリキーとバックエンドのカテゴリキーは一致する

**Verification**:
```typescript
∀ key ∈ categoryKeyToDisplayName:
  key ∈ BuyerStatusCategory
```

## Conclusion

本設計は、買主リストの「内覧日前日」カテゴリから案件をクリックした際に、内覧ページを直接開く機能を実現します。

既存実装は以下の点で優れています：
- シンプルで理解しやすい
- 拡張性が高い
- バックエンドとの整合性が保たれている

今後の改善として、テストの追加と国際化対応を検討することを推奨します。
