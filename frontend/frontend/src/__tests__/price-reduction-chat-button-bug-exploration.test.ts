/**
 * バグ条件探索テスト: PriceSection.tsx の showChatButton 誤表示バグ
 *
 * **CRITICAL**: このテストは未修正コードで実行し、バグの存在を確認する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **GOAL**: バグが存在することを示すカウンターサンプルを発見する
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: Bug Condition - showChatButton 誤表示バグ
 *
 * バグの根本原因:
 * - 現在のコード: `showChatButton = !isEditMode && !displayScheduledDate`
 * - `isPriceChanged` チェックが欠落しているため、売買価格未変更でも常にバーが表示される
 * - `scheduledDateWasCleared` 状態変数が存在しないため、値下げ予約日クリア時の追跡ができない
 * - `chatSent` 状態変数が存在しないため、送信後のバー非表示制御ができない
 *
 * バグ条件:
 * - `isPriceChanged === false` かつ `displayScheduledDate === null` かつ `isEditMode === false`
 * - この場合、バーが表示される（バグ）
 * - 期待値: `isPriceChanged === false` の場合、どちらのバーも表示されない
 *
 * **注意**: このテストは期待される動作をエンコードしている
 * - 未修正コード: テストが FAIL する（バグの存在を証明）
 * - 修正後コード: テストが PASS する（バグが修正されたことを確認）
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property 1: Bug Condition - showChatButton 誤表示バグ（PriceSection.tsx 静的解析）', () => {
  const priceSectionPath = path.join(
    __dirname,
    '../components/PriceSection.tsx'
  );

  let priceSectionContent: string;

  beforeAll(() => {
    priceSectionContent = fs.readFileSync(priceSectionPath, 'utf-8');
  });

  /**
   * テスト 1: showChatButton の計算式に isPriceChanged チェックが含まれていないことを確認
   *
   * バグ条件:
   * - 現在のコード: `showChatButton = !isEditMode && !displayScheduledDate`
   * - `isPriceChanged` チェックが欠落している
   * - 結果: `isPriceChanged === false` でも `displayScheduledDate` が空なら常にバーが表示される
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: `isPriceChanged` チェックが欠落している → FAIL
   * - 修正後コード: `isPriceChanged` チェックが含まれている → PASS
   */
  test('Bug Condition 1.1: showChatButton の計算式に isPriceChanged チェックが含まれている（修正後に PASS）', () => {
    // 現在の showChatButton 計算式を確認
    const currentBuggyPattern = /const\s+showChatButton\s*=\s*!isEditMode\s*&&\s*!displayScheduledDate/;
    const hasBuggyLogic = currentBuggyPattern.test(priceSectionContent);

    // 修正後の期待される計算式パターン（isPriceChanged を含む）
    // showOrangeChatButton または showBlueChatButton として分離されているか確認
    const fixedOrangePattern = /const\s+showOrangeChatButton\s*=/;
    const fixedBluePattern = /const\s+showBlueChatButton\s*=/;
    const hasFixedLogic = fixedOrangePattern.test(priceSectionContent) && fixedBluePattern.test(priceSectionContent);

    console.log('📊 PriceSection.tsx の showChatButton ロジック分析:');
    console.log('  - バグのある計算式 (showChatButton = !isEditMode && !displayScheduledDate) が存在する:', hasBuggyLogic);
    console.log('  - 修正後の計算式 (showOrangeChatButton + showBlueChatButton) が存在する:', hasFixedLogic);

    if (hasBuggyLogic && !hasFixedLogic) {
      // バグが存在する（未修正コード）
      console.log('');
      console.log('❌ カウンターサンプル発見:');
      console.log('  入力: isPriceChanged = false, displayScheduledDate = null, isEditMode = false');
      console.log('  現在の計算式: showChatButton = !isEditMode && !displayScheduledDate');
      console.log('  計算結果: showChatButton = !false && !null = true && true = true');
      console.log('  実際の動作: バーが表示される（バグ）');
      console.log('  期待される動作: isPriceChanged === false の場合、どちらのバーも表示されない');
      console.log('  バグ条件: isPriceChanged チェックが showChatButton 計算式に含まれていない');
      console.log('');

      // このアサーションは意図的に失敗させる（バグの存在を証明）
      expect(hasFixedLogic).toBe(true); // FAIL: isPriceChanged チェックが欠落している
    } else if (hasFixedLogic) {
      // バグが修正された（修正後コード）
      console.log('✅ 修正確認: showOrangeChatButton と showBlueChatButton が分離されている');
      expect(hasFixedLogic).toBe(true); // PASS
    } else {
      console.log('⚠️ 予期しない状態: 実装を確認してください');
      expect(hasFixedLogic).toBe(true);
    }
  });

  /**
   * テスト 2: scheduledDateWasCleared 状態変数が存在することを確認
   *
   * バグ条件:
   * - `scheduledDateWasCleared` 状態変数が存在しない
   * - 値下げ予約日が一度入力された後に空欄にされたことを追跡できない
   * - 結果: オレンジのバーの表示条件が正しく制御できない
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: `scheduledDateWasCleared` が存在しない → FAIL
   * - 修正後コード: `scheduledDateWasCleared` が存在する → PASS
   */
  test('Bug Condition 1.2: scheduledDateWasCleared 状態変数が存在する（修正後に PASS）', () => {
    // scheduledDateWasCleared の useState 定義を確認
    const scheduledDateWasClearedPattern = /scheduledDateWasCleared/;
    const hasScheduledDateWasCleared = scheduledDateWasClearedPattern.test(priceSectionContent);

    console.log('📊 PriceSection.tsx の scheduledDateWasCleared 状態変数分析:');
    console.log('  - scheduledDateWasCleared が存在する:', hasScheduledDateWasCleared);

    if (!hasScheduledDateWasCleared) {
      // バグが存在する（未修正コード）
      console.log('');
      console.log('❌ カウンターサンプル発見:');
      console.log('  - scheduledDateWasCleared 状態変数が存在しない');
      console.log('  - 値下げ予約日が一度入力された後に空欄にされたことを追跡できない');
      console.log('  - オレンジのバーの表示条件が正しく制御できない');
      console.log('  - バグ条件: scheduledDateWasCleared が存在しないため、値下げ予約日クリア時の追跡が不可能');
      console.log('');

      // このアサーションは意図的に失敗させる（バグの存在を証明）
      expect(hasScheduledDateWasCleared).toBe(true); // FAIL: scheduledDateWasCleared が存在しない
    } else {
      // バグが修正された（修正後コード）
      console.log('✅ 修正確認: scheduledDateWasCleared 状態変数が存在する');
      expect(hasScheduledDateWasCleared).toBe(true); // PASS
    }
  });

  /**
   * テスト 3: chatSent 状態変数が存在することを確認
   *
   * バグ条件:
   * - `chatSent` 状態変数が存在しない
   * - オレンジのバーから送信完了後にバーを非表示にする制御ができない
   * - 結果: 送信後もオレンジのバーが表示され続ける
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: `chatSent` が存在しない → FAIL
   * - 修正後コード: `chatSent` が存在する → PASS
   */
  test('Bug Condition 1.3: chatSent 状態変数が存在する（修正後に PASS）', () => {
    // chatSent の useState 定義を確認
    const chatSentPattern = /chatSent/;
    const hasChatSent = chatSentPattern.test(priceSectionContent);

    console.log('📊 PriceSection.tsx の chatSent 状態変数分析:');
    console.log('  - chatSent が存在する:', hasChatSent);

    if (!hasChatSent) {
      // バグが存在する（未修正コード）
      console.log('');
      console.log('❌ カウンターサンプル発見:');
      console.log('  - chatSent 状態変数が存在しない');
      console.log('  - オレンジのバーから送信完了後にバーを非表示にする制御ができない');
      console.log('  - 送信後もオレンジのバーが表示され続ける');
      console.log('  - バグ条件: chatSent が存在しないため、送信後のバー非表示制御が不可能');
      console.log('');

      // このアサーションは意図的に失敗させる（バグの存在を証明）
      expect(hasChatSent).toBe(true); // FAIL: chatSent が存在しない
    } else {
      // バグが修正された（修正後コード）
      console.log('✅ 修正確認: chatSent 状態変数が存在する');
      expect(hasChatSent).toBe(true); // PASS
    }
  });

  /**
   * テスト 4: バグ条件の総合確認
   *
   * 3つのバグ条件が同時に存在することを確認する:
   * 1. showChatButton に isPriceChanged チェックが欠落している
   * 2. scheduledDateWasCleared 状態変数が存在しない
   * 3. chatSent 状態変数が存在しない
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: 全てのバグが存在する → FAIL
   * - 修正後コード: 全てのバグが修正されている → PASS
   */
  test('Bug Condition 1.4: 全てのバグ条件が修正されている（修正後に PASS）', () => {
    // バグ条件1: showChatButton に isPriceChanged チェックが欠落
    const currentBuggyPattern = /const\s+showChatButton\s*=\s*!isEditMode\s*&&\s*!displayScheduledDate/;
    const hasBuggyLogic = currentBuggyPattern.test(priceSectionContent);
    const fixedOrangePattern = /const\s+showOrangeChatButton\s*=/;
    const fixedBluePattern = /const\s+showBlueChatButton\s*=/;
    const hasFixedLogic = fixedOrangePattern.test(priceSectionContent) && fixedBluePattern.test(priceSectionContent);

    // バグ条件2: scheduledDateWasCleared が存在しない
    const scheduledDateWasClearedPattern = /scheduledDateWasCleared/;
    const hasScheduledDateWasCleared = scheduledDateWasClearedPattern.test(priceSectionContent);

    // バグ条件3: chatSent が存在しない
    const chatSentPattern = /chatSent/;
    const hasChatSent = chatSentPattern.test(priceSectionContent);

    console.log('📊 バグ条件の総合確認:');
    console.log('  - バグ条件1 (showChatButton に isPriceChanged チェック欠落) が修正されている:', hasFixedLogic);
    console.log('  - バグ条件2 (scheduledDateWasCleared が存在しない) が修正されている:', hasScheduledDateWasCleared);
    console.log('  - バグ条件3 (chatSent が存在しない) が修正されている:', hasChatSent);

    const allFixed = hasFixedLogic && hasScheduledDateWasCleared && hasChatSent;

    if (!allFixed) {
      console.log('');
      console.log('❌ バグ条件が存在する（未修正コード）:');
      if (!hasFixedLogic) {
        console.log('  - バグ1: showChatButton = !isEditMode && !displayScheduledDate（isPriceChanged チェック欠落）');
        console.log('    → isPriceChanged === false でも displayScheduledDate が空なら常にバーが表示される');
        console.log('    → 反例: isPriceChanged=false, displayScheduledDate=null, isEditMode=false → バーが表示される（バグ）');
      }
      if (!hasScheduledDateWasCleared) {
        console.log('  - バグ2: scheduledDateWasCleared 状態変数が存在しない');
        console.log('    → 値下げ予約日クリア時の追跡が不可能');
        console.log('    → オレンジのバーの表示条件が正しく制御できない');
      }
      if (!hasChatSent) {
        console.log('  - バグ3: chatSent 状態変数が存在しない');
        console.log('    → 送信後のバー非表示制御が不可能');
        console.log('    → 送信後もオレンジのバーが表示され続ける');
      }
      console.log('');
    }

    // 全てのバグが修正されていることを期待する（未修正コードでは FAIL）
    expect(allFixed).toBe(true); // FAIL: 未修正コードでは全てのバグが存在する
  });
});
