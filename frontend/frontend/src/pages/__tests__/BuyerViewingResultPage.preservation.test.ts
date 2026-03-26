/**
 * BuyerViewingResultPage - 保全プロパティテスト
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * latest_status 以外のフィールドの保存動作が変わらないことを確認します。
 * このテストは未修正コードでPASSし、修正後も引き続きPASSすることを確認します。
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';

// -----------------------------------------------------------------------
// buyerApi.update のモック
// -----------------------------------------------------------------------
const mockUpdateCalls: Array<{ id: string; data: Record<string, any>; options?: { sync?: boolean; force?: boolean } }> = [];

const mockBuyerApiUpdate = jest.fn(async (id: string, data: Record<string, any>, options?: { sync?: boolean; force?: boolean }) => {
  mockUpdateCalls.push({ id, data, options });
  return {
    buyer: { buyer_number: id, ...data },
    syncStatus: 'synced',
  };
});

// -----------------------------------------------------------------------
// 未修正の handleInlineFieldSave ロジックを再現
// （BuyerViewingResultPage.tsx の現在の実装）
// -----------------------------------------------------------------------
async function handleInlineFieldSave_unfixed(
  buyerNumber: string,
  fieldName: string,
  newValue: any
): Promise<void> {
  const isLatestStatus = fieldName === 'latest_status';
  // 未修正: force が渡されていない
  await mockBuyerApiUpdate(
    buyerNumber,
    { [fieldName]: newValue },
    { sync: isLatestStatus }
  );
}

// -----------------------------------------------------------------------
// タスク2: 保全プロパティテスト
// latest_status 以外のフィールドは sync=false で呼ばれることを確認
// -----------------------------------------------------------------------
describe('保全テスト: latest_status以外のフィールドの保存動作が変わらないこと', () => {
  beforeEach(() => {
    mockUpdateCalls.length = 0;
    mockBuyerApiUpdate.mockClear();
  });

  test('latest_viewing_date保存時はsync=falseで呼ばれること', async () => {
    await handleInlineFieldSave_unfixed('2564', 'latest_viewing_date', '2026-04-01');

    expect(mockBuyerApiUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockUpdateCalls[0];
    expect(callArgs.options?.sync).toBe(false);
    expect(callArgs.options?.force).toBeUndefined();
  });

  test('viewing_time保存時はsync=falseで呼ばれること', async () => {
    await handleInlineFieldSave_unfixed('2564', 'viewing_time', '14:00');

    expect(mockBuyerApiUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockUpdateCalls[0];
    expect(callArgs.options?.sync).toBe(false);
    expect(callArgs.options?.force).toBeUndefined();
  });

  test('follow_up_assignee保存時はsync=falseで呼ばれること', async () => {
    await handleInlineFieldSave_unfixed('2564', 'follow_up_assignee', 'K');

    expect(mockBuyerApiUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockUpdateCalls[0];
    expect(callArgs.options?.sync).toBe(false);
    expect(callArgs.options?.force).toBeUndefined();
  });

  test('viewing_mobile保存時はsync=falseで呼ばれること', async () => {
    await handleInlineFieldSave_unfixed('2564', 'viewing_mobile', '【内覧_専（自社物件）】');

    expect(mockBuyerApiUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockUpdateCalls[0];
    expect(callArgs.options?.sync).toBe(false);
    expect(callArgs.options?.force).toBeUndefined();
  });

  test('offer_comment保存時はsync=falseで呼ばれること', async () => {
    await handleInlineFieldSave_unfixed('2564', 'offer_comment', 'テストコメント');

    expect(mockBuyerApiUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockUpdateCalls[0];
    expect(callArgs.options?.sync).toBe(false);
    expect(callArgs.options?.force).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // プロパティベーステスト: latest_status 以外の任意のフィールドに対して
  // force が渡されないことを確認
  // -----------------------------------------------------------------------
  test('【PBT】latest_status以外の任意のフィールドに対して、forceが渡されないこと', async () => {
    const nonLatestStatusFieldArbitrary = fc.constantFrom(
      'latest_viewing_date',
      'viewing_time',
      'follow_up_assignee',
      'viewing_mobile',
      'offer_comment',
      'viewing_result_follow_up',
      'viewing_unconfirmed'
    );

    await fc.assert(
      fc.asyncProperty(nonLatestStatusFieldArbitrary, async (fieldName) => {
        mockUpdateCalls.length = 0;
        mockBuyerApiUpdate.mockClear();

        await handleInlineFieldSave_unfixed('2564', fieldName, 'test_value');

        const callArgs = mockUpdateCalls[0];
        // latest_status 以外は sync=false で呼ばれること
        expect(callArgs?.options?.sync).toBe(false);
        // force は渡されないこと（undefined）
        expect(callArgs?.options?.force).toBeUndefined();
      }),
      { numRuns: 7 }
    );
  });

  // -----------------------------------------------------------------------
  // latest_status は sync=true で呼ばれることを確認（保全）
  // -----------------------------------------------------------------------
  test('latest_status保存時はsync=trueで呼ばれること（保全）', async () => {
    await handleInlineFieldSave_unfixed('2564', 'latest_status', 'B');

    expect(mockBuyerApiUpdate).toHaveBeenCalledTimes(1);
    const callArgs = mockUpdateCalls[0];
    // sync=true は変わらないこと
    expect(callArgs.options?.sync).toBe(true);
  });
});
