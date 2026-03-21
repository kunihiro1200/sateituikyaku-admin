import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';

// ============================================================
// 型定義
// ============================================================

export interface PresenceRecord {
  user_name: string;
  entered_at: string; // ISO 8601
}

// seller_number → PresenceRecord[] のマップ
export type PresenceState = Record<string, PresenceRecord[]>;

export interface UseSellerPresenceSubscribeResult {
  presenceState: PresenceState;
  isConnected: boolean;
}

export interface UseSellerPresenceTrackResult {
  isTracking: boolean;
}

// ============================================================
// 定数
// ============================================================

export const CHANNEL_NAME = 'seller-presence';
export const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30分

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * entered_at から30分以上経過したレコードを除外する
 */
export function filterStaleRecords(records: PresenceRecord[]): PresenceRecord[] {
  const now = Date.now();
  return records.filter((r) => {
    const enteredAt = new Date(r.entered_at).getTime();
    return now - enteredAt < STALE_THRESHOLD_MS;
  });
}

/**
 * プレゼンスバッジのラベルを生成する
 * 例: "林田が入っています" / "林田、田中が入っています"
 */
export function formatPresenceLabel(records: PresenceRecord[]): string {
  const active = filterStaleRecords(records);
  if (active.length === 0) return '';
  const names = active.map((r) => r.user_name).join('、');
  return `${names}が入っています`;
}

// ============================================================
// フック: 購読専用（SellersPage用）
// ============================================================

/**
 * Supabase Realtime Presence を購読し、全売主のプレゼンス状態を返す
 */
export function useSellerPresenceSubscribe(): UseSellerPresenceSubscribeResult {
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceRecord>();
        // presenceState を seller_number → PresenceRecord[] に変換
        const mapped: PresenceState = {};
        for (const [key, presences] of Object.entries(state)) {
          mapped[key] = presences as unknown as PresenceRecord[];
        }
        setPresenceState(mapped);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status !== 'SUBSCRIBED' && status !== 'CHANNEL_ERROR') {
          // CHANNEL_ERROR 以外の非接続状態はログ記録
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[useSellerPresence] 接続エラー:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { presenceState, isConnected };
}

// ============================================================
// フック: 発信専用（SellerDetailPage / CallModePage用）
// ============================================================

/**
 * 指定した売主番号のプレゼンスを登録する
 * コンポーネントのアンマウント時に自動的にトラッキングを停止する
 */
export function useSellerPresenceTrack(
  sellerNumber: string | undefined
): UseSellerPresenceTrackResult {
  const { employee } = useAuthStore();
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    // sellerNumber または employee.name が未取得の場合は早期リターン
    if (!sellerNumber || !employee?.name) return;

    const channel = supabase.channel(CHANNEL_NAME);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_name: employee.name,
          entered_at: new Date().toISOString(),
        });
        setIsTracking(true);
      }
    });

    return () => {
      channel.untrack().finally(() => {
        supabase.removeChannel(channel);
        setIsTracking(false);
      });
    };
  }, [sellerNumber, employee?.name]);

  return { isTracking };
}
