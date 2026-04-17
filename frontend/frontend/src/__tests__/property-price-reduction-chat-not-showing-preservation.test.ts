/**
 * 保全プロパティテスト: 値下げ予約日あり・編集モードでのCHATボタン非表示
 *
 * **重要**: 観察優先メソドロジーに従う
 * 未修正コードで非バグ条件の入力（`isBugCondition` が false になるケース）の動作を観察する
 * このテストは未修正コードで PASS する必要がある（ベースライン動作の確認）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation - 値下げ予約日あり・編集モードでのボタン非表示
 *
 * 観察内容:
 * - 観察1: priceReductionScheduledDate="2026/05/01" かつ isEditMode=false → ボタンが非表示
 * - 観察2: isEditMode=true かつ priceReductionScheduledDate=null → ボタンが非表示
 * - 観察3: priceReductionScheduledDate=null かつ isEditMode=false → ボタンが表示（正常動作）
 *
 * プロパティベーステスト:
 * - 任意の非空文字列の priceReductionScheduledDate に対して showChatButton === false を検証
 * - 任意の isEditMode=true に対して showChatButton === false を検証
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

describe('Property 2: Preservation - 値下げ予約日あり・編集モードでのCHATボタン非表示', () => {
  const priceSectionPath = path.join(
    __dirname,
    '../components/PriceSection.tsx'
  );

  let priceSectionContent: string;

  beforeAll(() => {
    priceSectionContent = fs.readFileSync(priceSectionPath, 'utf-8');
  });

  /**
   * showChatButton ロジックを PriceSection.tsx から抽出して再現する
   *
   * PriceSection.tsx の実装:
   *   const displayScheduledDate = editedData.price_reduction_scheduled_date !== undefined
   *     ? editedData.price_reduction_scheduled_date
   *     : priceReductionScheduledDate;
   *   const showChatButton = !isEditMode && !displayScheduledDate;
   */
  function computeShowChatButton(params: {
    priceReductionScheduledDate: string | null | undefined;
    isEditMode: boolean;
    editedData?: Record<string, any>;
  }): boolean {
    const { priceReductionScheduledDate, isEditMode, editedData = {} } = params;
    const displayScheduledDate =
      editedData.price_reduction_scheduled_date !== undefined
        ? editedData.price_reduction_scheduled_date
        : priceReductionScheduledDate;
    return !isEditMode && !displayScheduledDate;
  }

  /**
   * 観察テスト 3.1: showChatButton ロジックが PriceSection.tsx に正しく実装されていることを確認
   *
   * **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
   */
  test('Preservation 3.1: showChatButton ロジックが PriceSection.tsx に正しく実装されている', () => {
    // showChatButton の計算ロジックを確認
    const showChatButtonPattern = /const\s+showChatButton\s*=\s*!isEditMode\s*&&\s*!displayScheduledDate/;
    const hasShowChatButtonLogic = showChatButtonPattern.test(priceSectionContent);

    console.log('📊 PriceSection の showChatButton ロジック:');
    console.log('  - showChatButton = !isEditMode && !displayScheduledDate:', hasShowChatButtonLogic);

    expect(hasShowChatButtonLogic).toBe(true);
  });

  /**
   * 観察テスト 3.2: priceReductionScheduledDate="2026/05/01" かつ isEditMode=false → ボタンが非表示
   *
   * 値下げ予約日に値がある場合、非編集モードでもボタンは非表示になるべき
   *
   * **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
   */
  test('Preservation 3.2: priceReductionScheduledDate="2026/05/01" かつ isEditMode=false → showChatButton === false', () => {
    const result = computeShowChatButton({
      priceReductionScheduledDate: '2026/05/01',
      isEditMode: false,
    });

    console.log('📊 観察1: priceReductionScheduledDate="2026/05/01" かつ isEditMode=false');
    console.log('  - showChatButton:', result);
    console.log('  - 期待値: false（値下げ予約日あり → ボタン非表示）');

    expect(result).toBe(false);
  });

  /**
   * 観察テスト 3.3: isEditMode=true かつ priceReductionScheduledDate=null → ボタンが非表示
   *
   * 編集モードでは値下げ予約日の有無に関わらずボタンは非表示になるべき
   *
   * **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
   */
  test('Preservation 3.3: isEditMode=true かつ priceReductionScheduledDate=null → showChatButton === false', () => {
    const result = computeShowChatButton({
      priceReductionScheduledDate: null,
      isEditMode: true,
    });

    console.log('📊 観察2: isEditMode=true かつ priceReductionScheduledDate=null');
    console.log('  - showChatButton:', result);
    console.log('  - 期待値: false（編集モード → ボタン非表示）');

    expect(result).toBe(false);
  });

  /**
   * 観察テスト 3.4: priceReductionScheduledDate=null かつ isEditMode=false → ボタンが表示（正常動作）
   *
   * 値下げ予約日が null かつ非編集モードの場合、ボタンは表示されるべき（正常動作）
   *
   * **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
   */
  test('Preservation 3.4: priceReductionScheduledDate=null かつ isEditMode=false → showChatButton === true（正常動作）', () => {
    const result = computeShowChatButton({
      priceReductionScheduledDate: null,
      isEditMode: false,
    });

    console.log('📊 観察3: priceReductionScheduledDate=null かつ isEditMode=false');
    console.log('  - showChatButton:', result);
    console.log('  - 期待値: true（値下げ予約日なし・非編集モード → ボタン表示）');

    expect(result).toBe(true);
  });

  /**
   * プロパティベーステスト 3.5 [PBT]: 任意の非空文字列の priceReductionScheduledDate に対して
   * showChatButton === false を検証
   *
   * FOR ALL date WHERE date is non-empty string DO
   *   ASSERT showChatButton(isEditMode=false, priceReductionScheduledDate=date) === false
   * END FOR
   *
   * **Validates: Requirements 3.1**
   *
   * **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
   */
  test('Preservation 3.5 [PBT]: 任意の非空文字列の priceReductionScheduledDate に対して showChatButton === false', () => {
    fc.assert(
      fc.property(
        // 非空文字列の priceReductionScheduledDate を生成
        fc.string({ minLength: 1 }),
        (priceReductionScheduledDate) => {
          const result = computeShowChatButton({
            priceReductionScheduledDate,
            isEditMode: false,
          });

          // 値下げ予約日に値がある場合、ボタンは非表示
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );

    console.log('✅ プロパティ検証完了: 任意の非空文字列の priceReductionScheduledDate → showChatButton === false');
  });

  /**
   * プロパティベーステスト 3.6 [PBT]: 任意の isEditMode=true に対して
   * showChatButton === false を検証
   *
   * FOR ALL priceReductionScheduledDate DO
   *   ASSERT showChatButton(isEditMode=true, priceReductionScheduledDate=any) === false
   * END FOR
   *
   * **Validates: Requirements 3.2**
   *
   * **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
   */
  test('Preservation 3.6 [PBT]: 任意の priceReductionScheduledDate に対して isEditMode=true → showChatButton === false', () => {
    fc.assert(
      fc.property(
        // priceReductionScheduledDate は null、空文字列、任意の文字列のいずれか
        fc.oneof(
          fc.constant(null),
          fc.constant(''),
          fc.string({ minLength: 1 }),
        ),
        (priceReductionScheduledDate) => {
          const result = computeShowChatButton({
            priceReductionScheduledDate,
            isEditMode: true,
          });

          // 編集モードでは値下げ予約日の有無に関わらずボタンは非表示
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );

    console.log('✅ プロパティ検証完了: isEditMode=true → showChatButton === false（値下げ予約日の値に関わらず）');
  });

  /**
   * プロパティベーステスト 3.7 [PBT]: editedData に price_reduction_scheduled_date が設定されている場合の
   * showChatButton ロジックを検証
   *
   * editedData.price_reduction_scheduled_date が非空文字列の場合、
   * priceReductionScheduledDate prop の値に関わらず showChatButton === false
   *
   * **Validates: Requirements 3.1**
   *
   * **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
   */
  test('Preservation 3.7 [PBT]: editedData に非空文字列の price_reduction_scheduled_date がある場合 showChatButton === false', () => {
    fc.assert(
      fc.property(
        // editedData.price_reduction_scheduled_date は非空文字列
        fc.string({ minLength: 1 }),
        // priceReductionScheduledDate prop は null または任意の文字列
        fc.oneof(
          fc.constant(null),
          fc.string(),
        ),
        (editedScheduledDate, priceReductionScheduledDate) => {
          const result = computeShowChatButton({
            priceReductionScheduledDate,
            isEditMode: false,
            editedData: { price_reduction_scheduled_date: editedScheduledDate },
          });

          // editedData に非空文字列の値下げ予約日がある場合、ボタンは非表示
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );

    console.log('✅ プロパティ検証完了: editedData に非空文字列の price_reduction_scheduled_date → showChatButton === false');
  });
});
