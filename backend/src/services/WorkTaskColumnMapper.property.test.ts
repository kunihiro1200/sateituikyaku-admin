/**
 * WorkTaskColumnMapper Property-Based Tests
 * Feature: business-phone-number-zero-prefix
 */
import * as fc from 'fast-check';
import { WorkTaskColumnMapper } from './WorkTaskColumnMapper';

describe('WorkTaskColumnMapper - Property 3: mapToDatabaseでの電話番号補完', () => {
  const mapper = new WorkTaskColumnMapper();

  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any 先頭が「0」でない電話番号文字列を「売主TEL」または「買主TEL」カラムに含む SheetRow に対して、
   * mapToDatabase の結果の seller_contact_tel / buyer_contact_tel は先頭「0」が付加された値になる
   */
  it('Property 3: 先頭「0」でない電話番号は seller_contact_tel / buyer_contact_tel に「0」が付加される', () => {
    fc.assert(
      fc.property(
        // 先頭が「0」でない、長さ1以上の文字列
        fc.string({ minLength: 1 }).filter((s) => !s.startsWith('0')),
        (tel) => {
          const row = {
            '物件番号': 'AA12345',
            '売主TEL': tel,
            '買主TEL': tel,
          };
          const result = mapper.mapToDatabase(row);
          return (
            result.seller_contact_tel === '0' + tel &&
            result.buyer_contact_tel === '0' + tel
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
