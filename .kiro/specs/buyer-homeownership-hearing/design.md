# Design Document: 問合時持家ヒアリング機能

## Overview

買主詳細画面（BuyerDetailPage.tsx）および新規買主登録画面（NewBuyerPage.tsx）に、問合せ対応時の持家ヒアリングワークフローを支援する3つのフィールドを追加する。

対象フィールド：
- **問合時持家ヒアリング**（EG列 / `owned_home_hearing_inquiry`）：担当スタッフのイニシャルを単一選択
- **持家ヒアリング結果**（EH列 / `owned_home_hearing_result`）：4択ボタン選択（条件付き表示）
- **要査定**（EJ列 / `valuation_required`）：2択ボタン選択（条件付き表示）

DBカラムおよびスプレッドシートのカラムマッピング（`buyer-column-mapping.json`）は既に存在しているため、フロントエンドUIとバックエンドAPIの受け渡し処理が主な実装対象となる。

## Architecture

```mermaid
graph TD
    A[BuyerDetailPage.tsx] -->|PUT /api/buyers/:id?sync=true| B[buyers.ts ルート]
    C[NewBuyerPage.tsx] -->|POST /api/buyers| B
    B --> D[BuyerService.ts]
    D --> E[Supabase DB]
    D -->|sync: true| F[SpreadsheetSyncService]
    F --> G[スプレッドシート EG/EH/EJ列]
    G -->|GAS定期同期| E

    H[/api/employees/normal-initials] -->|イニシャル一覧| A
    H -->|イニシャル一覧| C
```

### 同期方向

| 方向 | 手段 | タイミング |
|------|------|-----------|
| DB → スプレッドシート | `buyerApi.update({ sync: true })` | フィールド変更時に即時 |
| スプレッドシート → DB | GAS定期同期 | 定期実行（既存の仕組み） |

## Components and Interfaces

### フロントエンド

#### BuyerDetailPage.tsx

**変更箇所1: `BUYER_FIELD_SECTIONS` の更新**

`問合せ内容` セクションに3フィールドを追加する。既存の `owned_home_hearing`（持家ヒアリング）フィールドの後に配置する。

```typescript
// 問合せ内容セクションに追加
{ key: 'owned_home_hearing_inquiry', label: '問合時持家ヒアリング', inlineEditable: true, fieldType: 'staffSelect' },
{ key: 'owned_home_hearing_result', label: '持家ヒアリング結果', inlineEditable: true, fieldType: 'homeHearingResult' },
{ key: 'valuation_required', label: '要査定', inlineEditable: true, fieldType: 'valuationRequired' },
```

**変更箇所2: 各フィールドのカスタムレンダリング**

`broker_inquiry` フィールドと同様に、`fieldType` に応じた特別処理を追加する。

```typescript
// 問合時持家ヒアリング（通常スタッフのイニシャル単一選択）
if (field.key === 'owned_home_hearing_inquiry') {
  return (
    <Grid item xs={12} key={...}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary"
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {field.label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
          {normalInitials.map((initial) => {
            const isSelected = buyer.owned_home_hearing_inquiry === initial;
            return (
              <Button key={initial} size="small"
                variant={isSelected ? 'contained' : 'outlined'}
                color="primary"
                onClick={async () => {
                  const newValue = isSelected ? '' : initial;
                  handleFieldChange(section.title, field.key, newValue);
                  await handleInlineFieldSave(field.key, newValue);
                }}
                sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}>
                {initial}
              </Button>
            );
          })}
        </Box>
      </Box>
    </Grid>
  );
}

// 持家ヒアリング結果（条件付き表示）
if (field.key === 'owned_home_hearing_result') {
  if (!buyer.owned_home_hearing_inquiry) return null; // 条件付き非表示
  const RESULT_OPTIONS = ['持家（マンション）', '持家（戸建）', '賃貸', '他不明'];
  const showValuationText = ['持家（マンション）', '持家（戸建）'].includes(
    buyer.owned_home_hearing_result
  );
  return (
    <Grid item xs={12} key={...}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary"
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {field.label}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0.5 }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {RESULT_OPTIONS.map((option) => { /* ボタン */ })}
          </Box>
          {showValuationText && (
            <Typography variant="caption" color="primary.main" sx={{ mt: 0.5 }}>
              机上査定を無料で行っていますがこの後メールで査定額差し上げましょうか？
            </Typography>
          )}
        </Box>
      </Box>
    </Grid>
  );
}

// 要査定（条件付き表示）
if (field.key === 'valuation_required') {
  const showValuation = ['持家（マンション）', '持家（戸建）'].includes(
    buyer.owned_home_hearing_result
  );
  if (!showValuation) return null; // 条件付き非表示
  const VALUATION_OPTIONS = ['要', '不要'];
  return ( /* ボタン選択UI */ );
}
```

#### NewBuyerPage.tsx

**変更箇所1: state追加**

```typescript
const [ownedHomeHearingInquiry, setOwnedHomeHearingInquiry] = useState('');
const [ownedHomeHearingResult, setOwnedHomeHearingResult] = useState('');
const [valuationRequired, setValuationRequired] = useState('');
```

**変更箇所2: 「問合せ情報」セクションにフィールドを追加**

既存の `ownedHomeHearing` フィールドの後に3フィールドを追加する。NewBuyerPageでは条件付き表示は行わず、常に全フィールドを表示する（`buyer-new-registration-sync-rule.md` に従い、詳細画面と同等のフィールドを持つ）。

**変更箇所3: `handleSubmit` の `buyerData` に追加**

```typescript
owned_home_hearing_inquiry: ownedHomeHearingInquiry || null,
owned_home_hearing_result: ownedHomeHearingResult || null,
valuation_required: valuationRequired || null,
```

### バックエンド

#### backend/src/routes/buyers.ts

`POST /api/buyers` の `router.post('/')` ハンドラーは既に `req.body` をそのまま `buyerService.create(buyerData)` に渡しているため、フロントエンドから3フィールドを送信するだけで対応できる。追加実装は不要。

`PUT /api/buyers/:id` の既存ハンドラーも同様に `sync: true` オプションに対応済み（`buyerApi.update()` の実装を確認済み）。

#### backend/src/services/BuyerService.ts

`create()` メソッドおよび `update()` メソッドが `owned_home_hearing_inquiry`、`owned_home_hearing_result`、`valuation_required` を受け取れるかを確認する。DBカラムが既に存在するため、動的なフィールドマッピングが実装されていれば追加実装は不要。

#### backend/src/config/buyer-column-mapping.json

`spreadsheetToDatabaseExtended` セクションに以下のマッピングが既に定義済み：

```json
"問合時持家ヒアリング": "owned_home_hearing_inquiry",
"持家ヒアリング結果": "owned_home_hearing_result",
"要査定": "valuation_required"
```

追加実装は不要。

## Data Models

### buyers テーブル（既存カラム）

| カラム名 | 型 | スプレッドシート列 | 説明 |
|---------|-----|-----------------|------|
| `owned_home_hearing_inquiry` | TEXT | EG列 | 問合時持家ヒアリング担当スタッフのイニシャル |
| `owned_home_hearing_result` | TEXT | EH列 | 持家ヒアリング結果（持家（マンション）/持家（戸建）/賃貸/他不明） |
| `valuation_required` | TEXT | EJ列 | 要査定（要/不要） |

### フィールド値の定義

**owned_home_hearing_inquiry**
- 値: 通常スタッフのイニシャル（例: `Y`, `I`, `K`）または空文字
- 単一選択（1人のスタッフのみ）
- トグル動作: 選択済みをクリックすると空文字に戻る

**owned_home_hearing_result**
- 値: `持家（マンション）` / `持家（戸建）` / `賃貸` / `他不明` または空文字
- 単一選択

**valuation_required**
- 値: `要` / `不要` または空文字
- 単一選択

### 条件付き表示ロジック

```
owned_home_hearing_inquiry が非空
  └→ 持家ヒアリング結果 を表示
       └→ owned_home_hearing_result が「持家（マンション）」または「持家（戸建）」
            └→ 要査定 を表示
            └→ 追加テキスト「机上査定を無料で...」を表示
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 問合時持家ヒアリングのトグル動作

*For any* 買主データと通常スタッフのイニシャル、選択済みのイニシャルをクリックすると `owned_home_hearing_inquiry` が空文字になり、未選択のイニシャルをクリックすると `owned_home_hearing_inquiry` がそのイニシャルになる

**Validates: Requirements 1.4**

### Property 2: 持家ヒアリング結果の条件付き表示

*For any* 買主データにおいて、`owned_home_hearing_inquiry` が空文字または未入力の場合は持家ヒアリング結果フィールドが非表示になり、非空文字の場合は表示される

**Validates: Requirements 2.1, 2.2**

### Property 3: 要査定の条件付き表示

*For any* 買主データにおいて、`owned_home_hearing_result` が「持家（マンション）」または「持家（戸建）」の場合は要査定フィールドが表示され、それ以外（空文字・賃貸・他不明）の場合は非表示になる

**Validates: Requirements 3.1, 3.2**

### Property 4: 持家選択時の追加テキスト表示

*For any* `owned_home_hearing_result` の値において、「持家（マンション）」または「持家（戸建）」が選択されている場合は追加テキストが表示され、「賃貸」「他不明」または空文字の場合は追加テキストが表示されない

**Validates: Requirements 2.4, 2.5**

### Property 5: インライン保存時のsync: trueオプション

*For any* フィールド（`owned_home_hearing_inquiry`、`owned_home_hearing_result`、`valuation_required`）の変更において、`buyerApi.update()` が `sync: true` オプション付きで呼び出される

**Validates: Requirements 1.5, 2.6, 3.4, 4.1**

### Property 6: 新規登録時のフィールド送信

*For any* 新規買主登録において、`owned_home_hearing_inquiry`、`owned_home_hearing_result`、`valuation_required` の値が `POST /api/buyers` リクエストボディに含まれる

**Validates: Requirements 1.7, 2.8, 3.6**

### Property 7: ボタン選択UIのスタイル

*For any* ボタン選択UIにおいて、選択済みのボタンは `variant="contained"` かつ `fontWeight: 'bold'` で表示され、未選択のボタンは `variant="outlined"` で表示される

**Validates: Requirements 5.2, 5.3**

### Property 8: イニシャル取得失敗時のフォールバック

*For any* `/api/employees/normal-initials` のAPIエラーにおいて、問合時持家ヒアリングフィールドは空のボタン群として表示され（クラッシュしない）、エラーがコンソールに記録される

**Validates: Requirements 5.4**

## Error Handling

### APIエラー

| エラー | 対応 |
|--------|------|
| `/api/employees/normal-initials` 取得失敗 | `normalInitials` を空配列のまま維持。ボタンが表示されないが画面はクラッシュしない。`console.error` でログ記録 |
| `buyerApi.update()` 失敗 | 既存の `handleInlineFieldSave` のエラーハンドリングに委ねる（Snackbarでエラー表示） |
| `POST /api/buyers` 失敗 | 既存の `handleSubmit` のエラーハンドリングに委ねる（Alertでエラー表示） |

### 条件付き表示のリセット

`owned_home_hearing_inquiry` が空文字に変更された場合、`owned_home_hearing_result` と `valuation_required` は非表示になるが、DBの値はそのまま保持する（UIの表示制御のみ）。

`owned_home_hearing_result` が「賃貸」または「他不明」に変更された場合、`valuation_required` は非表示になるが、DBの値はそのまま保持する。

## Testing Strategy

### ユニットテスト

- 条件付き表示ロジック（`owned_home_hearing_inquiry` の有無による `owned_home_hearing_result` の表示/非表示）
- 条件付き表示ロジック（`owned_home_hearing_result` の値による `valuation_required` の表示/非表示）
- 追加テキストの表示/非表示ロジック
- トグル動作（選択済みクリックで空文字になること）
- エラーハンドリング（API失敗時に空配列になること）

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript/JavaScript向け）を使用する。各テストは最低100回のイテレーションで実行する。

**テストタグ形式**: `Feature: buyer-homeownership-hearing, Property {番号}: {プロパティ名}`

```typescript
// Property 2: 持家ヒアリング結果の条件付き表示
// Feature: buyer-homeownership-hearing, Property 2: 持家ヒアリング結果の条件付き表示
fc.assert(fc.property(
  fc.string(), // owned_home_hearing_inquiry の任意の値
  (inquiryValue) => {
    const shouldShow = inquiryValue !== '' && inquiryValue !== null && inquiryValue !== undefined;
    const isVisible = shouldShowHearingResult(inquiryValue);
    return isVisible === shouldShow;
  }
), { numRuns: 100 });

// Property 3: 要査定の条件付き表示
// Feature: buyer-homeownership-hearing, Property 3: 要査定の条件付き表示
fc.assert(fc.property(
  fc.oneof(
    fc.constant('持家（マンション）'),
    fc.constant('持家（戸建）'),
    fc.constant('賃貸'),
    fc.constant('他不明'),
    fc.constant(''),
  ),
  (resultValue) => {
    const shouldShow = ['持家（マンション）', '持家（戸建）'].includes(resultValue);
    const isVisible = shouldShowValuationRequired(resultValue);
    return isVisible === shouldShow;
  }
), { numRuns: 100 });

// Property 4: 持家選択時の追加テキスト表示
// Feature: buyer-homeownership-hearing, Property 4: 持家選択時の追加テキスト表示
fc.assert(fc.property(
  fc.oneof(
    fc.constant('持家（マンション）'),
    fc.constant('持家（戸建）'),
    fc.constant('賃貸'),
    fc.constant('他不明'),
    fc.constant(''),
  ),
  (resultValue) => {
    const shouldShow = ['持家（マンション）', '持家（戸建）'].includes(resultValue);
    const isVisible = shouldShowValuationText(resultValue);
    return isVisible === shouldShow;
  }
), { numRuns: 100 });
```

### 統合テスト（手動確認）

- BuyerDetailPageで問合時持家ヒアリングを選択 → DBに保存されること、スプレッドシートEG列に反映されること
- 持家ヒアリング結果を「持家（マンション）」に選択 → 追加テキストが表示されること、要査定フィールドが表示されること
- 持家ヒアリング結果を「賃貸」に変更 → 追加テキストが非表示になること、要査定フィールドが非表示になること
- NewBuyerPageで3フィールドを入力して登録 → DBに保存されること
