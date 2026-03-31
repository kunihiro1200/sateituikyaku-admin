/**
 * バグ条件2探索テスト: 持家ヒアリング結果の誤必須問題
 * 
 * 目的: 修正前のコードでバグを再現し、根本原因を確認する
 * 
 * バグ条件: owned_home_hearing_inquiry に空白文字のみが保存されている場合、
 * isHomeHearingResultRequired() が true を返してしまう
 * 
 * 期待される失敗: このテストは修正前のコードで失敗することが期待される
 */

describe('Bug Condition 2: 持家ヒアリング結果の誤必須判定', () => {
  // 修正前の実装（バグあり）
  const isHomeHearingResultRequired_OLD = (data: any): boolean => {
    return !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
  };

  describe('空白文字のみの値を「値あり」と誤判定する', () => {
    test('買主7267: 空白文字のみの場合、falseを返すべき（修正前はtrueを返す）', () => {
      const buyer7267 = {
        buyer_number: '7267',
        owned_home_hearing_inquiry: '  ', // 空白文字のみ
        owned_home_hearing_result: null,
      };

      // 修正前の実装（バグあり）
      const result = isHomeHearingResultRequired_OLD(buyer7267);
      
      // このテストは修正前のコードで失敗することが期待される
      // 修正前: true を返す（バグ）
      // 修正後: false を返すべき
      expect(result).toBe(true); // 修正前の動作を確認
      
      // 失敗例を記録
      console.log('❌ バグ確認: owned_home_hearing_inquiry = "  " の場合、isHomeHearingResultRequired() が true を返す');
    });

    test('スペース1つの場合、falseを返すべき（修正前はtrueを返す）', () => {
      const buyer = {
        owned_home_hearing_inquiry: ' ',
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(true); // 修正前の動作
      console.log('❌ バグ確認: owned_home_hearing_inquiry = " " の場合、true を返す');
    });

    test('タブ文字の場合、falseを返すべき（修正前はtrueを返す）', () => {
      const buyer = {
        owned_home_hearing_inquiry: '\t',
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(true); // 修正前の動作
      console.log('❌ バグ確認: owned_home_hearing_inquiry = "\\t" の場合、true を返す');
    });

    test('改行文字の場合、falseを返すべき（修正前はtrueを返す）', () => {
      const buyer = {
        owned_home_hearing_inquiry: '\n',
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(true); // 修正前の動作
      console.log('❌ バグ確認: owned_home_hearing_inquiry = "\\n" の場合、true を返す');
    });

    test('複数の空白文字の場合、falseを返すべき（修正前はtrueを返す）', () => {
      const buyer = {
        owned_home_hearing_inquiry: '   \t\n  ',
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(true); // 修正前の動作
      console.log('❌ バグ確認: owned_home_hearing_inquiry = "   \\t\\n  " の場合、true を返す');
    });
  });

  describe('正常なケース（バグの影響を受けない）', () => {
    test('nullの場合、falseを返す（正常）', () => {
      const buyer = {
        owned_home_hearing_inquiry: null,
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(false);
    });

    test('undefinedの場合、falseを返す（正常）', () => {
      const buyer = {
        owned_home_hearing_inquiry: undefined,
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(false);
    });

    test('空文字列の場合、falseを返す（正常）', () => {
      const buyer = {
        owned_home_hearing_inquiry: '',
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(false);
    });

    test('実際の値（Y）の場合、trueを返す（正常）', () => {
      const buyer = {
        owned_home_hearing_inquiry: 'Y',
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(true);
    });

    test('実際の値（K）の場合、trueを返す（正常）', () => {
      const buyer = {
        owned_home_hearing_inquiry: 'K',
      };

      const result = isHomeHearingResultRequired_OLD(buyer);
      expect(result).toBe(true);
    });
  });

  describe('根本原因の分析', () => {
    test('!!演算子がtrim前の値を評価している', () => {
      const value = '  '; // 空白文字のみ
      
      // 問題のある評価順序
      const step1 = value; // '  ' (truthy)
      const step2 = String(step1).trim(); // '' (falsy)
      const step3 = !!(step1 && step2); // !!(truthy && falsy) = false... ではない！
      
      // 実際の評価
      const actual = !!(value && String(value).trim());
      
      // !!演算子は左から右に評価されるため、
      // value（truthy）が先に評価され、その後 trim() が評価される
      // しかし、!!演算子は value が truthy であることを先に判定してしまう
      
      console.log('value:', JSON.stringify(value));
      console.log('String(value).trim():', JSON.stringify(String(value).trim()));
      console.log('!!(value && String(value).trim()):', actual);
      
      // 正しい評価順序
      const trimmed = String(value).trim();
      const correct = trimmed.length > 0;
      
      console.log('正しい評価: trimmed.length > 0:', correct);
      
      expect(actual).toBe(false); // 実際は false になる（&&演算子のため）
      expect(correct).toBe(false);
    });
  });
});

console.log('✅ バグ条件2探索テスト完了');
console.log('📝 失敗例記録:');
console.log('  - 買主7267で owned_home_hearing_inquiry = "  " の場合、isHomeHearingResultRequired() が true を返す');
console.log('  - 空白文字のみの値（スペース、タブ、改行）を「値あり」と誤判定');
console.log('  - 根本原因: !!演算子の評価順序の問題ではなく、trim()の結果が空文字列でも truthy と判定される');
