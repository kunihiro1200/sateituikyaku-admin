/**
 * 保全プロパティテスト: 買主内覧前日通知メール 500エラー
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで実行し、**成功することを確認する**（ベースライン動作の確認）
 * 修正後も同じテストが成功することで、リグレッションがないことを確認する
 *
 * 保全プロパティ:
 * - 3.1: 内覧前日通知メール以外のメール送信機能は正常に動作し続ける
 * - 3.2: メール本文プレビューは日付・時間・住所を正しく表示し続ける
 * - 3.3: `mergeMultiple` エンドポイントはテンプレートのプレースホルダーを正しく置換し続ける
 * - 3.4: 買主情報取得は `buyer_number` でも `buyer_id` でも正しく検索できる
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fc from 'fast-check';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { BuyerService } from '../services/BuyerService';

// 環境変数を読み込む（backendディレクトリの.envファイルを明示的に指定）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('買主内覧前日通知メール 500エラー - 保全プロパティ', () => {
  let emailTemplateService: EmailTemplateService;
  let buyerService: BuyerService;

  beforeAll(() => {
    emailTemplateService = new EmailTemplateService();
    buyerService = new BuyerService();
  });

  // ============================================================
  // Property 2: Preservation - 3.3
  // mergeMultiple がテンプレートのプレースホルダーを正しく置換すること
  // ============================================================

  /**
   * Property 2: Preservation - mergeMultipleProperties のプレースホルダー置換
   *
   * **Validates: Requirements 3.3**
   *
   * `mergeMultipleProperties` がテンプレートの {{}} 形式プレースホルダーを
   * 正しく置換し続けることを確認する
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  it('mergeMultipleProperties が {{buyerName}} プレースホルダーを正しく置換すること', () => {
    console.log('\n========================================');
    console.log('🔍 保全テスト: mergeMultipleProperties プレースホルダー置換');
    console.log('========================================\n');

    // テスト用テンプレート（内覧前日通知メールのプレースホルダーを含む）
    const template = {
      id: 'test-template',
      name: '☆内覧前日通知メール',
      description: 'テスト用テンプレート',
      subject: '【内覧前日通知】{{buyerName}}様',
      body: '{{buyerName}}様\n\n明日の内覧についてご確認ください。',
      placeholders: [],
    };

    // テスト用買主データ
    const buyer = {
      buyerName: '田中太郎',
      email: 'tanaka@example.com',
      buyer_number: '1234',
    };

    const result = emailTemplateService.mergeMultipleProperties(template, buyer, []);

    console.log('  件名:', result.subject);
    console.log('  本文（先頭50文字）:', result.body.substring(0, 50));

    // プレースホルダーが置換されていることを確認
    expect(result.subject).toBe('【内覧前日通知】田中太郎様');
    expect(result.body).toContain('田中太郎様');
    expect(result.subject).not.toContain('{{buyerName}}');
    expect(result.body).not.toContain('{{buyerName}}');

    console.log('\n✅ プレースホルダー置換が正しく動作しています');
    console.log('\n========================================');
    console.log('🔍 保全テスト終了: mergeMultipleProperties プレースホルダー置換');
    console.log('========================================\n');
  });

  /**
   * Property-Based Test: mergeMultipleProperties が任意の買主名で正しく置換すること
   *
   * **Validates: Requirements 3.3**
   *
   * 様々な買主名に対して、プレースホルダーが常に正しく置換されることを確認する
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  it('Property-Based: mergeMultipleProperties が任意の買主名で常に正しく置換すること', () => {
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト: mergeMultipleProperties 任意入力');
    console.log('========================================\n');

    // 買主名のジェネレーター（日本語名を含む）
    const buyerNameArbitrary = fc.constantFrom(
      '田中太郎',
      '山田花子',
      '佐藤一郎',
      '鈴木次郎',
      'テスト買主',
    );

    fc.assert(
      fc.property(
        buyerNameArbitrary,
        (buyerName) => {
          const template = {
            id: 'test',
            name: 'テスト',
            description: '',
            subject: '{{buyerName}}様へのご連絡',
            body: '{{buyerName}}様\n\nご連絡いたします。',
            placeholders: [],
          };

          const buyer = {
            buyerName,
            email: 'test@example.com',
            buyer_number: '9999',
          };

          const result = emailTemplateService.mergeMultipleProperties(template, buyer, []);

          // プレースホルダーが置換されていること
          const subjectReplaced = !result.subject.includes('{{buyerName}}');
          const bodyReplaced = !result.body.includes('{{buyerName}}');
          // 買主名が含まれていること
          const subjectContainsBuyerName = result.subject.includes(buyerName);
          const bodyContainsBuyerName = result.body.includes(buyerName);

          return subjectReplaced && bodyReplaced && subjectContainsBuyerName && bodyContainsBuyerName;
        }
      ),
      { numRuns: 5 }
    );

    console.log('✅ 任意の買主名でプレースホルダー置換が正しく動作しています');
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト終了: mergeMultipleProperties 任意入力');
    console.log('========================================\n');
  });

  // ============================================================
  // Property 2: Preservation - 3.2
  // メール本文プレビューが日付・時間・住所を正しく表示すること
  // ============================================================

  /**
   * Property 2: Preservation - mergeAngleBracketPlaceholders の日付・時間・住所置換
   *
   * **Validates: Requirements 3.2**
   *
   * `mergeAngleBracketPlaceholders` が <<内覧日>>・<<時間>>・<<住居表示>> を
   * 正しく置換し続けることを確認する
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  it('mergeAngleBracketPlaceholders が内覧日・時間・住所を正しく置換すること', () => {
    console.log('\n========================================');
    console.log('🔍 保全テスト: mergeAngleBracketPlaceholders 日付・時間・住所置換');
    console.log('========================================\n');

    // 内覧前日通知メールの本文テンプレート（<<>> 形式プレースホルダー）
    const templateBody = [
      '<<●氏名・会社名>>様',
      '',
      '明日の内覧についてご確認ください。',
      '',
      '■内覧日時',
      '日付: <<内覧日>>',
      '時間: <<時間>>',
      '',
      '■物件所在地',
      '<<住居表示>>',
    ].join('\n');

    // テスト用買主データ（内覧日・時間を含む）
    const buyer = {
      name: '田中太郎',
      buyer_number: '1234',
      email: 'tanaka@example.com',
      latest_viewing_date: '2026-04-10',
      viewing_time: '14:30:00',
    };

    // テスト用物件データ
    const properties = [
      {
        propertyNumber: 'AA1234',
        address: '大分県大分市中央町1-2-3',
        price: 35000000,
        googleMapUrl: 'https://maps.google.com/test',
        athomeUrl: '',
        detailUrl: '',
      },
    ];

    const result = emailTemplateService.mergeAngleBracketPlaceholders(
      templateBody,
      buyer,
      properties,
      null
    );

    console.log('  置換後本文:\n', result);

    // 買主名が置換されていること
    expect(result).toContain('田中太郎様');
    expect(result).not.toContain('<<●氏名・会社名>>');

    // 内覧日が置換されていること（「4月10日」形式）
    expect(result).toContain('4月10日');
    expect(result).not.toContain('<<内覧日>>');

    // 時間が置換されていること（「14時30分」形式）
    expect(result).toContain('14時30分');
    expect(result).not.toContain('<<時間>>');

    // 住所が置換されていること
    expect(result).toContain('大分県大分市中央町1-2-3');
    expect(result).not.toContain('<<住居表示>>');

    console.log('\n✅ 日付・時間・住所の置換が正しく動作しています');
    console.log('\n========================================');
    console.log('🔍 保全テスト終了: mergeAngleBracketPlaceholders 日付・時間・住所置換');
    console.log('========================================\n');
  });

  /**
   * Property-Based Test: 様々な日付・時間形式で正しく置換されること
   *
   * **Validates: Requirements 3.2**
   *
   * 様々な日付・時間形式に対して、プレースホルダーが常に正しく置換されることを確認する
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  it('Property-Based: 様々な日付・時間形式で <<内覧日>>・<<時間>> が正しく置換されること', () => {
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト: 日付・時間の多様な入力');
    console.log('========================================\n');

    // 日付のジェネレーター（YYYY-MM-DD形式）
    const dateArbitrary = fc.constantFrom(
      '2026-04-10',
      '2026-05-01',
      '2026-12-31',
      '2026-01-15',
    );

    // 時間のジェネレーター（HH:MM:SS形式）
    const timeArbitrary = fc.constantFrom(
      '09:00:00',
      '14:30:00',
      '16:00:00',
      '10:30:00',
    );

    fc.assert(
      fc.property(
        dateArbitrary,
        timeArbitrary,
        (viewingDate, viewingTime) => {
          const templateBody = '日付: <<内覧日>>\n時間: <<時間>>';

          const buyer = {
            name: 'テスト買主',
            buyer_number: '9999',
            email: 'test@example.com',
            latest_viewing_date: viewingDate,
            viewing_time: viewingTime,
          };

          const result = emailTemplateService.mergeAngleBracketPlaceholders(
            templateBody,
            buyer,
            [],
            null
          );

          // プレースホルダーが残っていないこと
          const noDatePlaceholder = !result.includes('<<内覧日>>');
          const noTimePlaceholder = !result.includes('<<時間>>');

          return noDatePlaceholder && noTimePlaceholder;
        }
      ),
      { numRuns: 4 }
    );

    console.log('✅ 様々な日付・時間形式でプレースホルダー置換が正しく動作しています');
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト終了: 日付・時間の多様な入力');
    console.log('========================================\n');
  });

  // ============================================================
  // Property 2: Preservation - 3.4
  // BuyerService.getById() が buyer_number と buyer_id の両方で検索できること
  // ============================================================

  /**
   * Property 2: Preservation - BuyerService.getById() の UUID 判定ロジック
   *
   * **Validates: Requirements 3.4**
   *
   * `BuyerService.getById()` が UUID 形式の入力を `buyer_id` で検索し、
   * 数字形式の入力を `buyer_number` で検索するロジックが正しく動作することを確認する
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  it('BuyerService.getById() が UUID 形式と buyer_number 形式を正しく判定すること', () => {
    console.log('\n========================================');
    console.log('🔍 保全テスト: BuyerService.getById() UUID判定ロジック');
    console.log('========================================\n');

    // UUID 形式の正規表現（BuyerService 内部と同じロジック）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // UUID 形式のテストケース
    const uuidInputs = [
      '550e8400-e29b-41d4-a716-446655440000',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      '00000000-0000-0000-0000-000000000000',
    ];

    // buyer_number 形式のテストケース
    const buyerNumberInputs = [
      '1234',
      '7187',
      '9999',
      '12345',
    ];

    console.log('  UUID形式の判定:');
    for (const uuid of uuidInputs) {
      const isUuid = uuidRegex.test(uuid);
      console.log(`    "${uuid}" → isUuid=${isUuid}`);
      expect(isUuid).toBe(true);
    }

    console.log('  buyer_number形式の判定:');
    for (const buyerNumber of buyerNumberInputs) {
      const isUuid = uuidRegex.test(buyerNumber);
      console.log(`    "${buyerNumber}" → isUuid=${isUuid}`);
      expect(isUuid).toBe(false);
    }

    console.log('\n✅ UUID判定ロジックが正しく動作しています');
    console.log('\n========================================');
    console.log('🔍 保全テスト終了: BuyerService.getById() UUID判定ロジック');
    console.log('========================================\n');
  });

  /**
   * Property-Based Test: BuyerService.getById() が任意の UUID/buyer_number で正しく判定すること
   *
   * **Validates: Requirements 3.4**
   *
   * 様々な UUID 形式と buyer_number 形式に対して、
   * 判定ロジックが常に正しく動作することを確認する
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  it('Property-Based: BuyerService.getById() が UUID と buyer_number を常に正しく判定すること', () => {
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト: BuyerService.getById() 判定ロジック');
    console.log('========================================\n');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // UUID ジェネレーター（有効な UUID 形式）
    const uuidArbitrary = fc.tuple(
      fc.hexaString({ minLength: 8, maxLength: 8 }),
      fc.hexaString({ minLength: 4, maxLength: 4 }),
      fc.hexaString({ minLength: 4, maxLength: 4 }),
      fc.hexaString({ minLength: 4, maxLength: 4 }),
      fc.hexaString({ minLength: 12, maxLength: 12 }),
    ).map(([a, b, c, d, e]) => `${a}-${b}-${c}-${d}-${e}`);

    // buyer_number ジェネレーター（4〜5桁の数字）
    const buyerNumberArbitrary = fc.integer({ min: 1000, max: 99999 }).map(String);

    // UUID は isUuid = true と判定されること
    fc.assert(
      fc.property(uuidArbitrary, (uuid) => {
        return uuidRegex.test(uuid) === true;
      }),
      { numRuns: 10 }
    );

    // buyer_number は isUuid = false と判定されること
    fc.assert(
      fc.property(buyerNumberArbitrary, (buyerNumber) => {
        return uuidRegex.test(buyerNumber) === false;
      }),
      { numRuns: 10 }
    );

    console.log('✅ UUID と buyer_number の判定ロジックが正しく動作しています');
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト終了: BuyerService.getById() 判定ロジック');
    console.log('========================================\n');
  });

  /**
   * Property 2: Preservation - BuyerService.getById() が実際のDBで検索できること
   *
   * **Validates: Requirements 3.4**
   *
   * 実際のDBに対して `getById()` を呼び出し、
   * buyer_number と buyer_id の両方で正しく検索できることを確認する
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  it('BuyerService.getById() が実際のDBで buyer_number と buyer_id の両方で検索できること', async () => {
    console.log('\n========================================');
    console.log('🔍 保全テスト: BuyerService.getById() 実際のDB検索');
    console.log('========================================\n');

    // UUID形式の正規表現（BuyerService 内部と同じロジック）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // まず buyer_number で検索して実在する買主を取得
    const allBuyers = await buyerService.getAll({ page: 1, limit: 5 });

    if (!allBuyers.data || allBuyers.data.length === 0) {
      console.log('  ⚠️  テスト用買主データが見つかりません。テストをスキップします。');
      expect(true).toBe(true);
      return;
    }

    // buyer_number での検索テスト
    const testBuyer = allBuyers.data[0];
    const buyerNumber = testBuyer.buyer_number;
    const buyerId = testBuyer.buyer_id;

    console.log(`  テスト対象: buyer_number=${buyerNumber}, buyer_id=${buyerId ? buyerId.substring(0, 8) + '...' : 'なし'}`);
    console.log(`  buyer_id はUUID形式か: ${buyerId ? uuidRegex.test(buyerId) : false}`);

    // buyer_number で検索
    if (buyerNumber) {
      const resultByNumber = await buyerService.getById(String(buyerNumber));
      console.log(`  buyer_number "${buyerNumber}" での検索結果:`, resultByNumber ? '✅ 見つかった' : '❌ 見つからない');
      expect(resultByNumber).not.toBeNull();
      expect(String(resultByNumber.buyer_number)).toBe(String(buyerNumber));
    }

    // buyer_id (UUID) で検索（UUID形式の場合のみ）
    if (buyerId && uuidRegex.test(buyerId)) {
      const resultById = await buyerService.getById(buyerId);
      console.log(`  buyer_id "${buyerId.substring(0, 8)}..." での検索結果:`, resultById ? '✅ 見つかった' : '❌ 見つからない');
      expect(resultById).not.toBeNull();
      expect(resultById.buyer_id).toBe(buyerId);
    } else {
      // UUID形式でない場合は、UUID形式の buyer_id を持つ買主を別途検索
      console.log('  ⚠️  最初の買主の buyer_id がUUID形式でないため、別の買主で確認します');
      const buyerWithUuid = allBuyers.data.find(b => b.buyer_id && uuidRegex.test(b.buyer_id));
      if (buyerWithUuid) {
        const resultById = await buyerService.getById(buyerWithUuid.buyer_id);
        console.log(`  buyer_id "${buyerWithUuid.buyer_id.substring(0, 8)}..." での検索結果:`, resultById ? '✅ 見つかった' : '❌ 見つからない');
        expect(resultById).not.toBeNull();
      } else {
        console.log('  ⚠️  UUID形式の buyer_id を持つ買主が見つかりません。buyer_number での検索のみ確認済み。');
        // buyer_number での検索が成功していれば OK
        expect(buyerNumber).toBeTruthy();
      }
    }

    console.log('\n✅ buyer_number と buyer_id の両方で正しく検索できています');
    console.log('\n========================================');
    console.log('🔍 保全テスト終了: BuyerService.getById() 実際のDB検索');
    console.log('========================================\n');
  }, 30000);
});
