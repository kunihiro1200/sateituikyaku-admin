# 設計ドキュメント

## Overview

本機能は、物件詳細ページのヘッダー部分に表示されるボタンのレイアウトを変更し、新たに「事務へCHAT」ボタンを追加します。また、物件リストに「確認」フィールドを実装し、スプレッドシートのDQ列（列番号120）と双方向同期を行います。「確認」フィールドが「未」の物件は、サイドバーに「未完了」カテゴリとして表示されます。

### 主要な変更点

1. **ヘッダーボタンのレイアウト変更**: 既存のボタンを2行に分けて表示
2. **「事務へCHAT」ボタンの追加**: 事務担当者とのチャット機能を追加
3. **「確認」フィールドの実装**: データベースとスプレッドシートで管理
4. **サイドバーの「未完了」カテゴリ**: 確認が未完了の物件を一覧表示

### 技術スタック

- **フロントエンド**: React, TypeScript, Material-UI
- **バックエンド**: Node.js, Express, TypeScript
- **データベース**: Supabase (PostgreSQL)
- **スプレッドシート同期**: Google Sheets API, Google Apps Script (GAS)

---

## Architecture

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                     フロントエンド                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PropertyListingDetailPage.tsx                       │   │
│  │  - ヘッダーボタン（2行レイアウト）                      │   │
│  │  - 「事務へCHAT」ボタン                                │   │
│  │  - 確認フィールドトグル（未/済）                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PropertyListingsPage.tsx                            │   │
│  │  - 物件一覧表示                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PropertySidebarStatus.tsx                           │   │
│  │  - 「未完了」カテゴリ表示                              │   │
│  │  - カウント表示                                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP API
┌─────────────────────────────────────────────────────────────┐
│                     バックエンド                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PropertyListingService                              │   │
│  │  - 確認フィールドの更新                                │   │
│  │  - チャット送信処理                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PropertyListingSyncService                          │   │
│  │  - スプレッドシート同期（DQ列）                        │   │
│  │  - 確認フィールドの同期                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     データベース                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  property_listings テーブル                          │   │
│  │  - confirmation VARCHAR(10)                          │   │
│  │  - updated_at TIMESTAMPTZ                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↕ 双方向同期
┌─────────────────────────────────────────────────────────────┐
│                  Google スプレッドシート                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  物件リストスプレッドシート                            │   │
│  │  - DQ列（列番号120）: 確認                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

#### 1. 確認フィールド更新フロー（データベース → スプレッドシート）

```
ユーザーが「未」または「済」ボタンをクリック
  ↓
フロントエンドがPUT /api/property-listings/:propertyNumber/confirmationを呼び出し
  ↓
PropertyListingService.updateConfirmation()がDBを更新
  ↓
PropertyListingSyncQueue.enqueue()が同期をキューに追加
  ↓
PropertyListingSyncQueue.process()がキューを順次処理
  ↓
PropertyListingSyncService.syncConfirmationToSpreadsheet()がDQ列を更新
  ↓
完了（5秒以内）
```

#### 2. 確認フィールド同期フロー（スプレッドシート → データベース）

```
GASの10分トリガーが発火
  ↓
syncPropertyList() が実行される
  ↓
スプレッドシートのDQ列を読み取る
  ↓
バックエンドAPIにPOSTリクエスト
  ↓
DBのproperty_listings.confirmationを更新
  ↓
完了（10分以内）
```

#### 3. 「事務へCHAT」ボタンクリックフロー

```
ユーザーが「事務へCHAT」ボタンをクリック
  ↓
フロントエンドがPOST /api/property-listings/:propertyNumber/send-chat-to-officeを呼び出し
  ↓
PropertyListingService.sendChatToOffice()がチャットアプリケーションを開く
  ↓
PropertyListingService.updateConfirmation()が確認フィールドを「未」に設定
  ↓
PropertyListingSyncQueue.enqueue()が同期をキューに追加
  ↓
完了（1秒以内）
```

---

## Components and Interfaces

### フロントエンドコンポーネント

#### 1. PropertyListingDetailPage.tsx

**責務**: 物件詳細ページの表示とヘッダーボタンの管理

**主要な変更点**:
- ヘッダーボタンを2行レイアウトに変更
- 「事務へCHAT」ボタンを追加
- 確認フィールドトグルボタンを追加

**新規State**:
```typescript
const [confirmation, setConfirmation] = useState<'未' | '済'>('未');
const [confirmationUpdating, setConfirmationUpdating] = useState(false);
```

**新規ハンドラー**:
```typescript
// 事務へCHAT送信
const handleSendChatToOffice = async () => {
  try {
    await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-office`, {
      message: chatMessage,
      senderName: employee?.name || employee?.initials || '不明',
    });
    // 確認フィールドを「未」に自動設定
    setConfirmation('未');
    setSnackbar({ open: true, message: '事務へチャットを送信しました', severity: 'success' });
  } catch (error: any) {
    setSnackbar({ open: true, message: error.response?.data?.error || 'チャット送信に失敗しました', severity: 'error' });
  }
};

// 確認フィールド更新
const handleUpdateConfirmation = async (value: '未' | '済') => {
  setConfirmationUpdating(true);
  try {
    await api.put(`/api/property-listings/${propertyNumber}/confirmation`, { confirmation: value });
    setConfirmation(value);
    setSnackbar({ open: true, message: `確認を「${value}」に更新しました`, severity: 'success' });
  } catch (error: any) {
    setSnackbar({ open: true, message: error.response?.data?.error || '確認の更新に失敗しました', severity: 'error' });
  } finally {
    setConfirmationUpdating(false);
  }
};
```

**UIレイアウト**:
```tsx
{/* ヘッダーボタン（2行レイアウト） */}
<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
  {/* 第1行: 売主TEL、EMAIL送信、SMS、公開URL */}
  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
    <Button variant="outlined" onClick={handleCallSeller}>売主TEL</Button>
    <Button variant="outlined" onClick={handleSendEmail}>EMAIL送信</Button>
    <Button variant="outlined" onClick={handleSendSMS}>SMS</Button>
    <Button variant="outlined" onClick={handleOpenPublicUrl}>公開URL</Button>
  </Box>
  
  {/* 第2行: 担当へCHAT、事務へCHAT */}
  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
    <Button variant="contained" onClick={handleSendChatToAssignee}>担当へCHAT</Button>
    <Button 
      variant="contained" 
      onClick={handleSendChatToOffice}
      aria-label="事務担当者へチャットを送信"
    >
      事務へCHAT
    </Button>
  </Box>
</Box>

{/* 確認フィールドトグル */}
<Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
  <Typography variant="body2" fontWeight="bold">確認:</Typography>
  <ButtonGroup size="small" disabled={confirmationUpdating}>
    <Button
      variant={confirmation === '未' ? 'contained' : 'outlined'}
      onClick={() => handleUpdateConfirmation('未')}
      aria-label="確認を未に設定"
      aria-pressed={confirmation === '未'}
    >
      未
    </Button>
    <Button
      variant={confirmation === '済' ? 'contained' : 'outlined'}
      onClick={() => handleUpdateConfirmation('済')}
      aria-label="確認を済に設定"
      aria-pressed={confirmation === '済'}
    >
      済
    </Button>
  </ButtonGroup>
  {/* スクリーンリーダー用のaria-live領域 */}
  <Box
    role="status"
    aria-live="polite"
    aria-atomic="true"
    sx={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
  >
    {confirmationUpdating && `確認を${confirmation}に更新中`}
  </Box>
</Box>
```

#### 2. PropertySidebarStatus.tsx

**責務**: サイドバーのステータスカテゴリ表示

**主要な変更点**:
- 「未完了」カテゴリを追加
- カウント表示とフィルタリング機能を実装

**新規カテゴリ定義**:
```typescript
interface StatusCategory {
  id: string;
  label: string;
  count: number;
  color: string;
  priority: number;
}

const categories: StatusCategory[] = [
  {
    id: 'incomplete',
    label: '未完了',
    count: listings.filter(l => l.confirmation === '未').length,
    color: '#ff5722', // オレンジ
    priority: 1, // 最優先
  },
  // ... 既存のカテゴリ
];
```

**UIレイアウト**:
```tsx
<List>
  {categories.map(category => (
    <ListItem
      key={category.id}
      button
      selected={selectedStatus === category.id}
      onClick={() => onStatusChange(category.id)}
      sx={{
        borderLeft: `4px solid ${category.color}`,
        bgcolor: selectedStatus === category.id ? 'action.selected' : 'transparent',
      }}
    >
      <ListItemText
        primary={category.label}
        secondary={`${category.count}件`}
        aria-label={`${category.label} ${category.count}件`}
      />
    </ListItem>
  ))}
</List>
```

### バックエンドサービス

#### 1. PropertyListingService

**ファイル**: `backend/src/services/PropertyListingService.ts`

**新規メソッド**:

```typescript
class PropertyListingService {
  /**
   * 確認フィールドを更新
   */
  async updateConfirmation(propertyNumber: string, confirmation: '未' | '済'): Promise<void> {
    // バリデーション
    if (!['未', '済'].includes(confirmation)) {
      throw new Error('確認フィールドは「未」または「済」のみ有効です');
    }

    // DBを更新
    const { error } = await this.supabase
      .from('property_listings')
      .update({ 
        confirmation,
        updated_at: new Date().toISOString(),
      })
      .eq('property_number', propertyNumber);

    if (error) {
      console.error('確認フィールド更新エラー:', error);
      throw new Error('確認フィールドの更新に失敗しました');
    }

    // スプレッドシート同期をキューに追加
    await this.syncQueue.enqueue({
      type: 'update_confirmation',
      propertyNumber,
      confirmation,
    });
  }

  /**
   * 事務へチャットを送信
   */
  async sendChatToOffice(propertyNumber: string, message: string, senderName: string): Promise<void> {
    // チャットアプリケーションを開く（担当へCHATと同じアドレス）
    const chatAddress = await this.getChatAddress(propertyNumber);
    await this.openChatApplication(chatAddress, message, senderName);

    // 確認フィールドを「未」に自動設定
    await this.updateConfirmation(propertyNumber, '未');
  }

  /**
   * チャットアドレスを取得
   */
  private async getChatAddress(propertyNumber: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('property_listings')
      .select('sales_assignee')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !data) {
      throw new Error('物件情報の取得に失敗しました');
    }

    // 担当者のチャットアドレスを返す
    return `chat://assignee/${data.sales_assignee}`;
  }

  /**
   * チャットアプリケーションを開く
   */
  private async openChatApplication(address: string, message: string, senderName: string): Promise<void> {
    // チャットアプリケーションのAPIを呼び出す
    // 実装は既存の「担当へCHAT」と同じ
  }
}
```

#### 2. PropertyListingSyncService

**ファイル**: `backend/src/services/PropertyListingSyncService.ts`

**新規メソッド**:

```typescript
class PropertyListingSyncService {
  /**
   * 確認フィールドをスプレッドシートに同期（DQ列）
   */
  async syncConfirmationToSpreadsheet(propertyNumber: string, confirmation: '未' | '済'): Promise<void> {
    try {
      // 物件番号から行番号を取得
      const rowIndex = await this.findRowByPropertyNumber(propertyNumber);
      if (!rowIndex) {
        throw new Error(`物件番号 ${propertyNumber} が見つかりません`);
      }

      // DQ列（列番号120）を更新
      const range = `物件リスト!DQ${rowIndex}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[confirmation]],
        },
      });

      console.log(`✅ 確認フィールド同期完了: ${propertyNumber} → ${confirmation}`);
    } catch (error) {
      console.error(`❌ 確認フィールド同期エラー: ${propertyNumber}`, error);
      throw error;
    }
  }

  /**
   * スプレッドシートから確認フィールドを同期（DQ列 → DB）
   */
  async syncConfirmationFromSpreadsheet(): Promise<void> {
    try {
      // DQ列（列番号120）を取得
      const range = '物件リスト!B:DQ'; // B列（物件番号）からDQ列まで
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 1; i < rows.length; i++) { // ヘッダー行をスキップ
        const row = rows[i];
        const propertyNumber = row[0]; // B列
        const confirmation = row[119]; // DQ列（0-indexed: 119）

        if (!propertyNumber) continue;

        // バリデーション
        if (confirmation && !['未', '済'].includes(confirmation)) {
          console.error(`❌ 無効な確認値: ${propertyNumber} → ${confirmation}`);
          errorCount++;
          continue;
        }

        // DBを更新
        try {
          const { error } = await this.supabase
            .from('property_listings')
            .update({ 
              confirmation: confirmation || '未', // 空欄の場合は「未」
              updated_at: new Date().toISOString(),
            })
            .eq('property_number', propertyNumber);

          if (error) {
            console.error(`❌ DB更新エラー: ${propertyNumber}`, error);
            errorCount++;
          } else {
            updatedCount++;
          }
        } catch (error) {
          console.error(`❌ 同期エラー: ${propertyNumber}`, error);
          errorCount++;
        }
      }

      console.log(`✅ 確認フィールド同期完了: ${updatedCount}件更新, ${errorCount}件エラー`);
    } catch (error) {
      console.error('❌ 確認フィールド同期エラー:', error);
      throw error;
    }
  }

  /**
   * 物件番号から行番号を取得
   */
  private async findRowByPropertyNumber(propertyNumber: string): Promise<number | null> {
    const range = '物件リスト!B:B'; // B列（物件番号）
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === propertyNumber) {
        return i + 1; // 1-indexed
      }
    }

    return null;
  }
}
```

---

## Data Models

### データベーススキーマ

#### property_listings テーブル

**既存カラム**: 既に `confirmation VARCHAR(10)` が存在

**マイグレーション**: 既存の物件に対して初期値を設定

```sql
-- 既存物件の確認フィールドに初期値を設定
UPDATE property_listings
SET confirmation = '未'
WHERE confirmation IS NULL;

-- NOT NULL制約を追加（オプション）
ALTER TABLE property_listings
ALTER COLUMN confirmation SET DEFAULT '未';

-- CHECK制約を追加（バリデーション）
ALTER TABLE property_listings
ADD CONSTRAINT check_confirmation_value
CHECK (confirmation IN ('未', '済'));
```

### スプレッドシートスキーマ

#### 物件リストスプレッドシート

**DQ列（列番号120）**: 確認

| 列 | カラム名 | データ型 | 説明 |
|----|---------|---------|------|
| DQ | 確認 | TEXT | 「未」または「済」 |

**バリデーション**: スプレッドシートにデータ検証ルールを設定

```
データ検証ルール:
- リストから選択: 未, 済
- 無効なデータの場合: 警告を表示
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 事務へCHATボタンクリック時の確認フィールド自動設定

*For any* 物件に対して、「事務へCHAT」ボタンをクリックすると、確認フィールドが「未」に自動設定される

**Validates: Requirements 2.3**

### Property 2: 確認フィールドのバリデーション

*For any* 確認フィールドへの入力値に対して、「未」または「済」以外の値は拒否される

**Validates: Requirements 3.2, 4.4**

### Property 3: 新規物件のデフォルト値

*For any* 新規作成される物件に対して、確認フィールドのデフォルト値は「未」である

**Validates: Requirements 3.3**

### Property 4: 確認フィールド更新時のタイムスタンプ記録

*For any* 物件の確認フィールドを更新すると、updated_atタイムスタンプが記録される

**Validates: Requirements 3.4**

### Property 5: 確認フィールドの双方向同期

*For any* 物件に対して、データベースで確認フィールドを更新すると、スプレッドシートのDQ列に同期され、逆にスプレッドシートのDQ列を更新すると、データベースに同期される

**Validates: Requirements 4.1**

### Property 6: 確認ボタンクリック時の動作

*For any* 物件に対して、「未」ボタンをクリックすると確認フィールドが「未」に設定され、「済」ボタンをクリックすると確認フィールドが「済」に設定される

**Validates: Requirements 5.2, 5.3**

### Property 7: 確認フィールド更新時の成功通知

*For any* 物件の確認フィールドを更新すると、成功通知が表示される

**Validates: Requirements 5.5**

### Property 8: 未完了カテゴリのカウント表示

*For any* 物件セットに対して、サイドバーの「未完了」カテゴリには確認フィールドが「未」の物件数が正しく表示される

**Validates: Requirements 6.2**

### Property 9: 未完了カテゴリのフィルタリング

*For any* 物件セットに対して、「未完了」カテゴリをクリックすると、確認フィールドが「未」の物件のみが表示される

**Validates: Requirements 6.3**

### Property 10: 未完了カテゴリのリアルタイム更新

*For any* 物件の確認フィールドを変更すると、サイドバーの「未完了」カテゴリのカウントがリアルタイムで更新される

**Validates: Requirements 6.4**

---

## Error Handling

### エラーケース

#### 1. チャットアプリケーションが開けない

**エラーメッセージ**: 「チャットアプリケーションを開けませんでした。もう一度お試しください。」

**処理**:
- ユーザーにエラーメッセージを表示
- エラーログに記録（タイムスタンプ、物件番号、エラー詳細）
- 確認フィールドは更新しない

**実装**:
```typescript
try {
  await this.openChatApplication(chatAddress, message, senderName);
} catch (error) {
  console.error(`❌ チャットアプリケーションエラー: ${propertyNumber}`, error);
  throw new Error('チャットアプリケーションを開けませんでした。もう一度お試しください。');
}
```

#### 2. 確認フィールド更新失敗

**エラーメッセージ**: 「確認の更新に失敗しました。もう一度お試しください。」

**処理**:
- ユーザーにエラーメッセージを表示
- 前の値を保持（ロールバック）
- エラーログに記録（タイムスタンプ、物件番号、エラー詳細）

**実装**:
```typescript
const previousValue = confirmation;
try {
  await this.updateConfirmation(propertyNumber, newValue);
  setConfirmation(newValue);
} catch (error) {
  console.error(`❌ 確認フィールド更新エラー: ${propertyNumber}`, error);
  setConfirmation(previousValue); // ロールバック
  throw new Error('確認の更新に失敗しました。もう一度お試しください。');
}
```

#### 3. スプレッドシート同期失敗

**エラーメッセージ**: （ユーザーには表示しない、バックグラウンドで処理）

**処理**:
- 最大3回までリトライ（Exponential backoff）
- リトライ遅延: 1秒 → 2秒 → 4秒
- 3回失敗した場合、エラーログに記録
- 次回の定期同期（10分後）で再試行

**実装**:
```typescript
async syncWithRetry(propertyNumber: string, confirmation: string, maxRetries = 3): Promise<void> {
  let attempt = 0;
  let delay = 1000; // 初回1秒

  while (attempt < maxRetries) {
    try {
      await this.syncConfirmationToSpreadsheet(propertyNumber, confirmation);
      return; // 成功
    } catch (error) {
      attempt++;
      console.error(`❌ 同期失敗 (試行 ${attempt}/${maxRetries}): ${propertyNumber}`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        // 最終的に失敗
        console.error(`❌ 同期最終失敗: ${propertyNumber}`, error);
        // エラーログに記録（次回の定期同期で再試行）
      }
    }
  }
}
```

#### 4. 無効な確認値

**エラーメッセージ**: 「無効な確認値です。「未」または「済」を指定してください。」

**処理**:
- スプレッドシートから無効な値を検出
- エラーログに記録（タイムスタンプ、物件番号、無効な値）
- その物件の同期をスキップ
- 次回の定期同期（10分後）で再試行

**実装**:
```typescript
if (confirmation && !['未', '済'].includes(confirmation)) {
  console.error(`❌ 無効な確認値: ${propertyNumber} → ${confirmation}`);
  // 同期をスキップ
  continue;
}
```

### エラーログフォーマット

```typescript
interface ErrorLog {
  timestamp: string;
  propertyNumber: string;
  errorType: 'chat_open_failed' | 'confirmation_update_failed' | 'sync_failed' | 'invalid_value';
  errorMessage: string;
  errorDetails: any;
}
```

---

## Testing Strategy

### デュアルテストアプローチ

本機能では、ユニットテストとプロパティベーステストの両方を使用して、包括的なテストカバレッジを実現します。

#### ユニットテスト

**目的**: 特定の例、エッジケース、エラー条件を検証

**テストケース**:

1. **ヘッダーボタンのレイアウト**
   - 第1行に「売主TEL」「EMAIL送信」「SMS」「公開URL」が表示される
   - 第2行に「担当へCHAT」「事務へCHAT」が表示される

2. **「事務へCHAT」ボタンの表示**
   - ボタンが表示される
   - aria-labelが設定されている

3. **確認フィールドトグルの表示**
   - 「未」「済」ボタンが表示される
   - aria-labelが設定されている
   - 現在選択されている値が視覚的に示される

4. **サイドバーの「未完了」カテゴリ表示**
   - 「未完了」カテゴリが表示される
   - カテゴリがサイドバーの最上部に表示される
   - aria-labelが設定されている

5. **マイグレーション**
   - 既存物件の確認フィールドがnullの場合、「未」が設定される
   - マイグレーション実行時にログが記録される

6. **エラーハンドリング**
   - チャットアプリケーションが開けない場合、エラーメッセージが表示される
   - 確認フィールド更新が失敗した場合、エラーメッセージが表示され、前の値が保持される
   - スプレッドシート同期が失敗した場合、3回までリトライされる
   - 無効な確認値の場合、エラーログに記録され、同期がスキップされる

7. **アクセシビリティ**
   - 「事務へCHAT」ボタンにaria-labelが設定されている
   - 確認フィールドトグルボタンにaria-labelが設定されている
   - 確認フィールド更新時にaria-liveで通知される
   - サイドバーの「未完了」カテゴリにaria-labelが設定されている

#### プロパティベーステスト

**目的**: 普遍的なプロパティを全入力にわたって検証

**テストライブラリ**: fast-check (JavaScript/TypeScript用)

**設定**:
- 最小イテレーション数: 100回
- タグフォーマット: `Feature: property-listing-header-chat-confirmation, Property {number}: {property_text}`

**テストケース**:

1. **Property 1: 事務へCHATボタンクリック時の確認フィールド自動設定**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 1: 事務へCHATボタンクリック時の確認フィールド自動設定
   fc.assert(
     fc.asyncProperty(
       fc.record({
         propertyNumber: fc.string({ minLength: 1 }),
         message: fc.string(),
         senderName: fc.string(),
       }),
       async ({ propertyNumber, message, senderName }) => {
         // 事務へCHATを送信
         await propertyListingService.sendChatToOffice(propertyNumber, message, senderName);
         
         // 確認フィールドが「未」に設定されていることを確認
         const property = await propertyListingService.getProperty(propertyNumber);
         expect(property.confirmation).toBe('未');
       }
     ),
     { numRuns: 100 }
   );
   ```

2. **Property 2: 確認フィールドのバリデーション**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 2: 確認フィールドのバリデーション
   fc.assert(
     fc.asyncProperty(
       fc.record({
         propertyNumber: fc.string({ minLength: 1 }),
         confirmation: fc.string().filter(s => s !== '未' && s !== '済'),
       }),
       async ({ propertyNumber, confirmation }) => {
         // 無効な値で更新を試みる
         await expect(
           propertyListingService.updateConfirmation(propertyNumber, confirmation)
         ).rejects.toThrow('確認フィールドは「未」または「済」のみ有効です');
       }
     ),
     { numRuns: 100 }
   );
   ```

3. **Property 3: 新規物件のデフォルト値**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 3: 新規物件のデフォルト値
   fc.assert(
     fc.asyncProperty(
       fc.record({
         propertyNumber: fc.string({ minLength: 1 }),
         // その他の物件データ
       }),
       async (propertyData) => {
         // 新規物件を作成
         await propertyListingService.createProperty(propertyData);
         
         // 確認フィールドが「未」であることを確認
         const property = await propertyListingService.getProperty(propertyData.propertyNumber);
         expect(property.confirmation).toBe('未');
       }
     ),
     { numRuns: 100 }
   );
   ```

4. **Property 4: 確認フィールド更新時のタイムスタンプ記録**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 4: 確認フィールド更新時のタイムスタンプ記録
   fc.assert(
     fc.asyncProperty(
       fc.record({
         propertyNumber: fc.string({ minLength: 1 }),
         confirmation: fc.constantFrom('未', '済'),
       }),
       async ({ propertyNumber, confirmation }) => {
         const beforeUpdate = new Date();
         
         // 確認フィールドを更新
         await propertyListingService.updateConfirmation(propertyNumber, confirmation);
         
         const afterUpdate = new Date();
         
         // updated_atが記録されていることを確認
         const property = await propertyListingService.getProperty(propertyNumber);
         const updatedAt = new Date(property.updated_at);
         expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
         expect(updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
       }
     ),
     { numRuns: 100 }
   );
   ```

5. **Property 5: 確認フィールドの双方向同期**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 5: 確認フィールドの双方向同期
   fc.assert(
     fc.asyncProperty(
       fc.record({
         propertyNumber: fc.string({ minLength: 1 }),
         confirmation: fc.constantFrom('未', '済'),
       }),
       async ({ propertyNumber, confirmation }) => {
         // データベースで更新
         await propertyListingService.updateConfirmation(propertyNumber, confirmation);
         
         // スプレッドシートに同期されることを確認（5秒待機）
         await new Promise(resolve => setTimeout(resolve, 5000));
         const spreadsheetValue = await propertyListingSyncService.getConfirmationFromSpreadsheet(propertyNumber);
         expect(spreadsheetValue).toBe(confirmation);
         
         // スプレッドシートで更新
         const newConfirmation = confirmation === '未' ? '済' : '未';
         await propertyListingSyncService.updateConfirmationInSpreadsheet(propertyNumber, newConfirmation);
         
         // データベースに同期されることを確認（10分待機 - テストでは短縮）
         await new Promise(resolve => setTimeout(resolve, 1000)); // テスト用に短縮
         const property = await propertyListingService.getProperty(propertyNumber);
         expect(property.confirmation).toBe(newConfirmation);
       }
     ),
     { numRuns: 100 }
   );
   ```

6. **Property 6: 確認ボタンクリック時の動作**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 6: 確認ボタンクリック時の動作
   fc.assert(
     fc.asyncProperty(
       fc.record({
         propertyNumber: fc.string({ minLength: 1 }),
         confirmation: fc.constantFrom('未', '済'),
       }),
       async ({ propertyNumber, confirmation }) => {
         // 確認ボタンをクリック
         await propertyListingService.updateConfirmation(propertyNumber, confirmation);
         
         // 確認フィールドが更新されていることを確認
         const property = await propertyListingService.getProperty(propertyNumber);
         expect(property.confirmation).toBe(confirmation);
       }
     ),
     { numRuns: 100 }
   );
   ```

7. **Property 7: 確認フィールド更新時の成功通知**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 7: 確認フィールド更新時の成功通知
   fc.assert(
     fc.asyncProperty(
       fc.record({
         propertyNumber: fc.string({ minLength: 1 }),
         confirmation: fc.constantFrom('未', '済'),
       }),
       async ({ propertyNumber, confirmation }) => {
         // 確認フィールドを更新
         const result = await propertyListingService.updateConfirmation(propertyNumber, confirmation);
         
         // 成功通知が返されることを確認
         expect(result.success).toBe(true);
         expect(result.message).toContain('更新しました');
       }
     ),
     { numRuns: 100 }
   );
   ```

8. **Property 8: 未完了カテゴリのカウント表示**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 8: 未完了カテゴリのカウント表示
   fc.assert(
     fc.asyncProperty(
       fc.array(
         fc.record({
           propertyNumber: fc.string({ minLength: 1 }),
           confirmation: fc.constantFrom('未', '済'),
         })
       ),
       async (properties) => {
         // 物件セットを作成
         for (const property of properties) {
           await propertyListingService.createProperty(property);
         }
         
         // 「未完了」カテゴリのカウントを取得
         const incompleteCount = await propertyListingService.getIncompleteCount();
         
         // 確認フィールドが「未」の物件数と一致することを確認
         const expectedCount = properties.filter(p => p.confirmation === '未').length;
         expect(incompleteCount).toBe(expectedCount);
       }
     ),
     { numRuns: 100 }
   );
   ```

9. **Property 9: 未完了カテゴリのフィルタリング**
   ```typescript
   // Feature: property-listing-header-chat-confirmation, Property 9: 未完了カテゴリのフィルタリング
   fc.assert(
     fc.asyncProperty(
       fc.array(
         fc.record({
           propertyNumber: fc.string({ minLength: 1 }),
           confirmation: fc.constantFrom('未', '済'),
         })
       ),
       async (properties) => {
         // 物件セットを作成
         for (const property of properties) {
           await propertyListingService.createProperty(property);
         }
         
         // 「未完了」カテゴリでフィルタリング
         const incompleteProperties = await propertyListingService.filterByIncomplete();
         
         // 全ての物件の確認フィールドが「未」であることを確認
         for (const property of incompleteProperties) {
           expect(property.confirmation).toBe('未');
         }
         
         // 確認フィールドが「未」の物件が全て含まれることを確認
         const expectedProperties = properties.filter(p => p.confirmation === '未');
         expect(incompleteProperties.length).toBe(expectedProperties.length);
       }
     ),
     { numRuns: 100 }
   );
   ```

10. **Property 10: 未完了カテゴリのリアルタイム更新**
    ```typescript
    // Feature: property-listing-header-chat-confirmation, Property 10: 未完了カテゴリのリアルタイム更新
    fc.assert(
      fc.asyncProperty(
        fc.record({
          propertyNumber: fc.string({ minLength: 1 }),
          initialConfirmation: fc.constantFrom('未', '済'),
          newConfirmation: fc.constantFrom('未', '済'),
        }),
        async ({ propertyNumber, initialConfirmation, newConfirmation }) => {
          // 物件を作成
          await propertyListingService.createProperty({ propertyNumber, confirmation: initialConfirmation });
          
          // 初期カウントを取得
          const initialCount = await propertyListingService.getIncompleteCount();
          
          // 確認フィールドを更新
          await propertyListingService.updateConfirmation(propertyNumber, newConfirmation);
          
          // 更新後のカウントを取得
          const updatedCount = await propertyListingService.getIncompleteCount();
          
          // カウントが正しく更新されていることを確認
          if (initialConfirmation === '未' && newConfirmation === '済') {
            expect(updatedCount).toBe(initialCount - 1);
          } else if (initialConfirmation === '済' && newConfirmation === '未') {
            expect(updatedCount).toBe(initialCount + 1);
          } else {
            expect(updatedCount).toBe(initialCount);
          }
        }
      ),
      { numRuns: 100 }
    );
    ```

### テスト実行

```bash
# ユニットテスト
npm test -- property-listing-header-chat-confirmation.test.ts

# プロパティベーステスト
npm test -- property-listing-header-chat-confirmation.property.test.ts

# 全テスト
npm test
```

---

以上で設計ドキュメントが完成しました。要件定義に基づいて、アーキテクチャ、コンポーネント、データモデル、正確性プロパティ、エラーハンドリング、テスト戦略を詳細に設計しました。
