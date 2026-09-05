import { useEffect, useState, useRef } from 'react';
import { StoreApi, UseBoundStore } from 'zustand';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import {
  GenericPresenceRecord,
  GenericPresenceState,
  PresenceStoreState,
} from '../store/createPresenceStore';

// ============================================================
// 汎用プレゼンスフック
// 売主(useSellerPresence)・買主(useBuyerPresence)と同じ仕組みを
// 物件リスト・業務依頼・共有など任意の対象に適用できるように汎用化したもの。
//
// - Supabase Realtime の Presence でリアルタイム共有
// - 同一ブラウザ内のタブ間は BroadcastChannel で即時反映
// - leave は5秒遅延で削除（ページ遷移時のちらつき防止）
// - 30分以上前のプレゼンスは stale として除外
// ============================================================

export const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30分
export const PRESENCE_PERSIST_DURATION_MS = 5000; // leave後5秒維持
const MAX_RETRIES = 5;

export interface PresenceChannelConfig {
  /** Supabase Realtime のチャンネル名（対象ごとに一意） */
  channelName: string;
  /** 同一ブラウザ内タブ間通信用の BroadcastChannel 名（対象ごとに一意） */
  broadcastChannelName: string;
  /** 対象ごとのプレゼンスストア */
  store: UseBoundStore<StoreApi<PresenceStoreState>>;
  /** ログ用ラベル */
  label: string;
}

export interface UsePresenceSubscribeResult {
  presenceState: GenericPresenceState;
  isConnected: boolean;
}

export interface UsePresenceTrackResult {
  isTracking: boolean;
}

export function filterStaleRecords(records: GenericPresenceRecord[]): GenericPresenceRecord[] {
  const now = Date.now();
  return records.filter((r) => now - new Date(r.entered_at).getTime() < STALE_THRESHOLD_MS);
}

// ============================================================
// 購読専用フック（リストページ用）
// ============================================================
export function createPresenceSubscribeHook(config: PresenceChannelConfig) {
  const { channelName, broadcastChannelName, store, label } = config;

  return function usePresenceSubscribe(): UsePresenceSubscribeResult {
    const [isConnected, setIsConnected] = useState(false);
    const leaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

    const presenceState = store((state) => state.presenceState);
    const addPresence = store((state) => state.addPresence);
    const removePresence = store((state) => state.removePresence);
    const clearAllPresence = store((state) => state.clearAllPresence);

    useEffect(() => {
      try {
        broadcastChannelRef.current = new BroadcastChannel(broadcastChannelName);
      } catch (e) {
        console.warn(`[${label}] subscribe: BroadcastChannel作成失敗（古いブラウザ）`, e);
      }

      const channel = supabase.channel(channelName, {
        config: { presence: { key: undefined } },
      });

      const buildState = () => {
        const raw = channel.presenceState<GenericPresenceRecord>();
        const now = Date.now();
        const mapped: GenericPresenceState = {};

        for (const presences of Object.values(raw)) {
          for (const p of presences as unknown as GenericPresenceRecord[]) {
            if (!p.item_key) continue;
            if (now - new Date(p.entered_at).getTime() >= STALE_THRESHOLD_MS) continue;
            if (!mapped[p.item_key]) mapped[p.item_key] = [];
            mapped[p.item_key].push(p);
          }
        }

        clearAllPresence();
        for (const records of Object.values(mapped)) {
          for (const record of records) addPresence(record);
        }
        return mapped;
      };

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.onmessage = (event) => {
          if (event.data.type === 'track') {
            addPresence({
              item_key: event.data.item_key,
              user_name: event.data.user_name,
              entered_at: event.data.entered_at,
            });
          } else if (event.data.type === 'untrack') {
            const itemKey = event.data.item_key;
            const userName = event.data.user_name;
            const timerKey = `${itemKey}-${userName}`;
            if (leaveTimersRef.current.has(timerKey)) {
              const t = leaveTimersRef.current.get(timerKey);
              if (t) clearTimeout(t);
            }
            const timer = setTimeout(() => {
              removePresence(itemKey, userName);
              leaveTimersRef.current.delete(timerKey);
            }, PRESENCE_PERSIST_DURATION_MS);
            leaveTimersRef.current.set(timerKey, timer);
          }
        };
      }

      channel
        .on('presence', { event: 'sync' }, () => {
          buildState();
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          const presences = newPresences as unknown as GenericPresenceRecord[];
          presences.forEach((p) => {
            if (p.item_key && leaveTimersRef.current.has(p.item_key)) {
              const t = leaveTimersRef.current.get(p.item_key);
              if (t) {
                clearTimeout(t);
                leaveTimersRef.current.delete(p.item_key);
              }
            }
          });
          buildState();
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          const presences = leftPresences as unknown as GenericPresenceRecord[];
          presences.forEach((p) => {
            if (!p.item_key) return;
            if (leaveTimersRef.current.has(p.item_key)) {
              const t = leaveTimersRef.current.get(p.item_key);
              if (t) clearTimeout(t);
            }
            const timer = setTimeout(() => {
              buildState();
              leaveTimersRef.current.delete(p.item_key);
            }, PRESENCE_PERSIST_DURATION_MS);
            leaveTimersRef.current.set(p.item_key, timer);
          });
        })
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
          if (status === 'SUBSCRIBED') buildState();
        });

      const timers = leaveTimersRef.current;
      return () => {
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.close();
          broadcastChannelRef.current = null;
        }
        supabase.removeChannel(channel);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { presenceState, isConnected };
  };
}

// ============================================================
// 発信専用フック（詳細ページ／モーダル用）
// ============================================================
export function createPresenceTrackHook(config: PresenceChannelConfig) {
  const { channelName, broadcastChannelName, store, label } = config;

  return function usePresenceTrack(itemKey: string | undefined | null): UsePresenceTrackResult {
    const { employee } = useAuthStore();
    const addPresence = store((state) => state.addPresence);
    const removePresence = store((state) => state.removePresence);
    const [isTracking, setIsTracking] = useState(false);
    const trackedRef = useRef(false);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
      const userInitials = employee?.initials || employee?.name;
      if (!itemKey || !userInitials) return;

      const userName = userInitials;

      try {
        broadcastChannelRef.current = new BroadcastChannel(broadcastChannelName);
      } catch (e) {
        console.warn(`[${label}] track: BroadcastChannel作成失敗（古いブラウザ）`, e);
      }

      const connect = () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase.channel(channelName, {
          config: { presence: { key: undefined } },
        });
        channelRef.current = channel;
        trackedRef.current = false;

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && !trackedRef.current) {
            retryCountRef.current = 0;
            try {
              const presenceData: GenericPresenceRecord = {
                item_key: itemKey,
                user_name: userName,
                entered_at: new Date().toISOString(),
              };
              await channel.track(presenceData);
              trackedRef.current = true;
              setIsTracking(true);
              addPresence(presenceData);
              if (broadcastChannelRef.current) {
                broadcastChannelRef.current.postMessage({ type: 'track', ...presenceData });
              }
            } catch (e) {
              console.error(`[${label}] track エラー:`, e);
            }
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            retryCountRef.current += 1;
            if (retryCountRef.current <= MAX_RETRIES) {
              const delay =
                retryCountRef.current === 1
                  ? 0
                  : Math.min(500 * Math.pow(2, retryCountRef.current - 2), 10000);
              retryTimerRef.current = setTimeout(() => connect(), delay);
            }
          }
        });
      };

      connect();

      return () => {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        removePresence(itemKey, userName);
        if (broadcastChannelRef.current && trackedRef.current) {
          broadcastChannelRef.current.postMessage({
            type: 'untrack',
            item_key: itemKey,
            user_name: userName,
          });
        }
        if (channelRef.current && trackedRef.current) {
          const ch = channelRef.current;
          ch.untrack();
          supabase.removeChannel(ch);
        } else if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.close();
          broadcastChannelRef.current = null;
        }
        channelRef.current = null;
        trackedRef.current = false;
        retryCountRef.current = 0;
        setIsTracking(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemKey, employee?.initials, employee?.name, addPresence, removePresence]);

    return { isTracking };
  };
}
