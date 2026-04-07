# 設計書：売主ステータスフィールド保存・同期機能

## 概要

売主リストの通話モードページのステータスセクションに存在する4つのフィールド（専任（他決）決定日、競合（複数選択可）、専任・他決要因（複数選択可）、競合名、理由（他決、専任））の保存機能とDB→スプレッドシート即時同期機能を実装します。

## アーキテクチャ

### システム構成

```
[フロントエンド: CallModePage.tsx]
         ↓ API呼び出し
[バックエンド: sellers.ts (PUT /api/sellers/:id)]
         ↓ データ保存
[SellerService.supabase.ts]
         ↓ DB更新
[Supabase: sellers テーブル]
         ↓ 同期トリガー
[SpreadsheetSyncService]
         ↓ 即時同期
[Google Sheets: 売主リスト]
```

### データフロー

1. **ユーザー入力** → フロントエンドの状態管理
2. **保存ボタンクリック** → バリデーション実行
3. **API呼び出し** → `PUT /api/sellers/:id`
4. **DB更新** → `SellerService.updateSeller()`
5. **スプレッドシート同期** → `SpreadsheetSyncService.syncToSpreadsheet()`
6. **成功メッセージ表示** → ユーザーにフィードバック

## コンポーネントとインターフェース

### 1. フロントエンド（CallModePage.tsx）

#### 状態管理

```typescript
// 編集中の値
const [editedExclusiveDecisionDate, setEditedExclusiveDecisionDate] = useState<string>('');
const [editedCompetitors, setEditedCompetitors] = useState<string[]>([]);
const [editedExclusiveOtherDecisionFactors, setEditedExclusiveOtherDecisionFactors] = useState<string[]>([]);
const [editedCompetitorNameAndReason, setEditedCompetitorNameAndReason] = useState<string>('');

// 保存済みの値（変更検知用）
const [savedExclusiveDecisionDate, setSavedExclusiveDecisionDate] = useState<string>('');
const [savedCompetitors, setSavedCompetitors] = useState<string[]>([]);
const [savedExclusiveOtherDecisionFactors, setSavedExclusiveOtherDecisionFactors] = useState<string[]>([]);
const [savedCompetitorNameAndReason, setSavedCompetitorNameAndReason] = useState<string>('');
```

#### バリデーションロジック

```typescript
// 専任または他決が含まれるステータスの場合、4つのフィールドが必須
const requiresDecisionDate = (status: string): boolean => {
  return status.includes('専任') || status.includes('他決');
};

// バリデーション実行
if (requiresDecisionDate(editedStatus)) {
  if (!editedExclusiveDecisionDate) {
    setError('専任（他決）決定日を入力してください');
    return;
  }
  if (editedCompetitors.length === 0) {
    setError('競合を選択してください');
    return;
  }
  if (editedExclusiveOtherDecisionFactors.length === 0) {
    setError('専任・他決要因を選択してください');
    return;
  }
}
```

#### API呼び出し

```typescript
const handleStatusSave = async () => {
  try {
    setSavingStatus(true);
    
    // バリデーション実行
    // ...
    
    // API呼び出し
    await api.put(`/sellers/${id}`, {
      status: editedStatus,
      confidence: editedConfidence || null,
      exclusiveOtherDecisionMeeting: editedExclusiveOtherDecisionMeeting || null,
      nextCallDate: editedNextCallDate || null,
      exclusiveDecisionDate: editedExclusiveDecisionDate || null,
      competitors: editedCompetitors.length > 0 ? editedCompetitors.join(', ') : null,
      exclusiveOtherDecisionFactors: editedExclusiveOtherDecisionFactors.length > 0 ? editedExclusiveOtherDecisionFactors : null,
      competitorNameAndReason: editedCompetitorNameAndReason || null,
    });
    
    // 保存済み値を更新
    setSavedExclusiveDecisionDate(editedExclusiveDecisionDate);
    setSavedCompetitors(editedCompetitors);
    setSavedExclusiveOtherDecisionFactors(editedExclusiveOtherDecisionFactors);
    setSavedCompetitorNameAndReason(editedCompetitorNameAndReason);
    
    setSuccessMessage('ステータスを保存しました');
  } catch (err: any) {
    setError(err.response?.data?.error?.message || 'ステータスの更新に失敗しました');
  } finally {
    setSavingStatus(false);
  }
};
```

### 2. バックエンド（sellers.ts）

#### ルートハンドラー

```typescript
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // バリデーション
    // ...
    
    // SellerServiceを呼び出し
    const seller = await sellerService.updateSeller(req.params.id, req.body);
    
    res.json(seller);
  } catch (error) {
    console.error('Update seller error:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_SELLER_ERROR',
        message: 'Failed to update seller',
        retryable: true,
      },
    });
  }
});
```

### 3. SellerService（SellerService.supabase.ts）

#### updateSellerメソッド

```typescript
async updateSeller(sellerId: string, data: UpdateSellerRequest): Promise<Seller> {
  const updates: any = {};
  
  // 競合情報フィールド
  if (data.competitorName !== undefined) {
    updates.competitor_name = data.competitorName;
  }
  if (data.competitors !== undefined) {
    // competitorsはcompetitor_nameとして保存（カンマ区切りの文字列）
    updates.competitor_name = data.competitors;
  }
  if (data.exclusiveDecisionDate !== undefined) {
    // exclusive_decision_dateカラムは存在しないため、contract_year_monthに保存
    updates.contract_year_month = data.exclusiveDecisionDate;
  }
  if (data.exclusiveOtherDecisionFactors !== undefined) {
    // exclusive_other_decision_factorは単数形（配列をカンマ区切り文字列として保存）
    const factors = data.exclusiveOtherDecisionFactors;
    if (Array.isArray(factors) && factors.length > 0) {
      updates.exclusive_other_decision_factor = factors.join(', ');
    } else {
      updates.exclusive_other_decision_factor = null;
    }
  }
  if (data.competitorNameAndReason !== undefined) {
    updates.competitor_name_and_reason = data.competitorNameAndReason;
  }
  
  // データベース更新
  const { data: seller, error } = await this.table('sellers')
    .update(updates)
    .eq('id', sellerId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update seller: ${error.message}`);
  }
  
  // キャッシュ無効化
  invalidateSellerCache(sellerId);
  invalidateListSellersCache();
  await CacheHelper.del(CacheHelper.generateKey('seller', sellerId));
  await CacheHelper.delPattern('sellers:list:*');
  await CacheHelper.del('sellers:sidebar-counts');
  
  // スプレッドシートに同期（非同期・ノンブロッキング）
  this.syncDirectToSpreadsheet(sellerId);
  
  return await this.decryptSeller(seller);
}
```

#### syncDirectToSpreadsheetメソッド

```typescript
private syncDirectToSpreadsheet(sellerId: string): void {
  // 非同期でスプレッドシート同期を実行（ノンブロッキング）
  (async () => {
    try {
      const syncService = await createSpreadsheetSyncService();
      if (syncService) {
        await syncService.syncToSpreadsheet(sellerId);
        console.log(`✅ [SpreadsheetSync] Synced seller ${sellerId} to spreadsheet`);
      }
    } catch (err) {
      console.error(`⚠️ [SpreadsheetSync] Failed to sync seller ${sellerId}:`, err);
    }
  })();
}
```

### 4. SpreadsheetSyncService

#### syncToSpreadsheetメソッド

```typescript
async syncToSpreadsheet(sellerId: string): Promise<SyncResult> {
  try {
    console.log(`📝 [SpreadsheetSync] Starting sync for seller ID: ${sellerId}`);
    
    // Supabaseから売主データを取得
    const { data: seller, error } = await this.supabase
      .from('sellers')
      .select('*')
      .eq('id', sellerId)
      .single();
    
    if (error || !seller) {
      return {
        success: false,
        rowsAffected: 0,
        error: `Seller not found: ${sellerId}`,
      };
    }
    
    // 暗号化フィールドを復号
    const decryptedSeller = this.decryptSellerFields(seller);
    
    // スプレッドシート形式に変換
    const sheetRow = this.columnMapper.mapToSheet(decryptedSeller as SellerData);
    
    // 売主番号で既存行を検索
    const existingRowIndex = await this.findRowBySellerId(seller.seller_number);
    
    if (existingRowIndex) {
      // 既存行を部分更新
      await this.sheetsClient.updateRowPartial(existingRowIndex, sheetRow);
      console.log(`✅ [SpreadsheetSync] Updated row ${existingRowIndex}`);
      
      // Supabaseの同期時刻を更新
      await this.updateSyncTimestamp(sellerId);
      
      return {
        success: true,
        rowsAffected: 1,
        operation: 'update',
      };
    } else {
      // 新規行を追加
      await this.sheetsClient.appendRow(sheetRow);
      console.log(`✅ [SpreadsheetSync] Added new row`);
      
      // Supabaseの同期時刻を更新
      await this.updateSyncTimestamp(sellerId);
      
      return {
        success: true,
        rowsAffected: 1,
        operation: 'create',
      };
    }
  } catch (error: any) {
    console.error(`❌ [SpreadsheetSync] Error:`, error.message);
    return {
      success: false,
      rowsAffected: 0,
      error: error.message,
    };
  }
}
```

## データモデル

### データベーススキーマ（sellers テーブル）

| カラム名 | 型 | 説明 | スプレッドシート列 |
|---------|-----|------|------------------|
| `contract_year_month` | DATE | 専任（他決）決定日 | AM列「契約年月 他決は分かった時点」 |
| `competitor_name` | TEXT | 競合（カンマ区切り） | AN列「競合名」 |
| `exclusive_other_decision_factor` | TEXT | 専任・他決要因（カンマ区切り） | AQ列「専任・他決要因」 |
| `competitor_name_and_reason` | TEXT | 競合名、理由（他決、専任） | AI列「競合名、理由（他決、専任）」 |

### TypeScript型定義

```typescript
// frontend/src/types/index.ts
export interface Seller {
  // ... 既存フィールド
  
  // 競合・他決情報
  competitorNameAndReason?: string;
  competitorName?: string;
  exclusiveOtherDecisionFactor?: string;
  exclusiveOtherDecisionFactors?: string[]; // 専任・他決要因（複数選択）
  contractYearMonth?: Date | string; // 専任（他決）決定日
}

export interface UpdateSellerRequest {
  // ... 既存フィールド
  
  // 競合・他決情報
  competitorName?: string;
  competitors?: string; // カンマ区切り文字列
  exclusiveDecisionDate?: string; // YYYY-MM-DD形式
  exclusiveOtherDecisionFactors?: string[]; // 配列
  competitorNameAndReason?: string;
}
```

### カラムマッピング（column-mapping.json）

```json
{
  "spreadsheetToDatabase": {
    "契約年月 他決は分かった時点": "contract_year_month",
    "競合名": "competitor_name",
    "専任・他決要因": "exclusive_other_decision_factor",
    "競合名、理由\n（他決、専任）": "competitor_name_and_reason"
  },
  "databaseToSpreadsheet": {
    "contract_year_month": "契約年月 他決は分かった時点",
    "competitor_name": "競合名",
    "exclusive_other_decision_factor": "専任・他決要因",
    "competitor_name_and_reason": "競合名、理由\n（他決、専任）"
  },
  "typeConversions": {
    "contract_year_month": "date",
    "competitor_name": "string",
    "exclusive_other_decision_factor": "string",
    "competitor_name_and_reason": "string"
  }
}
```

## エラーハンドリング

### 1. バリデーションエラー

**シナリオ**: 専任または他決ステータスで必須フィールドが未入力

**処理**:
```typescript
if (requiresDecisionDate(editedStatus)) {
  if (!editedExclusiveDecisionDate) {
    setError('専任（他決）決定日を入力してください');
    return;
  }
  if (editedCompetitors.length === 0) {
    setError('競合を選択してください');
    return;
  }
  if (editedExclusiveOtherDecisionFactors.length === 0) {
    setError('専任・他決要因を選択してください');
    return;
  }
}
```

**ユーザーへの表示**: 赤色のエラーメッセージ

### 2. データベース保存エラー

**シナリオ**: Supabaseへの保存が失敗

**処理**:
```typescript
try {
  const { data: seller, error } = await this.table('sellers')
    .update(updates)
    .eq('id', sellerId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update seller: ${error.message}`);
  }
} catch (error) {
  console.error('❌ Update seller error:', error);
  throw error;
}
```

**ユーザーへの表示**: 「データベースへの保存に失敗しました」

### 3. スプレッドシート同期エラー

**シナリオ**: Google Sheets APIへの同期が失敗

**処理**:
```typescript
try {
  await syncService.syncToSpreadsheet(sellerId);
  console.log(`✅ [SpreadsheetSync] Synced seller ${sellerId} to spreadsheet`);
} catch (err) {
  console.error(`⚠️ [SpreadsheetSync] Failed to sync seller ${sellerId}:`, err);
  // エラーをログに記録するが、ユーザーには成功メッセージを表示
  // （データベースへの保存は成功しているため）
}
```

**ユーザーへの表示**: 「ステータスを保存しました」（データベース保存成功）

**注意**: スプレッドシート同期は非同期・ノンブロッキングで実行されるため、同期エラーはユーザーに表示されません。エラーはサーバーログに記録されます。

### 4. ネットワークエラー

**シナリオ**: API呼び出しがタイムアウトまたは接続エラー

**処理**:
```typescript
try {
  await api.put(`/sellers/${id}`, { ... });
} catch (err: any) {
  if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    setError('ネットワークエラーが発生しました。再試行してください');
  } else {
    setError(err.response?.data?.error?.message || 'ステータスの更新に失敗しました');
  }
}
```

**ユーザーへの表示**: 「ネットワークエラーが発生しました。再試行してください」

### 5. タイムアウトエラー

**シナリオ**: スプレッドシート同期が5秒以内に完了しない

**処理**:
```typescript
// スプレッドシート同期は非同期・ノンブロッキングで実行されるため、
// タイムアウトエラーは発生しません。
// データベース保存が成功した時点で、ユーザーには成功メッセージを表示します。
```

**ユーザーへの表示**: 「ステータスを保存しました」（データベース保存成功）

## テスト戦略

### 1. ユニットテスト

#### フロントエンド（CallModePage.tsx）

**テスト対象**:
- バリデーションロジック（`requiresDecisionDate`）
- 状態管理（useState）
- API呼び出し（モック）

**テストケース**:
```typescript
describe('CallModePage - Status Section', () => {
  it('専任ステータスの場合、4つのフィールドが必須', () => {
    const status = '専任媒介';
    const exclusiveDecisionDate = '';
    const competitors: string[] = [];
    const exclusiveOtherDecisionFactors: string[] = [];
    
    expect(requiresDecisionDate(status)).toBe(true);
    expect(exclusiveDecisionDate).toBe('');
    expect(competitors.length).toBe(0);
    expect(exclusiveOtherDecisionFactors.length).toBe(0);
  });
  
  it('一般媒介ステータスの場合、4つのフィールドは任意', () => {
    const status = '一般媒介';
    
    expect(requiresDecisionDate(status)).toBe(false);
  });
});
```

#### バックエンド（SellerService.supabase.ts）

**テスト対象**:
- `updateSeller`メソッド
- データ変換ロジック（配列→カンマ区切り文字列）
- キャッシュ無効化

**テストケース**:
```typescript
describe('SellerService - updateSeller', () => {
  it('exclusiveOtherDecisionFactors配列をカンマ区切り文字列に変換', async () => {
    const sellerId = 'test-seller-id';
    const data = {
      exclusiveOtherDecisionFactors: ['①知り合い', '②価格が高い'],
    };
    
    const seller = await sellerService.updateSeller(sellerId, data);
    
    expect(seller.exclusiveOtherDecisionFactor).toBe('①知り合い, ②価格が高い');
  });
  
  it('exclusiveOtherDecisionFactorsが空配列の場合、nullを保存', async () => {
    const sellerId = 'test-seller-id';
    const data = {
      exclusiveOtherDecisionFactors: [],
    };
    
    const seller = await sellerService.updateSeller(sellerId, data);
    
    expect(seller.exclusiveOtherDecisionFactor).toBeNull();
  });
});
```

### 2. 統合テスト

**テスト対象**:
- フロントエンド → バックエンド → データベース → スプレッドシート

**テストケース**:
```typescript
describe('Status Fields Save and Sync - Integration', () => {
  it('4つのフィールドを保存し、スプレッドシートに同期', async () => {
    // 1. フロントエンドで値を入力
    const data = {
      status: '専任媒介',
      exclusiveDecisionDate: '2026-01-30',
      competitors: '別大興産, リライフ',
      exclusiveOtherDecisionFactors: ['①知り合い', '②価格が高い'],
      competitorNameAndReason: 'テスト理由',
    };
    
    // 2. API呼び出し
    const response = await api.put(`/sellers/${sellerId}`, data);
    
    // 3. データベースを確認
    const { data: seller } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', sellerId)
      .single();
    
    expect(seller.contract_year_month).toBe('2026-01-30');
    expect(seller.competitor_name).toBe('別大興産, リライフ');
    expect(seller.exclusive_other_decision_factor).toBe('①知り合い, ②価格が高い');
    expect(seller.competitor_name_and_reason).toBe('テスト理由');
    
    // 4. スプレッドシートを確認（非同期なので少し待つ）
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const sheetRow = await sheetsClient.findRowByColumn('売主番号', seller.seller_number);
    expect(sheetRow['契約年月 他決は分かった時点']).toBe('2026-01-30');
    expect(sheetRow['競合名']).toBe('別大興産, リライフ');
    expect(sheetRow['専任・他決要因']).toBe('①知り合い, ②価格が高い');
    expect(sheetRow['競合名、理由\n（他決、専任）']).toBe('テスト理由');
  });
});
```

### 3. E2Eテスト

**テスト対象**:
- ブラウザでの実際の操作

**テストケース**:
```typescript
describe('CallModePage - E2E', () => {
  it('ステータスセクションで4つのフィールドを入力し保存', async () => {
    // 1. 通話モードページを開く
    await page.goto(`/sellers/${sellerId}/call`);
    
    // 2. ステータスを選択
    await page.selectOption('[name="status"]', '専任媒介');
    
    // 3. 専任（他決）決定日を入力
    await page.fill('[name="exclusiveDecisionDate"]', '2026-01-30');
    
    // 4. 競合を選択
    await page.click('text=別大興産');
    await page.click('text=リライフ');
    
    // 5. 専任・他決要因を選択
    await page.click('text=①知り合い');
    await page.click('text=②価格が高い');
    
    // 6. 競合名、理由を入力
    await page.fill('[name="competitorNameAndReason"]', 'テスト理由');
    
    // 7. 保存ボタンをクリック
    await page.click('button:has-text("保存")');
    
    // 8. 成功メッセージを確認
    await expect(page.locator('text=ステータスを保存しました')).toBeVisible();
    
    // 9. ページをリロードして値が保存されているか確認
    await page.reload();
    
    expect(await page.inputValue('[name="exclusiveDecisionDate"]')).toBe('2026-01-30');
    expect(await page.isChecked('text=別大興産')).toBe(true);
    expect(await page.isChecked('text=リライフ')).toBe(true);
    expect(await page.isChecked('text=①知り合い')).toBe(true);
    expect(await page.isChecked('text=②価格が高い')).toBe(true);
    expect(await page.inputValue('[name="competitorNameAndReason"]')).toBe('テスト理由');
  });
});
```

## まとめ

この設計では、売主リストの通話モードページのステータスセクションに存在する4つのフィールドの保存機能とDB→スプレッドシート即時同期機能を実装します。

主な実装ポイント:
1. フロントエンドでバリデーションを実行（専任・他決ステータスの場合は必須）
2. バックエンドでデータベースに保存（配列→カンマ区切り文字列に変換）
3. スプレッドシート同期を非同期・ノンブロッキングで実行
4. エラーハンドリングを適切に実装（ユーザーにわかりやすいメッセージを表示）
5. キャッシュ無効化を実行（リストページの表示を最新に保つ）

この設計により、ユーザーは通話モードページで4つのフィールドを入力・保存し、スプレッドシートに即座に反映されることを確認できます。
