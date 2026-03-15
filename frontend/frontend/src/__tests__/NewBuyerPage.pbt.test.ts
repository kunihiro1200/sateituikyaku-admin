/**
 * NewBuyerPage プロパティベーステスト
 *
 * Feature: buyer-agency-inquiry-field
 * テストライブラリ: fast-check
 */

import * as fc from 'fast-check';

// ---- テスト対象のロジックをインライン定義 ----
// NewBuyerPage.tsx の showBrokerInquiry() と同等のロジック

/**
 * 法人名に入力がある場合のみ業者問合せを表示する
 */
const showBrokerInquiry = (name: string | undefined): boolean => {
  return Boolean(name && name.trim().length > 0);
};

/**
 * 送信ペイロードを構築する（NewBuyerPage の handleSubmit 内のロジックと同等）
 */
const buildBuyerData = ({
  companyName,
  brokerInquiry,
}: {
  companyName: string;
  brokerInquiry: string;
}): { company_name: string; broker_inquiry: string } => {
  return {
    company_name: companyName,
    broker_inquiry: companyName.trim() ? brokerInquiry : '',
  };
};

// ---- Property 1: 法人名の有無と業者問合せの表示状態の一致 ----
// Validates: Requirements 1.2, 1.3
describe('Property 1: 法人名の有無と業者問合せの表示状態の一致', () => {
  it('任意の文字列に対して showBrokerInquiry() の結果が companyName.trim().length > 0 と等価である', () => {
    fc.assert(
      fc.property(fc.string(), (companyName) => {
        const result = showBrokerInquiry(companyName);
        const expected = companyName.trim().length > 0;
        return result === expected;
      }),
      { numRuns: 100 }
    );
  });

  it('空文字列は false を返す', () => {
    expect(showBrokerInquiry('')).toBe(false);
  });

  it('空白のみは false を返す', () => {
    expect(showBrokerInquiry('   ')).toBe(false);
  });

  it('1文字以上は true を返す', () => {
    expect(showBrokerInquiry('A')).toBe(true);
    expect(showBrokerInquiry('株式会社テスト')).toBe(true);
  });

  it('undefined は false を返す', () => {
    expect(showBrokerInquiry(undefined)).toBe(false);
  });
});

// ---- Property 2: 法人名クリア時の業者問合せ値のリセット ----
// Validates: Requirements 1.4
describe('Property 2: 法人名クリア時の業者問合せ値のリセット', () => {
  it('法人名を空にした場合、broker_inquiry は空文字列になる', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom('業者問合せ', '業者（両手）'),
        (companyName, brokerInquiry) => {
          // 法人名をクリアした状態でペイロードを構築
          const result = buildBuyerData({ companyName: '', brokerInquiry });
          return result.broker_inquiry === '';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('空白のみの法人名でも broker_inquiry は空文字列になる', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('業者問合せ', '業者（両手）'),
        (brokerInquiry) => {
          const result = buildBuyerData({ companyName: '   ', brokerInquiry });
          return result.broker_inquiry === '';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Property 3: 登録リクエストへの broker_inquiry の包含 ----
// Validates: Requirements 3.1, 3.2
describe('Property 3: 登録リクエストへの broker_inquiry の包含', () => {
  it('任意のフォームデータに対して送信ペイロードに broker_inquiry キーが含まれる', () => {
    fc.assert(
      fc.property(
        fc.record({
          companyName: fc.string(),
          brokerInquiry: fc.constantFrom('', '業者問合せ', '業者（両手）'),
        }),
        ({ companyName, brokerInquiry }) => {
          const payload = buildBuyerData({ companyName, brokerInquiry });
          return 'broker_inquiry' in payload;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('法人名がある場合、選択した broker_inquiry の値がそのまま送信される', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('業者問合せ', '業者（両手）'),
        (companyName, brokerInquiry) => {
          const payload = buildBuyerData({ companyName, brokerInquiry });
          return payload.broker_inquiry === brokerInquiry;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('法人名が空の場合、broker_inquiry は空文字列で送信される', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '業者問合せ', '業者（両手）'),
        (brokerInquiry) => {
          const payload = buildBuyerData({ companyName: '', brokerInquiry });
          return payload.broker_inquiry === '';
        }
      ),
      { numRuns: 100 }
    );
  });
});
