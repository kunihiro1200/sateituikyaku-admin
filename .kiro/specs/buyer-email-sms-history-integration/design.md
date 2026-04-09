# 技術設計書：買主メール・SMS送信履歴統合表示

## 概要

買主詳細画面の「メール・SMS送信履歴」セクションに、4つの異なる送信元からのメール・SMS送信履歴を統合して表示する機能を実装します。既存の`activity_logs`テーブルと`metadata.source`フィールドを活用し、最小限の変更で実現します。

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    買主詳細画面                              │
│  (BuyerDetailPage.tsx)                                      │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │  メール・SMS送信履歴セクション                     │    │
│  │  - 他社物件新着配信                                │    │
│  │  - 公開前・値下げメール                            │    │
│  │  - 買主候補リスト                                  │    │
│  │  - 近隣買主                                        │    │
│  │  - 既存の送信履歴                                  │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    GET /api/activity-logs
                    ?target_type=buyer
                    &target_id={buyer_number}
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  ActivityLogService                         │
│  - getLogs(filter)                                          │
│  - logEmail(params)                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              activity_logs テーブル                         │
│  - id (UUID)                                                │
│  - employee_id (UUID, nullable)                             │
│  - action (VARCHAR) - 'email' | 'sms'                       │
│  - target_type (VARCHAR) - 'buyer'                          │
│  - target_id (VARCHAR) - buyer_number                       │
│  - metadata (JSONB)                                         │
│    - source (string) - 送信元識別子                        │
│    - templateName (string)                                  │
│    - subject (string)                                       │
│    - senderEmail (string)                                   │
│    - propertyNumbers (string[])                             │
│  - created_at (TIMESTAMP)                                   │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **メール送信時**
   - 各送信元（他社物件新着配信、公開前・値下げメール、買主候補リスト、近隣買主）からメール送信
   - `ActivityLogService.logEmail()`を呼び出し
   - `metadata.source`に送信元識別子を設定
   - `activity_logs`テーブルに記録

2. **履歴表示時**
   - 買主詳細画面で`GET /api/activity-logs?target_type=buyer&target_id={buyer_number}`を呼び出し
   - `ActivityLogService.getLogs()`が全ての送信履歴を取得
   - フロントエンドで`metadata.source`を使用して送信元を識別・表示

## コンポーネントとインターフェース

### 1. ActivityLogService（既存）

**場所**: `backend/src/services/ActivityLogService.ts`

**既存メソッド**:
```typescript
async logEmail(params: {
  buyerId?: string;
  sellerId?: string;
  propertyNumbers: string[];
  recipientEmail: string;
  subject: string;
  templateName?: string;
  senderEmail: string;
  preViewingNotes?: string;
  createdBy: string;
}): Promise<void>
```

**拡張**: `metadata.source`フィールドを追加

```typescript
async logEmail(params: {
  buyerId?: string;
  sellerId?: string;
  propertyNumbers: string[];
  recipientEmail: string;
  subject: string;
  templateName?: string;
  senderEmail: string;
  preViewingNotes?: string;
  createdBy: string;
  source?: string;  // 新規追加：送信元識別子
}): Promise<void> {
  await this.logActivity({
    employeeId: params.createdBy,
    action: 'email',
    targetType: params.buyerId ? 'buyer' : 'seller',
    targetId: params.buyerId || params.sellerId || '',
    metadata: {
      property_numbers: params.propertyNumbers,
      recipient_email: params.recipientEmail,
      subject: params.subject,
      templateName: params.templateName,
      sender_email: params.senderEmail,
      email_type: 'inquiry_response',
      pre_viewing_notes: params.preViewingNotes,
      source: params.source,  // 新規追加
    },
  });
}
```

### 2. 他社物件新着配信（OtherCompanyDistributionPage）

**場所**: `frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx`

**変更点**: メール送信後に`activity_logs`に記録

```typescript
// 既存のメール送信処理
await api.post('/api/gmail/send', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

// 新規追加：activity_logs に記録
await api.post('/api/activity-logs/email', {
  buyerId: buyer.buyer_number,
  propertyNumbers: [],  // 他社物件のため空配列
  recipientEmail: buyer.email,
  subject: emailSubject,
  templateName: '他社物件新着配信',
  senderEmail: 'tenant@ifoo-oita.com',
  source: 'other_company_distribution',  // 送信元識別子
});
```

**バックエンドAPI**: 新規エンドポイント`POST /api/activity-logs/email`を作成

### 3. 公開前・値下げメール

**場所**: 物件リスト詳細ページ（要確認）

**実装**: 他社物件新着配信と同様の実装パターン

```typescript
await api.post('/api/activity-logs/email', {
  buyerId: buyer.buyer_number,
  propertyNumbers: selectedPropertyNumbers,
  recipientEmail: buyer.email,
  subject: emailSubject,
  templateName: '公開前・値下げメール',
  senderEmail: 'tenant@ifoo-oita.com',
  source: 'pre_public_price_reduction',
});
```

### 4. 買主候補リスト

**場所**: 物件リスト詳細ページ（要確認）

**実装**: 他社物件新着配信と同様の実装パターン

```typescript
await api.post('/api/activity-logs/email', {
  buyerId: buyer.buyer_number,
  propertyNumbers: selectedPropertyNumbers,
  recipientEmail: buyer.email,
  subject: emailSubject,
  templateName: '買主候補リスト',
  senderEmail: 'tenant@ifoo-oita.com',
  source: 'buyer_candidate_list',
});
```

### 5. 近隣買主

**場所**: 売主リスト通話モードページ（要確認）

**実装**: 他社物件新着配信と同様の実装パターン

```typescript
await api.post('/api/activity-logs/email', {
  buyerId: buyer.buyer_number,
  propertyNumbers: [sellerPropertyNumber],
  recipientEmail: buyer.email,
  subject: emailSubject,
  templateName: '近隣買主',
  senderEmail: 'tenant@ifoo-oita.com',
  source: 'nearby_buyers',
});
```

### 6. BuyerDetailPage（既存）

**場所**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**変更点**: なし（既に`GET /api/activity-logs`を使用して履歴を取得している）

**表示ロジック**: `metadata.source`を使用して送信元を識別

```typescript
// 既存のコード（変更なし）
const activities = await api.get(`/api/activity-logs`, {
  params: {
    target_type: 'buyer',
    target_id: buyer_number,
  },
});

// 表示時に送信元を識別
const getSourceLabel = (source?: string): string => {
  switch (source) {
    case 'other_company_distribution':
      return '他社物件新着配信';
    case 'pre_public_price_reduction':
      return '公開前・値下げメール';
    case 'buyer_candidate_list':
      return '買主候補リスト';
    case 'nearby_buyers':
      return '近隣買主';
    default:
      return '買主詳細画面';
  }
};
```

## データモデル

### activity_logs テーブル（既存）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | UUID | PRIMARY KEY | 主キー |
| employee_id | UUID | NULLABLE, FK(employees.id) | 従業員ID |
| action | VARCHAR(100) | NOT NULL | アクション種別（'email', 'sms'） |
| target_type | VARCHAR(50) | NOT NULL | 対象種別（'buyer', 'seller'） |
| target_id | VARCHAR(255) | NOT NULL | 対象ID（buyer_number） |
| metadata | JSONB | NULLABLE | メタデータ |
| ip_address | INET | NULLABLE | IPアドレス |
| user_agent | TEXT | NULLABLE | ユーザーエージェント |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | 作成日時 |

### metadata フィールド構造

```typescript
interface ActivityLogMetadata {
  // 既存フィールド
  property_numbers?: string[];      // 配信対象物件番号の配列
  recipient_email?: string;         // 受信者メールアドレス
  subject?: string;                 // メール件名
  templateName?: string;            // テンプレート名
  sender_email?: string;            // 送信者メールアドレス
  email_type?: string;              // メール種別
  pre_viewing_notes?: string;       // 内覧前伝達事項
  
  // 新規追加
  source?: string;                  // 送信元識別子
}
```

### 送信元識別子（source）の値

| 送信元 | source値 | 説明 |
|--------|----------|------|
| 他社物件新着配信 | `other_company_distribution` | 買主リスト一覧ヘッダーの「他社物件新着配信」 |
| 公開前・値下げメール | `pre_public_price_reduction` | 物件リスト詳細ページの「公開前、値下げメール」 |
| 買主候補リスト | `buyer_candidate_list` | 物件リスト詳細ページの「買主候補リスト」 |
| 近隣買主 | `nearby_buyers` | 売主リスト通話モードページの「近隣買主」 |
| 買主詳細画面 | `undefined` または空 | 買主詳細画面から直接送信したメール・SMS |

## エラーハンドリング

### 1. メール送信失敗時

```typescript
try {
  // メール送信
  await api.post('/api/gmail/send', formData);
  
  // activity_logs に記録
  await api.post('/api/activity-logs/email', logData);
} catch (error) {
  // メール送信失敗時はactivity_logsに記録しない
  console.error('メール送信失敗:', error);
  throw error;
}
```

### 2. activity_logs 記録失敗時

```typescript
try {
  // メール送信
  await api.post('/api/gmail/send', formData);
} catch (error) {
  throw error;
}

// activity_logs 記録失敗はユーザーに通知しない（ログのみ）
try {
  await api.post('/api/activity-logs/email', logData);
} catch (error) {
  console.error('activity_logs記録失敗:', error);
  // ユーザーには通知しない（メール送信は成功しているため）
}
```

### 3. 履歴取得失敗時

```typescript
try {
  const activities = await api.get('/api/activity-logs', {
    params: { target_type: 'buyer', target_id: buyer_number },
  });
  setActivities(activities.data || []);
} catch (error) {
  console.error('履歴取得失敗:', error);
  setActivities([]); // 空配列を設定（エラー表示はしない）
}
```

## テスト戦略

### ユニットテスト

1. **ActivityLogService.logEmail()**
   - `metadata.source`が正しく設定されることを確認
   - `source`が`undefined`の場合でもエラーにならないことを確認

2. **送信元識別ロジック**
   - `getSourceLabel()`が正しい送信元名を返すことを確認
   - `source`が`undefined`の場合は「買主詳細画面」を返すことを確認

### 統合テスト

1. **他社物件新着配信からのメール送信**
   - メール送信後、`activity_logs`に`source: 'other_company_distribution'`が記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

2. **公開前・値下げメールからのメール送信**
   - メール送信後、`activity_logs`に`source: 'pre_public_price_reduction'`が記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

3. **買主候補リストからのメール送信**
   - メール送信後、`activity_logs`に`source: 'buyer_candidate_list'`が記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

4. **近隣買主からのメール送信**
   - メール送信後、`activity_logs`に`source: 'nearby_buyers'`が記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

5. **統合履歴表示**
   - 全ての送信元からのメール履歴が時系列順に表示されることを確認
   - 送信元が正しく識別・表示されることを確認

### パフォーマンステスト

1. **履歴取得クエリのパフォーマンス**
   - 買主詳細画面の初期ロード時間が2秒以内であることを確認
   - `activity_logs`テーブルに10,000件のレコードがある場合でも、履歴取得が500ms以内であることを確認

2. **インデックスの効果確認**
   - `idx_activity_logs_target`インデックスが使用されていることを確認
   - `EXPLAIN ANALYZE`でクエリプランを確認

## 実装計画

### フェーズ1: バックエンドAPI実装

1. **ActivityLogService拡張**
   - `logEmail()`メソッドに`source`パラメータを追加
   - 既存の呼び出し元に影響がないことを確認（`source`はオプショナル）

2. **新規エンドポイント作成**
   - `POST /api/activity-logs/email`エンドポイントを作成
   - 認証ミドルウェアを適用
   - リクエストバリデーションを実装

### フェーズ2: 他社物件新着配信の履歴記録

1. **OtherCompanyDistributionPage修正**
   - メール送信後に`POST /api/activity-logs/email`を呼び出し
   - `source: 'other_company_distribution'`を設定

2. **テスト**
   - メール送信後、`activity_logs`に記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

### フェーズ3: 公開前・値下げメールの履歴記録

1. **実装ファイルの特定**
   - 公開前・値下げメール送信機能の実装ファイルを特定

2. **履歴記録実装**
   - メール送信後に`POST /api/activity-logs/email`を呼び出し
   - `source: 'pre_public_price_reduction'`を設定

3. **テスト**
   - メール送信後、`activity_logs`に記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

### フェーズ4: 買主候補リストの履歴記録

1. **実装ファイルの特定**
   - 買主候補リスト送信機能の実装ファイルを特定

2. **履歴記録実装**
   - メール送信後に`POST /api/activity-logs/email`を呼び出し
   - `source: 'buyer_candidate_list'`を設定

3. **テスト**
   - メール送信後、`activity_logs`に記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

### フェーズ5: 近隣買主の履歴記録

1. **実装ファイルの特定**
   - 近隣買主送信機能の実装ファイルを特定

2. **履歴記録実装**
   - メール送信後に`POST /api/activity-logs/email`を呼び出し
   - `source: 'nearby_buyers'`を設定

3. **テスト**
   - メール送信後、`activity_logs`に記録されることを確認
   - 買主詳細画面で履歴が表示されることを確認

### フェーズ6: フロントエンド表示改善

1. **BuyerDetailPage修正**
   - `getSourceLabel()`関数を実装
   - 送信元を視覚的に識別できるように表示を改善（Chipの色分けなど）

2. **テスト**
   - 全ての送信元からの履歴が正しく表示されることを確認
   - 送信元が視覚的に識別できることを確認

### フェーズ7: パフォーマンス最適化

1. **インデックス確認**
   - `idx_activity_logs_target`インデックスが存在することを確認
   - 必要に応じて追加のインデックスを作成

2. **クエリ最適化**
   - `EXPLAIN ANALYZE`でクエリプランを確認
   - 必要に応じてクエリを最適化

3. **パフォーマンステスト**
   - 買主詳細画面の初期ロード時間を測定
   - 履歴取得クエリの実行時間を測定

## デプロイ計画

### 1. データベースマイグレーション

**不要** - 既存の`activity_logs`テーブルのスキーマ変更は不要

### 2. バックエンドデプロイ

1. `ActivityLogService`の変更をデプロイ
2. 新規エンドポイント`POST /api/activity-logs/email`をデプロイ
3. 既存の機能に影響がないことを確認

### 3. フロントエンドデプロイ

1. 他社物件新着配信の変更をデプロイ
2. 公開前・値下げメールの変更をデプロイ
3. 買主候補リストの変更をデプロイ
4. 近隣買主の変更をデプロイ
5. BuyerDetailPageの表示改善をデプロイ

### 4. 動作確認

1. 各送信元からメールを送信し、`activity_logs`に記録されることを確認
2. 買主詳細画面で全ての履歴が表示されることを確認
3. パフォーマンスが要件を満たしていることを確認

## リスクと対策

### リスク1: 既存の機能への影響

**リスク**: `ActivityLogService.logEmail()`の変更が既存の呼び出し元に影響を与える

**対策**: 
- `source`パラメータをオプショナルにする
- 既存の呼び出し元は変更不要
- ユニットテストで既存の動作が維持されることを確認

### リスク2: パフォーマンス劣化

**リスク**: 履歴取得クエリが遅くなり、買主詳細画面のロード時間が2秒を超える

**対策**:
- `idx_activity_logs_target`インデックスを使用
- クエリプランを確認し、必要に応じて最適化
- パフォーマンステストで要件を満たしていることを確認

### リスク3: 送信元の特定漏れ

**リスク**: 4つの送信元の実装ファイルを特定できない

**対策**:
- コードベースを検索して実装ファイルを特定
- 必要に応じてユーザーに確認
- 段階的に実装（特定できた送信元から順次実装）

### リスク4: activity_logs 記録失敗

**リスク**: メール送信は成功したが、`activity_logs`への記録が失敗する

**対策**:
- メール送信と`activity_logs`記録を分離
- `activity_logs`記録失敗はログに記録するが、ユーザーには通知しない
- 定期的にログを確認し、記録失敗が頻発していないか監視

## まとめ

本設計では、既存の`activity_logs`テーブルと`metadata.source`フィールドを活用することで、最小限の変更で4つの送信元からのメール・SMS履歴を統合表示します。

**主な利点**:
- データベーススキーマの変更不要
- 既存の機能への影響最小限
- 拡張性が高い（将来的に新しい送信元を追加しやすい）
- パフォーマンスへの影響最小限

**実装の鍵**:
- `metadata.source`フィールドで送信元を識別
- 各送信元からメール送信後に`activity_logs`に記録
- 買主詳細画面で`metadata.source`を使用して送信元を表示
