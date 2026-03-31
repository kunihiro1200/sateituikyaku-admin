# 設計ドキュメント

## Overview

この機能は、物件リストの「レインズ登録・サイト入力」ページに物件の基本情報（所在地、価格、営業担当）をヘッダー表示し、Suumo URLフィールドを追加するものです。Suumo URLはデータベースとスプレッドシート間で相互同期され、Gmail送信時にメール本文に自動埋め込みされます。

既存の物件リスト管理システムに対して、以下の機能を追加します：

1. レインズ登録ページのヘッダーに物件基本情報を表示
2. レインズ登録ページと物件詳細画面にSuumo URLフィールドを追加
3. データベース ⇔ スプレッドシート間でSuumo URLを相互同期
4. Gmail送信時にSuumo URLをメール本文に自動埋め込み

## Architecture

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    フロントエンド                              │
├─────────────────────────────────────────────────────────────┤
│  ReinsRegistrationPage.tsx                                  │
│  - ヘッダー情報表示（所在地、価格、営業担当）                    │
│  - Suumo URLフィールド（入力・編集・開くボタン）                 │
│  - Gmail送信（Suumo URL自動埋め込み）                          │
│                                                             │
│  PropertyListingDetailPage.tsx                              │
│  - 地図・サイトURLセクション                                   │
│  - Suumo URLフィールド（編集・リンクアイコン）                  │
└─────────────────────────────────────────────────────────────┘
                            ↓ API呼び出し
┌─────────────────────────────────────────────────────────────┐
│                    バックエンド                                │
├─────────────────────────────────────────────────────────────┤
│  PropertyListingService                                     │
│  - getByPropertyNumber() - 物件データ取得                     │
│  - update() - 物件データ更新（suumo_url含む）                  │
│                                                             │
│  PropertyListingSyncQueue（新規）                            │
│  - enqueue() - 同期タスクをキューに追加                        │
│  - process() - キューを順次処理                               │
│                                                             │
│  PropertyListingSpreadsheetSync（新規）                      │
│  - syncToSpreadsheet() - DB → スプレッドシート同期            │
└─────────────────────────────────────────────────────────────┘
                            ↓ 即時同期（数秒以内）
┌─────────────────────────────────────────────────────────────┐
│              物件リストスプレッドシート                          │
├─────────────────────────────────────────────────────────────┤
│  CX列: Suumo URL                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ 10分ごと定期同期
┌─────────────────────────────────────────────────────────────┐
│                    Google Apps Script                       │
├─────────────────────────────────────────────────────────────┤
│  syncPropertyListings()                                     │
│  - 10分トリガーで自動実行                                      │
│  - スプレッドシート → データベース同期                          │
└─────────────────────────────────────────────────────────────┘
```

### 同期方向

**データベース → スプレッドシート（即時同期）**:
- トリガー: ユーザーがSuumo URLを保存
- タイミング: 数秒以内
- 実装: PropertyListingSyncQueue

**スプレッドシート → データベース（定期同期）**:
- トリガー: GASの10分トリガー
- タイミング: 10分ごと
- 実装: GAS `syncPropertyListings()`

## Components and Interfaces

### フロントエンドコンポーネント

#### 1. ReinsRegistrationPage.tsx（既存コンポーネントの拡張）

**追加要素**:

```typescript
// ヘッダー情報の型定義
interface PropertyHeaderInfo {
  address: string | null;      // 物件所在地
  salesPrice: number | null;   // 売買価格
  salesAssignee: string | null; // 営業担当
}

// 既存のPropertyData型にsuumo_urlを追加（既に存在）
interface PropertyData {
  // ... 既存フィールド
  suumo_url?: string;
}
```

**新規UI要素**:
- ヘッダー情報表示エリア（物件番号の下）
- Suumo URLフィールド（「レインズ証明書メール済み」セクションの下）
- 「開く」ボタン（Suumo URL入力時のみ活性化）

#### 2. PropertyListingDetailPage.tsx（既存コンポーネントの拡張）

**追加要素**:

```typescript
// 地図・サイトURLセクションに追加
<EditableUrlField
  label="Suumo URL"
  value={data.suumo_url || null}
  placeholder="https://suumo.jp/..."
  onSave={handleUpdateSuumoUrl}
  helperText="Suumo掲載URLを入力してください"
/>
```

### バックエンドサービス

#### 1. PropertyListingSyncQueue（新規作成）

**責務**: データベース更新後、スプレッドシートへの同期をキューイング

```typescript
class PropertyListingSyncQueue {
  private queue: SyncTask[] = [];
  private processing: boolean = false;

  async enqueue(task: SyncTask): Promise<void>;
  private async process(): Promise<void>;
  private async syncSingleProperty(propertyNumber: string): Promise<void>;
}

interface SyncTask {
  type: 'update';
  propertyNumber: string;
  timestamp: Date;
}
```

**動作**:
1. `PropertyListingService.update()`から呼び出される
2. 同期タスクをキューに追加
3. バックグラウンドで順次処理
4. 失敗時は最大3回リトライ（Exponential backoff）

#### 2. PropertyListingSpreadsheetSync（新規作成）

**責務**: データベースからスプレッドシートへの同期処理

```typescript
class PropertyListingSpreadsheetSync {
  async syncToSpreadsheet(propertyNumber: string): Promise<void>;
  private async findRowIndex(propertyNumber: string): Promise<number | null>;
  private async updateRow(rowIndex: number, data: any): Promise<void>;
}
```

**同期対象フィールド**:
- `suumo_url` → CX列「Suumo URL」

#### 3. PropertyListingService（既存サービスの拡張）

**変更点**:

```typescript
class PropertyListingService {
  private syncQueue: PropertyListingSyncQueue;

  async update(propertyNumber: string, updates: any): Promise<PropertyListing> {
    // 既存のDB更新処理
    const updated = await this.supabase
      .from('property_listings')
      .update(updates)
      .eq('property_number', propertyNumber)
      .select()
      .single();

    // 同期キューに追加（新規）
    if (updated.data) {
      await this.syncQueue.enqueue({
        type: 'update',
        propertyNumber,
        timestamp: new Date()
      });
    }

    return updated.data;
  }
}
```

### GAS実装

#### syncPropertyListings()（既存関数、変更不要）

**理由**: `Suumo URL`カラムは既に`COLUMN_MAPPING`に含まれているため、追加の変更は不要です。

```javascript
// gas/property-listing-sync/PropertyListingSync.gs
var COLUMN_MAPPING = {
  // ... 既存マッピング
  'Suumo URL': 'suumo_url',  // 既に存在
};
```

## Data Models

### データベーススキーマ

#### property_listings テーブル（既存、変更不要）

```sql
-- suumo_url カラムは既に存在
CREATE TABLE property_listings (
  -- ... 既存カラム
  suumo_url TEXT,  -- 既に存在
  -- ... 既存カラム
);
```

### スプレッドシートスキーマ

#### 物件リストスプレッドシート

**CX列**: `Suumo URL`（TEXT型）

**初期値**: 既存物件は空欄

### APIレスポンス型

```typescript
interface PropertyListing {
  // ... 既存フィールド
  address: string | null;
  sales_price: number | null;
  sales_assignee: string | null;
  suumo_url: string | null;
  // ... 既存フィールド
}
```


## Correctness Properties

プロパティとは、システムの全ての有効な実行において真であるべき特性や動作のことです。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。


### Property 1: Suumo URL保存のラウンドトリップ

*For any* 物件番号と有効なSuumo URL、ユーザーがレインズ登録ページまたは物件詳細画面でSuumo URLを入力して保存した場合、データベースから同じ物件番号で取得したSuumo URLは入力した値と一致する

**Validates: Requirements 2.4, 2.5, 3.1, 5.6**

### Property 2: スプレッドシート同期のラウンドトリップ

*For any* 物件番号と有効なSuumo URL、データベースの`suumo_url`カラムを更新した場合、スプレッドシートのCX列（「Suumo URL」カラム）から同じ物件番号の行を取得したSuumo URLは更新した値と一致する（数秒以内）

**Validates: Requirements 3.3, 4.2**

### Property 3: 同期キューのエンキュー

*For any* 物件番号、データベースの`suumo_url`カラムを更新した場合、SyncQueueに同期タスク（type='update', propertyNumber=物件番号）がエンキューされる

**Validates: Requirements 3.2, 5.7**

### Property 4: 同期リトライとログ記録

*For any* 同期タスク、スプレッドシート同期が失敗した場合、システムは最大3回まで自動リトライ（Exponential backoff: 1秒、2秒、4秒）し、各試行の結果をログに記録する

**Validates: Requirements 3.5, 3.6**

### Property 5: Gmail本文へのSuumo URL埋め込み

*For any* 物件番号と有効なSuumo URL、ユーザーがレインズ登録ページで「Gmail送信」ボタンをクリックした場合、生成されるメール本文には「■SUUMO」行の下にSuumo URLが改行で区切られて含まれる

**Validates: Requirements 8.1, 8.2, 8.4, 8.5**

### Property 6: データベース更新失敗時のエラーメッセージ

*For any* 物件番号、データベースの`suumo_url`カラムの更新が失敗した場合、システムはエラーメッセージ「Suumo URLの保存に失敗しました」をユーザーに表示する

**Validates: Requirements 9.1**

### Property 7: スプレッドシート同期失敗時のエラーログ

*For any* 同期タスク、スプレッドシート同期が失敗した場合、システムはエラー詳細をログに記録する

**Validates: Requirements 9.2, 9.5**

## Error Handling

### データベースエラー

**エラーケース**: `property_listings`テーブルの更新失敗

**処理**:
1. エラーメッセージ「Suumo URLの保存に失敗しました」をSnackbarで表示
2. エラー詳細をコンソールログに出力
3. ユーザーに再試行を促す

**実装例**:
```typescript
try {
  await api.put(`/api/property-listings/${propertyNumber}`, { suumo_url: newUrl });
  setSnackbar({ open: true, message: 'Suumo URLを保存しました', severity: 'success' });
} catch (error) {
  console.error('Error updating suumo_url:', error);
  setSnackbar({ open: true, message: 'Suumo URLの保存に失敗しました', severity: 'error' });
}
```

### スプレッドシート同期エラー

**エラーケース**: Google Sheets API呼び出し失敗

**処理**:
1. エラーログに記録（物件番号、エラーメッセージ、タイムスタンプ）
2. 最大3回まで自動リトライ（Exponential backoff）
3. 3回失敗した場合、同期キューから削除してエラーログに記録

**リトライ設定**:
```typescript
const retryConfig = {
  maxRetries: 3,
  initialDelay: 1000,  // 1秒
  maxDelay: 10000,     // 10秒
  backoffMultiplier: 2
};
```

### GAS同期エラー

**エラーケース**: GAS `syncPropertyListings()`実行失敗

**処理**:
1. GASのエラーログに記録
2. 次回の10分トリガーで自動的に再試行
3. 連続失敗の場合、管理者に通知（手動対応が必要）

### バリデーションエラー

**エラーケース**: 無効なURL形式

**処理**:
1. フロントエンドでURL形式をバリデーション（正規表現）
2. 無効な場合、エラーメッセージ「有効なSuumo URLを入力してください」を表示
3. 保存ボタンを非活性化

**URL形式**:
```typescript
const SUUMO_URL_PATTERN = /^https:\/\/suumo\.jp\/.+/;
```

## Testing Strategy

### ユニットテスト

**対象**:
- PropertyListingSyncQueue
- PropertyListingSpreadsheetSync
- buildEmailBody()関数（Gmail本文生成）

**テストケース**:
1. Suumo URL保存のラウンドトリップ
2. 同期キューのエンキュー
3. Gmail本文へのSuumo URL埋め込み
4. エラーハンドリング（データベース更新失敗、同期失敗）

**例**:
```typescript
describe('PropertyListingSyncQueue', () => {
  test('should enqueue sync task after database update', async () => {
    const queue = new PropertyListingSyncQueue();
    await queue.enqueue({ type: 'update', propertyNumber: 'AA12345', timestamp: new Date() });
    expect(queue.getQueueLength()).toBe(1);
  });
});
```

### プロパティベーステスト

**対象**:
- Suumo URL保存のラウンドトリップ（Property 1）
- スプレッドシート同期のラウンドトリップ（Property 2）
- Gmail本文へのSuumo URL埋め込み（Property 5）

**設定**:
- 最小100回の反復実行
- ランダムな物件番号とSuumo URLを生成

**例**:
```typescript
import fc from 'fast-check';

describe('Property 1: Suumo URL保存のラウンドトリップ', () => {
  test('Feature: property-listing-header-suumo-url, Property 1: For any 物件番号と有効なSuumo URL、保存後に取得した値は入力した値と一致する', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 10 }), // 物件番号
        fc.webUrl({ validSchemes: ['https'], authoritySettings: { host: fc.constant('suumo.jp') } }), // Suumo URL
        async (propertyNumber, suumoUrl) => {
          // 保存
          await api.put(`/api/property-listings/${propertyNumber}`, { suumo_url: suumoUrl });
          
          // 取得
          const response = await api.get(`/api/property-listings/${propertyNumber}`);
          
          // 検証
          expect(response.data.suumo_url).toBe(suumoUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 統合テスト

**対象**:
- レインズ登録ページのSuumo URLフィールド
- 物件詳細画面のSuumo URLフィールド
- Gmail送信機能

**テストケース**:
1. レインズ登録ページでSuumo URLを入力して保存
2. 物件詳細画面でSuumo URLを編集して保存
3. Gmail送信時にSuumo URLがメール本文に埋め込まれる
4. スプレッドシート同期が正常に動作する

### エンドツーエンドテスト

**シナリオ**:
1. ユーザーがレインズ登録ページを開く
2. ヘッダーに物件基本情報（所在地、価格、営業担当）が表示される
3. Suumo URLフィールドにURLを入力
4. 「開く」ボタンをクリックして新しいタブでURLを開く
5. Gmail送信ボタンをクリック
6. メール本文にSuumo URLが埋め込まれる
7. スプレッドシートのCX列にSuumo URLが同期される

---

**最終更新日**: 2026年3月25日  
**作成者**: Kiro AI Assistant  
**機能名**: property-listing-header-suumo-url
