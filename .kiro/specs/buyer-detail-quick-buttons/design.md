# 設計ドキュメント

## 概要

BuyerDetailPageの`message_to_assignee`フィールドとBuyerViewingResultPageの`viewing_result_follow_up`フィールドに、ヒアリング項目と同じクイックボタン機能を追加する。

## アーキテクチャ

### 変更対象ファイル

1. `frontend/frontend/src/pages/BuyerDetailPage.tsx`
2. `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`

## 詳細設計

### 1. クイックボタン定義の追加

`BuyerDetailPage.tsx`のファイル先頭付近に、新しいクイックボタン定義を追加する：

```typescript
const ASSIGNEE_MESSAGE_QUICK_INPUTS = [
  { label: '内覧理由', text: '内覧理由：' },
  { label: '家族構成', text: '家族構成：' },
  { label: '購入物件の譲れない点', text: '購入物件の譲れない点：' },
  { label: 'この物件の気に入っている点', text: 'この物件の気に入っている点：' },
  { label: 'この物件の駄目な点', text: 'この物件の駄目な点：' },
  { label: '購入時障害となる点', text: '購入時障害となる点：' },
  { label: '仮審査', text: '仮審査：' },
  { label: '連絡の付きやすい曜日、時間帯', text: '連絡の付きやすい曜日、時間帯：' },
  { label: '次のアクション', text: '次のアクション：' },
  { label: 'クロージング', text: 'クロージング：' },
];
```

### 2. BuyerDetailPage: message_to_assigneeフィールドの変更

現在`message_to_assignee`フィールドは`InlineEditableField`（textarea）で実装されている。これを`inquiry_hearing`フィールドと同様に`RichTextCommentEditor`に変更し、クイックボタンを追加する。

#### 変更内容

- `message_to_assignee`フィールド用のRefを追加：`messageToAssigneeEditorRef`
- `message_to_assignee`フィールド用のローカル編集値を追加：`messageToAssigneeEditValue`
- 保存ハンドラーを追加：`handleSaveMessageToAssignee`
- クイックボタンのクリックハンドラーを追加：`handleMessageToAssigneeQuickInput`
- フィールドのレンダリングを`inquiry_hearing`と同様のパターンに変更

#### フィールドのレンダリングパターン

```tsx
if (field.key === 'message_to_assignee') {
  return (
    <Grid item xs={12} key={`${section.title}-${field.key}`}>
      {/* クイックボタン */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          {field.label}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {ASSIGNEE_MESSAGE_QUICK_INPUTS.map((item) => (
            <Chip
              key={item.label}
              label={item.label}
              onClick={() => messageToAssigneeEditorRef.current?.insertAtCursor(`<b>${item.text}</b>`)}
              size="small"
              clickable
              color="primary"
              variant="outlined"
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Box>
      {/* RichTextCommentEditor */}
      <RichTextCommentEditor
        ref={messageToAssigneeEditorRef}
        value={messageToAssigneeEditValue}
        onChange={(html) => setMessageToAssigneeEditValue(html)}
        placeholder="担当への伝言・質問事項を入力..."
      />
      <Button
        fullWidth
        variant={isDirty ? 'contained' : 'outlined'}
        onClick={handleSaveMessageToAssignee}
        ...
      />
    </Grid>
  );
}
```

### 3. BuyerViewingResultPage: viewing_result_follow_upフィールドの変更

`BuyerViewingResultPage.tsx`では、既存の`VIEWING_RESULT_QUICK_INPUTS`定義を新しいボタン定義に置き換える。

#### 変更内容

- `VIEWING_RESULT_QUICK_INPUTS`の定義を新しい10個のボタンに更新
- 既存の`handleViewingResultQuickInput`ハンドラーはそのまま使用（先頭に挿入する動作）

## データフロー

### BuyerDetailPage（message_to_assignee）

```
ユーザーがクイックボタンをクリック
  ↓
messageToAssigneeEditorRef.current?.insertAtCursor(`<b>テキスト</b>`)
  ↓
RichTextCommentEditorのカーソル位置に太字テキストが挿入される
  ↓
ユーザーが保存ボタンをクリック
  ↓
handleSaveMessageToAssignee() → buyerApi.update()
  ↓
DBに保存
```

### BuyerViewingResultPage（viewing_result_follow_up）

```
ユーザーがクイックボタンをクリック
  ↓
handleViewingResultQuickInput(text, label)
  ↓
現在の値の先頭にテキストを追加
  ↓
buyerApi.update({ viewing_result_follow_up: newValue })
  ↓
DBに保存、UIを更新
```
