/**
 * バグ条件探索テスト: 土地面積（当社調べ）保存エラー
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * このテストは修正後のコードで実行し、成功することを確認します。
 * 
 * 修正内容:
 * - PropertyService.mapToPropertyInfo()が property_address のみを使用するように修正
 * - PropertyService.updateProperty()が updates.address を updateData.property_address にマッピング
 * - propertiesテーブルの address カラムを参照しないように修正
 */

import { PropertyService } from '../services/PropertyService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('土地面積（当社調べ）保存エラー - バグ条件探索', () => {
  let propertyService: PropertyService;
  let testSellerId: string;
  let testPropertyId: string;

  beforeAll(async () => {
    propertyService = new PropertyService();

    // テスト用の売主を作成
    const timestamp = Date.now().toString().slice(-8); // 最後の8桁のみ使用
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `TEST_LA_${timestamp}`, // 20文字以内
        name: 'テスト売主',
        status: '追客中',
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`Failed to create test seller: ${sellerError.message}`);
    }

    testSellerId = seller.id;

    // テスト用の物件を作成
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .insert({
        seller_id: testSellerId,
        property_address: '大分市中央町1-1-1', // property_addressカラムを使用
        property_type: '戸建て',
        land_area: 100,
        building_area: 80,
      })
      .select()
      .single();

    if (propertyError) {
      throw new Error(`Failed to create test property: ${propertyError.message}`);
    }

    testPropertyId = property.id;
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    if (testPropertyId) {
      await supabase.from('properties').delete().eq('id', testPropertyId);
    }
    if (testSellerId) {
      await supabase.from('sellers').delete().eq('id', testSellerId);
    }
  });

  /**
   * Property 1: Expected Behavior - 土地面積（当社調べ）保存成功
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * 期待される動作（修正後）:
   * - 正常に保存される
   * - 成功メッセージが返される
   * - property_addressカラムを正しく使用する
   */
  test('土地面積（当社調べ）に値を入力して保存すると、正常に保存される（修正後）', async () => {
    // 土地面積（当社調べ）を更新
    const updateData = {
      landAreaVerified: 100, // 土地面積（当社調べ）
    };

    // 修正後のコードでは、正常に保存される
    const result = await propertyService.updateProperty(testPropertyId, updateData);

    // 保存が成功することを確認
    expect(result).not.toBeNull();
    expect(result.landAreaVerified).toBe(100);
    expect(result.address).toBe('大分市中央町1-1-1'); // property_addressが正しく使用されている
  });

  /**
   * Property 1: Expected Behavior - 土地面積（当社調べ）保存成功（異なる値）
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * 期待される動作（修正後）:
   * - 正しい住所カラム（property_address）を参照して保存される
   * - Geocoding APIエラーが発生しない
   */
  test('土地面積（当社調べ）の保存処理が正常に完了する（修正後）', async () => {
    // 土地面積（当社調べ）を更新
    const updateData = {
      landAreaVerified: 200, // 土地面積（当社調べ）
    };

    // 修正後のコードでは、正常に保存される
    const result = await propertyService.updateProperty(testPropertyId, updateData);

    // 保存が成功することを確認
    expect(result).not.toBeNull();
    expect(result.landAreaVerified).toBe(200);
    expect(result.address).toBe('大分市中央町1-1-1'); // property_addressが正しく使用されている
  });

  /**
   * Property 1: Expected Behavior - 土地面積（当社調べ）保存成功（さらに異なる値）
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * 期待される動作（修正後）:
   * - サーバーは200ステータスコードを返し、保存が成功する
   * - 500エラーが発生しない
   */
  test('土地面積（当社調べ）の保存処理が正常に完了する（さらに異なる値）', async () => {
    // 土地面積（当社調べ）を更新
    const updateData = {
      landAreaVerified: 150, // 土地面積（当社調べ）
    };

    // 修正後のコードでは、正常に保存される
    const result = await propertyService.updateProperty(testPropertyId, updateData);

    // 保存が成功することを確認
    expect(result).not.toBeNull();
    expect(result.landAreaVerified).toBe(150);
    expect(result.address).toBe('大分市中央町1-1-1'); // property_addressが正しく使用されている
  });

  /**
   * エッジケース: 土地面積（当社調べ）に0を入力して保存
   * 
   * 期待される動作:
   * - 正常に保存される
   */
  test('土地面積（当社調べ）に0を入力して保存すると、正常に保存される', async () => {
    // 土地面積（当社調べ）を0に更新
    const updateData = {
      landAreaVerified: 0, // 土地面積（当社調べ）= 0
    };

    // 修正後のコードでは、正常に保存される
    const result = await propertyService.updateProperty(testPropertyId, updateData);

    // 保存が成功することを確認
    expect(result).not.toBeNull();
    expect(result.landAreaVerified).toBe(0);
  });

  /**
   * 根本原因の確認: mapToPropertyInfo()が property_address を正しく使用している
   * 
   * このテストは、PropertyService.getProperty()を呼び出して、
   * mapToPropertyInfo()が property_address を正しく使用していることを確認します。
   */
  test('PropertyService.getProperty()が property_address を正しく使用している（修正後）', async () => {
    // getProperty()を呼び出す（includeDeleted=trueを指定）
    const property = await propertyService.getProperty(testPropertyId, true);

    // property.address が正しく取得されることを確認
    expect(property).not.toBeNull();
    expect(property?.address).toBe('大分市中央町1-1-1');
    
    // 修正後のコードでは、data.property_address のみを使用している
    console.log('property.address:', property?.address);
    console.log('Expected: 大分市中央町1-1-1');
  });
});
