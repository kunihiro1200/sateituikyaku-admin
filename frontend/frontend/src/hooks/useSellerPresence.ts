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
// Supabase Presenceは同一チャンネルインスタンスを共有する必要がある
// ============================================================

let sharedChannel: RealtimeChannel | null = null;
let subscriberCount = 0;
let channelStatus: 'SUBSCRIBED' | 'SUBSCRIBING' | 'CLOSED' = 'CLOSED';
const stateListeners: Set<() => void> = new Set();

function getOrCreateChannel(): RealtimeChannel {
  if (!sharedChannel) {
    sharedChannel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: undefined, // Supabaseが自動生成
        },
      },
    });

    sharedChannel
      .on('presence', { event: 'sync' }, () => {
        stateListeners.forEach((fn) => fn());
      })
      .on('presence', { event: 'join' }, () => {
        stateListeners.forEach((fn) => fn());
      })
      .on('presence', { event: 'leave' }, () => {
        stateListeners.forEach((fn) => fn());
      })
      .subscribe((status) => {
        console.log('[useSellerPresence] channel status:', status);
        if (status === 'SUBSCRIBED') {
          channelStatus = 'SUBSCRIBED';
          stateListeners.forEach((fn) => fn());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[useSellerPresence] 接続エラー:', status);
          channelStatus = 'CLOSED';
        } else {
          channelStatus = 'SUBSCRIBING';
        }
      });
  }
  subscriberCount++;
  return sharedChannel;
}

function releaseChannel() {
  subscriberCount--;
  if (subscriberCount <= 0 && sharedChannel) {
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
 * シングルトンチャンネルを使用して、発信側と同じインスタンスを共有する
 */
export function useSellerPresenceSubscribe(): UseSellerPresenceSubscribeResult {
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = getOrCreateChannel();

    const refresh = () => {
      setPresenceState(buildPresenceState(channel));
      setIsConnected(channelStatus === 'SUBSCRIBED');
    };

    stateListeners.add(refresh);

    // 既にSUBSCRIBED状態なら即座に状態を取得
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
// フック: 発信専用（SellerDetailPage / CallModePage用）
// ============================================================

/**
 * 指定した売主番号のプレゼンスを登録する
 * シングルトンチャンネルを使用して、購読側と同じインスタンスを共有する
 * コンポーネントのアンマウント時に自動的にトラッキングを停止する
 */
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

    const channel = getOrCreateChannel();

    const doTrack = async () => {
      if (channelStatus === 'SUBSCRIBED' && !trackedRef.current) {
        await channel.track({
          seller_number: sellerNumber,
          user_name: employee.name,
          entered_at: new Date().toISOString(),
        });
        trackedRef.current = true;
        setIsTracking(true);
        console.log('[useSellerPresence] track 完了: sellerNumber=', sellerNumber);
      }
    };

    // 既にSUBSCRIBED状態なら即座にtrack
    if (channelStatus === 'SUBSCRIBED') {
      doTrack();
    } else {
      // SUBSCRIBED になったらtrackするリスナーを登録
      const onStatusChange = () => {
        if (channelStatus === 'SUBSCRIBED') {
          doTrack();
        }
      };
      stateListeners.add(onStatusChange);

      return () => {
        stateListeners.delete(onStatusChange);
        if (trackedRef.current) {
          channel.untrack();
          trackedRef.current = false;
        }
        setIsTracking(false);
        releaseChannel();
      };
    }

    return () => {
      if (trackedRef.current) {
        channel.untrack();
        trackedRef.current = false;
      }
      setIsTracking(false);
      releaseChannel();
    };
  }, [sellerNumber, employee?.name]);

  return { isTracking };
}
