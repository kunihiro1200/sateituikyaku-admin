# 設計ドキュメント

## 概要

売主リストの通話モードページに「専任他決打合せ」フィールドを追加する機能を実装します。このフィールドは、専任、他決、または一般が決定した売主に対して、打合せ内容を記録するために使用されます。

## アーキテクチャ

### システム構成

```
フロントエンド (CallModePage)
  ↓ API呼び出し
バックエンド (SellerService)
  ↓ データ保存
データベース (sellers.exclusive_other_decision_meeting)
  ↓ 即時同期（SyncQueue）
スプレッドシート (CZ列)
  ↓ 定期同期（GAS 10分トリガー）
データベース (sellers.exclusive_other_decision_meeting)
```

### 同期方向

1. **データベース → スプレッドシート**: 即時同期（数秒以内）
   - トリガー: ユーザーが保存ボタンをクリック
   - 実装: `SyncQueue` + `SpreadsheetSyncService`

2. **スプレッドシート → データベース**: 定期同期（10分ごと）
   - トリガー: GASの時間トリガー
   - 実装: GAS関数 `syncSellerList`

## コンポーネントとインターフェース

### 1. フロントエンド（CallModePage）

#### 状態管理

```typescript
// 専任他決打合せフィールドの状態
const [editedExclusiveOtherDecisionMeeting, setEditedExclusiveOtherDecisionMeeting] = useState<string>('');
```

#### UI配置

**ステータスセクション内の配置順序**:
1. 状況（当社）
2. 次電日
3. 専任（他決）決定日（条件付き表示）
4. 競合（条件付き表示）
5. 専任・他決要因（条件付き表示）
6. 競合名、理由（条件付き表示）
7. **専任他決打合せ（条件付き表示）** ← 新規追加
8. 確度

#### 表示条件

```typescript
// 専任、他決、または一般が含まれる場合に表示
const requiresDecisionDate = (status: string): boolean => {
  return status.includes('専任') || status.includes('他決') || status.includes('一般');
};
```

#### UIコンポーネント

```typescript
{requiresDecisionDate(editedStatus) && (
  <Grid item xs={12}>
    <TextField
      fullWidth
      multiline
      rows={4}
      size="small"
      label="専任他決打合せ"
      value={editedExclusiveOtherDecisionMeeting}
      onChange={(e) => {
        setEditedExclusiveOtherDecisionMeeting(e.target.value);
        setStatusChanged(true);
      }}
      placeholder="専任、他決、または一般が決定した際の打合せ内容を記入してください"
    />
  </Grid>
)}
```

### 2. バックエンド（SellerService）

#### APIエンドポイント

**エンドポイント**: `PUT /api/sellers/:id`

**リクエストボディ**:
```typescript
{
  exclusiveOtherDecisionMeeting?: string;
  // ... 他のフィールド
}
```

**レスポンス**:
```typescript
{
  id: string;
  exclusiveOtherDecisionMeeting?: string;
  // ... 他のフィールド
}
```

#### decryptSellerメソッドの更新

```typescript
private async decryptSeller(seller: any): Promise<Seller> {
  const decrypted = {
    // ... 既存フィールド
    
    // 専任他決打合せフィールド
    exclusiveOtherDecisionMeeting: seller.exclusive_other_decision_meeting,
    
    // ... 他のフィールド
  };
  
  return decrypted;
}
```

### 3. データベース（Supabase）

#### マイグレーション

**ファイル名**: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_exclusive_other_decision_meeting.sql`

```sql
-- 専任他決打合せカラムを追加
ALTER TABLE sellers
ADD COLUMN exclusive_other_decision_meeting TEXT NULL;

-- コメント追加
COMMENT ON COLUMN sellers.exclusive_other_decision_meeting IS '専任他決打合せ（専任、他決、または一般が決定した際の打合せ内容）';
```

### 4. スプレッドシート同期

#### カラムマッピング

**ファイル**: `backend/src/config/column-mapping.json`

```json
{
  "spreadsheetToDatabase": {
    "専任他決打合せ": "exclusive_other_decision_meeting"
  },
  "databaseToSpreadsheet": {
    "exclusive_other_decision_meeting": "専任他決打合せ"
  },
  "typeConversions": {
    "exclusive_other_decision_meeting": "string"
  }
}
```

#### スプレッドシート仕様

- **カラム名**: 「専任他決打合せ」
- **列位置**: CZ列（列番号104、0-indexed: 103）
- **データ型**: 文字列（TEXT）

#### 同期処理

**EnhancedAutoSyncService.syncSingleSeller()**:

```typescript
// CZ列（列番号104、0-indexed: 103）から専任他決打合せを取得
const exclusiveOtherDecisionMeeting = row[103]; // CZ列

if (exclusiveOtherDecisionMeeting !== undefined) {
  updateData.exclusive_other_decision_meeting = String(exclusiveOtherDecisionMeeting || '');
}
```

**EnhancedAutoSyncService.updateSingleSeller()**:

```typescript
// CZ列（列番号104、0-indexed: 103）から専任他決打合せを取得
const exclusiveOtherDecisionMeeting = row[103]; // CZ列

if (exclusiveOtherDecisionMeeting !== undefined) {
  updateData.exclusive_other_decision_meeting = String(exclusiveOtherDecisionMeeting || '');
}
```

### 5. 型定義

#### フロントエンド型定義

**ファイル**: `frontend/frontend/src/types/index.ts`

```typescript
export interface Seller {
  // ... 既存フィールド
  
  exclusiveOtherDecisionMeeting?: string; // 専任他決打合せ
  
  // ... 他のフィールド
}
```

#### バックエンド型定義

**ファイル**: `backend/src/types/index.ts`

```typescript
export interface Seller {
  // ... 既存フィールド
  
  exclusive_other_decision_meeting?: string; // 専任他決打合せ
  
  // ... 他のフィールド
}
```

## データモデル

### データベーススキーマ

**テーブル**: `sellers`

| カラム名 | データ型 | NULL許可 | デフォルト値 | 説明 |
|---------|---------|---------|------------|------|
| `exclusive_other_decision_meeting` | TEXT | YES | NULL | 専任他決打合せ（専任、他決、または一般が決定した際の打合せ内容） |

### スプレッドシートスキーマ

| 列 | カラム名 | データ型 | 説明 |
|----|---------|---------|------|
| CZ（列番号104、0-indexed: 103） | 専任他決打合せ | 文字列 | 専任、他決、または一般が決定した際の打合せ内容 |

### データフロー

```
ユーザー入力（CallModePage）
  ↓
editedExclusiveOtherDecisionMeeting状態
  ↓
handleUpdateStatus() → API呼び出し
  ↓
SellerService.updateSeller()
  ↓
データベース更新（sellers.exclusive_other_decision_meeting）
  ↓
SyncQueue.enqueue() → 即時同期
  ↓
SpreadsheetSyncService.syncToSpreadsheet()
  ↓
スプレッドシート更新（CZ列）
```

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。プロパティは、人間が読める仕様と機械が検証可能な正確性保証の橋渡しをします。*

### プロパティ1: 表示条件の正確性

*任意の*売主ステータスに対して、ステータスに「専任」、「他決」、または「一般」が含まれる場合、「専任他決打合せ」フィールドが表示されるべきである

**検証**: 要件1.1

### プロパティ2: 保存時のデータ整合性

*任意の*「専任他決打合せ」フィールドの入力値に対して、保存ボタンをクリックした場合、データベースの`exclusive_other_decision_meeting`カラムとスプレッドシートのCZ列に同じ値が保存されるべきである

**検証**: 要件2.1, 2.2, 2.3

### プロパティ3: NULL値の正確性

*任意の*「専任他決打合せ」フィールドが空の場合、データベースとスプレッドシートに`null`または空文字列が保存されるべきである

**検証**: 要件2.5

### プロパティ4: APIレスポンスの完全性

*任意の*売主IDに対して、`/api/sellers/:id`エンドポイントを呼び出した場合、レスポンスに`exclusiveOtherDecisionMeeting`フィールドが含まれるべきである

**検証**: 要件5.1, 5.2, 5.3

### プロパティ5: 双方向同期の一貫性

*任意の*売主に対して、データベースの`exclusive_other_decision_meeting`カラムを更新した場合、スプレッドシートのCZ列に同じ値が同期されるべきである。逆に、スプレッドシートのCZ列を更新した場合、データベースの`exclusive_other_decision_meeting`カラムに同じ値が同期されるべきである

**検証**: 要件8.3, 8.4

### プロパティ6: UI配置の正確性

*任意の*売主に対して、「専任他決打合せ」フィールドが表示される場合、「確度」フィールドの上に配置されるべきである

**検証**: 要件1.2

## エラーハンドリング

### 1. バリデーションエラー

**シナリオ**: 必須フィールドが未入力の場合

**対応**:
- 「専任他決打合せ」フィールドは必須項目ではないため、バリデーションエラーは発生しない
- 空欄でも保存可能

### 2. API呼び出しエラー

**シナリオ**: ネットワークエラーまたはサーバーエラー

**対応**:
```typescript
try {
  await api.put(`/sellers/${id}`, {
    exclusiveOtherDecisionMeeting: editedExclusiveOtherDecisionMeeting,
    // ... 他のフィールド
  });
  setSuccessMessage('ステータスを更新しました');
} catch (error) {
  console.error('ステータス更新エラー:', error);
  setError('ステータスの更新に失敗しました');
}
```

### 3. スプレッドシート同期エラー

**シナリオ**: Google Sheets APIエラー

**対応**:
- `SyncQueue`が自動的に最大3回までリトライ（Exponential backoff）
- リトライ失敗時はログに記録
- ユーザーには成功メッセージを表示（同期は非同期で実行されるため）

### 4. データベース同期エラー

**シナリオ**: Supabaseエラー

**対応**:
- エラーをキャッチしてログに記録
- ユーザーにエラーメッセージを表示
- トランザクションロールバック（該当する場合）

## テストストラテジー

### 単体テスト

#### フロントエンド

**テストファイル**: `frontend/frontend/src/__tests__/CallModePage-exclusive-other-decision-meeting.test.tsx`

**テストケース**:
1. 「専任」が含まれるステータスの場合、「専任他決打合せ」フィールドが表示される
2. 「他決」が含まれるステータスの場合、「専任他決打合せ」フィールドが表示される
3. 「一般」が含まれるステータスの場合、「専任他決打合せ」フィールドが表示される
4. 「追客中」のステータスの場合、「専任他決打合せ」フィールドが表示されない
5. 「専任他決打合せ」フィールドに入力した場合、状態が更新される
6. 保存ボタンをクリックした場合、APIが呼び出される

#### バックエンド

**テストファイル**: `backend/src/__tests__/SellerService-exclusive-other-decision-meeting.test.ts`

**テストケース**:
1. `decryptSeller`メソッドが`exclusiveOtherDecisionMeeting`フィールドを返す
2. `updateSeller`メソッドが`exclusive_other_decision_meeting`カラムを更新する
3. `exclusive_other_decision_meeting`が`null`の場合、`exclusiveOtherDecisionMeeting`が`null`として返される

### プロパティベーステスト

#### テストファイル

**フロントエンド**: `frontend/frontend/src/__tests__/CallModePage-exclusive-other-decision-meeting-properties.test.tsx`

**バックエンド**: `backend/src/__tests__/SellerService-exclusive-other-decision-meeting-properties.test.ts`

#### プロパティテスト1: 表示条件の正確性

```typescript
/**
 * Feature: seller-exclusive-other-decision-meeting, Property 1: 表示条件の正確性
 * 
 * 任意の売主ステータスに対して、ステータスに「専任」、「他決」、または「一般」が含まれる場合、
 * 「専任他決打合せ」フィールドが表示されるべきである
 */
test('Property 1: 表示条件の正確性', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant('専任媒介'),
        fc.constant('一般媒介'),
        fc.constant('他決→追客'),
        fc.constant('他決→追客不要'),
        fc.constant('他決→専任'),
        fc.constant('他決→一般'),
        fc.constant('専任→他社専任'),
        fc.constant('一般→他決'),
        fc.constant('追客中'), // 表示されないケース
      ),
      (status) => {
        const shouldDisplay = status.includes('専任') || status.includes('他決') || status.includes('一般');
        const isDisplayed = requiresDecisionDate(status);
        expect(isDisplayed).toBe(shouldDisplay);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### プロパティテスト2: 保存時のデータ整合性

```typescript
/**
 * Feature: seller-exclusive-other-decision-meeting, Property 2: 保存時のデータ整合性
 * 
 * 任意の「専任他決打合せ」フィールドの入力値に対して、保存ボタンをクリックした場合、
 * データベースの`exclusive_other_decision_meeting`カラムとスプレッドシートのCZ列に同じ値が保存されるべきである
 */
test('Property 2: 保存時のデータ整合性', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 0, maxLength: 1000 }),
      async (meetingContent) => {
        // データベースに保存
        await sellerService.updateSeller(sellerId, {
          exclusive_other_decision_meeting: meetingContent,
        });
        
        // データベースから取得
        const seller = await sellerService.getSeller(sellerId);
        expect(seller.exclusiveOtherDecisionMeeting).toBe(meetingContent);
        
        // スプレッドシートから取得（同期完了を待つ）
        await waitForSync();
        const spreadsheetValue = await getSpreadsheetValue(sellerId, 103); // CZ列
        expect(spreadsheetValue).toBe(meetingContent);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### プロパティテスト3: NULL値の正確性

```typescript
/**
 * Feature: seller-exclusive-other-decision-meeting, Property 3: NULL値の正確性
 * 
 * 任意の「専任他決打合せ」フィールドが空の場合、データベースとスプレッドシートに`null`または空文字列が保存されるべきである
 */
test('Property 3: NULL値の正確性', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.constant(''), // 空文字列
      async (emptyValue) => {
        // データベースに保存
        await sellerService.updateSeller(sellerId, {
          exclusive_other_decision_meeting: emptyValue,
        });
        
        // データベースから取得
        const seller = await sellerService.getSeller(sellerId);
        expect(seller.exclusiveOtherDecisionMeeting).toBeOneOf([null, '']);
        
        // スプレッドシートから取得（同期完了を待つ）
        await waitForSync();
        const spreadsheetValue = await getSpreadsheetValue(sellerId, 103); // CZ列
        expect(spreadsheetValue).toBeOneOf([null, '', undefined]);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### プロパティテスト4: APIレスポンスの完全性

```typescript
/**
 * Feature: seller-exclusive-other-decision-meeting, Property 4: APIレスポンスの完全性
 * 
 * 任意の売主IDに対して、`/api/sellers/:id`エンドポイントを呼び出した場合、
 * レスポンスに`exclusiveOtherDecisionMeeting`フィールドが含まれるべきである
 */
test('Property 4: APIレスポンスの完全性', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.uuid(),
      async (sellerId) => {
        const response = await api.get(`/sellers/${sellerId}`);
        expect(response.data).toHaveProperty('exclusiveOtherDecisionMeeting');
      }
    ),
    { numRuns: 100 }
  );
});
```

#### プロパティテスト5: 双方向同期の一貫性

```typescript
/**
 * Feature: seller-exclusive-other-decision-meeting, Property 5: 双方向同期の一貫性
 * 
 * 任意の売主に対して、データベースの`exclusive_other_decision_meeting`カラムを更新した場合、
 * スプレッドシートのCZ列に同じ値が同期されるべきである。
 * 逆に、スプレッドシートのCZ列を更新した場合、データベースの`exclusive_other_decision_meeting`カラムに同じ値が同期されるべきである
 */
test('Property 5: 双方向同期の一貫性', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 0, maxLength: 1000 }),
      async (meetingContent) => {
        // データベース → スプレッドシート
        await sellerService.updateSeller(sellerId, {
          exclusive_other_decision_meeting: meetingContent,
        });
        await waitForSync();
        const spreadsheetValue1 = await getSpreadsheetValue(sellerId, 103);
        expect(spreadsheetValue1).toBe(meetingContent);
        
        // スプレッドシート → データベース
        const newMeetingContent = meetingContent + ' (updated)';
        await updateSpreadsheetValue(sellerId, 103, newMeetingContent);
        await waitForSync();
        const seller = await sellerService.getSeller(sellerId);
        expect(seller.exclusiveOtherDecisionMeeting).toBe(newMeetingContent);
      }
    ),
    { numRuns: 100 }
  );
});
```

### 統合テスト

**テストファイル**: `backend/src/__tests__/exclusive-other-decision-meeting-integration.test.ts`

**テストケース**:
1. フロントエンドからバックエンドへのAPI呼び出し
2. バックエンドからデータベースへの保存
3. データベースからスプレッドシートへの同期
4. スプレッドシートからデータベースへの同期

### E2Eテスト

**テストファイル**: `frontend/frontend/src/__tests__/CallModePage-exclusive-other-decision-meeting-e2e.test.tsx`

**テストシナリオ**:
1. 通話モードページを開く
2. ステータスを「専任媒介」に変更
3. 「専任他決打合せ」フィールドが表示されることを確認
4. 「専任他決打合せ」フィールドに入力
5. 保存ボタンをクリック
6. 成功メッセージが表示されることを確認
7. ページをリロード
8. 入力した内容が保持されていることを確認

### テスト設定

**プロパティベーステストの設定**:
- 最小実行回数: 100回
- タイムアウト: 30秒
- ランダムシード: 固定（再現性のため）

**統合テストの設定**:
- テストデータベース: Supabaseのテスト環境
- テストスプレッドシート: 専用のテストシート
- 同期待機時間: 最大10秒

## 実装計画

### フェーズ1: データベーススキーマ追加

1. マイグレーションファイル作成
2. マイグレーション実行
3. スキーマ確認

### フェーズ2: バックエンド実装

1. 型定義追加（`backend/src/types/index.ts`）
2. `SellerService.decryptSeller()`メソッド更新
3. カラムマッピング追加（`column-mapping.json`）
4. スプレッドシート同期処理追加（`EnhancedAutoSyncService`）

### フェーズ3: フロントエンド実装

1. 型定義追加（`frontend/frontend/src/types/index.ts`）
2. 状態管理追加（`CallModePage`）
3. UIコンポーネント追加（`CallModePage`）
4. 保存処理更新（`handleUpdateStatus`）

### フェーズ4: テスト実装

1. 単体テスト作成
2. プロパティベーステスト作成
3. 統合テスト作成
4. E2Eテスト作成

### フェーズ5: デプロイ

1. バックエンドデプロイ（Vercel）
2. フロントエンドデプロイ（Vercel）
3. 動作確認
4. ドキュメント更新

## セキュリティ考慮事項

### 1. 入力検証

- 「専任他決打合せ」フィールドは文字列型のため、XSS攻撃のリスクがある
- フロントエンドでサニタイズ処理を実施
- バックエンドでも入力検証を実施

### 2. 認証・認可

- APIエンドポイントは認証が必要
- ユーザーは自分が担当する売主のみ更新可能

### 3. データ暗号化

- 「専任他決打合せ」フィールドは暗号化対象外（個人情報ではないため）
- データベースとスプレッドシートに平文で保存

## パフォーマンス考慮事項

### 1. データベースクエリ

- `exclusive_other_decision_meeting`カラムにインデックスは不要（検索対象ではないため）
- SELECT文に`exclusive_other_decision_meeting`を追加してもパフォーマンスへの影響は最小限

### 2. スプレッドシート同期

- CZ列（列番号104）は既存の取得範囲（`B:CZ`）に含まれるため、追加のAPI呼び出しは不要
- 同期処理のパフォーマンスへの影響は最小限

### 3. フロントエンドレンダリング

- 「専任他決打合せ」フィールドは条件付き表示のため、不要な場合はレンダリングされない
- パフォーマンスへの影響は最小限

## 運用考慮事項

### 1. データ移行

- 既存の売主データには`exclusive_other_decision_meeting`カラムが存在しないため、マイグレーション実行時に`NULL`が設定される
- データ移行は不要

### 2. モニタリング

- スプレッドシート同期のエラーログを監視
- Google Sheets APIクォータを監視

### 3. バックアップ

- データベースの定期バックアップ（Supabaseの自動バックアップ）
- スプレッドシートの定期バックアップ（Google Driveの自動バックアップ）

## 依存関係

### 外部ライブラリ

- なし（既存のライブラリを使用）

### 内部モジュール

- `SellerService`
- `EnhancedAutoSyncService`
- `SpreadsheetSyncService`
- `SyncQueue`

## 制約事項

1. 「専任他決打合せ」フィールドは、ステータスに「専任」、「他決」、または「一般」が含まれる場合のみ表示される
2. 「専任他決打合せ」フィールドは、「確度」フィールドの上に配置される
3. 「専任他決打合せ」フィールドは、複数行のテキストフィールドとして表示される
4. 「専任他決打合せ」フィールドは、必須項目ではない（空欄でも保存可能）
5. スプレッドシートのCZ列（列番号104、0-indexed: 103）とデータベースの`exclusive_other_decision_meeting`カラムは常に同期される

## 参考資料

- `seller-table-column-definition.md`: 売主テーブルのカラム定義
- `seller-spreadsheet-column-mapping.md`: スプレッドシートのカラムマッピング
- `backend-architecture.md`: バックエンドアーキテクチャ定義
- `auto-sync-timing.md`: 自動同期のタイミング

---

**作成日**: 2026年3月25日  
**作成者**: Kiro AI  
**バージョン**: 1.0
