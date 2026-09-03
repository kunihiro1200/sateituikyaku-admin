// 売却サポートページ（顧客向け公開ページ）専用のAPIクライアント。
// 認証不要（トークンで本人確認）のため、既存の `api`（axios、Supabase認証ヘッダー付き）は使わず、
// PropertyPreviewPage と同じ「バックエンドURLへの直接fetch」パターンを踏襲する。

const BACKEND_URL = import.meta.env.MODE === 'production'
  ? 'https://sateituikyaku-admin-backend.vercel.app'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

const STORAGE_KEY = 'seller_portal_token';

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

export interface ValuationSummary {
  minimumPrice: number;
  midPrice: number;
  maximumPrice: number;
  propertyType: 'land' | 'detached_house' | 'apartment' | 'other';
}

export interface PropertySummary {
  ownerName: string | null;
  propertyTypeLabel: string;
  address: string | null;
  landArea: number | null;
  buildingArea: number | null;
}

export const sellerPortalApi = {
  /** URLパスのトークンをlocalStorageに保存しておく（PWAでホーム画面から再訪した際の補助） */
  saveToken(token: string) {
    localStorage.setItem(STORAGE_KEY, token);
  },
  getStoredToken(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },

  async getPortalTop(token: string) {
    return request<{
      success: boolean;
      sellerNumber: string;
      valuation: ValuationSummary;
      preferences: any;
      propertySummary: PropertySummary | null;
    }>(`/api/seller-portal/portal?token=${encodeURIComponent(token)}`);
  },

  async getValuationBreakdown(token: string) {
    return request<{ success: boolean; breakdown: any }>(
      `/api/seller-portal/portal/valuation-breakdown?token=${encodeURIComponent(token)}`
    );
  },

  async getRoughProceeds(token: string) {
    return request<{ success: boolean; rows: any[] }>(
      `/api/seller-portal/portal/rough-proceeds?token=${encodeURIComponent(token)}`
    );
  },

  async getDetailedProceeds(token: string, params: { loanBalance?: number; mortgageReleaseFee?: number; transferTax: any }) {
    return request<{ success: boolean; rows: any[] }>('/api/seller-portal/portal/detailed-proceeds', {
      method: 'POST',
      body: JSON.stringify({ token, ...params }),
    });
  },

  async saveKnownFacts(token: string, facts: Record<string, any>) {
    return request<{ success: boolean }>('/api/seller-portal/portal/known-facts', {
      method: 'POST',
      body: JSON.stringify({ token, facts }),
    });
  },

  async updatePreferences(token: string, updates: { desiredSalePrice?: number; minimumSalePrice?: number; desiredSettlementYearMonth?: string }) {
    return request<{ success: boolean }>('/api/seller-portal/portal/preferences', {
      method: 'PUT',
      body: JSON.stringify({ token, ...updates }),
    });
  },

  async getSchedule(token: string) {
    return request<{ success: boolean; schedule: any }>(
      `/api/seller-portal/portal/schedule?token=${encodeURIComponent(token)}`
    );
  },

  async requestBuyout(token: string) {
    return request<{ success: boolean }>('/api/seller-portal/portal/buyout-request', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async sendMessage(token: string, contextTag: string, content: string) {
    return request<{ success: boolean; conversationId: string }>('/api/seller-portal/portal/messages', {
      method: 'POST',
      body: JSON.stringify({ token, contextTag, content }),
    });
  },

  async getMessages(token: string, options?: { markAsRead?: boolean }) {
    const params = new URLSearchParams({ token });
    if (options?.markAsRead === false) {
      params.set('markAsRead', 'false');
    }
    return request<{ success: boolean; conversations: any[] }>(
      `/api/seller-portal/portal/messages?${params.toString()}`
    );
  },
};

export { BACKEND_URL };
