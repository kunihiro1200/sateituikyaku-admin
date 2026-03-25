# 設計ドキュメント: property-detail-chat-notification

## 概要

物件詳細画面（PropertyListingDetailPage.tsx）のヘッダーにある「SMS」ボタンの隣に「担当へCHAT」ボタンを追加する。クリックするとメッセージ入力フォームが表示され、送信するとスタッフ管理スプレッドシートの担当者のChat webhookにメッセージが送信される。

## アーキテクチャ

### フロントエンド変更

**ファイル**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

- 「担当へCHAT」ボタンをSMSボタンの隣に追加（`sales_assignee`が空の場合は非表示）
- ボタンクリックでトグル表示する入力フォーム（TextField + 送信ボタン）
- 送信処理: `POST /api/property-listings/:propertyNumber/send-chat-to-assignee`

### バックエンド変更

**ファイル**: `backend/src/routes/propertyListings.ts`

- 新エンドポイント: `POST /:propertyNumber/send-chat-to-assignee`
- `StaffManagementService.getWebhookUrl()` を使用して担当者のWebhook URLを取得
- `axios.post()` でGoogle Chat webhookにメッセージ送信

## 詳細設計

### フロントエンド

#### 状態管理

```typescript
const [chatPanelOpen, setChatPanelOpen] = useState(false);
const [chatMessage, setChatMessage] = useState('');
const [chatSending, setChatSending] = useState(false);
```

#### ボタン表示条件

```typescript
// sales_assigneeが入力されている場合のみ表示
{data.sales_assignee && (
  <Button onClick={() => setChatPanelOpen(!chatPanelOpen)}>
    担当へCHAT
  </Button>
)}
```

#### 入力フォーム

```tsx
{chatPanelOpen && (
  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
    <TextField
      size="small"
      placeholder="担当へ質問_伝言"
      value={chatMessage}
      onChange={(e) => setChatMessage(e.target.value)}
      sx={{ flex: 1 }}
    />
    <Button
      variant="contained"
      size="small"
      disabled={chatSending || !chatMessage.trim()}
      onClick={handleSendChatToAssignee}
    >
      {chatSending ? <CircularProgress size={16} /> : '送信'}
    </Button>
  </Box>
)}
```

#### 送信ハンドラー

```typescript
const handleSendChatToAssignee = async () => {
  if (!chatMessage.trim() || !propertyNumber) return;
  setChatSending(true);
  try {
    await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-assignee`, {
      message: chatMessage,
    });
    setSnackbar({ open: true, message: '担当へチャットを送信しました', severity: 'success' });
    setChatMessage('');
    setChatPanelOpen(false);
  } catch (error: any) {
    setSnackbar({ open: true, message: error.response?.data?.error || 'チャット送信に失敗しました', severity: 'error' });
  } finally {
    setChatSending(false);
  }
};
```

### バックエンド

#### エンドポイント

```typescript
// POST /:propertyNumber/send-chat-to-assignee
router.post('/:propertyNumber/send-chat-to-assignee', async (req, res) => {
  const { propertyNumber } = req.params;
  const { message } = req.body;

  // 1. 物件情報取得
  const property = await propertyListingService.getByPropertyNumber(propertyNumber);
  if (!property) return res.status(404).json({ error: '物件が見つかりません' });

  // 2. sales_assigneeチェック
  if (!property.sales_assignee) return res.status(400).json({ error: '物件担当が設定されていません' });

  // 3. StaffManagementServiceでWebhook URL取得
  const staffService = new StaffManagementService();
  const result = await staffService.getWebhookUrl(property.sales_assignee);
  if (!result.success) return res.status(404).json({ error: result.error });

  // 4. Google Chat webhookにメッセージ送信
  const chatMessage = `📩 *物件担当への質問・伝言*\n\n物件番号: ${propertyNumber}\n担当: ${property.sales_assignee}\n\n${message}`;
  await axios.post(result.webhookUrl!, { text: chatMessage });

  res.json({ success: true });
});
```

#### メッセージフォーマット

```
📩 *物件担当への質問・伝言*

物件番号: AA12345
担当: 〇〇

[ユーザーが入力したメッセージ]
```

## StaffManagementServiceのマッチングロジック

既存の `StaffManagementService.getWebhookUrl()` を使用する。このメソッドは以下の順序でマッチングを行う：

1. イニシャル完全一致（B列）
2. 名前完全一致（C列）
3. 名前部分一致（C列に含まれる）
4. 担当名が名前に含まれる

`fetchStaffData()` では：
- B列（イニシャル）→ `initials`
- C列（名字）→ `name`（フルネームがない場合はイニシャルを使用）
- F列（Chat webhook）→ `chatWebhook`

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` | 「担当へCHAT」ボタン・入力フォーム・送信ハンドラーを追加 |
| `backend/src/routes/propertyListings.ts` | `POST /:propertyNumber/send-chat-to-assignee` エンドポイントを追加 |
