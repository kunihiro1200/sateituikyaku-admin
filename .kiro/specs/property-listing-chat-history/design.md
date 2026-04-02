# 設計書：物件リスト詳細画面CHAT送信履歴表示機能

## 概要

物件リスト詳細画面に「事務へCHAT」と「担当へCHAT」ボタンの送信履歴を表示する機能を追加します。現在、これらのボタンでメッセージを送信できますが、送信した内容の履歴が残らないため、過去のやり取りを確認できません。この機能により、ユーザーは過去に送信したCHATメッセージを時系列で確認でき、コミュニケーションの履歴を追跡できるようになります。

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    フロントエンド                              │
│  PropertyListingDetailPage.tsx                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ カテゴリー欄                                           │   │
│  │ ┌────────────────────────────────────────────────┐   │   │
│  │ │ 既存のカテゴリー表示                              │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │ ┌────────────────────────────────────────────────┐   │   │
│  │ │ CHAT送信履歴セクション（新規）                    │   │   │
│  │ │ - 送信日時、送信先、送信内容、送信者名            │   │   │
│  │ │ - 折りたたみ可能、スクロール可能                  │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ API呼び出し
┌─────────────────────────────────────────────────────────────┐
│                    バックエンドAPI                             │
│  backend/src/routes/propertyListings.ts                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ GET /api/property-listings/:propertyNumber/          │   │
│  │     chat-history                                     │   │
│  │ - 履歴取得（最大50件、降順）                          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ POST /api/property-listings/:propertyNumber/         │   │
│  │      send-chat-to-assignee                           │   │
│  │ - CHAT送信 + 履歴保存（既存APIに追加）                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ POST /api/property-listings/:propertyNumber/         │   │
│  │      send-chat-to-office                             │   │
│  │ - CHAT送信 + 履歴保存（既存APIに追加）                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ データ操作
┌─────────────────────────────────────────────────────────────┐
│                    データベース                                │
│  property_chat_history テーブル（新規）                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ - id (UUID, 主キー)                                  │   │
│  │ - property_number (物件番号, 外部キー)                │   │
│  │ - chat_type ('office' | 'assignee')                 │   │
│  │ - message (TEXT)                                    │   │
│  │ - sender_name (VARCHAR)                             │   │
│  │ - sent_at (TIMESTAMP)                               │   │
│  │ - created_at (TIMESTAMP)                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

#### CHAT送信時のフロー

```
1. ユーザーがCHATメッセージを入力
   ↓
2. 「事務へCHAT」または「担当へCHAT」ボタンをクリック
   ↓
3. フロントエンドがAPIを呼び出し
   POST /api/property-listings/:propertyNumber/send-chat-to-{office|assignee}
   ↓
4. バックエンドがChatwork/Google Chatにメッセージを送信
   ↓
5. 送信成功時、property_chat_historyテーブルに履歴を保存
   ↓
6. フロントエンドが履歴を再取得
   GET /api/property-listings/:propertyNumber/chat-history
   ↓
7. UIに最新の履歴を表示（ページリロードなし）
```

#### 履歴表示時のフロー

```
1. PropertyListingDetailPageがマウント
   ↓
2. 物件データと同時に履歴を取得
   GET /api/property-listings/:propertyNumber/chat-history
   ↓
3. カテゴリー欄の下に履歴セクションを表示
   - 送信日時（降順）
   - 送信先バッジ（事務/担当）
   - 送信内容（最初の3行 + 続きを読む）
   - 送信者名
```

## コンポーネントとインターフェース

### データベーステーブル

#### property_chat_history テーブル（新規）

```sql
CREATE TABLE property_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_number VARCHAR(50) NOT NULL,
  chat_type VARCHAR(20) NOT NULL CHECK (chat_type IN ('office', 'assignee')),
  message TEXT NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- 外部キー制約
  CONSTRAINT fk_property_number 
    FOREIGN KEY (property_number) 
    REFERENCES property_listings(property_number) 
    ON DELETE CASCADE,
  
  -- インデックス
  INDEX idx_property_chat_history_property_number (property_number),
  INDEX idx_property_chat_history_sent_at (sent_at DESC)
);
```

**カラム説明**:
- `id`: 履歴レコードの一意識別子（UUID）
- `property_number`: 物件番号（property_listingsテーブルへの外部キー）
- `chat_type`: 送信先タイプ（'office' = 事務、'assignee' = 担当）
- `message`: 送信したメッセージ内容（TEXT型、改行を保持）
- `sender_name`: 送信者名（employeesテーブルのnameまたはinitials）
- `sent_at`: 送信日時（TIMESTAMP WITH TIME ZONE）
- `created_at`: レコード作成日時（TIMESTAMP WITH TIME ZONE）

**インデックス戦略**:
- `property_number`: 物件ごとの履歴取得を高速化
- `sent_at DESC`: 新しい順のソートを高速化

### バックエンドAPI

#### 1. GET /api/property-listings/:propertyNumber/chat-history

**目的**: 指定された物件のCHAT送信履歴を取得

**リクエスト**:
```typescript
GET /api/property-listings/AA10424/chat-history
```

**レスポンス**:
```typescript
{
  success: true,
  data: [
    {
      id: "uuid-1",
      property_number: "AA10424",
      chat_type: "office",
      message: "確認をお願いします",
      sender_name: "山田太郎",
      sent_at: "2026-04-02T10:30:00Z",
      created_at: "2026-04-02T10:30:00Z"
    },
    {
      id: "uuid-2",
      property_number: "AA10424",
      chat_type: "assignee",
      message: "訪問日程の調整をお願いします",
      sender_name: "佐藤花子",
      sent_at: "2026-04-01T15:20:00Z",
      created_at: "2026-04-01T15:20:00Z"
    }
  ]
}
```

**エラーレスポンス**:
```typescript
// 物件が存在しない場合
{
  success: false,
  error: "物件が見つかりません"
}
// ステータスコード: 404
```

**実装場所**: `backend/src/routes/propertyListings.ts`

**処理フロー**:
1. 物件番号をパラメータから取得
2. property_listingsテーブルで物件の存在を確認
3. property_chat_historyテーブルから履歴を取得（最大50件、sent_at降順）
4. レスポンスを返す

#### 2. POST /api/property-listings/:propertyNumber/send-chat-to-assignee（既存APIに追加）

**目的**: 担当へCHATを送信し、履歴を保存

**リクエスト**:
```typescript
POST /api/property-listings/AA10424/send-chat-to-assignee
{
  message: "訪問日程の調整をお願いします",
  senderName: "佐藤花子"
}
```

**レスポンス**:
```typescript
{
  success: true
}
```

**実装変更**:
- 既存のCHAT送信処理の後に履歴保存処理を追加
- トランザクション内で履歴を保存
- 履歴保存失敗時はエラーログを記録するが、送信処理は成功とする

#### 3. POST /api/property-listings/:propertyNumber/send-chat-to-office（既存APIに追加）

**目的**: 事務へCHATを送信し、履歴を保存

**リクエスト**:
```typescript
POST /api/property-listings/AA10424/send-chat-to-office
{
  message: "確認をお願いします",
  senderName: "山田太郎"
}
```

**レスポンス**:
```typescript
{
  success: true
}
```

**実装変更**:
- 既存のCHAT送信処理の後に履歴保存処理を追加
- トランザクション内で履歴を保存
- 履歴保存失敗時はエラーログを記録するが、送信処理は成功とする

### フロントエンドコンポーネント

#### PropertyListingDetailPage.tsx（既存コンポーネントに追加）

**新規State**:
```typescript
const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
```

**新規型定義**:
```typescript
interface ChatHistoryItem {
  id: string;
  property_number: string;
  chat_type: 'office' | 'assignee';
  message: string;
  sender_name: string;
  sent_at: string;
  created_at: string;
}
```

**新規関数**:
```typescript
// CHAT送信履歴を取得
const fetchChatHistory = async () => {
  if (!propertyNumber) return;
  setChatHistoryLoading(true);
  try {
    const response = await api.get(`/api/property-listings/${propertyNumber}/chat-history`);
    setChatHistory(response.data.data);
  } catch (error) {
    console.error('CHAT送信履歴の取得に失敗:', error);
  } finally {
    setChatHistoryLoading(false);
  }
};

// 履歴の展開/折りたたみ
const handleToggleHistoryExpand = (historyId: string) => {
  setExpandedHistoryId(expandedHistoryId === historyId ? null : historyId);
};
```

**UI配置**:
- カテゴリー欄の左の欄の下に配置
- セクションタイトル: 「CHAT送信履歴」
- 折りたたみ可能（デフォルトで展開）
- スクロール可能（最大高さ400px）

**UI構造**:
```tsx
<Box sx={{ mt: 2 }}>
  <Typography variant="h6">CHAT送信履歴</Typography>
  <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
    {chatHistory.length === 0 ? (
      <Typography variant="body2" color="text.secondary">
        送信履歴はありません
      </Typography>
    ) : (
      chatHistory.map((item) => (
        <Paper key={item.id} sx={{ p: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption">
              {formatDateTime(item.sent_at)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.sender_name}
            </Typography>
          </Box>
          <Chip 
            label={item.chat_type === 'office' ? '事務' : '担当'} 
            size="small"
            color={item.chat_type === 'office' ? 'primary' : 'secondary'}
            sx={{ mb: 1 }}
          />
          <Typography variant="body2">
            {expandedHistoryId === item.id 
              ? item.message 
              : truncateMessage(item.message, 3)}
          </Typography>
          {shouldShowReadMore(item.message) && (
            <Button 
              size="small" 
              onClick={() => handleToggleHistoryExpand(item.id)}
            >
              {expandedHistoryId === item.id ? '閉じる' : '続きを読む'}
            </Button>
          )}
        </Paper>
      ))
    )}
  </Box>
</Box>
```

## データモデル

### property_chat_history テーブル

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|-----|---------|----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| property_number | VARCHAR(50) | NO | - | 物件番号（外部キー） |
| chat_type | VARCHAR(20) | NO | - | 送信先（'office' or 'assignee'） |
| message | TEXT | NO | - | 送信内容 |
| sender_name | VARCHAR(255) | NO | - | 送信者名 |
| sent_at | TIMESTAMP WITH TIME ZONE | NO | - | 送信日時 |
| created_at | TIMESTAMP WITH TIME ZONE | NO | CURRENT_TIMESTAMP | 作成日時 |

**制約**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `property_number` → `property_listings(property_number)` ON DELETE CASCADE
- CHECK: `chat_type IN ('office', 'assignee')`
- INDEX: `idx_property_chat_history_property_number` on `property_number`
- INDEX: `idx_property_chat_history_sent_at` on `sent_at DESC`

### データ例

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "property_number": "AA10424",
  "chat_type": "office",
  "message": "確認をお願いします\n詳細は添付資料をご覧ください",
  "sender_name": "山田太郎",
  "sent_at": "2026-04-02T10:30:00+09:00",
  "created_at": "2026-04-02T10:30:00+09:00"
}
```

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。つまり、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械が検証可能な正確性保証の橋渡しをします。*

