/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - Pinrich要変更カテゴリ未実装バグ
 *
 * NOTE: このテストは**未修正コード**で FAIL することを確認する
 * テストが失敗することがバグの存在を証明する
 *
 * **期待される結果**: テストが**失敗**する（これが正しい — バグの存在を証明する）
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  StatusCategory,
  filterSellersByCategory,
} from '../utils/sellerStatusFilters';

// ============================================================
// テスト1: StatusCategory型に pinrichChangeRequired が含まれているか
// ============================================================
describe('Bug Condition Exploration - Test 1: StatusCategory型にpinrichChangeRequiredが含まれているか', () => {
  /**
   * 未修正コードでは FAIL する:
   * StatusCategory型に 'pinrichChangeRequired' が含まれていないため
   *
   * 修正後は PASS する:
   * StatusCategory型に 'pinrichChangeRequired' が追加されるため
   */
  it('sellerStatusFilters.ts の StatusCategory 型に pinrichChangeRequired が含まれていること（未修正コードでは FAIL）', () => {
    const filePath = join(
      __dirname,
      '../utils/sellerStatusFilters.ts'
    );
    const sourceCode = readFileSync(filePath, 'utf-8');

    // StatusCategory型の定義行を抽出
    const statusCategoryMatch = sourceCode.match(/export type StatusCategory\s*=\s*([^;]+);/s);
    const statusCategoryDef = statusCategoryMatch ? statusCategoryMatch[1] : '';

    // 未修正コードでは 'pinrichChangeRequired' が含まれていないため FAIL する
    expect(statusCategoryDef).toContain('pinrichChangeRequired');
  });
});

// ============================================================
// テスト2: filterSellersByCategory が pinrichChangeRequired をサポートしているか
// ============================================================
describe('Bug Condition Exploration - Test 2: filterSellersByCategory が pinrichChangeRequired をサポートしているか', () => {
  /**
   * 条件Aを満たす売主データ:
   * - visit_assignee = "外す"
   * - pinrich_status = "クローズ"
   * - status = "追客中"
   */
  const conditionASeller = {
    id: 'test-seller-001',
    seller_number: 'AA13712',
    name: 'テスト売主',
    status: '追客中',
    visit_assignee: '外す',
    pinrich_status: 'クローズ',
    confidence_level: '',
    visit_date: null,
    contract_year_month: null,
    next_call_date: null,
    contact_method: '',
    preferred_contact_time: '',
    phone_contact_person: '',
  };

  it('条件Aを満たす売主が filterSellersByCategory(sellers, "pinrichChangeRequired") で返されること（未修正コードでは FAIL）', () => {
    const sellers = [conditionASeller];

    // 未修正コードでは 'pinrichChangeRequired' ケースが switch 文に存在しないため
    // default ケースが実行されて全件が返される（または空が返される）
    // 修正後は条件Aを満たす売主のみが返される
    const result = filterSellersByCategory(sellers, 'pinrichChangeRequired' as StatusCategory);

    // 未修正コードでは FAIL する（条件Aを満たす売主が返されない）
    expect(result).toHaveLength(1);
    expect(result[0].seller_number).toBe('AA13712');
  });

  it('条件Aを満たさない売主が filterSellersByCategory(sellers, "pinrichChangeRequired") で返されないこと（未修正コードでは FAIL）', () => {
    const normalSeller = {
      id: 'test-seller-002',
      seller_number: 'AA99999',
      name: '通常売主',
      status: '追客中',
      visit_assignee: 'Y',  // 「外す」ではない
      pinrich_status: '配信中',  // 「クローズ」ではない
      confidence_level: '',
      visit_date: null,
      contract_year_month: null,
      next_call_date: null,
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
    };

    const sellers = [conditionASeller, normalSeller];

    const result = filterSellersByCategory(sellers, 'pinrichChangeRequired' as StatusCategory);

    // 未修正コードでは FAIL する（条件Aを満たす売主のみが返されるべきだが、未実装のため全件または空が返される）
    expect(result).toHaveLength(1);
    expect(result[0].seller_number).toBe('AA13712');
  });
});

// ============================================================
// テスト3: SellerStatusSidebar.tsx に「Pinrich要変更」ボタンが存在するか
// ============================================================
describe('Bug Condition Exploration - Test 3: SellerStatusSidebar に「Pinrich要変更」ボタンが存在するか', () => {
  /**
   * 未修正コードでは FAIL する:
   * SellerStatusSidebar.tsx の renderAllCategories() に「Pinrich要変更」ボタンが存在しないため
   *
   * 修正後は PASS する:
   * renderAllCategories() に「Pinrich要変更」ボタンが追加されるため
   */
  it('SellerStatusSidebar.tsx に「Pinrich要変更」の文字列が含まれていること（未修正コードでは FAIL）', () => {
    const filePath = join(
      __dirname,
      '../components/SellerStatusSidebar.tsx'
    );
    const sourceCode = readFileSync(filePath, 'utf-8');

    // 未修正コードでは「Pinrich要変更」が含まれていないため FAIL する
    expect(sourceCode).toContain('Pinrich要変更');
  });

  it('SellerStatusSidebar.tsx に pinrichChangeRequired カテゴリの renderCategoryButton 呼び出しが含まれていること（未修正コードでは FAIL）', () => {
    const filePath = join(
      __dirname,
      '../components/SellerStatusSidebar.tsx'
    );
    const sourceCode = readFileSync(filePath, 'utf-8');

    // 未修正コードでは pinrichChangeRequired の renderCategoryButton 呼び出しが存在しないため FAIL する
    expect(sourceCode).toContain("renderCategoryButton('pinrichChangeRequired'");
  });
});

// ============================================================
// テスト4: sellerStatusFilters.ts に isPinrichChangeRequired 関数が存在するか
// ============================================================
describe('Bug Condition Exploration - Test 4: isPinrichChangeRequired 関数が存在するか', () => {
  /**
   * 未修正コードでは FAIL する:
   * sellerStatusFilters.ts に isPinrichChangeRequired 関数が存在しないため
   *
   * 修正後は PASS する:
   * isPinrichChangeRequired 関数が追加されるため
   */
  it('sellerStatusFilters.ts に isPinrichChangeRequired 関数が定義されていること（未修正コードでは FAIL）', () => {
    const filePath = join(
      __dirname,
      '../utils/sellerStatusFilters.ts'
    );
    const sourceCode = readFileSync(filePath, 'utf-8');

    // 未修正コードでは isPinrichChangeRequired が存在しないため FAIL する
    expect(sourceCode).toContain('isPinrichChangeRequired');
  });

  it('sellerStatusFilters.ts の filterSellersByCategory に pinrichChangeRequired ケースが含まれていること（未修正コードでは FAIL）', () => {
    const filePath = join(
      __dirname,
      '../utils/sellerStatusFilters.ts'
    );
    const sourceCode = readFileSync(filePath, 'utf-8');

    // filterSellersByCategory の switch 文に pinrichChangeRequired ケースが含まれているか確認
    // 未修正コードでは存在しないため FAIL する
    expect(sourceCode).toContain("case 'pinrichChangeRequired'");
  });
});
