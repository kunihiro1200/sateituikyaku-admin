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
export const PRESENCE_PERSIST_DURATION_MS = 5000; // 5秒間プレゼンス情報を維持

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
  const leaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useSellerPresence] presence sync`);
        setPresenceState(buildState());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useSellerPresence] presence join:`, key, newPresences);
        
        // joinイベントが来たら、該当するleaveタイマーをキャンセル
        const presences = newPresences as unknown as PresenceRecord[];
        presences.forEach((p) => {
          if (p.seller_number && leaveTimersRef.current.has(p.seller_number)) {
            const timer = leaveTimersRef.current.get(p.seller_number);
            if (timer) {
              clearTimeout(timer);
              leaveTimersRef.current.delete(p.seller_number);
              console.log(`[${timestamp}] [useSellerPresence] leaveタイマーキャンセル: ${p.seller_number}`);
            }
          }
        });
        
        setPresenceState(buildState());
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useSellerPresence] presence leave:`, key, leftPresences);
        
        // leaveイベントが来ても即座に削除せず、5秒後に削除
        const presences = leftPresences as unknown as PresenceRecord[];
        presences.forEach((p) => {
          if (!p.seller_number) return;
          
          // 既存のタイマーをキャンセル
          if (leaveTimersRef.current.has(p.seller_number)) {
            const timer = leaveTimersRef.current.get(p.seller_number);
            if (timer) clearTimeout(timer);
          }
          
          // 5秒後に状態を更新
          const timer = setTimeout(() => {
            const delayTimestamp = new Date().toISOString();
            console.log(`[${delayTimestamp}] [useSellerPresence] ${PRESENCE_PERSIST_DURATION_MS}ms経過、状態更新: ${p.seller_number}`);
            setPresenceState(buildState());
            leaveTimersRef.current.delete(p.seller_number);
          }, PRESENCE_PERSIST_DURATION_MS);
          
          leaveTimersRef.current.set(p.seller_number, timer);
          console.log(`[${timestamp}] [useSellerPresence] leaveタイマー設定: ${p.seller_number} (${PRESENCE_PERSIST_DURATION_MS}ms後)`);
        });
      })
      .subscribe((status) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useSellerPresence] subscribe status:`, status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          setPresenceState(buildState());
        }
      });

    return () => {
      console.log('[useSellerPresence] subscribe: チャンネル削除');
      
      // 全てのleaveタイマーをキャンセル
      leaveTimersRef.current.forEach((timer) => clearTimeout(timer));
      leaveTimersRef.current.clear();
      
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const untrackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 5秒遅延用タイマー
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  useEffect(() => {
    if (!sellerNumber || !employee?.name) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [useSellerPresence] track スキップ: sellerNumber=`, sellerNumber, 'employee=', employee?.name);
      return;
    }

    const userName = employee.name;

    const connect = () => {
      // 既存チャンネルをクリーンアップ
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [useSellerPresence] track 開始: sellerNumber=`, sellerNumber, 'user=', userName, 'retry=', retryCountRef.current);

      const channel = supabase.channel(CHANNEL_NAME, {
        config: { presence: { key: undefined } },
      });
      channelRef.current = channel;
      trackedRef.current = false;

      channel.subscribe(async (status) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useSellerPresence] track channel status:`, status);

        if (status === 'SUBSCRIBED' && !trackedRef.current) {
          retryCountRef.current = 0;
          try {
            const result = await channel.track({
              seller_number: sellerNumber,
              user_name: userName,
              entered_at: new Date().toISOString(),
            });
            const trackTimestamp = new Date().toISOString();
            console.log(`[${trackTimestamp}] [useSellerPresence] track 結果:`, result);
            trackedRef.current = true;
            setIsTracking(true);
          } catch (e) {
            console.error(`[${timestamp}] [useSellerPresence] track エラー:`, e);
          }
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          retryCountRef.current += 1;
          if (retryCountRef.current <= MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30000);
            console.log(`[${timestamp}] [useSellerPresence] track リトライ予定:`, retryCountRef.current, '/', MAX_RETRIES, 'delay=', delay, 'ms');
            retryTimerRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.warn(`[${timestamp}] [useSellerPresence] track リトライ上限に達しました`);
          }
        }
      });
    };

    connect();

    return () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [useSellerPresence] track: クリーンアップ開始（5秒遅延でuntrack）`);
      
      // リトライタイマーをキャンセル
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      
      // 既存のuntrackタイマーをキャンセル（複数回呼び出された場合）
      if (untrackTimerRef.current) {
        clearTimeout(untrackTimerRef.current);
        untrackTimerRef.current = null;
      }
      
      // 5秒後にuntrackを実行
      if (channelRef.current && trackedRef.current) {
        const channelToUntrack = channelRef.current;
        untrackTimerRef.current = setTimeout(() => {
          const untrackTimestamp = new Date().toISOString();
          console.log(`[${untrackTimestamp}] [useSellerPresence] track: 5秒経過、untrack実行`);
          channelToUntrack.untrack();
          supabase.removeChannel(channelToUntrack);
          untrackTimerRef.current = null;
        }, PRESENCE_PERSIST_DURATION_MS);
        
        console.log(`[${timestamp}] [useSellerPresence] track: untrackタイマー設定（${PRESENCE_PERSIST_DURATION_MS}ms後）`);
      } else if (channelRef.current) {
        // trackしていない場合は即座に削除
        supabase.removeChannel(channelRef.current);
      }
      
      channelRef.current = null;
      trackedRef.current = false;
      retryCountRef.current = 0;
      setIsTracking(false);
    };
  }, [sellerNumber, employee?.name]);

  return { isTracking };
}
