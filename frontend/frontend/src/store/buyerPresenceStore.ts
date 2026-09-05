import { create } from 'zustand';
import { BuyerPresenceRecord, BuyerPresenceState } from '../hooks/useBuyerPresence';

interface BuyerPresenceStoreState {
  presenceState: BuyerPresenceState;
  addPresence: (record: BuyerPresenceRecord) => void;
  removePresence: (buyerNumber: string, userName: string) => void;
  clearPresence: (buyerNumber: string) => void;
  clearAllPresence: () => void; // 全てのプレゼンス情報をクリア
}

export const useBuyerPresenceStore = create<BuyerPresenceStoreState>((set) => ({
  presenceState: {},

  addPresence: (record: BuyerPresenceRecord) => {
    set((state) => {
      const newState = { ...state.presenceState };
      const buyerNumber = record.buyer_number;

      if (!newState[buyerNumber]) {
        newState[buyerNumber] = [];
      }

      // 既存のレコードを削除（同じユーザーの重複を防ぐ）
      newState[buyerNumber] = newState[buyerNumber].filter(
        (r) => r.user_name !== record.user_name
      );

      // 新しいレコードを追加
      newState[buyerNumber].push(record);

      console.log('[buyerPresenceStore] addPresence:', newState);
      return { presenceState: newState };
    });
  },

  removePresence: (buyerNumber: string, userName: string) => {
    set((state) => {
      const newState = { ...state.presenceState };

      if (newState[buyerNumber]) {
        newState[buyerNumber] = newState[buyerNumber].filter(
          (r) => r.user_name !== userName
        );

        if (newState[buyerNumber].length === 0) {
          delete newState[buyerNumber];
        }
      }

      console.log('[buyerPresenceStore] removePresence:', newState);
      return { presenceState: newState };
    });
  },

  clearPresence: (buyerNumber: string) => {
    set((state) => {
      const newState = { ...state.presenceState };
      delete newState[buyerNumber];

      console.log('[buyerPresenceStore] clearPresence:', newState);
      return { presenceState: newState };
    });
  },

  clearAllPresence: () => {
    console.log('[buyerPresenceStore] clearAllPresence');
    set({ presenceState: {} });
  },
}));
