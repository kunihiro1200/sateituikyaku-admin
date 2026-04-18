/**
 * 保全プロパティテスト: PriceSection.tsx の変化しない動作（リグレッション防止）
 *
 * **重要**: このテストは修正前コードで PASS し、修正後も引き続き PASS することを確認する
 * 修正によって壊れてはいけない既存動作をエンコードしている
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation - 変化しない動作の保全
 *
 * 保全すべき動作（bugfix.md の「変化しない動作」より）:
 * - 3.1: 青いCHAT送信バーから送信を実行すると「確認」フィールドが「未」にリセットされる
 * - 3.2: 値下げ予約日に値が設定されている場合、どちらのCHATバーも表示されない
 * - 3.3: 編集モード中は、どちらのCHATバーも表示されない
 *
 * テスト方法: PriceSection.tsx のソースコードを静的解析して確認する
 * - 修正前コードで PASS する（ベースライン動作の確認）
 * - 修正後コードでも PASS する（リグレッションがないことの確認）
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property 2: Preservation - PriceSection.tsx の変化しない動作（静的解析）', () => {
  const priceSectionPath = path.join(
    __dirname,
    '../components/PriceSection.tsx'
  );

  let priceSectionContent: string;

  beforeAll(() => {
    priceSectionContent = fs.readFileSync(priceSectionPath, 'utf-8');
  });

  /**
   * 保全テスト 1: displayScheduledDate に値がある場合、バーが表示されないロジックが存在する
   *
   * 要件 3.2: WHEN 値下げ予約日に値が設定されている THEN システムは CONTINUE TO
   * どちらのCHATバーも表示しない SHALL
   *
   * 確認内容:
   * - `!displayScheduledDate` が showChatButton 系の計算式に含まれている
   * - 修正前: `showChatButton = !isEditMode && !displayScheduledDate`
   * - 修正後: `showOrangeChatButton = ... && !displayScheduledDate && ...`
   *          `showBlueChatButton = ... && !displayScheduledDate && ...`
   *
   * **EXPECTED OUTCOME**: テストが PASS する（修正前・修正後ともに）
   */
  test('Preservation 1: !displayScheduledDate が showChatButton 系の計算式に含まれている', () => {
    // 修正前のパターン: showChatButton = !isEditMode && !displayScheduledDate
    const preBugFixPattern = /const\s+showChatButton\s*=\s*!isEditMode\s*&&\s*!displayScheduledDate/;
    const hasPreBugFixLogic = preBugFixPattern.test(priceSectionContent);

    // 修正後のパターン: showOrangeChatButton と showBlueChatButton に !displayScheduledDate が含まれる
    const postFixOrangePattern = /const\s+showOrangeChatButton\s*=.*!displayScheduledDate/;
    const postFixBluePattern = /const\s+showBlueChatButton\s*=.*!displayScheduledDate/;
    const hasPostFixLogic =
      postFixOrangePattern.test(priceSectionContent) &&
      postFixBluePattern.test(priceSectionContent);

    // どちらかのパターンが存在すれば OK（修正前または修正後）
    const hasDisplayScheduledDateCheck = hasPreBugFixLogic || hasPostFixLogic;

    console.log('📊 Preservation 1: !displayScheduledDate チェックの存在確認:');
    console.log('  - 修正前パターン (showChatButton = !isEditMode && !displayScheduledDate):', hasPreBugFixLogic);
    console.log('  - 修正後パターン (showOrangeChatButton + showBlueChatButton に !displayScheduledDate):', hasPostFixLogic);
    console.log('  - いずれかのパターンが存在する:', hasDisplayScheduledDateCheck);

    expect(hasDisplayScheduledDateCheck).toBe(true);
  });

  /**
   * 保全テスト 2: isEditMode が true の場合、バーが表示されないロジックが存在する
   *
   * 要件 3.3: WHEN 編集モード中 THEN システムは CONTINUE TO
   * どちらのCHATバーも表示しない SHALL
   *
   * 確認内容:
   * - `!isEditMode` が showChatButton 系の計算式に含まれている
   * - 修正前: `showChatButton = !isEditMode && !displayScheduledDate`
   * - 修正後: `showOrangeChatButton = !isEditMode && ...`
   *          `showBlueChatButton = !isEditMode && ...`
   *
   * **EXPECTED OUTCOME**: テストが PASS する（修正前・修正後ともに）
   */
  test('Preservation 2: !isEditMode が showChatButton 系の計算式に含まれている', () => {
    // 修正前のパターン: showChatButton = !isEditMode && !displayScheduledDate
    const preBugFixPattern = /const\s+showChatButton\s*=\s*!isEditMode\s*&&\s*!displayScheduledDate/;
    const hasPreBugFixLogic = preBugFixPattern.test(priceSectionContent);

    // 修正後のパターン: showOrangeChatButton と showBlueChatButton に !isEditMode が含まれる
    const postFixOrangePattern = /const\s+showOrangeChatButton\s*=\s*!isEditMode/;
    const postFixBluePattern = /const\s+showBlueChatButton\s*=\s*!isEditMode/;
    const hasPostFixLogic =
      postFixOrangePattern.test(priceSectionContent) &&
      postFixBluePattern.test(priceSectionContent);

    // どちらかのパターンが存在すれば OK（修正前または修正後）
    const hasIsEditModeCheck = hasPreBugFixLogic || hasPostFixLogic;

    console.log('📊 Preservation 2: !isEditMode チェックの存在確認:');
    console.log('  - 修正前パターン (showChatButton = !isEditMode && !displayScheduledDate):', hasPreBugFixLogic);
    console.log('  - 修正後パターン (showOrangeChatButton + showBlueChatButton に !isEditMode):', hasPostFixLogic);
    console.log('  - いずれかのパターンが存在する:', hasIsEditModeCheck);

    expect(hasIsEditModeCheck).toBe(true);
  });

  /**
   * 保全テスト 3: handleSendPriceReductionChat 内に onChatSendSuccess の呼び出しが存在する
   *
   * 要件 3.1: WHEN 青いCHAT送信バーから送信を実行する THEN システムは CONTINUE TO
   * 「確認」フィールドを「未」に自動リセットする SHALL
   *
   * 確認内容:
   * - `onChatSendSuccess` の呼び出しが `handleSendPriceReductionChat` 内に存在する
   * - これにより「確認」フィールドが「未」にリセットされる（handlePriceChatSendSuccess が呼ばれる）
   *
   * **EXPECTED OUTCOME**: テストが PASS する（修正前・修正後ともに）
   */
  test('Preservation 3: handleSendPriceReductionChat 内に onChatSendSuccess の呼び出しが存在する', () => {
    // handleSendPriceReductionChat 関数の定義を検索
    const handleSendFuncPattern = /const\s+handleSendPriceReductionChat\s*=\s*async\s*\(\s*\)\s*=>/;
    const hasSendFunction = handleSendFuncPattern.test(priceSectionContent);

    // onChatSendSuccess の呼び出しが存在するか確認
    const onChatSendSuccessCallPattern = /onChatSendSuccess\s*\(/;
    const hasOnChatSendSuccessCall = onChatSendSuccessCallPattern.test(priceSectionContent);

    // handleSendPriceReductionChat 関数のブロックを抽出して onChatSendSuccess が含まれるか確認
    // 関数定義の開始位置を見つける
    const funcStartIndex = priceSectionContent.search(handleSendFuncPattern);
    let hasOnChatSendSuccessInFunc = false;

    if (funcStartIndex !== -1) {
      // 関数の開始から適切な範囲を抽出（最大2000文字）
      const funcBlock = priceSectionContent.substring(funcStartIndex, funcStartIndex + 2000);
      hasOnChatSendSuccessInFunc = /onChatSendSuccess\s*\(/.test(funcBlock);
    }

    console.log('📊 Preservation 3: handleSendPriceReductionChat 内の onChatSendSuccess 呼び出し確認:');
    console.log('  - handleSendPriceReductionChat 関数が存在する:', hasSendFunction);
    console.log('  - onChatSendSuccess の呼び出しが存在する（ファイル全体）:', hasOnChatSendSuccessCall);
    console.log('  - onChatSendSuccess の呼び出しが handleSendPriceReductionChat 内に存在する:', hasOnChatSendSuccessInFunc);

    // handleSendPriceReductionChat 関数が存在し、その中に onChatSendSuccess の呼び出しがある
    expect(hasSendFunction).toBe(true);
    expect(hasOnChatSendSuccessInFunc).toBe(true);
  });
});
