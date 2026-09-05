import { createPresenceStore } from '../store/createPresenceStore';
import {
  createPresenceSubscribeHook,
  createPresenceTrackHook,
} from './useGenericPresence';

// ============================================================
// 各リスト（物件リスト・業務依頼・共有）用のプレゼンスインスタンス
// 「誰が今この項目を開いて作業しているか」をリアルタイム表示するために使う。
// ============================================================

// --- 物件リスト（キー: 物件番号） ---
const propertyStore = createPresenceStore('propertyPresenceStore');
export const usePropertyListingPresenceSubscribe = createPresenceSubscribeHook({
  channelName: 'property-listing-presence',
  broadcastChannelName: 'property-listing-presence-local',
  store: propertyStore,
  label: 'usePropertyListingPresence',
});
export const usePropertyListingPresenceTrack = createPresenceTrackHook({
  channelName: 'property-listing-presence',
  broadcastChannelName: 'property-listing-presence-local',
  store: propertyStore,
  label: 'usePropertyListingPresence',
});

// --- 業務依頼（キー: 物件番号） ---
const workTaskStore = createPresenceStore('workTaskPresenceStore');
export const useWorkTaskPresenceSubscribe = createPresenceSubscribeHook({
  channelName: 'work-task-presence',
  broadcastChannelName: 'work-task-presence-local',
  store: workTaskStore,
  label: 'useWorkTaskPresence',
});
export const useWorkTaskPresenceTrack = createPresenceTrackHook({
  channelName: 'work-task-presence',
  broadcastChannelName: 'work-task-presence-local',
  store: workTaskStore,
  label: 'useWorkTaskPresence',
});

// --- 共有（キー: 共有ID） ---
const sharedItemStore = createPresenceStore('sharedItemPresenceStore');
export const useSharedItemPresenceSubscribe = createPresenceSubscribeHook({
  channelName: 'shared-item-presence',
  broadcastChannelName: 'shared-item-presence-local',
  store: sharedItemStore,
  label: 'useSharedItemPresence',
});
export const useSharedItemPresenceTrack = createPresenceTrackHook({
  channelName: 'shared-item-presence',
  broadcastChannelName: 'shared-item-presence-local',
  store: sharedItemStore,
  label: 'useSharedItemPresence',
});
