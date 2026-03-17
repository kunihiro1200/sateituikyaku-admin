# 設計ドキュメント: レインズ登録・サイト入力ページ

## 概要

物件詳細画面（PropertyListingDetailPage）のヘッダーに「レインズ登録、サイト入力」ボタンを追加し、専用の入力ページ（ReinsRegistrationPage）へ遷移する機能を実装する。

ReinsRegistrationPage では、レインズ登録に関連する4つのフィールドをボタン形式で操作できる。各フィールドの値は `property_listings` テーブルに保存され、既存の `PropertyListingService.update()` を通じてスプレッドシートへ即時同期される。

---

## アーキテクチャ

本機能は社内管理システム（`baikyaku-property-site3`）の一部として実装する。

```
フロントエンド (frontend/frontend/src/)
  ├── pages/PropertyListingDetailPage.tsx  ← ボタン追加
  ├── pages/ReinsRegistrationPage.tsx      ← 新規作成
  └── App.tsx                              ← ルート追加

バックエンド (backend/src/)
  └── routes/propertyListings.ts           ← 既存のPUT /:propertyNumber を使用
      └── services/PropertyListingService.ts ← 既存の update() を使用
          └── syncToSpreadsheet()          ← 既存のスプレッドシート同期
```

### データフロー

```
ユーザーがボタンをクリック
  ↓
ReinsRegistrationPage: ローカルstate更新 + ローディング表示
  ↓
PUT /api/property-listings/:propertyNumber
  ↓
PropertyListingService.update()
  ↓
Supabase: property_listings テーブル更新
  ↓
syncToSpreadsheet() → スプレッドシートへ即時同期
  ↓
成功/エラーフィードバック表示
```

---

## コンポーネントとインターフェース

### 1. PropertyListingDetailPage（変更）

ヘッダーの既存ボタン群（「報告」「買主候補リスト」等）に「レインズ登録、サイト入力」ボタンを追加する。

```tsx
<Button
  variant="outlined"
  onClick={() => navigate(`/property-listings/${propertyNumber}/reins-registration`)}
  sx={{ borderColor: '#1565c0', color: '#1565c0' }}
>
  レインズ登録、サイト入力
</Button>
```

### 2. ReinsRegistrationPage（新規作成）

**ファイルパス**: `frontend/frontend/src/pages/ReinsRegistrationPage.tsx`

**Props**: なし（URLパラメータ `propertyNumber` を `useParams` で取得）

**State**:
```typescript
interface ReinsData {
  reins_certificate_email: string | null;
  cc_assignee: string | null;
  report_date_setting: string | null;
}

const [data, setData] = useState<ReinsData | null>(null);
const [loading, setLoading] = useState(true);
const [updating, setUpdating] = useState<string | null>(null); // 更新中のフィールド名
const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>();
```

**フィールド定義**:
```typescript
const REINS_FIELDS = [
  {
    key: 'reins_certificate_email',
    label: 'レインズ証明書メール済み',
    options: ['連絡済み', '未'],
  },
  {
    key: 'cc_assignee',
    label: '担当をCCにいれる',
    options: ['済', '未'],
  },
  {
    key: 'report_date_setting',
    label: '報告日設定',
    options: ['する', 'しない'],
  },
];
```

### 3. APIエンドポイント（既存）

既存の `PUT /api/property-listings/:propertyNumber` を使用する。新規エンドポイントは不要。

```typescript
// 既存エンドポイント（変更なし）
router.put('/:propertyNumber', async (req, res) => {
  const data = await propertyListingService.update(propertyNumber, updates);
  res.json(data);
});
```

---

## データモデル

### property_listings テーブル（既存カラム）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `reins_certificate_email` | TEXT | レインズ証明書メール済み（`"連絡済み"` / `"未"` / null） |
| `cc_assignee` | TEXT | 担当をCCにいれる（`"済"` / `"未"` / null） |
| `report_date_setting` | TEXT | 報告日設定（`"する"` / `"しない"` / null） |

DBカラムは既存のため、マイグレーションは不要。

### ルーティング

`App.tsx` に以下を追加:

```tsx
import ReinsRegistrationPage from './pages/ReinsRegistrationPage';

<Route
  path="/property-listings/:propertyNumber/reins-registration"
  element={
    <ProtectedRoute>
      <ReinsRegistrationPage />
    </ProtectedRoute>
  }
/>
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことである。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをする。*

### Property 1: ボタンクリックによるDB更新

*任意の* 物件番号と、任意のフィールド（`reins_certificate_email`, `cc_assignee`, `report_date_setting`）と、そのフィールドの任意の有効な値に対して、対応するボタンをクリックすると、`property_listings` テーブルの該当カラムがその値に更新される。

**Validates: Requirements 3.2, 3.3, 5.2, 5.3, 6.2, 6.3, 7.1**

### Property 2: DB更新後のスプレッドシート同期

*任意の* フィールド更新が成功したとき、`PropertyListingService.syncToSpreadsheet()` が呼ばれ、スプレッドシートへの同期が実行される。

**Validates: Requirements 3.5, 5.5, 6.5, 7.2**

### Property 3: 現在値の強調表示

*任意の* フィールドの現在値に対して、その値に対応するボタンが視覚的に強調表示（`variant="contained"`）され、他のボタンは強調表示されない（`variant="outlined"`）。

**Validates: Requirements 3.4, 5.4, 6.4**

### Property 4: ページ読み込み時のDB値反映

*任意の* DB値の組み合わせ（`reins_certificate_email`, `cc_assignee`, `report_date_setting`）に対して、ページ読み込み後にそれぞれの値がUIの対応するフィールドに反映される。

**Validates: Requirements 2.3**

### Property 5: ナビゲーション正確性

*任意の* 物件番号に対して、「レインズ登録、サイト入力」ボタンをクリックすると `/property-listings/{propertyNumber}/reins-registration` へ遷移し、戻るボタンをクリックすると `/property-listings/{propertyNumber}` へ遷移する。

**Validates: Requirements 1.2, 1.3, 2.5**

### Property 6: DB更新失敗時のエラー表示

*任意の* DB更新失敗（ネットワークエラー、サーバーエラー等）に対して、エラーメッセージがユーザーに表示され、UIの状態は更新前の値に戻る。

**Validates: Requirements 7.3**

---

## エラーハンドリング

### フロントエンド

| エラーケース | 対応 |
|------------|------|
| ページ読み込み時のAPI失敗 | エラーメッセージ表示、再試行ボタン表示 |
| フィールド更新時のAPI失敗 | エラーSnackbar表示、UIを更新前の値に戻す |
| 物件が見つからない（404） | 「物件が見つかりません」メッセージ表示 |

### バックエンド

既存の `PropertyListingService.update()` のエラーハンドリングをそのまま使用する。スプレッドシート同期失敗はログのみ（DB更新結果に影響しない）。

---

## テスト戦略

### ユニットテスト

- `ReinsRegistrationPage` のレンダリングテスト（4つのフィールドが表示されるか）
- 各ボタンクリック時のAPI呼び出しテスト
- エラー時のUI状態テスト
- 戻るボタンのナビゲーションテスト

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript/JavaScript向け）を使用する。各テストは最低100回実行する。

**Property 1: ボタンクリックによるDB更新**

```typescript
// Feature: reins-registration-page, Property 1: ボタンクリックによるDB更新
it('任意のフィールドと値に対してDB更新が正しく呼ばれる', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('reins_certificate_email', 'cc_assignee', 'report_date_setting'),
      fc.constantFrom('連絡済み', '未', '済', 'する', 'しない'),
      fc.string({ minLength: 1, maxLength: 20 }), // propertyNumber
      (field, value, propertyNumber) => {
        // モックAPIを設定
        // ボタンクリックをシミュレート
        // APIが正しいフィールドと値で呼ばれたことを確認
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 3: 現在値の強調表示**

```typescript
// Feature: reins-registration-page, Property 3: 現在値の強調表示
it('任意の現在値に対して対応するボタンが強調表示される', () => {
  fc.assert(
    fc.property(
      fc.record({
        reins_certificate_email: fc.constantFrom('連絡済み', '未', null),
        cc_assignee: fc.constantFrom('済', '未', null),
        report_date_setting: fc.constantFrom('する', 'しない', null),
      }),
      (currentValues) => {
        // 各フィールドの現在値に対応するボタンがcontained、他がoutlinedであることを確認
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 4: ページ読み込み時のDB値反映**

```typescript
// Feature: reins-registration-page, Property 4: ページ読み込み時のDB値反映
it('任意のDB値がページ読み込み後にUIに反映される', () => {
  fc.assert(
    fc.property(
      fc.record({
        reins_certificate_email: fc.option(fc.constantFrom('連絡済み', '未')),
        cc_assignee: fc.option(fc.constantFrom('済', '未')),
        report_date_setting: fc.option(fc.constantFrom('する', 'しない')),
      }),
      (dbValues) => {
        // モックAPIがdbValuesを返すよう設定
        // ページ読み込み後、各フィールドの表示値がdbValuesと一致することを確認
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 6: DB更新失敗時のエラー表示**

```typescript
// Feature: reins-registration-page, Property 6: DB更新失敗時のエラー表示
it('DB更新失敗時にエラーが表示されUIが元の値に戻る', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('reins_certificate_email', 'cc_assignee', 'report_date_setting'),
      fc.string({ minLength: 1 }), // エラーメッセージ
      (field, errorMessage) => {
        // モックAPIがエラーを返すよう設定
        // ボタンクリック後にエラーSnackbarが表示されることを確認
        // UIの値が更新前に戻ることを確認
      }
    ),
    { numRuns: 100 }
  );
});
```
