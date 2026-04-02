import api from './api';
import { ChatHistoryResponse } from '../types/chatHistory';

/**
 * 物件のCHAT送信履歴を取得
 * @param propertyNumber 物件番号
 * @returns CHAT送信履歴の配列
 */
export async function fetchChatHistory(propertyNumber: string): Promise<ChatHistoryResponse> {
  try {
    const response = await api.get(`/api/property-listings/${propertyNumber}/chat-history`);
    return response.data;
  } catch (error: any) {
    console.error('CHAT送信履歴の取得に失敗:', error);
    // エラー時は空配列を返す
    return [];
  }
}
