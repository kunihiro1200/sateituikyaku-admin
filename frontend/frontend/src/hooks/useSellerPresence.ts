import { useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';

// ============================================================
// 型定義
// ============================================================

export interface PresenceRecord {
  seller_number: string;
  user_name: string;
  entered_at: string; // ISO 8601
}

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

export function filterStaleRecords(records: PresenceRecord[]): PresenceRecord[] {
  const now = Date.now();
  return records.filter((r) => {
    const enteredAt = new Date(r.entered_at).getTime();
    return now - enteredAt < STALE_THRESHOLD_MS;
  });
}

export function formatPresenceLabel(records: PresenceRecord[]): string {
  const active = filterStaleRecords(records);
  if (active.length === 0) return '';
  const names = active.map((r) => r.user_name).join('、');
  return `${names}が入っています`;
}

// ============================================================
// フック: 購読専用（SellersPage用）
// ============================================================

export function useSellerPresenceSubscribe(): UseSellerPresenceSubscribeResult {
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('[useSellerPresence] subscribe: チャンネル作成');

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: undefined } },
    });

    const buildState = () => {
      const raw = channel.presenceState<PresenceRecord>();
      const mapped: PresenceState = {};
      for (const presences of Object.values(raw)) {
        for (const p of presences as unknown as PresenceRecord[]) {
          if (!p.seller_number) continue;
          if (!mapped[p.seller_number]) mapped[p.seller_number] = [];
          mapped[p.seller_number].push(p);
        }
      }
      console.log('[useSellerPresence] subscribe state:', mapped);
      return mapped;
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('[useSellerPresence] presence sync');
        setPresenceState(buildState());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[useSellerPresence] presence join:', key, newPresences);
        setPresenceState(buildState());
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[useSellerPresence] presence leave:', key, leftPresences);
        setPresenceState(buildState());
      })
      .subscribe((status) => {
        console.log('[useSellerPresence] subscribe status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          setPresenceState(buildState());
        }
      });

    return () => {
      console.log('[useSellerPresence] subscribe: チャンネル削除');
      supabase.removeChannel(channel);
    };
  }, []);

  return { presenceState, isConnected };
}

// ============================================================
// フック: 発信専用（CallModePage用）
// ============================================================

export function useSellerPresenceTrack(
  sellerNumber: string | undefined
): UseSellerPresenceTrackResult {
  const { employee } = useAuthStore();
  const [isTracking, setIsTracking] = useState(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!sellerNumber || !employee?.name) {
      console.log('[useSellerPresence] track スキップ: sellerNumber=', sellerNumber, 'employee=', employee?.name);
      return;
    }

    console.log('[useSellerPresence] track 開始: sellerNumber=', sellerNumber, 'user=', employee.name);

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: undefined } },
    });

    trackedRef.current = false;

    channel.subscribe(async (status) => {
      console.log('[useSellerPresence] track channel status:', status);
      if (status === 'SUBSCRIBED' && !trackedRef.current) {
        try {
          const result = await channel.track({
            seller_number: sellerNumber,
            user_name: employee.name,
            entered_at: new Date().toISOString(),
          });
          console.log('[useSellerPresence] track 結果:', result);
          trackedRef.current = true;
          setIsTracking(true);
        } catch (e) {
          console.error('[useSellerPresence] track エラー:', e);
        }
      }
    });

    return () => {
      console.log('[useSellerPresence] track: untrack & チャンネル削除');
      if (trackedRef.current) {
        channel.untrack();
        trackedRef.current = false;
      }
      setIsTracking(false);
      supabase.removeChannel(channel);
    };
  }, [sellerNumber, employee?.name]);

  return { isTracking };
}
