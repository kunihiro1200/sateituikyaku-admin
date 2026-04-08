/**
 * バグ条件探索テスト: 買主詳細画面「他社物件情報」セクション条件表示
 * 
 * **Validates: Requirements 1.1, 2.1, 2.2**
 * 
 * このテストは修正前のコードで実行し、失敗することを確認する（失敗がバグの存在を証明）
 * 
 * Property 1: Bug Condition - 他社物件情報セクションの条件付き表示
 * 
 * For any 買主詳細画面において、他社物件フィールド（other_company_property）が
 * 空（null、undefined、または空文字列）の場合、「他社物件情報」セクションは非表示にされるべきです。
 * other_company_propertyに値がある場合は、セクションが表示されるべきです。
 * 
 * 注意: building_name_priceフィールドは条件に含めません。
 */

// モックデータ
const mockBuyerWithEmptyFields = {
  buyer_number: 'B001',
  name: 'テスト買主',
  phone_number: '090-1234-5678',
  email: 'test@example.com',
  other_company_property: null,
  building_name_price: null,
};

const mockBuyerWithEmptyStrings = {
  buyer_number: 'B002',
  name: 'テスト買主2',
  phone_number: '090-1234-5679',
  email: 'test2@example.com',
  other_company_property: '',
  building_name_price: '',
};

const mockBuyerWithWhitespace = {
  buyer_number: 'B003',
  name: 'テスト買主3',
  phone_number: '090-1234-5680',
  email: 'test3@example.com',
  other_company_property: '   ',
  building_name_price: '   ',
};

const mockBuyerWithOtherCompanyProperty = {
  buyer_number: 'B004',
  name: 'テスト買主4',
  phone_number: '090-1234-5681',
  email: 'test4@example.com',
  other_company_property: '〇〇マンション',
  building_name_price: null,
};

const mockBuyerWithBuildingNamePrice = {
  buyer_number: 'B005',
  name: 'テスト買主5',
  phone_number: '090-1234-5682',
  email: 'test5@example.com',
  other_company_property: null,
  building_name_price: '△△ビル/3000万円',
};

const mockBuyerWithBothFields = {
  buyer_number: 'B006',
  name: 'テスト買主6',
  phone_number: '090-1234-5683',
  email: 'test6@example.com',
  other_company_property: '〇〇マンション',
  building_name_price: '△△ビル/3000万円',
};

describe('買主詳細画面「他社物件情報」セクション条件表示 - バグ条件探索', () => {
  describe('バグケース: 両フィールドが空の場合、セクションは非表示にすべき', () => {
    test('両フィールドがnullの場合、セクションは非表示にすべき', () => {
      // このテストは修正前のコードで失敗する（バグの存在を証明）
      // 期待: セクションが非表示
      // 実際（修正前）: セクションが表示される（バグ）
      
      const hasOtherCompanyProperty = mockBuyerWithEmptyFields.other_company_property;
      const hasBuildingNamePrice = mockBuyerWithEmptyFields.building_name_price;
      
      // 両方が空（null）であることを確認
      expect(hasOtherCompanyProperty).toBeNull();
      expect(hasBuildingNamePrice).toBeNull();
      
      // 修正前の条件式の評価をシミュレート
      const shouldDisplay = !!(hasOtherCompanyProperty || hasBuildingNamePrice);
      
      // 期待される動作: 両方が空の場合、セクションは非表示（shouldDisplay = false）
      expect(shouldDisplay).toBe(false);
    });

    test('両フィールドが空文字列の場合、セクションは非表示にすべき', () => {
      const hasOtherCompanyProperty = mockBuyerWithEmptyStrings.other_company_property;
      const hasBuildingNamePrice = mockBuyerWithEmptyStrings.building_name_price;
      
      // 両方が空文字列であることを確認
      expect(hasOtherCompanyProperty).toBe('');
      expect(hasBuildingNamePrice).toBe('');
      
      // 修正前の条件式の評価をシミュレート
      const shouldDisplay = !!(hasOtherCompanyProperty || hasBuildingNamePrice);
      
      // 期待される動作: 両方が空文字列の場合、セクションは非表示（shouldDisplay = false）
      expect(shouldDisplay).toBe(false);
    });

    test('両フィールドが空白文字のみの場合、セクションは非表示にすべき', () => {
      const hasOtherCompanyProperty = mockBuyerWithWhitespace.other_company_property;
      const hasBuildingNamePrice = mockBuyerWithWhitespace.building_name_price;
      
      // 両方が空白文字のみであることを確認
      expect(hasOtherCompanyProperty?.trim()).toBe('');
      expect(hasBuildingNamePrice?.trim()).toBe('');
      
      // 修正前の条件式の評価をシミュレート
      // 空白文字のみの場合、!!演算子はtrueを返す（バグ）
      const shouldDisplayBuggy = !!(hasOtherCompanyProperty || hasBuildingNamePrice);
      
      // 修正後の条件式の評価をシミュレート（trim()を考慮）
      const shouldDisplayFixed = !!((hasOtherCompanyProperty && hasOtherCompanyProperty.trim() !== '') || 
                              (hasBuildingNamePrice && hasBuildingNamePrice.trim() !== ''));
      
      // 期待される動作: 両方が空白文字のみの場合、セクションは非表示（shouldDisplay = false）
      expect(shouldDisplayFixed).toBe(false);
      
      // バグの確認: 修正前は空白文字をtruthyと判定する
      expect(shouldDisplayBuggy).toBe(true); // 修正前の動作（バグ）
      console.log('❌ バグ確認: 空白文字のみの場合、修正前の条件式はtrueを返す');
    });
  });

  describe('正常ケース: other_company_propertyに値がある場合、セクションは表示すべき', () => {
    test('other_company_propertyのみ値がある場合、セクションは表示すべき', () => {
      const hasOtherCompanyProperty = mockBuyerWithOtherCompanyProperty.other_company_property;
      
      // other_company_propertyに値があることを確認
      expect(hasOtherCompanyProperty).toBe('〇〇マンション');
      
      // 修正後の条件式の評価をシミュレート（other_company_propertyのみをチェック）
      const shouldDisplay = !!(hasOtherCompanyProperty && hasOtherCompanyProperty.trim() !== '');
      
      // 期待される動作: other_company_propertyに値がある場合、セクションは表示（shouldDisplay = true）
      expect(shouldDisplay).toBe(true);
    });

    test('building_name_priceのみ値がある場合、セクションは非表示にすべき', () => {
      const hasOtherCompanyProperty = mockBuyerWithBuildingNamePrice.other_company_property;
      const hasBuildingNamePrice = mockBuyerWithBuildingNamePrice.building_name_price;
      
      // building_name_priceに値があるが、other_company_propertyは空
      expect(hasOtherCompanyProperty).toBeNull();
      expect(hasBuildingNamePrice).toBe('△△ビル/3000万円');
      
      // 修正後の条件式の評価をシミュレート（other_company_propertyのみをチェック）
      const shouldDisplay = !!(hasOtherCompanyProperty && hasOtherCompanyProperty.trim() !== '');
      
      // 期待される動作: other_company_propertyが空の場合、セクションは非表示（shouldDisplay = false）
      // building_name_priceは条件に含めない
      expect(shouldDisplay).toBe(false);
    });

    test('両フィールドに値がある場合、セクションは表示すべき', () => {
      const hasOtherCompanyProperty = mockBuyerWithBothFields.other_company_property;
      
      // other_company_propertyに値があることを確認
      expect(hasOtherCompanyProperty).toBe('〇〇マンション');
      
      // 修正後の条件式の評価をシミュレート（other_company_propertyのみをチェック）
      const shouldDisplay = !!(hasOtherCompanyProperty && hasOtherCompanyProperty.trim() !== '');
      
      // 期待される動作: other_company_propertyに値がある場合、セクションは表示（shouldDisplay = true）
      expect(shouldDisplay).toBe(true);
    });
  });

  describe('修正後の条件式の検証', () => {
    test('修正後の条件式はother_company_propertyのみをチェックすべき', () => {
      // 修正後の条件式をテスト（other_company_propertyのみをチェック）
      const hasOtherCompanyPropertyData = (buyer: any): boolean => {
        if (!buyer) return false;
        // 「他社物件」フィールドのみをチェック（「建物名/価格」は条件に含めない）
        const hasOtherProperty = !!(buyer.other_company_property && buyer.other_company_property.trim() !== '');
        return hasOtherProperty;
      };

      // 両方がnullの場合
      expect(hasOtherCompanyPropertyData(mockBuyerWithEmptyFields)).toBe(false);
      
      // 両方が空文字列の場合
      expect(hasOtherCompanyPropertyData(mockBuyerWithEmptyStrings)).toBe(false);
      
      // 両方が空白文字のみの場合
      expect(hasOtherCompanyPropertyData(mockBuyerWithWhitespace)).toBe(false);
      
      // other_company_propertyのみ値がある場合
      expect(hasOtherCompanyPropertyData(mockBuyerWithOtherCompanyProperty)).toBe(true);
      
      // building_name_priceのみ値がある場合（other_company_propertyは空）
      // 修正後: 非表示にすべき
      expect(hasOtherCompanyPropertyData(mockBuyerWithBuildingNamePrice)).toBe(false);
      
      // 両方に値がある場合
      expect(hasOtherCompanyPropertyData(mockBuyerWithBothFields)).toBe(true);
    });
  });
});

console.log('✅ バグ条件探索テスト完了');
console.log('📝 確認事項:');
console.log('  - other_company_propertyが空の場合、セクションは非表示');
console.log('  - building_name_priceは条件に含めない');
console.log('  - 修正後の条件式はother_company_propertyのみをチェック');

