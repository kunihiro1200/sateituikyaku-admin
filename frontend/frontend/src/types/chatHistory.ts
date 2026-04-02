// CHAT送信履歴の型定義
export interface ChatHistoryItem {
  id: string;
  property_number: string;
  chat_type: 'office' | 'assignee';
  message: string;
  sender_name: string;
  sent_at: string;
  created_at: string;
}

// CHAT送信履歴取得APIのレスポンス型
export type ChatHistoryResponse = ChatHistoryItem[];
