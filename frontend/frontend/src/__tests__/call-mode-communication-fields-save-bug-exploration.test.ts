/**
 * バグ条件探索テスト: コミュニケーション情報フィールドの保存失敗
 * 
 * **CRITICAL**: このテストは修正前のコードで実行し、バグの存在を確認する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **GOAL**: バグが存在することを示す具体例を発見する
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * Property 1: Bug Condition - コミュニケーション情報フィールドの保存失敗
 * 
 * _For any_ ユーザー入力で、通話モードページのコミュニケーション情報フィールド
 * （電話担当、連絡取りやすい日、連絡方法）を編集した場合、
 * 修正前のシステムはデータベースに保存せず、スプレッドシートに同期しない。
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import api from '../services/api';

// Supabaseクライアントの初期化
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

describe('Bug Condition Exploration: コミュニケーション情報フィールドの保存失敗', () => {
  let testSellerId: string;
  let testSellerNumber: string;

  beforeAll(async () => {
    // テスト用の売主を作成
    const { data: seller, error } = await supabase
      .from('sellers')
      .insert({
        seller_number: `TEST-COMM-${Date.now()}`,
        name: 'テスト売主（コミュニケーション情報）',
        phone_number: '090-1234-5678',
        status: '追客中',
        phone_contact_person: null,
        preferred_contact_time: null,
        contact_method: null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test seller: ${error.message}`);
    }

    testSellerId = seller.id;
    testSellerNumber = seller.seller_number;
    console.log('✅ テスト用売主を作成:', { id: testSellerId, seller_number: testSellerNumber });
  });

  afterAll(async () => {
    // テスト用の売主を削除
    if (testSellerId) {
      await supabase
        .from('sellers')
        .delete()
        .eq('id', testSellerId);
      console.log('🗑️ テスト用売主を削除:', testSellerId);
    }
  });

  it('Bug Condition 1.1: 電話担当（任意）フィールドを編集してもデータベースに保存されない', async () => {
    // Arrange: 電話担当フィールドを編集
    const newPhoneContactPerson = '田中';

    // Act: APIリクエストを送信（通話モードページの自動保存処理をシミュレート）
    try {
      await api.put(`/api/sellers/${testSellerId}`, {
        phoneContactPerson: newPhoneContactPerson,
        preferredContactTime: null,
        contactMethod: null,
        firstCallPerson: null,
      });
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
    }

    // 1秒待機（デバウンス処理をシミュレート）
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Assert: データベースから取得して確認
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('phone_contact_person')
      .eq('id', testSellerId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch seller: ${error.message}`);
    }

    console.log('📊 データベースの値:', { phone_contact_person: seller.phone_contact_person });

    // **EXPECTED OUTCOME**: テストが失敗する（これは正しい - バグの存在を証明）
    // 修正前のコードでは、phone_contact_personがnullのまま（保存されない）
    expect(seller.phone_contact_person).toBe(newPhoneContactPerson);
  }, 10000);

  it('Bug Condition 1.2: 連絡取りやすい日フィールドを編集してもデータベースに保存されない', async () => {
    // Arrange: 連絡取りやすい日フィールドを編集
    const newPreferredContactTime = '平日午前中';

    // Act: APIリクエストを送信
    try {
      await api.put(`/api/sellers/${testSellerId}`, {
        phoneContactPerson: null,
        preferredContactTime: newPreferredContactTime,
        contactMethod: null,
        firstCallPerson: null,
      });
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
    }

    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Assert: データベースから取得して確認
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('preferred_contact_time')
      .eq('id', testSellerId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch seller: ${error.message}`);
    }

    console.log('📊 データベースの値:', { preferred_contact_time: seller.preferred_contact_time });

    // **EXPECTED OUTCOME**: テストが失敗する（バグの存在を証明）
    expect(seller.preferred_contact_time).toBe(newPreferredContactTime);
  }, 10000);

  it('Bug Condition 1.3: 連絡方法フィールドを編集してもデータベースに保存されない', async () => {
    // Arrange: 連絡方法フィールドを編集
    const newContactMethod = 'Email優先';

    // Act: APIリクエストを送信
    try {
      await api.put(`/api/sellers/${testSellerId}`, {
        phoneContactPerson: null,
        preferredContactTime: null,
        contactMethod: newContactMethod,
        firstCallPerson: null,
      });
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
    }

    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Assert: データベースから取得して確認
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('contact_method')
      .eq('id', testSellerId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch seller: ${error.message}`);
    }

    console.log('📊 データベースの値:', { contact_method: seller.contact_method });

    // **EXPECTED OUTCOME**: テストが失敗する（バグの存在を証明）
    expect(seller.contact_method).toBe(newContactMethod);
  }, 10000);

  it('Bug Condition 1.4: 複数のコミュニケーション情報フィールドを同時に編集してもデータベースに保存されない', async () => {
    // Arrange: 3つのフィールドを同時に編集
    const newPhoneContactPerson = '佐藤';
    const newPreferredContactTime = '土日午後';
    const newContactMethod = 'SMS優先';

    // Act: APIリクエストを送信
    try {
      await api.put(`/api/sellers/${testSellerId}`, {
        phoneContactPerson: newPhoneContactPerson,
        preferredContactTime: newPreferredContactTime,
        contactMethod: newContactMethod,
        firstCallPerson: null,
      });
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
    }

    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Assert: データベースから取得して確認
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('phone_contact_person, preferred_contact_time, contact_method')
      .eq('id', testSellerId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch seller: ${error.message}`);
    }

    console.log('📊 データベースの値:', {
      phone_contact_person: seller.phone_contact_person,
      preferred_contact_time: seller.preferred_contact_time,
      contact_method: seller.contact_method,
    });

    // **EXPECTED OUTCOME**: テストが失敗する（バグの存在を証明）
    expect(seller.phone_contact_person).toBe(newPhoneContactPerson);
    expect(seller.preferred_contact_time).toBe(newPreferredContactTime);
    expect(seller.contact_method).toBe(newContactMethod);
  }, 10000);

  it('Counterexample: 1番電話フィールドは正常に保存される（バグなし）', async () => {
    // Arrange: 1番電話フィールドを編集
    const newFirstCallPerson = '山田';

    // Act: APIリクエストを送信
    try {
      await api.put(`/api/sellers/${testSellerId}`, {
        phoneContactPerson: null,
        preferredContactTime: null,
        contactMethod: null,
        firstCallPerson: newFirstCallPerson,
      });
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
    }

    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Assert: データベースから取得して確認
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('first_call_person')
      .eq('id', testSellerId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch seller: ${error.message}`);
    }

    console.log('📊 データベースの値:', { first_call_person: seller.first_call_person });

    // **EXPECTED OUTCOME**: テストが成功する（1番電話は正常に保存される）
    expect(seller.first_call_person).toBe(newFirstCallPerson);
  }, 10000);
});
