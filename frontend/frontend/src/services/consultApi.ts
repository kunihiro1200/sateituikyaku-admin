// 不動産相談チャットアプリ（Consult App）専用のAPIクライアント。
// 顧客向け公開ページ（認証不要）のため、既存の `api`（axios、認証ヘッダー・401リダイレクト付き）は使わず、
// PropertyPreviewPage と同じ「バックエンドURLへの直接fetch」パターンを踏襲する。

const BACKEND_URL = import.meta.env.MODE === 'production'
  ? 'https://sateituikyaku-admin-backend.vercel.app'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

const STORAGE_KEY = 'consult_session_token';
const STORAGE_SELLER_ID_KEY = 'consult_seller_id';
const STORAGE_SELLER_NUMBER_KEY = 'consult_seller_number';

export interface ConsultSession {
  sellerId: string;
  sellerNumber: string;
  propertyAddress?: string | null;
  maskedName?: string | null;
  sessionToken?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `リクエストに失敗しました（${res.status}）`);
  }
  return data as T;
}

export const consultApi = {
  /** 端末に保存された本人確認情報を取得する */
  getStoredSession(): { sellerId: string; sellerNumber: string; token: string } | null {
    const token = localStorage.getItem(STORAGE_KEY);
    const sellerId = localStorage.getItem(STORAGE_SELLER_ID_KEY);
    const sellerNumber = localStorage.getItem(STORAGE_SELLER_NUMBER_KEY);
    if (!token || !sellerId || !sellerNumber) return null;
    return { sellerId, sellerNumber, token };
  },

  saveSession(sellerId: string, sellerNumber: string, token: string) {
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(STORAGE_SELLER_ID_KEY, sellerId);
    localStorage.setItem(STORAGE_SELLER_NUMBER_KEY, sellerNumber);
  },

  clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_SELLER_ID_KEY);
    localStorage.removeItem(STORAGE_SELLER_NUMBER_KEY);
  },

  /** 保存済みトークンが有効か確認する */
  async resolveSession(token: string): Promise<{ sellerId: string; sellerNumber: string } | null> {
    try {
      const data = await request<{ success: boolean; sellerId: string; sellerNumber: string }>(
        `/api/consult/session/${token}`
      );
      return { sellerId: data.sellerId, sellerNumber: data.sellerNumber };
    } catch {
      return null;
    }
  },

  /** 売主番号または電話番号で本人確認する */
  async verify(params: { sellerNumber?: string; phoneNumber?: string }): Promise<ConsultSession> {
    return request<ConsultSession & { success: boolean }>('/api/consult/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getProfile(sellerId: string, sellerNumber: string) {
    return request<{ success: boolean; profile: any }>(
      `/api/consult/${sellerId}/profile?sellerNumber=${encodeURIComponent(sellerNumber)}`
    );
  },

  async uploadToki(sellerId: string, sellerNumber: string, files: Array<{ name: string; mimeType: string; base64: string }>) {
    return request<{ success: boolean; profile: any }>(`/api/consult/${sellerId}/toki-upload`, {
      method: 'POST',
      body: JSON.stringify({ sellerNumber, files }),
    });
  },

  async startConversation(sellerId: string, sellerNumber: string) {
    return request<{ success: boolean; conversationId: string }>(`/api/consult/${sellerId}/conversations`, {
      method: 'POST',
      body: JSON.stringify({ sellerNumber }),
    });
  },

  async sendChat(sellerId: string, sellerNumber: string, conversationId: string, message: string) {
    return request<{ success: boolean; reply: string; themeTag: string | null; answerSource: string }>(
      `/api/consult/${sellerId}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({ sellerNumber, conversationId, message }),
      }
    );
  },
};

export { BACKEND_URL };
