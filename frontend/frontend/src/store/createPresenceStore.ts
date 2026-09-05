import { create, StoreApi, UseBoundStore } from 'zustand';

// ============================================================
// 汎用プレゼンスストア
// 「誰が今この項目を開いているか」をリアルタイムに保持する。
// キー（itemKey）は物件番号・業務依頼の物件番号・共有ID等、
// 対象ごとに異なるが、構造は共通なのでファクトリで生成する。
// ============================================================

export interface GenericPresenceRecord {
  item_key: string;
  user_name: string;
  entered_at: string; // ISO 8601
}

export type GenericPresenceState = Record<string, GenericPresenceRecord[]>;

export interface PresenceStoreState {
  presenceState: GenericPresenceState;
  addPresence: (record: GenericPresenceRecord) => void;
  removePresence: (itemKey: string, userName: string) => void;
  clearPresence: (itemKey: string) => void;
  clearAllPresence: () => void;
}

/**
 * 対象ごとに独立したプレゼンスストアを生成するファクトリ。
 * @param label ログ出力用のラベル（例: 'propertyPresenceStore'）
 */
export function createPresenceStore(
  label: string
): UseBoundStore<StoreApi<PresenceStoreState>> {
  return create<PresenceStoreState>((set) => ({
    presenceState: {},

    addPresence: (record: GenericPresenceRecord) => {
      set((state) => {
        const newState = { ...state.presenceState };
        const key = record.item_key;

        if (!newState[key]) {
          newState[key] = [];
        }

        // 同じユーザーの重複を防ぐ
        newState[key] = newState[key].filter((r) => r.user_name !== record.user_name);
        newState[key].push(record);

        return { presenceState: newState };
      });
    },

    removePresence: (itemKey: string, userName: string) => {
      set((state) => {
        const newState = { ...state.presenceState };

        if (newState[itemKey]) {
          newState[itemKey] = newState[itemKey].filter((r) => r.user_name !== userName);
          if (newState[itemKey].length === 0) {
            delete newState[itemKey];
          }
        }

        return { presenceState: newState };
      });
    },

    clearPresence: (itemKey: string) => {
      set((state) => {
        const newState = { ...state.presenceState };
        delete newState[itemKey];
        return { presenceState: newState };
      });
    },

    clearAllPresence: () => {
      set({ presenceState: {} });
    },
  }));
}
