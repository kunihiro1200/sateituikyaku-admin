import { useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { usePresenceStore } from '../store/presenceStore';

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
export const BROADCAST_CHANNEL_NAME = 'seller-presence-local'; // ローカル通信用
export const CUSTOM_EVENT_NAME = 'seller-presence-update'; // 同じタブ内通信用

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
  const [isConnected, setIsConnected] = useState(false);
  const leaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  
  // グローバルステートから取得
  const presenceState = usePresenceStore((state) => state.presenceState);
  const addPresence = usePresenceStore((state) => state.addPresence);
  const removePresence = usePresenceStore((state) => state.removePresence);
  const clearAllPresence = usePresenceStore((state) => state.clearAllPresence);

  useEffect(() => {
    console.log('[useSellerPresence] subscribe: チャンネル作成');

    // BroadcastChannelを作成（同じブラウザ内のタブ間通信用）
    try {
      broadcastChannelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      console.log('[useSellerPresence] subscribe: BroadcastChannel作成成功');
    } catch (e) {
      console.warn('[useSellerPresence] subscribe: BroadcastChannel作成失敗（古いブラウザ）', e);
    }

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: undefined } },
    });

    const buildState = () => {
      const raw = channel.presenceState<PresenceRecord>();
      const mapped: PresenceState = {};
      const now = Date.now();
      
      for (const presences of Object.values(raw)) {
        for (const p of presences as unknown as PresenceRecord[]) {
          if (!p.seller_number) continue;
          
          // 30分以上古いプレゼンス情報は除外
          const enteredAt = new Date(p.entered_at).getTime();
          if (now - enteredAt >= STALE_THRESHOLD_MS) {
            console.log(`[useSellerPresence] subscribe: 古いプレゼンス情報を除外: ${p.seller_number} - ${p.user_name} (${Math.floor((now - enteredAt) / 60000)}分前)`);
            continue;
          }
          
          if (!mapped[p.seller_number]) mapped[p.seller_number] = [];
          mapped[p.seller_number].push(p);
        }
      }
      console.log('[useSellerPresence] subscribe state:', mapped);
      
      // グローバルステートをクリアしてから再構築（古いデータを削除）
      clearAllPresence();
      
      // グローバルステートに保存
      for (const [sellerNumber, records] of Object.entries(mapped)) {
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
        console.log(`[${timestamp}] [useSellerPresence] BroadcastChannel受信:`, event.data);
        
        if (event.data.type === 'track') {
          // 即座にグローバルステートに追加
          addPresence({
            seller_number: event.data.seller_number,
            user_name: event.data.user_name,
            entered_at: event.data.entered_at,
          });
          console.log(`[${timestamp}] [useSellerPresence] BroadcastChannel ローカルステート即座更新`);
        } else if (event.data.type === 'untrack') {
          // 5秒後に削除（leaveタイマーと同じロジック）
          const sellerNumber = event.data.seller_number;
          const userName = event.data.user_name;
          
          // 既存のタイマーをキャンセル
          const timerKey = `${sellerNumber}-${userName}`;
          if (leaveTimersRef.current.has(timerKey)) {
            const timer = leaveTimersRef.current.get(timerKey);
            if (timer) clearTimeout(timer);
          }
          
          // 5秒後に削除
          const timer = setTimeout(() => {
            const delayTimestamp = new Date().toISOString();
            console.log(`[${delayTimestamp}] [useSellerPresence] BroadcastChannel untrack: ${PRESENCE_PERSIST_DURATION_MS}ms経過、削除: ${sellerNumber} - ${userName}`);
            removePresence(sellerNumber, userName);
            leaveTimersRef.current.delete(timerKey);
          }, PRESENCE_PERSIST_DURATION_MS);
          
          leaveTimersRef.current.set(timerKey, timer);
          console.log(`[${timestamp}] [useSellerPresence] BroadcastChannel untrackタイマー設定: ${timerKey} (${PRESENCE_PERSIST_DURATION_MS}ms後)`);
        }
      };
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [useSellerPresence] presence sync`);
        buildState(); // グローバルステートに保存済み
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
        
        buildState(); // グローバルステートに保存済み
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
            buildState(); // グローバルステートに保存済み
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
          buildState(); // グローバルステートに保存済み
        }
      });

    return () => {
      console.log('[useSellerPresence] subscribe: チャンネル削除');
      
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
// フック: 発信専用（CallModePage用）
// ============================================================

export function useSellerPresenceTrack(
  sellerNumber: string | undefined
): UseSellerPresenceTrackResult {
  const { employee } = useAuthStore();
  const addPresence = usePresenceStore((state) => state.addPresence);
  const removePresence = usePresenceStore((state) => state.removePresence);
  const [isTracking, setIsTracking] = useState(false);
  const trackedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const untrackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 5秒遅延用タイマー
  const retryCountRef = useRef(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const MAX_RETRIES = 5;

  useEffect(() => {
    const timestamp = new Date().toISOString();
    // イニシャルを優先的に使用（employee.initialsがない場合はemployee.nameにフォールバック）
    const userInitials = employee?.initials || employee?.name;
    const employeeId = employee?.employee_number || employee?.email; // ユーザーを一意に識別
    console.log(`[${timestamp}] [useSellerPresence] track useEffect実行: sellerNumber=`, sellerNumber, 'employee.initials=', employee?.initials, 'employee.name=', employee?.name, 'employeeId=', employeeId, 'userInitials=', userInitials);
    
    if (!sellerNumber || !userInitials) {
      console.log(`[${timestamp}] [useSellerPresence] track スキップ: sellerNumber=`, sellerNumber, 'userInitials=', userInitials);
      return;
    }

    const userName = userInitials;
    console.log(`[${timestamp}] [useSellerPresence] track userName=`, userName);

    // BroadcastChannelを作成
    try {
      broadcastChannelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      console.log('[useSellerPresence] track: BroadcastChannel作成成功');
    } catch (e) {
      console.warn('[useSellerPresence] track: BroadcastChannel作成失敗（古いブラウザ）', e);
    }

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
            const presenceData = {
              seller_number: sellerNumber,
              user_name: userName,
              entered_at: new Date().toISOString(),
            };
            
            const result = await channel.track(presenceData);
            const trackTimestamp = new Date().toISOString();
            console.log(`[${trackTimestamp}] [useSellerPresence] track 結果:`, result);
            trackedRef.current = true;
            setIsTracking(true);
            
            // 即座にグローバルステートに追加（同じタブ内で即時反映）
            addPresence(presenceData);
            console.log(`[${trackTimestamp}] [useSellerPresence] グローバルステート即座更新（track）:`, presenceData);
            
            // BroadcastChannelで他のタブにも通知
            if (broadcastChannelRef.current) {
              broadcastChannelRef.current.postMessage({
                type: 'track',
                ...presenceData,
              });
              console.log(`[${trackTimestamp}] [useSellerPresence] BroadcastChannel送信（track）:`, presenceData);
            }
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
      
      // 5秒後にグローバルステートから削除（同じタブ内で即時反映）
      untrackTimerRef.current = setTimeout(() => {
        const delayTimestamp = new Date().toISOString();
        console.log(`[${delayTimestamp}] [useSellerPresence] track: 5秒経過、グローバルステートから削除: ${sellerNumber} - ${userName}`);
        removePresence(sellerNumber, userName);
      }, PRESENCE_PERSIST_DURATION_MS);
      
      console.log(`[${timestamp}] [useSellerPresence] track: グローバルステート削除タイマー設定（${PRESENCE_PERSIST_DURATION_MS}ms後）`);
      
      // BroadcastChannelで他のタブにも通知
      if (broadcastChannelRef.current && trackedRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'untrack',
          seller_number: sellerNumber,
          user_name: userName,
        });
        console.log(`[${timestamp}] [useSellerPresence] BroadcastChannel送信（untrack）:`, { sellerNumber, userName });
      }
      
      // 5秒後にSupabase Realtimeからもuntrack
      if (channelRef.current && trackedRef.current) {
        const channelToUntrack = channelRef.current;
        setTimeout(() => {
          const untrackTimestamp = new Date().toISOString();
          console.log(`[${untrackTimestamp}] [useSellerPresence] track: 5秒経過、Supabase untrack実行`);
          channelToUntrack.untrack();
          supabase.removeChannel(channelToUntrack);
        }, PRESENCE_PERSIST_DURATION_MS);
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
  }, [sellerNumber, employee?.initials, employee?.name, employee?.employee_number, employee?.email, addPresence, removePresence]);

  return { isTracking };
}
