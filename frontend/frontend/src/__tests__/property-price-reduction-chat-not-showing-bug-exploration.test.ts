/**
 * バグ条件探索テスト: 値下げ予約日を空欄にして保存後、CHATボタンが表示されないバグ
 *
 * **CRITICAL**: このテストは未修正コードで実行し、バグの存在を確認する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **GOAL**: バグが存在することを示すカウンターサンプルを発見する
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition - onChatSend prop 欠落 & 空文字列保存バグ
 *
 * バグの根本原因:
 * 1. `PropertyListingDetailPage.tsx` の `PriceSection` JSX に `onChatSend` prop が渡されていない
 *    - `PriceSection` の TypeScript インターフェースでは `onChatSend` は必須 prop
 *    - TypeScript コンパイルエラーが発生し、コンポーネントが正常にレンダリングされない可能性がある
 *
 * 2. `backend/src/routes/propertyListings.ts` の PUT 処理で
 *    `price_reduction_scheduled_date` の空文字列→null 変換が行われていない
 *    - 空欄で保存すると DB に空文字列 `""` が保存される
 *    - 再取得時に `""` が返り、ボタン表示に影響する可能性がある
 *
 * 期待される動作（修正後）:
 * - `onChatSend` prop が正しく渡され、`showChatButton` が `true` になる
 * - `price_reduction_scheduled_date` が `""` の場合、`null` に変換されて DB に保存される
 *
 * **注意**: このテストは期待される動作をエンコードしている
 * - 未修正コード: テストが FAIL する（バグの存在を証明）
 * - 修正後コード: テストが PASS する（バグが修正されたことを確認）
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property 1: Bug Condition - onChatSend prop 欠落 & 空文字列保存バグ', () => {
  const priceSectionPath = path.join(
    __dirname,
    '../components/PriceSection.tsx'
  );
  const propertyListingDetailPagePath = path.join(
    __dirname,
    '../pages/PropertyListingDetailPage.tsx'
  );
  const backendRoutePath = path.join(
    __dirname,
    '../../../../backend/src/routes/propertyListings.ts'
  );

  let priceSectionContent: string;
  let propertyListingDetailPageContent: string;
  let backendRouteContent: string;

  beforeAll(() => {
    priceSectionContent = fs.readFileSync(priceSectionPath, 'utf-8');
    propertyListingDetailPageContent = fs.readFileSync(propertyListingDetailPagePath, 'utf-8');
    backendRouteContent = fs.readFileSync(backendRoutePath, 'utf-8');
  });

  /**
   * テスト 1: PriceSection に onChatSend prop が必須として定義されていることを確認
   *
   * バグ条件: `onChatSendPropPassed === false`
   *
   * PriceSection の TypeScript インターフェースで `onChatSend` が必須 prop として定義されているが、
   * PropertyListingDetailPage.tsx の PriceSection JSX に `onChatSend` prop が渡されていない。
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: `onChatSend` prop が渡されていない → FAIL
   * - 修正後コード: `onChatSend` prop が渡されている → PASS
   */
  test('Bug Condition 1.1: PropertyListingDetailPage の PriceSection に onChatSend prop が渡されている（修正後に PASS）', () => {
    // PriceSection の props インターフェースで onChatSend が必須として定義されているか確認
    const requiredPropPattern = /onChatSend\s*:\s*\(data\s*:\s*PropertyChatSendData\)\s*=>\s*Promise<void>/;
    const hasRequiredProp = requiredPropPattern.test(priceSectionContent);

    console.log('📊 PriceSection の onChatSend prop 定義状態:');
    console.log('  - onChatSend が必須 prop として定義されている:', hasRequiredProp);

    // PropertyListingDetailPage.tsx の PriceSection JSX に onChatSend が渡されているか確認
    // PriceSection コンポーネントの使用箇所を探す
    const priceSectionUsagePattern = /<PriceSection[\s\S]*?\/>/;
    const priceSectionUsageMatch = propertyListingDetailPageContent.match(priceSectionUsagePattern);

    // onChatSend prop が渡されているか確認
    const onChatSendPassedPattern = /onChatSend\s*=\s*\{/;
    const hasOnChatSendPassed = onChatSendPassedPattern.test(propertyListingDetailPageContent);

    console.log('📊 PropertyListingDetailPage の PriceSection JSX 状態:');
    console.log('  - PriceSection JSX が見つかった:', !!priceSectionUsageMatch);
    console.log('  - onChatSend prop が渡されている:', hasOnChatSendPassed);

    if (hasRequiredProp && !hasOnChatSendPassed) {
      // バグが存在する（未修正コード）
      console.log('');
      console.log('❌ カウンターサンプル発見:');
      console.log('  - PriceSection の TypeScript インターフェースで onChatSend は必須 prop');
      console.log('  - しかし PropertyListingDetailPage.tsx の PriceSection JSX に onChatSend が渡されていない');
      console.log('  - バグ条件: onChatSendPropPassed === false');
      console.log('  - 結果: TypeScript コンパイルエラーが発生し、ボタンが表示されない');
      console.log('');

      // このアサーションは意図的に失敗させる（バグの存在を証明）
      expect(hasOnChatSendPassed).toBe(true); // FAIL: onChatSend prop が渡されていない
    } else if (hasRequiredProp && hasOnChatSendPassed) {
      // バグが修正された（修正後コード）
      console.log('✅ 修正確認: onChatSend prop が正しく渡されている');
      expect(hasOnChatSendPassed).toBe(true); // PASS
    } else {
      console.log('⚠️ 予期しない状態: 実装を確認してください');
      expect(hasOnChatSendPassed).toBe(true);
    }
  });

  /**
   * テスト 2: バックエンドの PUT 処理で price_reduction_scheduled_date の
   *           空文字列→null 変換が行われていることを確認
   *
   * バグ条件: `price_reduction_scheduled_date === ''` のまま Supabase に渡される
   *
   * 未修正コードでの動作:
   * - `OFFER_FIELDS` のみ空文字列→null 変換を行っている
   * - `price_reduction_scheduled_date` は `OFFER_FIELDS` に含まれていない
   * - 空欄で保存すると DB に空文字列 `""` が保存される
   *
   * 修正後コードでの動作:
   * - `price_reduction_scheduled_date === ''` の場合、`null` に変換される
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: 変換ロジックが存在しない → FAIL
   * - 修正後コード: 変換ロジックが存在する → PASS
   */
  test('Bug Condition 1.2: バックエンドの PUT 処理で price_reduction_scheduled_date の空文字列→null 変換が行われている（修正後に PASS）', () => {
    // OFFER_FIELDS に price_reduction_scheduled_date が含まれているか確認
    const offerFieldsPattern = /OFFER_FIELDS\s*=\s*\[([^\]]*)\]/;
    const offerFieldsMatch = backendRouteContent.match(offerFieldsPattern);

    let offerFieldsContent = '';
    if (offerFieldsMatch) {
      offerFieldsContent = offerFieldsMatch[1];
    }

    const priceReductionInOfferFields = offerFieldsContent.includes('price_reduction_scheduled_date');

    console.log('📊 OFFER_FIELDS の内容:');
    console.log('  - OFFER_FIELDS:', offerFieldsContent.trim());
    console.log('  - price_reduction_scheduled_date が OFFER_FIELDS に含まれている:', priceReductionInOfferFields);

    // 個別の変換ロジックが存在するか確認
    // パターン: if (safeUpdates.price_reduction_scheduled_date === '') { safeUpdates.price_reduction_scheduled_date = null; }
    const individualConversionPattern =
      /safeUpdates\.price_reduction_scheduled_date\s*===\s*['"]{2}\s*\)\s*\{[\s\S]*?safeUpdates\.price_reduction_scheduled_date\s*=\s*null/;
    const hasIndividualConversion = individualConversionPattern.test(backendRouteContent);

    console.log('  - 個別の空文字列→null 変換ロジックが存在する:', hasIndividualConversion);

    const hasConversion = priceReductionInOfferFields || hasIndividualConversion;

    if (!hasConversion) {
      // バグが存在する（未修正コード）
      console.log('');
      console.log('❌ カウンターサンプル発見:');
      console.log('  入力: price_reduction_scheduled_date = ""（空文字列）');
      console.log('  実際の動作: 空文字列がそのまま Supabase に渡される');
      console.log('  Supabase の date 型カラムに空文字列を保存しようとするとエラーになる可能性がある');
      console.log('  または空文字列 "" が DB に保存され、再取得時に "" が返る');
      console.log('  バグ条件: price_reduction_scheduled_date === "" のまま変換されずに保存される');
      console.log('');

      // このアサーションは意図的に失敗させる（バグの存在を証明）
      expect(hasConversion).toBe(true); // FAIL: 変換ロジックが存在しない
    } else {
      // バグが修正された（修正後コード）
      console.log('✅ 修正確認: price_reduction_scheduled_date の空文字列→null 変換が実装されている');
      expect(hasConversion).toBe(true); // PASS
    }
  });

  /**
   * テスト 3: PriceSection の showChatButton ロジックを確認する
   *
   * このテストは、showChatButton の計算ロジックが正しく実装されていることを確認する。
   * `showChatButton = !isEditMode && !displayScheduledDate`
   *
   * バグ条件の連鎖を確認:
   * 1. onChatSend prop が渡されていない → TypeScript エラー
   * 2. price_reduction_scheduled_date が "" として保存される → displayScheduledDate が ""
   * 3. !("") === true なのに、onChatSend prop 欠落によりボタンが表示されない
   *
   * **EXPECTED OUTCOME**: テストが PASS する（showChatButton ロジック自体は正しい）
   * このテストはバグの連鎖の第1段階（showChatButton ロジック）を確認する
   */
  test('Bug Condition 1.3: PriceSection の showChatButton ロジックが正しく実装されている（バグの連鎖を確認）', () => {
    // showChatButton の計算ロジックを確認
    const showChatButtonPattern = /const\s+showChatButton\s*=\s*!isEditMode\s*&&\s*!displayScheduledDate/;
    const hasShowChatButtonLogic = showChatButtonPattern.test(priceSectionContent);

    console.log('📊 PriceSection の showChatButton ロジック:');
    console.log('  - showChatButton = !isEditMode && !displayScheduledDate:', hasShowChatButtonLogic);

    if (hasShowChatButtonLogic) {
      console.log('✅ showChatButton ロジック自体は正しく実装されている');
      console.log('   バグの原因は onChatSend prop の欠落と price_reduction_scheduled_date の空文字列保存');
    }

    // showChatButton ロジックは正しいはずなので PASS する
    expect(hasShowChatButtonLogic).toBe(true);
  });

  /**
   * テスト 4: バグ条件の総合確認
   *
   * 2つのバグ条件が同時に存在することを確認する:
   * 1. onChatSend prop が渡されていない
   * 2. price_reduction_scheduled_date の空文字列→null 変換が行われていない
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: 両方のバグが存在する → FAIL
   * - 修正後コード: 両方のバグが修正されている → PASS
   */
  test('Bug Condition 1.4: 両方のバグ条件が修正されている（修正後に PASS）', () => {
    // バグ条件1: onChatSend prop が渡されていない
    const onChatSendPassedPattern = /onChatSend\s*=\s*\{/;
    const hasOnChatSendPassed = onChatSendPassedPattern.test(propertyListingDetailPageContent);

    // バグ条件2: price_reduction_scheduled_date の空文字列→null 変換が行われていない
    const offerFieldsPattern = /OFFER_FIELDS\s*=\s*\[([^\]]*)\]/;
    const offerFieldsMatch = backendRouteContent.match(offerFieldsPattern);
    const offerFieldsContent = offerFieldsMatch ? offerFieldsMatch[1] : '';
    const priceReductionInOfferFields = offerFieldsContent.includes('price_reduction_scheduled_date');

    const individualConversionPattern =
      /safeUpdates\.price_reduction_scheduled_date\s*===\s*['"]{2}\s*\)\s*\{[\s\S]*?safeUpdates\.price_reduction_scheduled_date\s*=\s*null/;
    const hasIndividualConversion = individualConversionPattern.test(backendRouteContent);

    const hasBackendConversion = priceReductionInOfferFields || hasIndividualConversion;

    console.log('📊 バグ条件の総合確認:');
    console.log('  - バグ条件1 (onChatSend prop 欠落) が修正されている:', hasOnChatSendPassed);
    console.log('  - バグ条件2 (空文字列→null 変換欠落) が修正されている:', hasBackendConversion);

    const bothFixed = hasOnChatSendPassed && hasBackendConversion;

    if (!bothFixed) {
      console.log('');
      console.log('❌ バグ条件が存在する（未修正コード）:');
      if (!hasOnChatSendPassed) {
        console.log('  - バグ1: PropertyListingDetailPage.tsx の PriceSection に onChatSend prop が渡されていない');
        console.log('    → TypeScript の必須 prop 違反が発生している');
        console.log('    → コンポーネントが正常にレンダリングされない可能性がある');
      }
      if (!hasBackendConversion) {
        console.log('  - バグ2: バックエンドの PUT 処理で price_reduction_scheduled_date の空文字列→null 変換が行われていない');
        console.log('    → 空欄で保存すると DB に空文字列 "" が保存される');
        console.log('    → 再取得時に "" が返り、ボタン表示に影響する可能性がある');
      }
      console.log('');
    }

    // 両方のバグが修正されていることを期待する（未修正コードでは FAIL）
    expect(bothFixed).toBe(true); // FAIL: 未修正コードでは少なくとも1つのバグが存在する
  });
});
