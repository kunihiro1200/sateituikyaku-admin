/**
 * 買主サイドバー「内覧済み」「担当」カテゴリフィルタ不具合 - バグ条件探索テスト
 * 
 * Property 1: Bug Condition - 基本カテゴリのステータス判定
 * 
 * 目的: 修正前のコードでバグを再現し、修正後のコードで正しい動作を検証する
 * 
 * 期待される結果（修正前）: テストがFAILする（バグの存在を証明）
 * 期待される結果（修正後）: テストがPASSする（バグが修正されたことを確認）
 */

import { calculateBuyerStatus, BuyerData } from '../services/BuyerStatusCalculator';

describe('Bug Condition Exploration Tests - 基本カテゴリのステータス判定', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const pastDate = new Date('2026-04-03');

  describe('Priority 36: 内覧済み(イニシャル)', () => {
    it('買主7282: viewing_date = 2026-04-03（過去）、follow_up_assignee = "Y" → 「内覧済み(Y)」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: '7282',
        name: 'テスト買主7282',
        viewing_date: pastDate.toISOString(),
        follow_up_assignee: 'Y',
      };

      const result = calculateBuyerStatus(buyer);

      // 修正後: 「内覧済み(Y)」を返す
      expect(result.status).toBe('内覧済み(Y)');
      expect(result.priority).toBe(36);
    });

    it('買主5641: viewing_date = 2026-04-01（過去）、follow_up_assignee = "林" → 「内覧済み(林)」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: '5641',
        name: 'テスト買主5641',
        viewing_date: '2026-04-01', // 明確に過去の日付に変更
        follow_up_assignee: '林',
      };

      const result = calculateBuyerStatus(buyer);

      // 修正後: 「内覧済み(林)」を返す
      expect(result.status).toBe('内覧済み(林)');
      expect(result.priority).toBe(36);
    });
  });

  describe('Priority 37: 担当(イニシャル)', () => {
    it('買主1234: viewing_date = NULL、follow_up_assignee = "Y" → 「担当(Y)」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: '1234',
        name: 'テスト買主1234',
        viewing_date: null,
        follow_up_assignee: 'Y',
      };

      const result = calculateBuyerStatus(buyer);

      // 修正後: 「担当(Y)」を返す
      expect(result.status).toBe('担当(Y)');
      expect(result.priority).toBe(37);
    });

    it('follow_up_assignee = "林"、viewing_date = NULL → 「担当(林)」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: '5678',
        name: 'テスト買主5678',
        viewing_date: null,
        follow_up_assignee: '林',
      };

      const result = calculateBuyerStatus(buyer);

      // 修正後: 「担当(林)」を返す
      expect(result.status).toBe('担当(林)');
      expect(result.priority).toBe(37);
    });
  });

  describe('Priority 38: 内覧済み', () => {
    it('viewing_date = 2026-04-03（過去）、follow_up_assignee = NULL → 「内覧済み」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: '9999',
        name: 'テスト買主9999',
        viewing_date: pastDate.toISOString(),
        follow_up_assignee: null,
      };

      const result = calculateBuyerStatus(buyer);

      // 修正後: 「内覧済み」を返す
      expect(result.status).toBe('内覧済み');
      expect(result.priority).toBe(38);
    });
  });

  describe('エッジケース', () => {
    it('viewing_date = 未来、follow_up_assignee = "Y" → 「担当(Y)」を返す', () => {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 10);

      const buyer: BuyerData = {
        buyer_number: '1111',
        name: 'テスト買主1111',
        viewing_date: futureDate.toISOString(),
        follow_up_assignee: 'Y',
      };

      const result = calculateBuyerStatus(buyer);

      // 内覧日が未来の場合は「担当(Y)」を返す
      expect(result.status).toBe('担当(Y)');
      expect(result.priority).toBe(37);
    });

    it('viewing_date = NULL、follow_up_assignee = NULL → 空文字列を返す', () => {
      const buyer: BuyerData = {
        buyer_number: '2222',
        name: 'テスト買主2222',
        viewing_date: null,
        follow_up_assignee: null,
      };

      const result = calculateBuyerStatus(buyer);

      // どの条件にも該当しない場合は空文字列を返す
      expect(result.status).toBe('');
      expect(result.priority).toBe(0);
    });
  });

  describe('優先度の確認', () => {
    it('Priority 36（内覧済み(Y)）がPriority 37（担当(Y)）より優先される', () => {
      const buyer: BuyerData = {
        buyer_number: '3333',
        name: 'テスト買主3333',
        viewing_date: pastDate.toISOString(),
        follow_up_assignee: 'Y',
      };

      const result = calculateBuyerStatus(buyer);

      // 内覧日が過去 かつ 担当者あり → Priority 36が優先
      expect(result.status).toBe('内覧済み(Y)');
      expect(result.priority).toBe(36);
    });
  });
});
