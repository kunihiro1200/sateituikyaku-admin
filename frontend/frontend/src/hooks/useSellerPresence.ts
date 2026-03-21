import { useEffect, useState, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
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
// シングルトンチャンネル管理
// ============================================================

let sharedChannel: RealtimeChannel | null = null;
let subscriberCount = 0;
let channelStatus: 'SUBSCRIBED' | 'SUBSCRIBING' | 'CLOSED' = 'CLOSED';
const stateListeners: Set<() => void> = new Set();

function getOrCreateChannel(): RealtimeChannel {
  if (!sharedChannel) {
    console.log('[useSellerPresence] チャンネル作成:', CHANNEL_NAME);
    sharedChannel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: undefined,
        },
      },
    });

    sharedChannel
      .on('presence', { event: 'sync' }, () => {
        console.log('[useSellerPresence] presence sync イベント');
        stateListeners.forEach((fn) => fn());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[useSellerPresence] presence join:', key, newPresences);
        stateListeners.forEach((fn) => fn());
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[useSellerPresence] presence leave:', key, leftPresences);
        stateListeners.forEach((fn) => fn());
      })
      .subscribe((status, err) => {
        console.log('[useSellerPresence] channel status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          channelStatus = 'SUBSCRIBED';
          stateListeners.forEach((fn) => fn());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[useSellerPresence] 接続エラー:', status, err);
          channelStatus = 'CLOSED';
        } else {
          channelStatus = 'SUBSCRIBING';
        }
      });
  }
  subscriberCount++;
  console.log('[useSellerPresence] subscriberCount:', subscriberCount);
  return sharedChannel;
}

function releaseChannel() {
  subscriberCount--;
  console.log('[useSellerPresence] releaseChannel, subscriberCount:', subscriberCount);
  if (subscriberCount <= 0 && sharedChannel) {
    console.log('[useSellerPresence] チャンネル削除');
    supabase.removeChannel(sharedChannel);
    sharedChannel = null;
    subscriberCount = 0;
    channelStatus = 'CLOSED';
  }
}

function buildPresenceState(channel: RealtimeChannel): PresenceState {
  const raw = channel.presenceState<PresenceRecord>();
  const mapped: PresenceState = {};
  for (const presences of Object.values(raw)) {
    for (const p of presences as unknown as PresenceRecord[]) {
      if (!p.seller_number) continue;
      if (!mapped[p.seller_number]) mapped[p.seller_number] = [];
      mapped[p.seller_number].push(p);
    }
  }
  return mapped;
}

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
    const channel = getOrCreateChannel();

    const refresh = () => {
      const state = buildPresenceState(channel);
      console.log('[useSellerPresence] subscribe refresh, state:', state);
      setPresenceState(state);
      setIsConnected(channelStatus === 'SUBSCRIBED');
    };

    stateListeners.add(refresh);

    if (channelStatus === 'SUBSCRIBED') {
      refresh();
    }

    return () => {
      stateListeners.delete(refresh);
      releaseChannel();
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
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sellerNumber || !employee?.name) {
      console.log('[useSellerPresence] track スキップ: sellerNumber=', sellerNumber, 'employee=', employee?.name);
      return;
    }

    console.log('[useSellerPresence] track 開始: sellerNumber=', sellerNumber, 'user=', employee.name);

    const channel = getOrCreateChannel();
    channelRef.current = channel;

    const doTrack = async () => {
      if (trackedRef.current) return;
      console.log('[useSellerPresence] doTrack 実行: channelStatus=', channelStatus);
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
    };

    if (channelStatus === 'SUBSCRIBED') {
      doTrack();
    }

    // SUBSCRIBEDになったらtrackするリスナー
    const onStatusChange = () => {
      if (channelStatus === 'SUBSCRIBED' && !trackedRef.current) {
        doTrack();
      }
    };
    stateListeners.add(onStatusChange);

    return () => {
      stateListeners.delete(onStatusChange);
      if (trackedRef.current && channelRef.current) {
        console.log('[useSellerPresence] untrack: sellerNumber=', sellerNumber);
        channelRef.current.untrack();
        trackedRef.current = false;
      }
      setIsTracking(false);
      releaseChannel();
      channelRef.current = null;
    };
  }, [sellerNumber, employee?.name]);

  return { isTracking };
}
