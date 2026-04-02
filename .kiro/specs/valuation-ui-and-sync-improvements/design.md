# Design Document

## Introduction

売主リストの通話モードページにおいて、査定計算セクションのUI改善とデータ同期の修正を実施します。具体的には、「路線価を確認」リンクの配置変更と、査定担当フィールドのスプレッドシート同期修正（イニシャル変換）の2つの改善を行います。

## Overview

本機能は、通話モードページの査定計算セクションにおけるユーザビリティ向上とデータ同期の正確性向上を目的としています。

### 主要な改善点

1. **路線価リンクの配置変更**
   - 現在：査定計算セクションの上部に単独で配置
   - 改善後：物件住所（コピー用）フィールドの右隣に配置
   - 効果：査定計算時に物件住所と路線価を素早く確認できる

2. **査定担当のイニシャル変換とスプレッドシート同期**
   - 現在：査定担当（フルネーム）がそのままスプレッドシートに同期される
   - 改善後：フルネームをイニシャルに変換してからスプレッドシートのBZ列に同期
   - 効果：スプレッドシートで査定担当をコンパクトに確認できる

## Architecture

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    通話モードページ                          │
│                  (CallModePage.tsx)                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         査定計算セクション                          │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────┐         │    │
│  │  │ 物件住所（コピー用）  [路線価を確認] │         │    │
│  │  └──────────────────────────────────────┘         │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────┐         │    │
│  │  │ 査定額1, 2, 3                        │         │    │
│  │  │ 査定方法                              │         │    │
│  │  │ 査定担当（現在のユーザー）            │         │    │
│  │  └──────────────────────────────────────┘         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ 保存時
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  SellerService.updateSeller()                │
│                                                              │
│  1. データベース更新（valuation_assignee = フルネーム）     │
│  2. SyncQueue.enqueue() → スプレッドシート同期キュー         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            SpreadsheetSyncService.syncToSpreadsheet()        │
│                                                              │
│  1. データベースから売主データ取得                           │
│  2. イニシャル変換（convertToInitials）                     │
│  3. スプレッドシートBZ列「査定担当」に同期                   │
└─────────────────────────────────────────────────────────────┘
```


### データフロー

#### 査定額保存時のフロー

```
ユーザーが査定額を入力して保存
  ↓
CallModePage.handleSaveValuation()
  ↓
SellerService.updateSeller({
  valuation_amount_1: 12000000,
  valuation_amount_2: 13000000,
  valuation_amount_3: 15000000,
  valuation_assignee: "山田太郎"  // 現在のユーザーのフルネーム
})
  ↓
データベース更新（sellersテーブル）
  ↓
SyncQueue.enqueue({ type: 'update', sellerId: 'xxx' })
  ↓
SpreadsheetSyncService.syncToSpreadsheet()
  ↓
イニシャル変換: "山田太郎" → "Y"
  ↓
スプレッドシートBZ列「査定担当」に "Y" を書き込み
```

#### スプレッドシート → データベース同期時のフロー

```
GAS syncSellerList() (10分ごと)
  ↓
スプレッドシートBZ列「査定担当」から "Y" を読み取り
  ↓
EnhancedAutoSyncService.syncSingleSeller()
  ↓
データベース更新（valuation_assignee = "Y"）
```

**重要**: スプレッドシート → データベース同期では、イニシャルをそのまま保存します（逆変換は行いません）。

## Components and Interfaces

### フロントエンド

#### CallModePage.tsx

**変更箇所**: 査定計算セクションのレイアウト

**変更前**:
```tsx
<Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
  <Button
    size="small"
    href="https://www.chikamap.jp/chikamap/Portal?mid=216"
    target="_blank"
    rel="noopener noreferrer"
  >
    路線価を確認
  </Button>
  {property?.address && (
    <TextField
      size="small"
      value={property.address}
      label="物件住所（コピー用）"
      // ... コピー機能
    />
  )}
</Box>
```

**変更後**:
```tsx
{property?.address && (
  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
    <TextField
      size="small"
      value={property.address}
      label="物件住所（コピー用）"
      sx={{ flex: 1, minWidth: '400px' }}
      // ... コピー機能
    />
    <Button
      size="small"
      href="https://www.chikamap.jp/chikamap/Portal?mid=216"
      target="_blank"
      rel="noopener noreferrer"
    >
      路線価を確認
    </Button>
  </Box>
)}
```

**変更点**:
- 物件住所フィールドを先に配置
- 路線価リンクを物件住所の右隣に配置
- flexレイアウトで横並びに配置


### バックエンド

#### SpreadsheetSyncService.ts

**新規関数**: `convertToInitials(fullName: string): string`

**目的**: フルネームをイニシャルに変換

**実装**:
```typescript
/**
 * フルネームをイニシャルに変換
 * @param fullName フルネーム（例: "山田太郎", "Yamada Taro"）
 * @returns イニシャル（例: "Y"）
 */
private convertToInitials(fullName: string): string {
  if (!fullName || fullName.trim() === '') {
    return '';
  }

  const trimmed = fullName.trim();
  
  // スペースで分割（姓と名を分離）
  const parts = trimmed.split(/\s+/);
  
  if (parts.length === 0) {
    return '';
  }
  
  // 姓（最初の部分）を取得
  const surname = parts[0];
  
  // 日本語（漢字・ひらがな・カタカナ）の場合
  if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(surname)) {
    // 姓の最初の1文字をローマ字に変換
    const firstChar = surname.charAt(0);
    return this.convertKanaToRomaji(firstChar).toUpperCase();
  }
  
  // 英語（アルファベット）の場合
  if (/^[A-Za-z]/.test(surname)) {
    // 姓の最初の1文字を大文字にして返す
    return surname.charAt(0).toUpperCase();
  }
  
  // その他の場合は最初の1文字をそのまま返す
  return surname.charAt(0);
}

/**
 * 日本語の文字をローマ字に変換（簡易版）
 * @param char 日本語の文字
 * @returns ローマ字
 */
private convertKanaToRomaji(char: string): string {
  const kanaToRomaji: { [key: string]: string } = {
    'あ': 'A', 'い': 'I', 'う': 'U', 'え': 'E', 'お': 'O',
    'か': 'K', 'き': 'K', 'く': 'K', 'け': 'K', 'こ': 'K',
    'さ': 'S', 'し': 'S', 'す': 'S', 'せ': 'S', 'そ': 'S',
    'た': 'T', 'ち': 'T', 'つ': 'T', 'て': 'T', 'と': 'T',
    'な': 'N', 'に': 'N', 'ぬ': 'N', 'ね': 'N', 'の': 'N',
    'は': 'H', 'ひ': 'H', 'ふ': 'H', 'へ': 'H', 'ほ': 'H',
    'ま': 'M', 'み': 'M', 'む': 'M', 'め': 'M', 'も': 'M',
    'や': 'Y', 'ゆ': 'Y', 'よ': 'Y',
    'ら': 'R', 'り': 'R', 'る': 'R', 'れ': 'R', 'ろ': 'R',
    'わ': 'W', 'を': 'W', 'ん': 'N',
    // カタカナ
    'ア': 'A', 'イ': 'I', 'ウ': 'U', 'エ': 'E', 'オ': 'O',
    'カ': 'K', 'キ': 'K', 'ク': 'K', 'ケ': 'K', 'コ': 'K',
    'サ': 'S', 'シ': 'S', 'ス': 'S', 'セ': 'S', 'ソ': 'S',
    'タ': 'T', 'チ': 'T', 'ツ': 'T', 'テ': 'T', 'ト': 'T',
    'ナ': 'N', 'ニ': 'N', 'ヌ': 'N', 'ネ': 'N', 'ノ': 'N',
    'ハ': 'H', 'ヒ': 'H', 'フ': 'H', 'ヘ': 'H', 'ホ': 'H',
    'マ': 'M', 'ミ': 'M', 'ム': 'M', 'メ': 'M', 'モ': 'M',
    'ヤ': 'Y', 'ユ': 'Y', 'ヨ': 'Y',
    'ラ': 'R', 'リ': 'R', 'ル': 'R', 'レ': 'R', 'ロ': 'R',
    'ワ': 'W', 'ヲ': 'W', 'ン': 'N',
    // 漢字（主要な姓の読み）
    '山': 'Y', '田': 'T', '佐': 'S', '藤': 'F', '鈴': 'S',
    '高': 'T', '橋': 'H', '渡': 'W', '伊': 'I', '中': 'N',
    '小': 'K', '林': 'H', '加': 'K', '木': 'K', '斎': 'S',
    '松': 'M', '井': 'I', '清': 'K', '山': 'Y', '森': 'M',
  };
  
  return kanaToRomaji[char] || char.charAt(0).toUpperCase();
}
```


**変更箇所**: `syncToSpreadsheet()` メソッド

**変更内容**:
```typescript
async syncToSpreadsheet(sellerId: string): Promise<void> {
  // 売主データを取得
  const seller = await this.getSeller(sellerId);
  
  // スプレッドシートの行を検索
  const rowIndex = await this.findSellerRow(seller.seller_number);
  
  // 査定担当をイニシャルに変換
  const valuationAssigneeInitial = seller.valuation_assignee 
    ? this.convertToInitials(seller.valuation_assignee)
    : '';
  
  // スプレッドシートに書き込むデータを準備
  const rowData = {
    // ... 他のフィールド
    '査定担当': valuationAssigneeInitial,  // イニシャルに変換
    // ... 他のフィールド
  };
  
  // スプレッドシートに書き込み
  await this.updateSpreadsheetRow(rowIndex, rowData);
}
```

#### column-mapping.json

**変更内容**: BZ列のマッピングを確認（既に存在）

```json
{
  "spreadsheetToDatabase": {
    "査定担当": "valuation_assignee"
  },
  "databaseToSpreadsheet": {
    "valuation_assignee": "査定担当"
  }
}
```

**注意**: `column-mapping.json` は既に正しく設定されているため、変更不要です。

## Data Models

### データベース（sellersテーブル）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `valuation_assignee` | TEXT | 査定担当（フルネームまたはイニシャル） |

**データ例**:
- データベース → スプレッドシート同期時: `"山田太郎"` → `"Y"` に変換
- スプレッドシート → データベース同期時: `"Y"` → `"Y"` のまま保存

### スプレッドシート（売主リスト）

| 列 | カラム名 | 型 | 説明 |
|----|---------|-----|------|
| BZ | `査定担当` | TEXT | 査定担当のイニシャル |

**データ例**: `"Y"`, `"I"`, `"T"` など


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: イニシャル変換の正確性

*For any* フルネーム（日本語または英語）、イニシャル変換関数は姓の最初の1文字を正しくローマ字大文字に変換する

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

**詳細**:
- 日本語（漢字・ひらがな・カタカナ）: 姓の最初の1文字をローマ字に変換（例: 「山田太郎」→「Y」）
- 英語（アルファベット）: 姓の最初の1文字を大文字に変換（例: 「Yamada Taro」→「Y」）
- スペースあり: スペースの前の部分を姓として扱う
- スペースなし: 最初の1文字をイニシャルとする

### Property 2: データベース → スプレッドシート同期時のイニシャル変換

*For any* 売主データ、データベースの`valuation_assignee`（フルネーム）が更新されたとき、スプレッドシートのBZ列「査定担当」にはイニシャルが保存される

**Validates: Requirements 2.2**

### Property 3: スプレッドシート → データベース同期時のイニシャル保持

*For any* スプレッドシートのBZ列「査定担当」の値（イニシャル）、データベースの`valuation_assignee`カラムには同じ値（イニシャル）が保存される

**Validates: Requirements 2.5**

### Property 4: 査定額保存時の査定担当自動設定

*For any* ユーザー、査定額を入力して保存したとき、データベースの`valuation_assignee`カラムには現在のユーザーのフルネームが保存される

**Validates: Requirements 2.1**

### Property 5: 査定額クリア時の査定担当クリア

*For any* 売主データ、査定額をクリアしたとき、査定担当も空になる

**Validates: Requirements 4.6**

### Property 6: 既存機能の保持（査定計算）

*For any* 売主データ、以下の既存機能が引き続き正常に動作する：
- 査定額の自動計算
- 査定額の手動入力
- 査定方法の選択
- 査定担当の表示
- 物件住所のコピー

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**


## Error Handling

### フロントエンド

#### CallModePage.tsx

**エラーケース1**: 物件住所が存在しない場合

**処理**:
```tsx
{property?.address && (
  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
    {/* 物件住所フィールドと路線価リンク */}
  </Box>
)}
```

**結果**: 物件住所が存在しない場合、物件住所フィールドと路線価リンクの両方を非表示にする

**エラーケース2**: 査定額保存時のエラー

**処理**:
```tsx
try {
  await SellerService.updateSeller(sellerId, {
    valuation_amount_1: valuationAmount1,
    valuation_amount_2: valuationAmount2,
    valuation_amount_3: valuationAmount3,
    valuation_assignee: currentUser.name,
  });
  setSnackbarMessage('査定額を保存しました');
  setSnackbarOpen(true);
} catch (error) {
  console.error('査定額の保存に失敗しました:', error);
  setSnackbarMessage('査定額の保存に失敗しました');
  setSnackbarOpen(true);
}
```

**結果**: エラーメッセージをスナックバーで表示

### バックエンド

#### SpreadsheetSyncService.ts

**エラーケース1**: フルネームが空またはnullの場合

**処理**:
```typescript
private convertToInitials(fullName: string): string {
  if (!fullName || fullName.trim() === '') {
    return '';
  }
  // ... 変換処理
}
```

**結果**: 空文字列を返す

**エラーケース2**: 変換できない文字が含まれる場合

**処理**:
```typescript
private convertKanaToRomaji(char: string): string {
  const kanaToRomaji: { [key: string]: string } = {
    // ... マッピング
  };
  
  // マッピングに存在しない場合は、最初の1文字を大文字にして返す
  return kanaToRomaji[char] || char.charAt(0).toUpperCase();
}
```

**結果**: 最初の1文字を大文字にして返す（フォールバック）

**エラーケース3**: スプレッドシート同期時のエラー

**処理**:
```typescript
async syncToSpreadsheet(sellerId: string): Promise<void> {
  try {
    // 売主データを取得
    const seller = await this.getSeller(sellerId);
    
    // イニシャル変換
    const valuationAssigneeInitial = seller.valuation_assignee 
      ? this.convertToInitials(seller.valuation_assignee)
      : '';
    
    // スプレッドシートに書き込み
    await this.updateSpreadsheetRow(rowIndex, rowData);
    
    console.log(`✅ Synced seller ${seller.seller_number} to spreadsheet`);
  } catch (error) {
    console.error(`❌ Failed to sync seller ${sellerId} to spreadsheet:`, error);
    throw error;  // SyncQueueがリトライを処理
  }
}
```

**結果**: エラーをログに記録し、SyncQueueにリトライを委ねる


## Testing Strategy

### デュアルテストアプローチ

本機能では、以下の2つのテスト手法を組み合わせて包括的なテストカバレッジを実現します：

1. **ユニットテスト**: 特定の例、エッジケース、エラー条件を検証
2. **プロパティテスト**: 全ての入力に対する普遍的なプロパティを検証

### ユニットテスト

#### フロントエンド（CallModePage.tsx）

**テストファイル**: `frontend/frontend/src/__tests__/CallModePage-valuation-ui.test.tsx`

**テストケース**:

1. **路線価リンクの配置**
   - 物件住所フィールドの右隣に路線価リンクが配置されていることを確認
   - 路線価リンクのボタンサイズが「small」であることを確認
   - 路線価リンクのhref属性が正しいURLであることを確認
   - 路線価リンクのtarget属性が「_blank」であることを確認

2. **物件住所が存在しない場合**
   - 物件住所フィールドと路線価リンクが非表示になることを確認

3. **査定額保存時の査定担当設定**
   - 査定額を保存したとき、現在のユーザーのフルネームが`valuation_assignee`に設定されることを確認

4. **査定額クリア時の査定担当クリア**
   - 査定額をクリアしたとき、査定担当も空になることを確認

#### バックエンド（SpreadsheetSyncService.ts）

**テストファイル**: `backend/src/__tests__/SpreadsheetSyncService-initials.test.ts`

**テストケース**:

1. **イニシャル変換（日本語）**
   - 「山田太郎」→「Y」
   - 「佐藤花子」→「S」
   - 「鈴木一郎」→「S」

2. **イニシャル変換（英語）**
   - 「Yamada Taro」→「Y」
   - 「Sato Hanako」→「S」
   - 「Suzuki Ichiro」→「S」

3. **イニシャル変換（スペースなし）**
   - 「山田」→「Y」
   - 「Yamada」→「Y」

4. **イニシャル変換（空文字列）**
   - 「」→「」
   - null → 「」
   - undefined → 「」

5. **スプレッドシート同期**
   - データベースの`valuation_assignee`が「山田太郎」のとき、スプレッドシートのBZ列に「Y」が書き込まれることを確認
   - スプレッドシートのBZ列が「Y」のとき、データベースの`valuation_assignee`に「Y」が保存されることを確認

### プロパティテスト

**プロパティテストライブラリ**: fast-check（TypeScript/JavaScript用）

**設定**: 各プロパティテストは最低100回の反復を実行

#### Property 1: イニシャル変換の正確性

**テストファイル**: `backend/src/__tests__/properties/initials-conversion.property.test.ts`

**テストコード**:
```typescript
import fc from 'fast-check';
import { SpreadsheetSyncService } from '../../services/SpreadsheetSyncService';

describe('Property 1: イニシャル変換の正確性', () => {
  it('should convert any full name to correct initials', () => {
    // Feature: valuation-ui-and-sync-improvements, Property 1: イニシャル変換の正確性
    
    fc.assert(
      fc.property(
        fc.oneof(
          fc.tuple(fc.constantFrom('山田', '佐藤', '鈴木', '高橋', '田中'), fc.string()),
          fc.tuple(fc.constantFrom('Yamada', 'Sato', 'Suzuki', 'Takahashi', 'Tanaka'), fc.string())
        ),
        ([surname, givenName]) => {
          const fullName = `${surname} ${givenName}`;
          const service = new SpreadsheetSyncService();
          const initial = service['convertToInitials'](fullName);
          
          // イニシャルは1文字の大文字アルファベットである
          expect(initial).toMatch(/^[A-Z]$/);
          
          // 姓の最初の文字に対応するローマ字である
          const expectedInitials: { [key: string]: string } = {
            '山田': 'Y', '佐藤': 'S', '鈴木': 'S', '高橋': 'T', '田中': 'T',
            'Yamada': 'Y', 'Sato': 'S', 'Suzuki': 'S', 'Takahashi': 'T', 'Tanaka': 'T'
          };
          expect(initial).toBe(expectedInitials[surname]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Property 2: データベース → スプレッドシート同期時のイニシャル変換

**テストファイル**: `backend/src/__tests__/properties/db-to-spreadsheet-sync.property.test.ts`

**テストコード**:
```typescript
import fc from 'fast-check';
import { SpreadsheetSyncService } from '../../services/SpreadsheetSyncService';

describe('Property 2: データベース → スプレッドシート同期時のイニシャル変換', () => {
  it('should convert full name to initials when syncing to spreadsheet', async () => {
    // Feature: valuation-ui-and-sync-improvements, Property 2: データベース → スプレッドシート同期時のイニシャル変換
    
    fc.assert(
      fc.asyncProperty(
        fc.record({
          seller_number: fc.string({ minLength: 5, maxLength: 10 }),
          valuation_assignee: fc.oneof(
            fc.constantFrom('山田太郎', '佐藤花子', '鈴木一郎'),
            fc.constantFrom('Yamada Taro', 'Sato Hanako', 'Suzuki Ichiro')
          )
        }),
        async (seller) => {
          const service = new SpreadsheetSyncService();
          
          // モックデータベースに売主を作成
          await createMockSeller(seller);
          
          // スプレッドシートに同期
          await service.syncToSpreadsheet(seller.seller_number);
          
          // スプレッドシートのBZ列を確認
          const spreadsheetValue = await getSpreadsheetValue(seller.seller_number, 'BZ');
          
          // イニシャルに変換されていることを確認
          const expectedInitial = service['convertToInitials'](seller.valuation_assignee);
          expect(spreadsheetValue).toBe(expectedInitial);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Property 3: スプレッドシート → データベース同期時のイニシャル保持

**テストファイル**: `backend/src/__tests__/properties/spreadsheet-to-db-sync.property.test.ts`

**テストコード**:
```typescript
import fc from 'fast-check';
import { EnhancedAutoSyncService } from '../../services/EnhancedAutoSyncService';

describe('Property 3: スプレッドシート → データベース同期時のイニシャル保持', () => {
  it('should preserve initials when syncing from spreadsheet to database', async () => {
    // Feature: valuation-ui-and-sync-improvements, Property 3: スプレッドシート → データベース同期時のイニシャル保持
    
    fc.assert(
      fc.asyncProperty(
        fc.record({
          seller_number: fc.string({ minLength: 5, maxLength: 10 }),
          valuation_assignee: fc.constantFrom('Y', 'S', 'T', 'I', 'K')
        }),
        async (seller) => {
          const service = new EnhancedAutoSyncService();
          
          // スプレッドシートに売主を作成（BZ列にイニシャル）
          await createMockSpreadsheetRow(seller);
          
          // データベースに同期
          await service.syncSingleSeller(seller.seller_number);
          
          // データベースの値を確認
          const dbValue = await getDbValue(seller.seller_number, 'valuation_assignee');
          
          // イニシャルがそのまま保存されていることを確認
          expect(dbValue).toBe(seller.valuation_assignee);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### テスト実行

**ユニットテスト**:
```bash
# フロントエンド
cd frontend/frontend
npm test -- CallModePage-valuation-ui.test.tsx

# バックエンド
cd backend
npm test -- SpreadsheetSyncService-initials.test.ts
```

**プロパティテスト**:
```bash
cd backend
npm test -- properties/
```

### テストカバレッジ目標

- **ユニットテスト**: 90%以上のコードカバレッジ
- **プロパティテスト**: 全てのCorrectness Propertiesをカバー
- **E2Eテスト**: 主要なユーザーフローをカバー

