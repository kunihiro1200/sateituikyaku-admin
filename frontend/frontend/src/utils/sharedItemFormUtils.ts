/**
 * 共有ページ新規作成フォーム用ユーティリティ関数
 */
import api from '../services/api';

/**
 * バックエンドAPI経由でSupabase Storageにファイルをアップロードして公開URLを返す
 *
 * ⚠️ 以前はフロントエンドから supabase.storage を直接呼び出していたが、
 *    ユーザーのSupabaseセッション（JWT）が期限切れになると Storage の RLS に弾かれ
 *    「保存に失敗しました」エラーが発生していた（2026年10月障害）。
 *
 * バックエンドの POST /api/shared-items/upload はサービスロールキーで動作するため
 * ユーザーのセッション状態に関係なくアップロードできる。
 */
export async function uploadFileToStorage(file: File, type: 'pdf' | 'image'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  // Content-Type は axios が FormData を検知して multipart/form-data + boundary を自動設定する
  const response = await api.post('/api/shared-items/upload', formData);

  if (!response.data?.url) {
    throw new Error('アップロードURLの取得に失敗しました');
  }

  return response.data.url;
}

/**
 * 既存エントリーの最大IDに1を加算した次のIDを返す
 * エントリーが空の場合は1を返す
 */
export function calculateNextId(entries: { id: string | number }[]): number {
  if (entries.length === 0) return 1;
  const maxId = Math.max(
    ...entries.map((e) => {
      const num = Number(e.id);
      return isNaN(num) ? 0 : num;
    })
  );
  return maxId + 1;
}

/**
 * スタッフ選択のトグル
 * 選択済みの場合は除外、未選択の場合は追加する
 */
export function toggleStaff(selected: string[], staff: string): string[] {
  if (selected.includes(staff)) {
    return selected.filter((s) => s !== staff);
  }
  return [...selected, staff];
}

/**
 * URLバリデーション
 * http:// または https:// で始まる場合のみ有効
 * 空文字列は有効（任意フィールドのため）
 */
export function validateUrl(url: string): { isValid: boolean; error?: string } {
  if (!url || url.trim() === '') {
    return { isValid: true };
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { isValid: true };
  }
  return { isValid: false, error: '正しいURL形式で入力してください（http:// または https:// で始めてください）' };
}

/**
 * 今日の日付をYYYY/MM/DD形式で返す
 */
export function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 共有場の選択肢
 */
export const SHARING_LOCATIONS = [
  '朝礼',
  '売買会議',
  '契約率チーム',
  '物件数チーム',
  '事務会議',
  '営業会議',
  '他',
] as const;

/**
 * 項目の選択肢
 */
export const CATEGORIES = [
  '契約関係',
  '訪問査定',
  '追客電話',
  '内覧関係',
  '決済関係',
  '専任媒介報告書',
  '税金関係',
  '境界、塀、ブロック、崖関係',
  '温泉関係',
  'APPSHEET関係',
  '雛形関係',
  '他',
] as const;
