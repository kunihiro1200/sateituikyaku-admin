# 設計書：物件リスト詳細画面「事務へCHAT」送信履歴表示機能

## 概要

物件リスト詳細画面の左サイドバーに「事務へCHAT」送信履歴を表示する機能を追加します。この機能により、営業担当者は過去に送信したCHATメッセージを素早く確認でき、事務担当者とのコミュニケーション履歴を把握できます。

### 目的

- 過去のCHATメッセージを素早く確認できるようにする
- 事務担当者とのコミュニケーション履歴を可視化する
- 送信履歴をリアルタイムで更新する

### スコープ

**含まれるもの**:
- 新しいReactコンポーネント`PropertyChatHistory.tsx`の作成
- 既存のAPIエンドポイント`GET /api/property-listings/:propertyNumber/chat-history`の使用
- 「事務へCHAT」送信時の履歴保存機能の追加
- 送信後の自動リフレッシュ機能

**含まれないもの**:
- 履歴の削除機能
- 履歴の編集機能
- 「担当へCHAT」の履歴表示（「事務へCHAT」のみ）
- 履歴の検索・フィルタリング機能

---

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│ PropertyListingDetailPage.tsx                               │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ PropertySidebarStatus│  │ メインコンテンツ          │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│  ┌──────────────────────┐                                  │
│  │ PropertyChatHistory  │ ← 新規コンポーネント            │
│  │ (新規)               │                                  │
│  └──────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
                    ↓ API呼び出し
┌─────────────────────────────────────────────────────────────┐
│ Backend API (backend/src/routes/propertyListings.ts)       │
│                                                             │
│  GET /api/property-listings/:propertyNumber/chat-history   │
│  POST /api/property-listings/:propertyNumber/send-chat-to-office │
└─────────────────────────────────────────────────────────────┘
                    ↓ データベースアクセス
┌─────────────────────────────────────────────────────────────┐
│ Supabase (property_chat_history テーブル)                   │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **初期表示時**:
   - `PropertyListingDetailPage`がマウントされる
   - `PropertyChatHistory`コンポーネントがマウントされる
   - `GET /api/property-listings/:propertyNumber/chat-history`を呼び出す
   - `property_chat_history`テーブルから履歴を取得（`chat_type='office'`、最新5件）
   - 履歴を画面に表示

2. **CHAT送信時**:
   - ユーザーが「事務へCHAT」ボタンをクリック
   - メッセージを入力して送信
   - `POST /api/property-listings/:propertyNumber/send-chat-to-office`を呼び出す
   - Google Chatへメッセージを送信
   - `property_chat_history`テーブルに履歴を保存
   - フロントエンドで履歴を再取得
   - 新しい履歴を画面に表示

---

## コンポーネントとインターフェース

### 1. PropertyChatHistory.tsx（新規コンポーネント）

#### Props

```typescript
interface PropertyChatHistoryProps {
  propertyNumber: string;
  refreshTrigger?: number; // 外部から再取得をトリガーするための値
}
```

#### State

```typescript
interface ChatHistoryItem {
  id: number;
  property_number: string;
  chat_type: 'office' | 'assignee';
  message: string;
  sender_name: string;
  sent_at: string;
  created_at: string;
}

const [history, setHistory] = useState<ChatHistoryItem[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

#### 主要メソッド

```typescript
// 履歴を取得
const fetchChatHistory = async () => {
  setLoading(true);
  setError(null);
  try {
    const response = await api.get(
      `/api/property-listings/${propertyNumber}/chat-history?chat_type=office&limit=5`
    );
    setHistory(response.data.history || []);
  } catch (err: any) {
    setError('履歴の取得に失敗しました');
    console.error('[PropertyChatHistory] Error:', err);
  } finally {
    setLoading(false);
  }
};

// 日時フォーマット（YYYY/MM/DD HH:MM）
const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

// メッセージを100文字で切り捨て
const truncateMessage = (message: string): string => {
  if (message.length <= 100) return message;
  return message.substring(0, 100) + '...';
};
```

#### UI構造

```tsx
<Paper sx={{ p: 2, mb: 2 }}>
  <Typography variant="h6" sx={{ mb: 2 }}>
    事務へCHAT送信履歴
  </Typography>
  
  {loading && <CircularProgress />}
  
  {error && (
    <Alert severity="error">{error}</Alert>
  )}
  
  {!loading && !error && history.length === 0 && (
    <Typography variant="body2" color="text.secondary">
      送信履歴はありません
    </Typography>
  )}
  
  {!loading && !error && history.length > 0 && (
    <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
      {history.map((item) => (
        <Box key={item.id} sx={{ mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(item.sent_at)} - {item.sender_name}
          </Typography>
          <Typography variant="body2">
            {truncateMessage(item.message)}
          </Typography>
        </Box>
      ))}
    </Box>
  )}
</Paper>
```

### 2. PropertyListingDetailPage.tsx（既存コンポーネントの修正）

#### 追加するState

```typescript
const [chatHistoryRefreshTrigger, setChatHistoryRefreshTrigger] = useState(0);
```

#### 修正する関数

```typescript
// 事務へCHAT送信（修正）
const handleSendChatToOffice = async () => {
  if (!chatToOfficeMessage.trim() || !propertyNumber) return;
  setChatToOfficeSending(true);
  try {
    await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-office`, {
      message: chatToOfficeMessage,
      senderName: employee?.name || employee?.initials || '不明',
    });
    
    // 確認フィールドを「未」に自動設定
    setConfirmation('未');
    
    // キャッシュクリア
    pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
    sessionStorage.setItem('propertyListingsNeedsRefresh', 'true');
    
    // イベント発火
    window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', { 
      detail: { propertyNumber, confirmation: '未' } 
    }));
    
    // ★ 履歴を再取得（新規追加）
    setChatHistoryRefreshTrigger(prev => prev + 1);
    
    setSnackbar({ open: true, message: '事務へチャットを送信しました', severity: 'success' });
    setChatToOfficeMessage('');
    setChatToOfficePanelOpen(false);
  } catch (error: any) {
    setSnackbar({ open: true, message: error.response?.data?.error || 'チャット送信に失敗しました', severity: 'error' });
  } finally {
    setChatToOfficeSending(false);
  }
};
```

#### 追加するJSX

```tsx
{/* 左サイドバー */}
<Box sx={{ width: 300, flexShrink: 0 }}>
  <PropertySidebarStatus
    listings={[data]}
    selectedStatus={data.sidebar_status || null}
    onStatusChange={() => {}}
    pendingPriceReductionProperties={new Set()}
  />
  
  {/* ★ CHAT送信履歴（新規追加） */}
  <PropertyChatHistory
    propertyNumber={propertyNumber}
    refreshTrigger={chatHistoryRefreshTrigger}
  />
</Box>
```

### 3. Backend API（既存エンドポイントの修正）

#### GET /api/property-listings/:propertyNumber/chat-history（修正）

クエリパラメータを追加：

```typescript
router.get('/:propertyNumber/chat-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { chat_type, limit } = req.query;
    
    let query = supabase
      .from('property_chat_history')
      .select('*')
      .eq('property_number', propertyNumber);
    
    // chat_typeでフィルタリング
    if (chat_type) {
      query = query.eq('chat_type', chat_type);
    }
    
    // 新しい順にソート
    query = query.order('sent_at', { ascending: false });
    
    // 件数制限
    if (limit) {
      query = query.limit(Number(limit));
    }
    
    const { data: history, error } = await query;
    
    if (error) {
      console.error('[get-chat-history] Error:', error);
      res.status(500).json({ error: 'CHAT送信履歴の取得に失敗しました' });
      return;
    }
    
    res.json({ history: history || [] });
  } catch (error: any) {
    console.error('[get-chat-history] Error:', error.message);
    res.status(500).json({ error: error.message || 'CHAT送信履歴の取得に失敗しました' });
  }
});
```

#### POST /api/property-listings/:propertyNumber/send-chat-to-office（修正）

履歴保存処理を追加：

```typescript
router.post('/:propertyNumber/send-chat-to-office', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { message, senderName } = req.body;

    // ... 既存の処理（Google Chat送信） ...

    // ★ 履歴を保存（新規追加）
    const { error: insertError } = await supabase
      .from('property_chat_history')
      .insert({
        property_number: propertyNumber,
        chat_type: 'office',
        message: String(message).trim(),
        sender_name: senderName || '不明',
        sent_at: new Date().toISOString(),
      });
    
    if (insertError) {
      console.error('[send-chat-to-office] Failed to save history:', insertError);
      // 履歴保存失敗でもチャット送信は成功しているのでエラーにしない
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[send-chat-to-office] Error:', error.message);
    res.status(500).json({ error: error.message || 'チャット送信に失敗しました' });
  }
});
```

---

## データモデル

### property_chat_history テーブル（既存）

| カラム名 | 型 | 説明 | 制約 |
|---------|---|------|------|
| id | integer | 主キー | PRIMARY KEY, AUTO_INCREMENT |
| property_number | text | 物件番号 | NOT NULL |
| chat_type | text | チャット種別（'office' or 'assignee'） | NOT NULL |
| message | text | メッセージ内容 | NOT NULL |
| sender_name | text | 送信者名 | NOT NULL |
| sent_at | timestamp with time zone | 送信日時 | NOT NULL |
| created_at | timestamp with time zone | 作成日時 | DEFAULT now() |

#### インデックス

```sql
CREATE INDEX idx_property_chat_history_property_number 
ON property_chat_history(property_number);

CREATE INDEX idx_property_chat_history_chat_type 
ON property_chat_history(chat_type);

CREATE INDEX idx_property_chat_history_sent_at 
ON property_chat_history(sent_at DESC);
```

---

## エラーハンドリング

### フロントエンド

1. **API呼び出し失敗**:
   - エラーメッセージを表示
   - リトライボタンを表示（オプション）

2. **ネットワークエラー**:
   - 「ネットワークエラーが発生しました」と表示
   - 自動リトライ（3回まで）

3. **タイムアウト**:
   - 「タイムアウトしました」と表示
   - リトライボタンを表示

### バックエンド

1. **データベースエラー**:
   - 500エラーを返す
   - エラーログを出力

2. **履歴保存失敗**:
   - ログに記録
   - チャット送信は成功しているので200を返す

3. **バリデーションエラー**:
   - 400エラーを返す
   - エラーメッセージを返す

---

## テスト戦略

### ユニットテスト

1. **PropertyChatHistory.tsx**:
   - 履歴が正しく表示されるか
   - 日時フォーマットが正しいか
   - メッセージが100文字で切り捨てられるか
   - 履歴が0件の場合に「送信履歴はありません」と表示されるか
   - ローディング状態が正しく表示されるか
   - エラー状態が正しく表示されるか

2. **Backend API**:
   - `chat_type`パラメータでフィルタリングされるか
   - `limit`パラメータで件数制限されるか
   - 履歴が新しい順にソートされるか
   - 履歴保存が正しく動作するか

### 統合テスト

1. **CHAT送信から履歴表示まで**:
   - 「事務へCHAT」を送信
   - 履歴が自動的に再取得される
   - 新しい履歴が一覧の最上部に表示される

2. **複数物件の履歴**:
   - 物件Aの履歴を表示
   - 物件Bに遷移
   - 物件Bの履歴のみが表示される

### E2Eテスト

1. **ユーザーフロー**:
   - 物件リスト詳細画面を開く
   - 左サイドバーに履歴が表示される
   - 「事務へCHAT」を送信
   - 履歴が自動的に更新される
   - 新しい履歴が表示される

---

## パフォーマンス考慮事項

1. **履歴取得の最適化**:
   - 最新5件のみ取得（`LIMIT 5`）
   - インデックスを使用した高速検索

2. **リアルタイム更新**:
   - 送信後のみ再取得（ポーリングなし）
   - 不要な再レンダリングを防ぐ

3. **キャッシュ**:
   - React Queryを使用してキャッシュ（オプション）
   - 同じ物件の履歴を再取得しない

---

## セキュリティ考慮事項

1. **認証**:
   - 既存の認証機構を使用
   - 認証されたユーザーのみがアクセス可能

2. **認可**:
   - 物件番号に基づいてアクセス制御
   - 他の物件の履歴は閲覧不可

3. **入力検証**:
   - メッセージの長さ制限（最大1000文字）
   - XSS対策（エスケープ処理）

---

## デプロイ計画

### フェーズ1: バックエンド修正

1. `POST /api/property-listings/:propertyNumber/send-chat-to-office`に履歴保存処理を追加
2. `GET /api/property-listings/:propertyNumber/chat-history`にクエリパラメータを追加
3. デプロイ
4. 動作確認

### フェーズ2: フロントエンド実装

1. `PropertyChatHistory.tsx`コンポーネントを作成
2. `PropertyListingDetailPage.tsx`に統合
3. デプロイ
4. 動作確認

### フェーズ3: 統合テスト

1. E2Eテストを実行
2. バグ修正
3. 本番デプロイ

---

## 今後の拡張可能性

1. **履歴の検索・フィルタリング**:
   - 日付範囲で絞り込み
   - 送信者で絞り込み
   - キーワード検索

2. **履歴の詳細表示**:
   - モーダルで全文表示
   - 返信機能

3. **通知機能**:
   - 新しい履歴が追加されたら通知
   - リアルタイム更新（WebSocket）

4. **エクスポート機能**:
   - CSV出力
   - PDF出力

---

## まとめ

この設計により、物件リスト詳細画面の左サイドバーに「事務へCHAT」送信履歴を表示する機能を実装します。既存のAPIエンドポイントを活用し、最小限の変更で機能を追加します。リアルタイム更新により、ユーザーは常に最新の履歴を確認できます。
