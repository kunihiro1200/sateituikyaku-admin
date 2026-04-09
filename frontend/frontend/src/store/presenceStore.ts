import { create } from 'zustand';
import { PresenceRecord, PresenceState } from '../hooks/useSellerPresence';

interface PresenceStoreState {
  presenceState: PresenceState;
  addPresence: (record: PresenceRecord) => void;
  removePresence: (sellerNumber: string, userName: string) => void;
  clearPresence: (sellerNumber: string) => void;
}

export const usePresenceStore = create<PresenceStoreState>((set) => ({
  presenceState: {},
  
  addPresence: (record: PresenceRecord) => {
    set((state) => {
      const newState = { ...state.presenceState };
      const sellerNumber = record.seller_number;
      
      if (!newState[sellerNumber]) {
        newState[sellerNumber] = [];
      }
      
      // 既存のレコードを削除（同じユーザーの重複を防ぐ）
      newState[sellerNumber] = newState[sellerNumber].filter(
        (r) => r.user_name !== record.user_name
      );
      
      // 新しいレコードを追加
      newState[sellerNumber].push(record);
      
      console.log('[presenceStore] addPresence:', newState);
      return { presenceState: newState };
    });
  },
  
  removePresence: (sellerNumber: string, userName: string) => {
    set((state) => {
      const newState = { ...state.presenceState };
      
      if (newState[sellerNumber]) {
        newState[sellerNumber] = newState[sellerNumber].filter(
          (r) => r.user_name !== userName
        );
        
        if (newState[sellerNumber].length === 0) {
          delete newState[sellerNumber];
        }
      }
      
      console.log('[presenceStore] removePresence:', newState);
      return { presenceState: newState };
    });
  },
  
  clearPresence: (sellerNumber: string) => {
    set((state) => {
      const newState = { ...state.presenceState };
      delete newState[sellerNumber];
      
      console.log('[presenceStore] clearPresence:', newState);
      return { presenceState: newState };
    });
  },
}));
