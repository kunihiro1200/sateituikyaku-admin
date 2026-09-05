import { useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { useBuyerPresenceStore } from '../store/buyerPresenceStore';

// ============================================================
// 型定義
// ============================================================

export interface BuyerPresenceRecord {
  buyer_number: string;
  user_name: string;
  entered_at: string; // ISO 8601
}

export type BuyerPresenceState = Record<string, BuyerPresenceRecord[]>;

export interface UseBuyerPresenceSubscribeResult {
  presenceState: BuyerPresenceState;
  isConnected: boolean;
}

export interface UseBuyerPresenceTrackResult {
  isTracking: boolean;
}

// ============================================================
// 定数
// ============================================================

export const BUYER_CHANNEL_NAME = 'buyer-presence';
export const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30分
export const PRESENCE_PERSIST_DURATION_MS = 5000; // 5秒間プレゼンス情報を維持
export const BUYER_BROADCAST_CHANNEL_NAME = 'buyer-presence-local'; // ローカル通信用

// ============================================================
// ユーティリティ関数
// ============================================================

export function filterStaleRecords(records: BuyerPresenceRecord[]): BuyerPresenceRecord[] {
  const now = Date.now();
  return records.filter((r) => {
    const enteredAt = new Date(r.entered_at).getTime();
    return now - enteredAt < STALE_THRESHOLD_MS;
  });
}

export function formatPresenceLabel(records: BuyerPresenceRecord[]): string {
  const active = filterStaleRecords(records);
  if (active.length === 0) return '';
  const names = active.map((r) => r.user_name).join('、');
  return `${names}が入っています`;
}

// ============================================================
// フック: 購読専用（買主リスト用）
// ============================================================

export function useBuyerPresenceSubscribe(): UseBuyerPresenceSubscribeResult {
  const [isConnected, setIsConnected] = useState(false);
  const leaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // グローバルステートから取得
  const presenceState = useBuyerPresenceStore((state) => state.presenceState);
  const addPresence = useBuyerPresenceStore((state) => state.addPresence);
  const removePresence = useBuyerPresenceStore((state) => state.removePresence);
  const clearAllPresence = useBuyerPresenceStore((state) => state.clearAllPresence);

  useEffect(() => {
    console.log('[useBuyerPresence] subscribe: チャンネル作成');

    // BroadcastChannelを作成（同じブラウザ内のタブ間通信用）
    try {
      broadcastChannelRef.current = new BroadcastChannel(BUYER_BROADCAST_CHANNEL_NAME);
      console.log('[useBuyerPresence] subscribe: BroadcastChannel作成成功');
    } catch (e) {
      console.warn('[useBuyerPresence] subscribe: BroadcastChannel作成失敗（古いブラウザ）', e);
    }

    const channel = supabase.channel(BUYER_CHANNEL_NAME, {
      config: { presence: { key: undefined } },
    });

    const buildState = () => {
      const raw = channel.presenceState<BuyerPresenceRecord>();
      const mapped: BuyerPresenceState = {};
      const now = Date.now();

      for (const presences of Object.values(raw)) {
        for (const p of presences as unknown as BuyerPresenceRecord[]) {
          if (!p.buyer_number) continue;

          // 30分以上古いプレゼンス情報は除外
          const enteredAt = new Date(p.entered_at).getTime();
          if (now - enteredAt >= STALE_THRESHOLD_MS) {
            console.log(`[useBuyerPresence] subscribe: 古いプレゼンス情報を除外: ${p.buyer_number} - ${p.user_name} (${Math.floor((now - enteredAt) / 60000)}分前)`);
            continue;
          }

          if (!mapped[p.buyer_number]) mapped[p.buyer_number] = [];
          mapped[p.buyer_number].push(p);
        }
      }
      console.log('[useBuyerPresence] subscribe state:', mapped);

      // グローバルステートをクリアしてから再構築（古いデータを削除）
      clearAllPresence();

      // グローバルステートに保存
      for (const [, records] of Object.entries(mapped)) {
        for (const record of records) {
          addPresence(record);
        }
      }

      return mapped;
    };

    // BroadcastChannelからのメッセージを受信（即座の更新用）
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.onmessage = (event) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useBuyerPresence] BroadcastChannel受信:`, event.data);

        if (event.data.type === 'track') {
          // 即座にグローバルステートに追加
          addPresence({
            buyer_number: event.data.buyer_number,
            user_name: event.data.user_name,
            entered_at: event.data.entered_at,
          });
          console.log(`[${timestamp}] [useBuyerPresence] BroadcastChannel ローカルステート即座更新`);
        } else if (event.data.type === 'untrack') {
          // 5秒後に削除（leaveタイマーと同じロジック）
          const buyerNumber = event.data.buyer_number;
          const userName = event.data.user_name;

          // 既存のタイマーをキャンセル
          const timerKey = `${buyerNumber}-${userName}`;
          if (leaveTimersRef.current.has(timerKey)) {
            const timer = leaveTimersRef.current.get(timerKey);
            if (timer) clearTimeout(timer);
          }

          // 5秒後に削除
          const timer = setTimeout(() => {
            const delayTimestamp = new Date().toISOString();
            console.log(`[${delayTimestamp}] [useBuyerPresence] BroadcastChannel untrack: ${PRESENCE_PERSIST_DURATION_MS}ms経過、削除: ${buyerNumber} - ${userName}`);
            removePresence(buyerNumber, userName);
            leaveTimersRef.current.delete(timerKey);
          }, PRESENCE_PERSIST_DURATION_MS);

          leaveTimersRef.current.set(timerKey, timer);
          console.log(`[${timestamp}] [useBuyerPresence] BroadcastChannel untrackタイマー設定: ${timerKey} (${PRESENCE_PERSIST_DURATION_MS}ms後)`);
        }
      };
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useBuyerPresence] presence sync`);
        buildState(); // グローバルステートに保存済み
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useBuyerPresence] presence join:`, key, newPresences);

        // joinイベントが来たら、該当するleaveタイマーをキャンセル
        const presences = newPresences as unknown as BuyerPresenceRecord[];
        presences.forEach((p) => {
          if (p.buyer_number && leaveTimersRef.current.has(p.buyer_number)) {
            const timer = leaveTimersRef.current.get(p.buyer_number);
            if (timer) {
              clearTimeout(timer);
              leaveTimersRef.current.delete(p.buyer_number);
              console.log(`[${timestamp}] [useBuyerPresence] leaveタイマーキャンセル: ${p.buyer_number}`);
            }
          }
        });

        buildState(); // グローバルステートに保存済み
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useBuyerPresence] presence leave:`, key, leftPresences);

        // leaveイベントが来ても即座に削除せず、5秒後に削除
        const presences = leftPresences as unknown as BuyerPresenceRecord[];
        presences.forEach((p) => {
          if (!p.buyer_number) return;

          // 既存のタイマーをキャンセル
          if (leaveTimersRef.current.has(p.buyer_number)) {
            const timer = leaveTimersRef.current.get(p.buyer_number);
            if (timer) clearTimeout(timer);
          }

          // 5秒後に状態を更新
          const timer = setTimeout(() => {
            const delayTimestamp = new Date().toISOString();
            console.log(`[${delayTimestamp}] [useBuyerPresence] ${PRESENCE_PERSIST_DURATION_MS}ms経過、状態更新: ${p.buyer_number}`);
            buildState(); // グローバルステートに保存済み
            leaveTimersRef.current.delete(p.buyer_number);
          }, PRESENCE_PERSIST_DURATION_MS);

          leaveTimersRef.current.set(p.buyer_number, timer);
          console.log(`[${timestamp}] [useBuyerPresence] leaveタイマー設定: ${p.buyer_number} (${PRESENCE_PERSIST_DURATION_MS}ms後)`);
        });
      })
      .subscribe((status) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useBuyerPresence] subscribe status:`, status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          buildState(); // グローバルステートに保存済み
        }
      });

    return () => {
      console.log('[useBuyerPresence] subscribe: チャンネル削除');

      // 全てのleaveタイマーをキャンセル
      leaveTimersRef.current.forEach((timer) => clearTimeout(timer));
      leaveTimersRef.current.clear();

      // BroadcastChannelをクローズ
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }

      supabase.removeChannel(channel);
    };
  }, []);

  return { presenceState, isConnected };
}

// ============================================================
// フック: 発信専用（買主詳細ページ用）
// ============================================================

export function useBuyerPresenceTrack(
  buyerNumber: string | undefined
): UseBuyerPresenceTrackResult {
  const { employee } = useAuthStore();
  const addPresence = useBuyerPresenceStore((state) => state.addPresence);
  const removePresence = useBuyerPresenceStore((state) => state.removePresence);
  const [isTracking, setIsTracking] = useState(false);
  const trackedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const untrackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const MAX_RETRIES = 5;

  useEffect(() => {
    const timestamp = new Date().toISOString();
    // イニシャルを優先的に使用（employee.initialsがない場合はemployee.nameにフォールバック）
    const userInitials = employee?.initials || employee?.name;
    const employeeId = employee?.employee_number || employee?.email; // ユーザーを一意に識別
    console.log(`[${timestamp}] [useBuyerPresence] track useEffect実行: buyerNumber=`, buyerNumber, 'employee.initials=', employee?.initials, 'employee.name=', employee?.name, 'employeeId=', employeeId, 'userInitials=', userInitials);

    if (!buyerNumber || !userInitials) {
      console.log(`[${timestamp}] [useBuyerPresence] track スキップ: buyerNumber=`, buyerNumber, 'userInitials=', userInitials);
      return;
    }

    const userName = userInitials;
    console.log(`[${timestamp}] [useBuyerPresence] track userName=`, userName);

    // BroadcastChannelを作成
    try {
      broadcastChannelRef.current = new BroadcastChannel(BUYER_BROADCAST_CHANNEL_NAME);
      console.log('[useBuyerPresence] track: BroadcastChannel作成成功');
    } catch (e) {
      console.warn('[useBuyerPresence] track: BroadcastChannel作成失敗（古いブラウザ）', e);
    }

    const connect = () => {
      // 既存チャンネルをクリーンアップ
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [useBuyerPresence] track 開始: buyerNumber=`, buyerNumber, 'user=', userName, 'retry=', retryCountRef.current);

      const channel = supabase.channel(BUYER_CHANNEL_NAME, {
        config: { presence: { key: undefined } },
      });
      channelRef.current = channel;
      trackedRef.current = false;

      channel.subscribe(async (status) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useBuyerPresence] track channel status:`, status);

        if (status === 'SUBSCRIBED' && !trackedRef.current) {
          retryCountRef.current = 0;
          try {
            const presenceData = {
              buyer_number: buyerNumber,
              user_name: userName,
              entered_at: new Date().toISOString(),
            };

            const result = await channel.track(presenceData);
            const trackTimestamp = new Date().toISOString();
            console.log(`[${trackTimestamp}] [useBuyerPresence] track 結果:`, result);
            trackedRef.current = true;
            setIsTracking(true);

            // 即座にグローバルステートに追加（同じタブ内で即時反映）
            addPresence(presenceData);
            console.log(`[${trackTimestamp}] [useBuyerPresence] グローバルステート即座更新（track）:`, presenceData);

            // BroadcastChannelで他のタブにも通知
            if (broadcastChannelRef.current) {
              broadcastChannelRef.current.postMessage({
                type: 'track',
                ...presenceData,
              });
              console.log(`[${trackTimestamp}] [useBuyerPresence] BroadcastChannel送信（track）:`, presenceData);
            }
          } catch (e) {
            console.error(`[${timestamp}] [useBuyerPresence] track エラー:`, e);
          }
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          retryCountRef.current += 1;
          if (retryCountRef.current <= MAX_RETRIES) {
            // 最初のリトライは即座に、その後は指数バックオフ
            const delay = retryCountRef.current === 1 ? 0 : Math.min(500 * Math.pow(2, retryCountRef.current - 2), 10000);
            console.log(`[${timestamp}] [useBuyerPresence] track リトライ予定:`, retryCountRef.current, '/', MAX_RETRIES, 'delay=', delay, 'ms');
            retryTimerRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.warn(`[${timestamp}] [useBuyerPresence] track リトライ上限に達しました`);
          }
        }
      });
    };

    connect();

    return () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [useBuyerPresence] track: クリーンアップ開始（即座にuntrack）`);

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

      // 即座にグローバルステートから削除
      removePresence(buyerNumber, userName);
      console.log(`[${timestamp}] [useBuyerPresence] track: グローバルステートから即座削除: ${buyerNumber} - ${userName}`);

      // BroadcastChannelで他のタブにも通知
      if (broadcastChannelRef.current && trackedRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'untrack',
          buyer_number: buyerNumber,
          user_name: userName,
        });
        console.log(`[${timestamp}] [useBuyerPresence] BroadcastChannel送信（untrack）:`, { buyerNumber, userName });
      }

      // Supabase Realtimeからも即座にuntrack
      if (channelRef.current && trackedRef.current) {
        const channelToUntrack = channelRef.current;
        console.log(`[${timestamp}] [useBuyerPresence] track: Supabase untrack即座実行`);
        channelToUntrack.untrack();
        supabase.removeChannel(channelToUntrack);
      } else if (channelRef.current) {
        // trackしていない場合は即座に削除
        supabase.removeChannel(channelRef.current);
      }

      // BroadcastChannelをクローズ
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }

      channelRef.current = null;
      trackedRef.current = false;
      retryCountRef.current = 0;
      setIsTracking(false);
    };
  }, [buyerNumber, employee?.initials, employee?.name, employee?.employee_number, employee?.email, addPresence, removePresence]);

  return { isTracking };
}
