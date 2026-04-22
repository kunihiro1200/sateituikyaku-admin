/**
 * 表示時の電話番号補完プロパティベーステスト
 * Validates: Requirements 4.1, 4.2
 */
import * as fc from 'fast-check';
import { normalizePhoneNumber } from './phoneNormalizer';

/**
 * getValue 関数のロジックを再現するヘルパー
 * WorkTaskDetailModal の getValue 関数と同一ロジック
 */
function getValueWithNormalization(
  field: string,
  data: Record<string, string | null | undefined>,
  editedData: Record<string, string | null | undefined> = {}
): string | null | undefined {
  const raw = editedData[field] !== undefined ? editedData[field] : data[field];
  if (field === 'seller_contact_tel' || field === 'buyer_contact_tel') {
    return normalizePhoneNumber(raw) ?? raw;
  }
  return raw;
}

describe('表示時の電話番号補完 プロパティベーステスト', () => {
  /**
   * Property 4: 先頭「0」でない値が seller_contact_tel / buyer_contact_tel に
   * 格納されている場合、getValue が返す値は先頭「0」が付加された値になる
   * Validates: Requirements 4.1, 4.2
   */
  test('Property 4: seller_contact_tel の先頭「0」なし値は表示時に補完される', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0 && !s.startsWith('0')),
        (tel) => {
          const data = { seller_contact_tel: tel };
          const result = getValueWithNormalization('seller_contact_tel', data);
          return result === '0' + tel;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: buyer_contact_tel の先頭「0」なし値は表示時に補完される', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0 && !s.startsWith('0')),
        (tel) => {
          const data = { buyer_contact_tel: tel };
          const result = getValueWithNormalization('buyer_contact_tel', data);
          return result === '0' + tel;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: editedData の seller_contact_tel 先頭「0」なし値も補完される', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0 && !s.startsWith('0')),
        (tel) => {
          const data = { seller_contact_tel: '090-0000-0000' };
          const editedData = { seller_contact_tel: tel };
          const result = getValueWithNormalization('seller_contact_tel', data, editedData);
          return result === '0' + tel;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('電話番号以外のフィールドは補完されない', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0 && !s.startsWith('0')),
        (val) => {
          const data = { other_field: val };
          const result = getValueWithNormalization('other_field', data);
          return result === val;
        }
      ),
      { numRuns: 100 }
    );
  });
});
