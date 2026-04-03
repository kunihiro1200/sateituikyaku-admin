with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# state定義を追加
old_state = """  // 確認フィールド関連の状態
  const [confirmation, setConfirmation] = useState<'未' | '済' | null>(null);
  const [confirmationUpdating, setConfirmationUpdating] = useState(false);"""

new_state = """  // 確認フィールド関連の状態
  const [confirmation, setConfirmation] = useState<'未' | '済' | null>(null);
  const [confirmationUpdating, setConfirmationUpdating] = useState(false);

  // CHAT送信履歴関連の状態
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);"""

text = text.replace(old_state, new_state)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Added chat history state!')
