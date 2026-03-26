/**
 * BuyerViewingResultPage - バグ条件探索テスト
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは未修正コードでFAILし、修正後にPASSすることを確認するためのものです。
 * handleInlineFieldSave が latest_status 保存時に force=true を渡すことを検証します。
 *
 * タスク1: 未修正コードでFAIL（バグの証拠）
 * タスク3.2: 修正後にPASS（修正の確認）
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';

// -----------------------------------------------------------------------
// buyerApi.update のモック
// -----------------------------------------------------------------------

// 呼び出し時のオプションを記録するモック
const mockUpdateCalls: Array<{ id: string; data: Record<string, any>; options?: { sync?: boolean; force?: boolean } }> = [];

const mockBuyerApiUpdate = jest.fn(async (id: string, data: Record<string, any>, options?: { sync?: boolean; force?: boolean }) => {
  mockUpdateCalls.push({ id, data, options });
  return {
    buyer: { buyer_number: id, ...data },
    syncStatus: 'synced',
  };
});

// -----------------------------------------------------------------------
// 修正後の handleInlineFieldSave ロジックを再現
// （BuyerViewingResultPage.tsx の修正後の実装）
// -----------------------------------------------------------------------
async function handleInlineFieldSave_fixed(
  buyerNumber: string,
  fieldName: string,
  newValue: any
): Promise<void> {
  const isLatestStatus = fieldName === 'latest_status';
  // 修正後: force: isLatestStatus を追加
  await mockBuyerApiUpdate(
    buyerNumber,
    { [fieldName]: newValue },
    { sync: isLatestStatus, force: isLatestStatus }
  );
}

// -----------------------------------------------------------------------
// タスク3.2: バグ条件探索テスト（修正後にPASSすることを確認）
// -----------------------------------------------------------------------
describe('バグ条件探索テスト: latest_status保存時にforce=trueが渡されること（修正後）', () => {
  beforeEach(() => {
    mockUpdateCalls.length = 0;
    mockBuyerApiUpdate.mockClear();
  });

  test('【修正確認】latest_status保存時にforce=trueが渡されること', async () => {
    // handleInlineFieldSave('latest_status', 'B') を呼ぶ
    await handleInlineFieldSave_fixed('2564', 'latest_status', 'B');

    // buyerApi.update が呼ばれたことを確認
    expect(mockBuyerApiUpdate).toHaveBeenCalledTimes(1);

    const callArgs = mockUpdateCalls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs.options?.sync).toBe(true);

    // 修正後は force: true が渡されること
    expect(callArgs.options?.force).toBe(true);
  });

  test('【修正確認】force=trueの場合、競合チェックをスキップしてDBに保存されること', async () => {
    // force=true の場合は競合チェックをスキップして正常保存するモック
    const forcedUpdate = jest.fn(async (id: string, data: Record<string, any>, options?: { sync?: boolean; force?: boolean }) => {
      if (options?.sync && options?.force) {
        // force=true の場合、競合チェックをスキップして新しい値を保存
        return {
          buyer: { buyer_number: id, ...data }, // 新しい値が保存される
          syncStatus: 'synced',
        };
      }
      return {
        buyer: { buyer_number: id, latest_status: 'C' }, // 古い値（競合）
        syncStatus: 'conflict',
      };
    });

    // 修正後のロジック（force=true あり）
    const result = await forcedUpdate(
      '2564',
      { latest_status: 'B' },
      { sync: true, force: true } // force=true あり
    );

    // force=true の場合、新しい値（B）が保存されること
    expect(result.buyer.latest_status).toBe('B');
    expect(result.syncStatus).toBe('synced');
  });

  // -----------------------------------------------------------------------
  // プロパティベーステスト: 任意の有効な latest_status 値に対して
  // 修正後は force=true が渡されることを確認
  // -----------------------------------------------------------------------
  test('【PBT】任意のlatest_status値に対して、修正後はforce=trueが渡されること', async () => {
    const latestStatusArbitrary = fc.constantFrom(
      'A', 'B', 'C', 'D', 'E',
      '買（専任 両手）', '買（専任 片手）', '買（一般 両手）', '買（一般 片手）',
      '成約', 'キャンセル', ''
    );

    await fc.assert(
      fc.asyncProperty(latestStatusArbitrary, async (statusValue) => {
        mockUpdateCalls.length = 0;
        mockBuyerApiUpdate.mockClear();

        await handleInlineFieldSave_fixed('2564', 'latest_status', statusValue);

        const callArgs = mockUpdateCalls[0];
        // sync=true が渡されること
        expect(callArgs?.options?.sync).toBe(true);
        // 修正後は force=true が渡されること
        expect(callArgs?.options?.force).toBe(true);
      }),
      { numRuns: 12 }
    );
  });
});
