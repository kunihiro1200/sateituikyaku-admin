/**
 * 買主スプレッドシート削除同期バグ 探索テスト
 *
 * バグ: スプレッドシートに存在しない買主がDBからハードデリートされるべきところ、
 *       ソフトデリート（deleted_at設定）されている。
 *
 * 修正: executeBuyerSoftDelete() の .update({ deleted_at: ... }) を
 *       .delete() に変更する。
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ============================================================
// バグのあるロジックを再現するヘルパー
// ============================================================

type DeleteResult = { success: boolean; method: 'soft' | 'hard'; error?: string };

/**
 * 修正前: ソフトデリート（deleted_atを設定）
 */
async function buggyExecuteBuyerDelete(
  buyerNumber: string,
  supabase: any
): Promise<DeleteResult> {
  // バグ: .update({ deleted_at: ... }) でソフトデリートしている
  const { error } = await supabase
    .from('buyers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('buyer_number', buyerNumber);

  if (error) return { success: false, method: 'soft', error: error.message };
  return { success: true, method: 'soft' };
}

/**
 * 修正後: ハードデリート（物理削除）
 */
async function fixedExecuteBuyerDelete(
  buyerNumber: string,
  supabase: any
): Promise<DeleteResult> {
  // 修正: .delete() でハードデリートする
  const { error } = await supabase
    .from('buyers')
    .delete()
    .eq('buyer_number', buyerNumber);

  if (error) return { success: false, method: 'hard', error: error.message };
  return { success: true, method: 'hard' };
}

// ============================================================
// 安全ガードのロジック（変更なし）
// ============================================================

function checkSafetyGuards(
  sheetBuyerNumbers: Set<string>,
  dbActiveBuyerNumbers: Set<string>,
  deletionTargets: string[]
): { canDelete: boolean; reason?: string } {
  // 安全ガード1: スプレッドシートが0件の場合はスキップ
  if (sheetBuyerNumbers.size === 0) {
    return { canDelete: false, reason: 'SAFETY_GUARD_1: スプレッドシートが0件' };
  }

  // 安全ガード2: スプレッドシートの買主数がDBの50%未満の場合はスキップ
  const ratio = sheetBuyerNumbers.size / dbActiveBuyerNumbers.size;
  if (ratio < 0.5) {
    return { canDelete: false, reason: `SAFETY_GUARD_2: スプレッドシート比率が${(ratio * 100).toFixed(1)}%（50%未満）` };
  }

  // 安全ガード3: 削除対象がアクティブ買主の10%以上の場合はスキップ
  const deletionRatio = deletionTargets.length / dbActiveBuyerNumbers.size;
  if (deletionRatio >= 0.1) {
    return { canDelete: false, reason: `SAFETY_GUARD_3: 削除対象が${(deletionRatio * 100).toFixed(1)}%（10%以上）` };
  }

  return { canDelete: true };
}

// ============================================================
// テストスイート
// ============================================================

describe('買主スプレッドシート削除同期バグ 探索テスト', () => {

  describe('バグ確認: executeBuyerSoftDelete はソフトデリートを実行する', () => {
    it('【修正前】.update({ deleted_at }) が呼ばれる（ハードデリートではない）', async () => {
      const updateMock = jest.fn().mockReturnValue({ error: null });
      const deleteMock = jest.fn().mockReturnValue({ error: null });

      const eqForUpdate = jest.fn().mockReturnValue({ error: null });
      const eqForDelete = jest.fn().mockReturnValue({ error: null });

      const supabase = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({ eq: eqForUpdate }),
          delete: jest.fn().mockReturnValue({ eq: eqForDelete }),
        }),
      };

      await buggyExecuteBuyerDelete('7205', supabase);

      // 修正前: update が呼ばれる（ソフトデリート）
      expect(supabase.from).toHaveBeenCalledWith('buyers');
      const fromResult = supabase.from.mock.results[0].value;
      expect(fromResult.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      // delete は呼ばれない（バグ）
      expect(fromResult.delete).not.toHaveBeenCalled();
    });

    it('【修正前】ソフトデリート後もレコードはDBに残る（deleted_at が設定されるだけ）', async () => {
      // DBの状態をシミュレート
      const db: Record<string, { buyer_number: string; deleted_at: string | null }> = {
        '7205': { buyer_number: '7205', deleted_at: null },
      };

      const supabase = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockImplementation((data: any) => ({
            eq: jest.fn().mockImplementation((col: string, val: string) => {
              // ソフトデリート: deleted_at を設定するだけでレコードは残る
              if (db[val]) db[val].deleted_at = data.deleted_at;
              return { error: null };
            }),
          })),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((col: string, val: string) => {
              // ハードデリート: レコードを削除
              delete db[val];
              return { error: null };
            }),
          }),
        }),
      };

      await buggyExecuteBuyerDelete('7205', supabase);

      // バグ: レコードがDBに残っている（deleted_at が設定されているだけ）
      expect(db['7205']).toBeDefined();
      expect(db['7205'].deleted_at).not.toBeNull();
    });

    it('【修正後】.delete() が呼ばれる（ハードデリート）', async () => {
      const eqForUpdate = jest.fn().mockReturnValue({ error: null });
      const eqForDelete = jest.fn().mockReturnValue({ error: null });

      const supabase = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({ eq: eqForUpdate }),
          delete: jest.fn().mockReturnValue({ eq: eqForDelete }),
        }),
      };

      await fixedExecuteBuyerDelete('7205', supabase);

      // 修正後: delete が呼ばれる（ハードデリート）
      expect(supabase.from).toHaveBeenCalledWith('buyers');
      const fromResult = supabase.from.mock.results[0].value;
      expect(fromResult.delete).toHaveBeenCalled();
      // update は呼ばれない
      expect(fromResult.update).not.toHaveBeenCalled();
    });

    it('【修正後】ハードデリート後にレコードがDBから消える', async () => {
      const db: Record<string, { buyer_number: string; deleted_at: string | null }> = {
        '7205': { buyer_number: '7205', deleted_at: null },
      };

      const supabase = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockImplementation((data: any) => ({
            eq: jest.fn().mockImplementation((col: string, val: string) => {
              if (db[val]) db[val].deleted_at = data.deleted_at;
              return { error: null };
            }),
          })),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((col: string, val: string) => {
              delete db[val];
              return { error: null };
            }),
          }),
        }),
      };

      await fixedExecuteBuyerDelete('7205', supabase);

      // 修正後: レコードがDBから完全に消える
      expect(db['7205']).toBeUndefined();
    });
  });

  describe('安全ガードの維持確認', () => {
    it('安全ガード1: スプレッドシートが0件の場合は削除をスキップする', () => {
      const sheetBuyers = new Set<string>(); // 0件
      const dbBuyers = new Set(['7200', '7201', '7202', '7203', '7204', '7205']);
      const targets = ['7205'];

      const result = checkSafetyGuards(sheetBuyers, dbBuyers, targets);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('SAFETY_GUARD_1');
    });

    it('安全ガード2: スプレッドシートの買主数がDBの50%未満の場合はスキップする', () => {
      // DBに100件、スプレッドシートに40件（40%）
      const sheetBuyers = new Set(Array.from({ length: 40 }, (_, i) => String(7000 + i)));
      const dbBuyers = new Set(Array.from({ length: 100 }, (_, i) => String(7000 + i)));
      const targets = ['7205'];

      const result = checkSafetyGuards(sheetBuyers, dbBuyers, targets);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('SAFETY_GUARD_2');
    });

    it('安全ガード3: 削除対象がアクティブ買主の10%以上の場合はスキップする', () => {
      // DBに100件、スプレッドシートに90件、削除対象10件（10%）
      const sheetBuyers = new Set(Array.from({ length: 90 }, (_, i) => String(7000 + i)));
      const dbBuyers = new Set(Array.from({ length: 100 }, (_, i) => String(7000 + i)));
      const targets = Array.from({ length: 10 }, (_, i) => String(7090 + i));

      const result = checkSafetyGuards(sheetBuyers, dbBuyers, targets);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('SAFETY_GUARD_3');
    });

    it('安全ガードが全て通過する場合は削除を実行する', () => {
      // DBに100件、スプレッドシートに99件、削除対象1件（1%）
      const sheetBuyers = new Set(Array.from({ length: 99 }, (_, i) => String(7000 + i)));
      const dbBuyers = new Set(Array.from({ length: 100 }, (_, i) => String(7000 + i)));
      const targets = ['7099'];

      const result = checkSafetyGuards(sheetBuyers, dbBuyers, targets);
      expect(result.canDelete).toBe(true);
    });

    it('スプレッドシートに存在する買主は削除対象にならない', () => {
      const sheetBuyers = new Set(['7200', '7201', '7202']);
      const dbBuyers = new Set(['7200', '7201', '7202']);

      // スプレッドシートに存在する買主は削除対象にならない
      const targets: string[] = [];
      for (const buyerNumber of dbBuyers) {
        if (!sheetBuyers.has(buyerNumber)) {
          targets.push(buyerNumber);
        }
      }

      expect(targets).toHaveLength(0);
    });
  });
});
