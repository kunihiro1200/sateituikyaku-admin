# 設計書

## Overview

本機能は、買主詳細ページの「問合時持家ヒアリング」フィールドに「不要」と「未」の選択肢を追加し、これらが選択された場合に「持家ヒアリング結果」フィールドを必須扱いから除外する機能です。

現在の実装では、「問合時持家ヒアリング」フィールドにはスタッフのイニシャル（Y、I、K など）のみが選択肢として存在し、何らかの値が入力されている場合に「持家ヒアリング結果」が必須となります。この機能により、持家ヒアリングが不要な場合や未実施の場合を明示的に記録でき、かつ「持家ヒアリング結果」の入力を強制しないようになります。

### 主要な変更点

1. **UI層**: 「問合時持家ヒアリング」フィールドに「不要」「未」ボタンを追加
2. **バリデーション層**: `isHomeHearingResultRequired()` 関数を更新し、「不要」「未」の場合は必須扱いにしない
3. **データ層**: データベースとスプレッドシートで「不要」「未」の値を正しく同期

### 影響範囲

- **フロントエンド**: `BuyerDetailPage.tsx`（UIとバリデーションロジック）
- **バックエンド**: カラムマッピング（既に定義済み）、同期サービス（既存の仕組みを利用）
- **データベース**: `buyers` テーブルの `owned_home_hearing_inquiry` カラム（既存）
- **スプレッドシート**: 買主リストの「問合時持家ヒアリング」列（既存）

## Architecture

### システム構成

本機能は既存の買主管理システムの一部として実装されます。

```
┌─────────────────────────────────────────────────────────────┐
│                    BuyerDetailPage.tsx                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  問合時持家ヒアリング（staffSelect）                    │  │
│  │  [Y] [I] [K] ... [不要] [未]  ← 新規追加              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  持家ヒアリング結果（条件付き表示）                     │  │
│  │  [持家（マンション）] [持家（戸建）] [賃貸] [他不明]   │  │
│  │  ※ 問合時持家ヒアリングが「不要」「未」の場合は       │  │
│  │     必須扱いにしない（赤枠を表示しない）               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ API呼び出し
┌─────────────────────────────────────────────────────────────┐
│                    BuyerService.ts                           │
│  - updateWithSync(): DB更新 + スプレッドシート同期           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  BuyerWriteService.ts                        │
│  - updateFields(): スプレッドシートに書き込み                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Google Sheets API                               │
│  買主リストスプレッドシート                                   │
│  「問合時持家ヒアリング」列に「不要」「未」を保存            │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

#### 1. ユーザーが「不要」または「未」を選択

```
ユーザーがボタンをクリック
  ↓
setBuyer() で即座にUI更新（楽観的更新）
  ↓
handleFieldChange() で変更を記録
  ↓
isHomeHearingResultRequired() を再評価
  ↓
missingRequiredFields から owned_home_hearing_result を削除
  ↓
赤枠が消える
```

#### 2. 保存ボタン押下時

```
handleSectionSave() が呼ばれる
  ↓
BuyerService.updateWithSync() を呼び出し
  ↓
DB更新（owned_home_hearing_inquiry = "不要" or "未"）
  ↓
BuyerWriteService.updateFields() でスプレッドシート同期
  ↓
成功通知を表示
```

#### 3. スプレッドシートからの同期（GAS経由）

```
GASの10分トリガーが発火
  ↓
スプレッドシートから「問合時持家ヒアリング」列を読み取り
  ↓
値が「不要」または「未」の場合、そのままDBに保存
  ↓
BuyerDetailPage で表示時、対応するボタンが選択状態になる
```

### レイヤー構成

- **プレゼンテーション層**: `BuyerDetailPage.tsx`（UI、バリデーション）
- **ビジネスロジック層**: `BuyerService.ts`（データ更新、同期制御）
- **データアクセス層**: `BuyerWriteService.ts`（スプレッドシート書き込み）
- **データ層**: Supabase（`buyers` テーブル）、Google Sheets（買主リストスプレッドシート）

## Components and Interfaces

### 1. BuyerDetailPage.tsx（フロントエンド）

#### 変更箇所

**1.1 staffSelect フィールドのレンダリング部分**

現在の実装:
```typescript
// owned_home_hearing_inquiry フィールドは特別処理（スタッフイニシャル選択）
if (field.key === 'owned_home_hearing_inquiry') {
  return (
    <Grid item xs={12} key={`${section.title}-${field.key}`}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {field.label}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {normalInitials.map((initial) => {
            // イニシャルボタンのレンダリング
          })}
        </Box>
      </Box>
    </Grid>
  );
}
```

変更後:
```typescript
// owned_home_hearing_inquiry フィールドは特別処理（スタッフイニシャル選択 + 不要/未）
if (field.key === 'owned_home_hearing_inquiry') {
  const SPECIAL_OPTIONS = ['不要', '未'];  // 追加
  return (
    <Grid item xs={12} key={`${section.title}-${field.key}`}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {field.label}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {normalInitials.map((initial) => {
            // イニシャルボタンのレンダリング（既存）
          })}
          {/* 「不要」「未」ボタンを追加 */}
          {SPECIAL_OPTIONS.map((option) => {
            const isSelected = buyer.owned_home_hearing_inquiry === option;
            return (
              <Button
                key={option}
                size="small"
                variant={isSelected ? 'contained' : 'outlined'}
                color="secondary"  // イニシャルと区別するため異なる色
                onClick={async () => {
                  const newValue = isSelected ? '' : option;
                  setBuyer((prev: any) => {
                    if (!prev) return prev;
                    const updated = { ...prev, [field.key]: newValue };
                    // 必須状態を再計算
                    setMissingRequiredFields(prevMissing => {
                      const next = new Set(prevMissing);
                      if (isHomeHearingResultRequired(updated)) {
                        if (!updated.owned_home_hearing_result || !String(updated.owned_home_hearing_result).trim()) {
                          next.add('owned_home_hearing_result');
                        }
                      } else {
                        next.delete('owned_home_hearing_result');
                      }
                      return next;
                    });
                    return updated;
                  });
                  handleFieldChange(section.title, field.key, newValue);
                }}
                sx={{
                  minWidth: 60,
                  px: 1.5,
                  py: 0.5,
                  fontWeight: isSelected ? 'bold' : 'normal',
                  borderRadius: 1,
                }}
              >
                {option}
              </Button>
            );
          })}
        </Box>
      </Box>
    </Grid>
  );
}
```

**1.2 isHomeHearingResultRequired() 関数の更新**

現在の実装:
```typescript
const isHomeHearingResultRequired = (data: any): boolean => {
  if (!data.owned_home_hearing_inquiry) return false;
  const trimmed = String(data.owned_home_hearing_inquiry).trim();
  return trimmed.length > 0;
};
```

変更後:
```typescript
const isHomeHearingResultRequired = (data: any): boolean => {
  if (!data.owned_home_hearing_inquiry) return false;
  const trimmed = String(data.owned_home_hearing_inquiry).trim();
  if (trimmed.length === 0) return false;
  // 「不要」または「未」の場合は必須扱いにしない
  if (trimmed === '不要' || trimmed === '未') return false;
  return true;
};
```

### 2. BuyerService.ts（バックエンド）

変更不要。既存の `updateWithSync()` メソッドがそのまま使用できます。

### 3. BuyerWriteService.ts（バックエンド）

変更不要。既存の `updateFields()` メソッドがそのまま使用できます。

### 4. buyer-column-mapping.json（バックエンド）

変更不要。既に以下のマッピングが定義されています:

```json
{
  "spreadsheetToDatabase": {
    "問合時持家ヒアリング": "owned_home_hearing_inquiry",
    "持家ヒアリング結果": "owned_home_hearing_result"
  }
}
```

### インターフェース定義

#### Buyer インターフェース（既存）

```typescript
interface Buyer {
  buyer_number: string;
  owned_home_hearing_inquiry?: string;  // "Y", "I", "K", "不要", "未", null, ""
  owned_home_hearing_result?: string;   // "持家（マンション）", "持家（戸建）", "賃貸", "他不明", null, ""
  reception_date?: string;
  // ... その他のフィールド
}
```

## Data Models

### データベーススキーマ

#### buyers テーブル（既存、変更なし）

| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| `owned_home_hearing_inquiry` | TEXT | 問合時持家ヒアリング | NULL可、「Y」「I」「K」などのイニシャル、または「不要」「未」 |
| `owned_home_hearing_result` | TEXT | 持家ヒアリング結果 | NULL可、「持家（マンション）」「持家（戸建）」「賃貸」「他不明」 |

### スプレッドシートスキーマ

#### 買主リストスプレッドシート（既存、変更なし）

| カラム名 | データベースカラム | 説明 | 値の例 |
|---------|------------------|------|--------|
| 問合時持家ヒアリング | `owned_home_hearing_inquiry` | 持家ヒアリングの実施状況 | "Y", "I", "K", "不要", "未", "" |
| 持家ヒアリング結果 | `owned_home_hearing_result` | 持家ヒアリングの結果 | "持家（マンション）", "持家（戸建）", "賃貸", "他不明", "" |

### データ同期

#### データベース → スプレッドシート（即時同期）

- **トリガー**: ユーザーが保存ボタンを押下
- **実装**: `BuyerService.updateWithSync()` → `BuyerWriteService.updateFields()`
- **タイミング**: 数秒以内
- **リトライ**: 最大3回（Exponential backoff）

#### スプレッドシート → データベース（定期同期）

- **トリガー**: GASの10分トリガー
- **実装**: GAS関数 `syncBuyerList`（推測）
- **タイミング**: 10分ごと
- **処理**: スプレッドシートの「問合時持家ヒアリング」列の値（「不要」「未」を含む）をそのままDBに同期

### 条件付き必須ロジック

#### isHomeHearingResultRequired() の判定フロー

```
owned_home_hearing_inquiry の値を確認
  ↓
null または undefined → false（必須でない）
  ↓
空文字列 → false（必須でない）
  ↓
空白文字のみ（trim後に空） → false（必須でない）
  ↓
"不要" → false（必須でない）← 新規追加
  ↓
"未" → false（必須でない）← 新規追加
  ↓
その他の値（イニシャルなど） → true（必須）
```

### 値の種類と扱い

| 値 | 型 | 必須判定 | UI表示 | 説明 |
|----|-----|---------|--------|------|
| `null` | null | false | ボタン未選択 | 初期状態 |
| `""` | string | false | ボタン未選択 | 選択解除後 |
| `"  "` | string | false | ボタン未選択 | 空白文字のみ（バグ修正済み） |
| `"Y"`, `"I"`, `"K"` など | string | true | イニシャルボタン選択 | スタッフが実施 |
| `"不要"` | string | false | 「不要」ボタン選択 | ヒアリング不要 |
| `"未"` | string | false | 「未」ボタン選択 | ヒアリング未実施 |


## Correctness Properties

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械が検証可能な正しさの保証との橋渡しとなります。*

### Property 1: ボタンのトグル動作

*任意の*「不要」または「未」ボタンに対して、選択状態でクリックした場合、選択が解除され、フィールド値が空欄になる

**Validates: Requirements 1.4**

### Property 2: スプレッドシート→DB→UI同期の保持

*任意の*買主データに対して、スプレッドシートの「問合時持家ヒアリング」列に「不要」または「未」が入力されている場合、DBに正しく同期され、買主詳細ページで対応するボタンが選択状態で表示される

**Validates: Requirements 1.5**

### Property 3: 「不要」「未」の場合は必須扱いにしない

*任意の*買主データに対して、「問合時持家ヒアリング」が「不要」または「未」の場合、「持家ヒアリング結果」フィールドは必須扱いにならず、赤枠が表示されない

**Validates: Requirements 2.1, 2.2**

### Property 4: イニシャルの場合は必須扱いにする

*任意の*買主データに対して、「問合時持家ヒアリング」がイニシャル（Y、I、K など）の場合、「持家ヒアリング結果」フィールドは必須扱いになり、未入力の場合は赤枠が表示される

**Validates: Requirements 2.3, 4.1**

### Property 5: 値変更時の即時必須状態更新

*任意の*買主データに対して、「問合時持家ヒアリング」の値を変更した場合、「持家ヒアリング結果」の必須状態が即座に再評価され、UIに反映される（「不要」「未」→必須解除、イニシャル→必須化）

**Validates: Requirements 2.4, 2.5**

### Property 6: 保存時の警告ダイアログ除外

*任意の*買主データに対して、「問合時持家ヒアリング」が「不要」または「未」で、「持家ヒアリング結果」が未入力の場合、保存ボタン押下時に警告ダイアログに「持家ヒアリング結果」が表示されない

**Validates: Requirements 2.6**

### Property 7: 往復同期の保持

*任意の*「不要」または「未」の値に対して、データベース → スプレッドシート → データベースの往復同期を実行した場合、元の値と同じ値が保持される

**Validates: Requirements 3.5**

### Property 8: 既存イニシャル機能の保持

*任意の*イニシャル値（Y、I、K など）に対して、「問合時持家ヒアリング」に設定した場合、「持家ヒアリング結果」が必須扱いになる（既存機能が壊れていない）

**Validates: Requirements 4.1**

## Error Handling

### 1. バリデーションエラー

#### 1.1 必須フィールド未入力

**シナリオ**: 「問合時持家ヒアリング」にイニシャルが入力されているが、「持家ヒアリング結果」が未入力

**処理**:
- `checkMissingFields()` が `owned_home_hearing_result` を検出
- `missingRequiredFields` に追加
- 赤枠で表示
- 保存ボタン押下時に警告ダイアログを表示

**ユーザーへの通知**: 「以下の必須項目が未入力です: 持家ヒアリング結果」

#### 1.2 不正な値

**シナリオ**: スプレッドシートに想定外の値（例: "test"）が入力されている

**処理**:
- DB同期時にそのまま保存（バリデーションなし）
- UI表示時、normalInitials に含まれない値として扱われる
- ボタンは選択状態にならない（既存の実装）

**影響**: UIでは未選択状態として表示されるが、データは保持される

### 2. 同期エラー

#### 2.1 スプレッドシート書き込み失敗

**シナリオ**: Google Sheets APIがタイムアウトまたはクォータ超過

**処理**:
- `BuyerWriteService.updateFields()` がエラーを返す
- `BuyerService.updateWithSync()` がリトライ（最大3回）
- 全て失敗した場合、`syncStatus: 'pending'` を返す
- フロントエンドに警告メッセージを表示: 「DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました」

**リカバリー**: GASの定期同期（10分ごと）で自動的に修正される

#### 2.2 データベース更新失敗

**シナリオ**: Supabaseへの接続エラーまたはクエリエラー

**処理**:
- `BuyerService.updateWithSync()` が例外をスロー
- フロントエンドでキャッチしてエラーメッセージを表示: 「更新に失敗しました」
- UI状態はロールバックされない（楽観的更新のため、ユーザーは再度保存を試行可能）

**リカバリー**: ユーザーが再度保存ボタンを押下

### 3. 競合エラー

#### 3.1 スプレッドシートが他のユーザーによって変更された

**シナリオ**: ユーザーAが編集中に、ユーザーBがスプレッドシートで同じ買主の「問合時持家ヒアリング」を変更

**処理**:
- `BuyerService.updateWithSync()` の競合チェックが検出
- `syncStatus: 'failed'`, `error: 'Conflict detected'` を返す
- フロントエンドでエラーメッセージを表示

**リカバリー**: ユーザーがページをリロードして最新データを取得

**注意**: 現在の実装では `force: true` オプションを使用しているため、競合チェックはスキップされます

## Testing Strategy

### テスト方針

本機能のテストは、**ユニットテスト**と**プロパティベーステスト**の両方を使用します。

- **ユニットテスト**: 具体的な例、エッジケース、エラー条件を検証
- **プロパティベーステスト**: 全ての入力に対して成り立つべき普遍的なプロパティを検証

両者は補完的であり、包括的なカバレッジを実現するために両方が必要です。

### プロパティベーステスト

#### テストライブラリ

**fast-check**（TypeScript/JavaScript用のプロパティベーステストライブラリ）を使用します。

#### テスト設定

- **最小イテレーション数**: 100回
- **タグ形式**: `Feature: buyer-home-hearing-optional-choices, Property {number}: {property_text}`

#### テストケース

**1. Property 1: ボタンのトグル動作**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 1: ボタンのトグル動作
fc.assert(
  fc.property(
    fc.constantFrom('不要', '未'),
    (option) => {
      // 選択状態でクリック → 空欄になる
      const buyer = { owned_home_hearing_inquiry: option };
      const newValue = option; // 同じ値をクリック
      const result = newValue === buyer.owned_home_hearing_inquiry ? '' : newValue;
      return result === '';
    }
  ),
  { numRuns: 100 }
);
```

**2. Property 2: スプレッドシート→DB→UI同期の保持**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 2: スプレッドシート→DB→UI同期の保持
fc.assert(
  fc.property(
    fc.constantFrom('不要', '未'),
    fc.string(), // buyer_number
    async (value, buyerNumber) => {
      // スプレッドシートに値を設定
      await setSpreadsheetValue(buyerNumber, '問合時持家ヒアリング', value);
      // GAS同期を実行
      await triggerGasSync();
      // DBから取得
      const buyer = await getBuyerFromDb(buyerNumber);
      // UIで表示
      const isButtonSelected = buyer.owned_home_hearing_inquiry === value;
      return isButtonSelected;
    }
  ),
  { numRuns: 100 }
);
```

**3. Property 3: 「不要」「未」の場合は必須扱いにしない**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 3: 「不要」「未」の場合は必須扱いにしない
fc.assert(
  fc.property(
    fc.constantFrom('不要', '未'),
    fc.option(fc.string(), { nil: null }), // owned_home_hearing_result
    (inquiryValue, resultValue) => {
      const buyer = {
        owned_home_hearing_inquiry: inquiryValue,
        owned_home_hearing_result: resultValue,
      };
      const isRequired = isHomeHearingResultRequired(buyer);
      return !isRequired;
    }
  ),
  { numRuns: 100 }
);
```

**4. Property 4: イニシャルの場合は必須扱いにする**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 4: イニシャルの場合は必須扱いにする
fc.assert(
  fc.property(
    fc.constantFrom('Y', 'I', 'K', 'T', 'H'), // イニシャル
    (initial) => {
      const buyer = {
        owned_home_hearing_inquiry: initial,
        owned_home_hearing_result: '',
      };
      const isRequired = isHomeHearingResultRequired(buyer);
      const isMissing = !buyer.owned_home_hearing_result || !String(buyer.owned_home_hearing_result).trim();
      return isRequired && isMissing;
    }
  ),
  { numRuns: 100 }
);
```

**5. Property 5: 値変更時の即時必須状態更新**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 5: 値変更時の即時必須状態更新
fc.assert(
  fc.property(
    fc.constantFrom('Y', 'I', 'K'), // 初期値（イニシャル）
    fc.constantFrom('不要', '未'), // 変更後の値
    (initialValue, newValue) => {
      const buyer = {
        owned_home_hearing_inquiry: initialValue,
        owned_home_hearing_result: '',
      };
      // 初期状態: 必須
      const initialRequired = isHomeHearingResultRequired(buyer);
      // 値を変更
      buyer.owned_home_hearing_inquiry = newValue;
      // 変更後: 必須でない
      const afterRequired = isHomeHearingResultRequired(buyer);
      return initialRequired && !afterRequired;
    }
  ),
  { numRuns: 100 }
);
```

**6. Property 6: 保存時の警告ダイアログ除外**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 6: 保存時の警告ダイアログ除外
fc.assert(
  fc.property(
    fc.constantFrom('不要', '未'),
    (inquiryValue) => {
      const buyer = {
        owned_home_hearing_inquiry: inquiryValue,
        owned_home_hearing_result: '', // 未入力
      };
      const missingFields = checkMissingFields(buyer);
      return !missingFields.includes('owned_home_hearing_result');
    }
  ),
  { numRuns: 100 }
);
```

**7. Property 7: 往復同期の保持**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 7: 往復同期の保持
fc.assert(
  fc.property(
    fc.constantFrom('不要', '未'),
    fc.string(), // buyer_number
    async (value, buyerNumber) => {
      // DB → スプレッドシート
      await updateBuyerInDb(buyerNumber, { owned_home_hearing_inquiry: value });
      await syncDbToSpreadsheet(buyerNumber);
      const spreadsheetValue = await getSpreadsheetValue(buyerNumber, '問合時持家ヒアリング');
      
      // スプレッドシート → DB
      await syncSpreadsheetToDb(buyerNumber);
      const dbValue = await getBuyerFromDb(buyerNumber);
      
      return dbValue.owned_home_hearing_inquiry === value && spreadsheetValue === value;
    }
  ),
  { numRuns: 100 }
);
```

**8. Property 8: 既存イニシャル機能の保持**

```typescript
// Feature: buyer-home-hearing-optional-choices, Property 8: 既存イニシャル機能の保持
fc.assert(
  fc.property(
    fc.constantFrom('Y', 'I', 'K', 'T', 'H'), // イニシャル
    (initial) => {
      const buyer = {
        owned_home_hearing_inquiry: initial,
        owned_home_hearing_result: '',
      };
      const isRequired = isHomeHearingResultRequired(buyer);
      return isRequired;
    }
  ),
  { numRuns: 100 }
);
```

### ユニットテスト

ユニットテストは、具体的な例、エッジケース、エラー条件に焦点を当てます。プロパティベーステストが多数の入力をカバーするため、ユニットテストは最小限に抑えます。

#### テストケース

**1. UI表示テスト（Example）**

```typescript
test('「問合時持家ヒアリング」フィールドに「不要」「未」ボタンが表示される', () => {
  // Validates: Requirements 1.1
  render(<BuyerDetailPage />);
  expect(screen.getByText('不要')).toBeInTheDocument();
  expect(screen.getByText('未')).toBeInTheDocument();
});
```

**2. 「不要」ボタンクリックテスト（Example）**

```typescript
test('「不要」ボタンをクリックすると、フィールドに「不要」が保存される', async () => {
  // Validates: Requirements 1.2
  render(<BuyerDetailPage />);
  const button = screen.getByText('不要');
  await userEvent.click(button);
  expect(button).toHaveClass('MuiButton-contained'); // 選択状態
});
```

**3. 「未」ボタンクリックテスト（Example）**

```typescript
test('「未」ボタンをクリックすると、フィールドに「未」が保存される', async () => {
  // Validates: Requirements 1.3
  render(<BuyerDetailPage />);
  const button = screen.getByText('未');
  await userEvent.click(button);
  expect(button).toHaveClass('MuiButton-contained'); // 選択状態
});
```

**4. DB保存テスト（Example）**

```typescript
test('「不要」を選択して保存すると、DBに「不要」が保存される', async () => {
  // Validates: Requirements 3.1
  const buyerNumber = 'TEST001';
  await updateBuyer(buyerNumber, { owned_home_hearing_inquiry: '不要' });
  const buyer = await getBuyerFromDb(buyerNumber);
  expect(buyer.owned_home_hearing_inquiry).toBe('不要');
});

test('「未」を選択して保存すると、DBに「未」が保存される', async () => {
  // Validates: Requirements 3.2
  const buyerNumber = 'TEST002';
  await updateBuyer(buyerNumber, { owned_home_hearing_inquiry: '未' });
  const buyer = await getBuyerFromDb(buyerNumber);
  expect(buyer.owned_home_hearing_inquiry).toBe('未');
});
```

**5. 既存機能保持テスト（Example）**

```typescript
test('「問合時持家ヒアリング」が空欄の場合、必須扱いにしない', () => {
  // Validates: Requirements 4.2
  const buyer = { owned_home_hearing_inquiry: '' };
  expect(isHomeHearingResultRequired(buyer)).toBe(false);
});

test('他の条件付き必須フィールドが正しく動作する', () => {
  // Validates: Requirements 4.4
  const buyer = {
    initial_assignee: '',
    reception_date: '2026-03-30',
  };
  const missing = checkMissingFields(buyer);
  expect(missing).toContain('初動担当');
});
```

**6. エッジケーステスト**

```typescript
test('「問合時持家ヒアリング」が空白文字のみの場合、必須扱いにしない', () => {
  // Validates: Requirements 4.3 (edge-case)
  const buyer = { owned_home_hearing_inquiry: '   ' };
  expect(isHomeHearingResultRequired(buyer)).toBe(false);
});
```

### テスト実行

```bash
# プロパティベーステスト
npm test -- buyer-home-hearing-optional-choices.property.test.ts

# ユニットテスト
npm test -- buyer-home-hearing-optional-choices.unit.test.ts
```

### テストカバレッジ目標

- **関数カバレッジ**: 100%（`isHomeHearingResultRequired()` 関数）
- **分岐カバレッジ**: 100%（全ての条件分岐）
- **プロパティテスト**: 最小100イテレーション/プロパティ
