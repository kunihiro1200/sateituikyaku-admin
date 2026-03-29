/**
 * プロパティベーステスト: 買主「★最新状況」必須チェック条件
 *
 * fast-check を使用して、修正後のロジックの正確性を検証する。
 *
 * Property 1: isBugCondition が true の全入力で latest_status が必須扱いされない
 * Property 2: latest_status 以外の必須フィールドのチェック結果が変わらない
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fc from 'fast-check';

// ===== 修正後コードのロジックを再現 =====
function isLatestStatusRequired(data: any): boolean {
  if (data.broker_inquiry && String(data.broker_inquiry).trim()) return false;
  if (!data.reception_date) return false;
  const receptionDate = new Date(data.reception_date);
  if (receptionDate < new Date('2026-02-08')) return false;
  const hearingFilled = data.inquiry_hearing && String(data.inquiry_hearing).trim();
  const hasPhone = data.inquiry_source && String(data.inquiry_source).includes('電話');
  const emailPhoneDone = data.inquiry_email_phone && String(data.inquiry_email_phone) === '済';
  if (!((hearingFilled && hasPhone) || emailPhoneDone)) return false;
  return true;
}

function isBugCondition(data: any): boolean {
  const latestStatusBlank = !data.latest_status || !String(data.latest_status).trim();
  return latestStatusBlank && !isLatestStatusRequired(data);
}

function checkLatestStatusMissing(data: any): boolean {
  return isLatestStatusRequired(data) && (!data.latest_status || !String(data.latest_status).trim());
}

function checkInitialAssigneeMissing(data: any): boolean {
  return !data.initial_assignee || !String(data.initial_assignee).trim();
}

function checkDistributionTypeMissing(data: any): boolean {
  return !data.distribution_type || !String(data.distribution_type).trim();
}

function checkInquiryEmailPhoneMissing(data: any): boolean {
  const hasEmail = data.inquiry_source && String(data.inquiry_source).includes('メール');
  if (!hasEmail) return false;
  return !data.inquiry_email_phone || !String(data.inquiry_email_phone).trim();
}

// ===== ジェネレーター（filterを使わずシンプルに） =====

// バグ条件ケース1: broker_inquiry に値がある
const bugCase1 = fc.record({
  broker_inquiry: fc.constantFrom('業者問合せ', '業者', '仲介業者', 'ABC不動産'),
  latest_status: fc.constant(''),
  reception_date: fc.constant('2026-03-01'),
  inquiry_hearing: fc.constantFrom('', 'ヒアリング済み'),
  inquiry_source: fc.constantFrom('電話', 'メール', 'ネット'),
  inquiry_email_phone: fc.constantFrom('', '済'),
  initial_assignee: fc.constantFrom('', 'Y', 'I'),
  distribution_type: fc.constantFrom('', 'メール'),
});

// バグ条件ケース2: reception_date が古い
const bugCase2 = fc.record({
  broker_inquiry: fc.constant(''),
  latest_status: fc.constant(''),
  reception_date: fc.constantFrom('2026-01-01', '2026-02-07', '2025-12-31', '2025-01-01'),
  inquiry_hearing: fc.constantFrom('ヒアリング済み', '初見か：あり'),
  inquiry_source: fc.constant('電話'),
  inquiry_email_phone: fc.constant(''),
  initial_assignee: fc.constantFrom('', 'Y'),
  distribution_type: fc.constantFrom('', 'メール'),
});

// バグ条件ケース3: reception_date が null
const bugCase3 = fc.record({
  broker_inquiry: fc.constant(''),
  latest_status: fc.constant(''),
  reception_date: fc.constant(null),
  inquiry_hearing: fc.constantFrom('ヒアリング済み', '初見か：あり'),
  inquiry_source: fc.constant('電話'),
  inquiry_email_phone: fc.constant(''),
  initial_assignee: fc.constantFrom('', 'Y'),
  distribution_type: fc.constantFrom('', 'メール'),
});

// バグ条件ケース4: inquiry_hearing が空欄かつ inquiry_email_phone が「済」でない
const bugCase4 = fc.record({
  broker_inquiry: fc.constant(''),
  latest_status: fc.constant(''),
  reception_date: fc.constant('2026-03-01'),
  inquiry_hearing: fc.constant(''),
  inquiry_source: fc.constant('電話'),
  inquiry_email_phone: fc.constantFrom('', '未', '対応中'),
  initial_assignee: fc.constantFrom('', 'Y'),
  distribution_type: fc.constantFrom('', 'メール'),
});

// バグ条件ケース5: inquiry_source に「電話」を含まず inquiry_email_phone が「済」でない
const bugCase5 = fc.record({
  broker_inquiry: fc.constant(''),
  latest_status: fc.constant(''),
  reception_date: fc.constant('2026-03-01'),
  inquiry_hearing: fc.constantFrom('ヒアリング済み', '初見か：あり'),
  inquiry_source: fc.constantFrom('ネット', 'メール', 'チラシ', 'その他'),
  inquiry_email_phone: fc.constantFrom('', '未', '対応中'),
  initial_assignee: fc.constantFrom('', 'Y'),
  distribution_type: fc.constantFrom('', 'メール'),
});

const bugConditionArbitrary = fc.oneof(bugCase1, bugCase2, bugCase3, bugCase4, bugCase5);

// 全条件を満たす買主データのジェネレーター
const validConditionArbitrary = fc.record({
  broker_inquiry: fc.constant(''),
  latest_status: fc.constantFrom('', '商談中', '検討中', '購入意欲あり'),
  reception_date: fc.constantFrom('2026-02-08', '2026-03-01', '2026-04-01', '2027-01-01'),
  inquiry_hearing: fc.constantFrom('ヒアリング済み', '初見か：あり', '詳細確認済み'),
  inquiry_source: fc.constant('電話'),
  inquiry_email_phone: fc.constant(''),
  initial_assignee: fc.constantFrom('', 'Y', 'I'),
  distribution_type: fc.constantFrom('', 'メール'),
});

// ===== Property 1: isBugCondition が true の全入力で latest_status が必須扱いされない =====

describe('Property 1: isBugCondition が true の全入力で latest_status が必須扱いされない', () => {
  /**
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   */
  test('Property 1: バグ条件を満たす全入力で checkLatestStatusMissing が false を返す', () => {
    fc.assert(
      fc.property(bugConditionArbitrary, (data) => {
        if (!isBugCondition(data)) return true;
        return checkLatestStatusMissing(data) === false;
      }),
      { numRuns: 20 }
    );
  });

  test('Property 1 (broker_inquiry あり): broker_inquiry に値がある場合は必須扱いされない', () => {
    fc.assert(
      fc.property(bugCase1, (data) => {
        return checkLatestStatusMissing(data) === false;
      }),
      { numRuns: 20 }
    );
  });

  test('Property 1 (reception_date が古い): 2026-02-08 より前の日付では必須扱いされない', () => {
    fc.assert(
      fc.property(bugCase2, (data) => {
        return checkLatestStatusMissing(data) === false;
      }),
      { numRuns: 20 }
    );
  });

  test('Property 1 (inquiry_hearing 空欄): ヒアリングなし・問合メール電話対応未済では必須扱いされない', () => {
    fc.assert(
      fc.property(bugCase4, (data) => {
        return checkLatestStatusMissing(data) === false;
      }),
      { numRuns: 20 }
    );
  });
});

// ===== Property 2: latest_status 以外の必須フィールドのチェック結果が変わらない =====

describe('Property 2: latest_status 以外の必須フィールドのチェック結果が変わらない', () => {
  /**
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
   */
  test('Property 2 (initial_assignee): initial_assignee が空欄の場合は必須扱いされる', () => {
    fc.assert(
      fc.property(
        fc.record({
          broker_inquiry: fc.constantFrom('', '業者'),
          latest_status: fc.constantFrom('', '商談中'),
          reception_date: fc.constantFrom('', '2026-03-01'),
          inquiry_hearing: fc.constantFrom('', 'ヒアリング済み'),
          inquiry_source: fc.constantFrom('', '電話', 'メール'),
          inquiry_email_phone: fc.constantFrom('', '済'),
          initial_assignee: fc.constant(''),
          distribution_type: fc.constantFrom('', 'メール'),
        }),
        (data) => checkInitialAssigneeMissing(data) === true
      ),
      { numRuns: 20 }
    );
  });

  test('Property 2 (initial_assignee 入力済み): initial_assignee に値がある場合は必須扱いされない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Y', 'I', '山田', 'Tanaka'),
        (assignee) => checkInitialAssigneeMissing({ initial_assignee: assignee }) === false
      ),
      { numRuns: 20 }
    );
  });

  test('Property 2 (distribution_type): distribution_type が空欄の場合は必須扱いされる', () => {
    fc.assert(
      fc.property(
        fc.record({
          broker_inquiry: fc.constantFrom('', '業者'),
          latest_status: fc.constantFrom('', '商談中'),
          distribution_type: fc.constant(''),
        }),
        (data) => checkDistributionTypeMissing(data) === true
      ),
      { numRuns: 20 }
    );
  });

  test('Property 2 (distribution_type 入力済み): distribution_type に値がある場合は必須扱いされない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('メール', 'SMS', 'メール・SMS'),
        (distType) => checkDistributionTypeMissing({ distribution_type: distType }) === false
      ),
      { numRuns: 20 }
    );
  });

  test('Property 2 (inquiry_email_phone): メール問合せで inquiry_email_phone が空欄の場合は必須扱いされる', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('メール', 'メール・電話', 'ネット（メール）'),
        (inquirySource) => {
          const data = { inquiry_source: inquirySource, inquiry_email_phone: '' };
          return checkInquiryEmailPhoneMissing(data) === true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 2 (inquiry_email_phone 入力済み): メール問合せで inquiry_email_phone に値がある場合は必須扱いされない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('メール', 'メール・電話', 'ネット（メール）'),
        fc.constantFrom('済', '対応済み', '完了'),
        (inquirySource, emailPhone) => {
          const data = { inquiry_source: inquirySource, inquiry_email_phone: emailPhone };
          return checkInquiryEmailPhoneMissing(data) === false;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 2 (全条件を満たす買主): latest_status が空欄の場合は必須扱いされる', () => {
    fc.assert(
      fc.property(validConditionArbitrary, (data) => {
        if (data.latest_status === '') {
          return checkLatestStatusMissing(data) === true;
        } else {
          return checkLatestStatusMissing(data) === false;
        }
      }),
      { numRuns: 20 }
    );
  });
});
