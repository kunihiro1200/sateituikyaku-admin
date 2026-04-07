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
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// 環境変数の読み込み
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runBugExplorationTest() {
  console.log('🧪 バグ条件探索テスト開始...\n');

  let testSellerId: string | null = null;
  let testSellerNumber: string | null = null;

  try {
    // テスト用の売主を作成
    console.log('📝 テスト用売主を作成中...');
    const timestamp = Date.now().toString().slice(-8); // 最後の8桁のみ使用
    const { data: seller, error: createError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `TEST-${timestamp}`,
        name: 'テスト売主（コミュニケーション情報）',
        phone_number: '090-1234-5678',
        status: '追客中',
        phone_contact_person: null,
        preferred_contact_time: null,
        contact_method: null,
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create test seller: ${createError.message}`);
    }

    testSellerId = seller.id;
    testSellerNumber = seller.seller_number;
    console.log(`✅ テスト用売主を作成: ${testSellerNumber} (ID: ${testSellerId})\n`);

    // テスト1: 電話担当フィールドの保存テスト
    console.log('🧪 テスト1: 電話担当（任意）フィールドの保存テスト');
    const newPhoneContactPerson = '田中';
    
    try {
      await axios.put(`${apiBaseUrl}/api/sellers/${testSellerId}`, {
        phoneContactPerson: newPhoneContactPerson,
        preferredContactTime: null,
        contactMethod: null,
        firstCallPerson: null,
      });
      console.log('✅ API呼び出し成功');
    } catch (error: any) {
      console.error('❌ API呼び出しエラー:', error.response?.data || error.message);
    }

    // 1秒待機（デバウンス処理をシミュレート）
    await new Promise(resolve => setTimeout(resolve, 1000));

    // データベースから取得して確認
    const { data: seller1, error: error1 } = await supabase
      .from('sellers')
      .select('phone_contact_person')
      .eq('id', testSellerId)
      .single();

    if (error1) {
      throw new Error(`Failed to fetch seller: ${error1.message}`);
    }

    console.log('📊 データベースの値:', { phone_contact_person: seller1.phone_contact_person });
    
    if (seller1.phone_contact_person === newPhoneContactPerson) {
      console.log('✅ テスト1: 成功（phone_contact_personが保存された）\n');
    } else {
      console.log('❌ テスト1: 失敗（phone_contact_personが保存されていない）');
      console.log(`   期待値: ${newPhoneContactPerson}`);
      console.log(`   実際の値: ${seller1.phone_contact_person}\n`);
    }

    // テスト2: 連絡取りやすい日フィールドの保存テスト
    console.log('🧪 テスト2: 連絡取りやすい日フィールドの保存テスト');
    const newPreferredContactTime = '平日午前中';
    
    try {
      await axios.put(`${apiBaseUrl}/api/sellers/${testSellerId}`, {
        phoneContactPerson: null,
        preferredContactTime: newPreferredContactTime,
        contactMethod: null,
        firstCallPerson: null,
      });
      console.log('✅ API呼び出し成功');
    } catch (error: any) {
      console.error('❌ API呼び出しエラー:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: seller2, error: error2 } = await supabase
      .from('sellers')
      .select('preferred_contact_time')
      .eq('id', testSellerId)
      .single();

    if (error2) {
      throw new Error(`Failed to fetch seller: ${error2.message}`);
    }

    console.log('📊 データベースの値:', { preferred_contact_time: seller2.preferred_contact_time });
    
    if (seller2.preferred_contact_time === newPreferredContactTime) {
      console.log('✅ テスト2: 成功（preferred_contact_timeが保存された）\n');
    } else {
      console.log('❌ テスト2: 失敗（preferred_contact_timeが保存されていない）');
      console.log(`   期待値: ${newPreferredContactTime}`);
      console.log(`   実際の値: ${seller2.preferred_contact_time}\n`);
    }

    // テスト3: 連絡方法フィールドの保存テスト
    console.log('🧪 テスト3: 連絡方法フィールドの保存テスト');
    const newContactMethod = 'Email優先';
    
    try {
      await axios.put(`${apiBaseUrl}/api/sellers/${testSellerId}`, {
        phoneContactPerson: null,
        preferredContactTime: null,
        contactMethod: newContactMethod,
        firstCallPerson: null,
      });
      console.log('✅ API呼び出し成功');
    } catch (error: any) {
      console.error('❌ API呼び出しエラー:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: seller3, error: error3 } = await supabase
      .from('sellers')
      .select('contact_method')
      .eq('id', testSellerId)
      .single();

    if (error3) {
      throw new Error(`Failed to fetch seller: ${error3.message}`);
    }

    console.log('📊 データベースの値:', { contact_method: seller3.contact_method });
    
    if (seller3.contact_method === newContactMethod) {
      console.log('✅ テスト3: 成功（contact_methodが保存された）\n');
    } else {
      console.log('❌ テスト3: 失敗（contact_methodが保存されていない）');
      console.log(`   期待値: ${newContactMethod}`);
      console.log(`   実際の値: ${seller3.contact_method}\n`);
    }

    // テスト4: 複数フィールド同時編集テスト
    console.log('🧪 テスト4: 複数のコミュニケーション情報フィールドを同時に編集');
    const newPhoneContactPerson2 = '佐藤';
    const newPreferredContactTime2 = '土日午後';
    const newContactMethod2 = 'SMS優先';
    
    try {
      await axios.put(`${apiBaseUrl}/api/sellers/${testSellerId}`, {
        phoneContactPerson: newPhoneContactPerson2,
        preferredContactTime: newPreferredContactTime2,
        contactMethod: newContactMethod2,
        firstCallPerson: null,
      });
      console.log('✅ API呼び出し成功');
    } catch (error: any) {
      console.error('❌ API呼び出しエラー:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: seller4, error: error4 } = await supabase
      .from('sellers')
      .select('phone_contact_person, preferred_contact_time, contact_method')
      .eq('id', testSellerId)
      .single();

    if (error4) {
      throw new Error(`Failed to fetch seller: ${error4.message}`);
    }

    console.log('📊 データベースの値:', {
      phone_contact_person: seller4.phone_contact_person,
      preferred_contact_time: seller4.preferred_contact_time,
      contact_method: seller4.contact_method,
    });
    
    const allFieldsSaved = 
      seller4.phone_contact_person === newPhoneContactPerson2 &&
      seller4.preferred_contact_time === newPreferredContactTime2 &&
      seller4.contact_method === newContactMethod2;
    
    if (allFieldsSaved) {
      console.log('✅ テスト4: 成功（全てのフィールドが保存された）\n');
    } else {
      console.log('❌ テスト4: 失敗（一部またはすべてのフィールドが保存されていない）');
      console.log(`   期待値: phone_contact_person=${newPhoneContactPerson2}, preferred_contact_time=${newPreferredContactTime2}, contact_method=${newContactMethod2}`);
      console.log(`   実際の値: phone_contact_person=${seller4.phone_contact_person}, preferred_contact_time=${seller4.preferred_contact_time}, contact_method=${seller4.contact_method}\n`);
    }

    // テスト5: 1番電話フィールドは正常に保存される（対照実験）
    console.log('🧪 テスト5: 1番電話フィールドは正常に保存される（対照実験）');
    const newFirstCallPerson = '山田';
    
    try {
      await axios.put(`${apiBaseUrl}/api/sellers/${testSellerId}`, {
        phoneContactPerson: null,
        preferredContactTime: null,
        contactMethod: null,
        firstCallPerson: newFirstCallPerson,
      });
      console.log('✅ API呼び出し成功');
    } catch (error: any) {
      console.error('❌ API呼び出しエラー:', error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: seller5, error: error5 } = await supabase
      .from('sellers')
      .select('first_call_person')
      .eq('id', testSellerId)
      .single();

    if (error5) {
      throw new Error(`Failed to fetch seller: ${error5.message}`);
    }

    console.log('📊 データベースの値:', { first_call_person: seller5.first_call_person });
    
    if (seller5.first_call_person === newFirstCallPerson) {
      console.log('✅ テスト5: 成功（first_call_personが保存された）\n');
    } else {
      console.log('❌ テスト5: 失敗（first_call_personが保存されていない）');
      console.log(`   期待値: ${newFirstCallPerson}`);
      console.log(`   実際の値: ${seller5.first_call_person}\n`);
    }

  } catch (error: any) {
    console.error('❌ テスト実行エラー:', error.message);
    console.error(error.stack);
  } finally {
    // テスト用の売主を削除
    if (testSellerId) {
      console.log('🗑️ テスト用売主を削除中...');
      await supabase
        .from('sellers')
        .delete()
        .eq('id', testSellerId);
      console.log(`✅ テスト用売主を削除: ${testSellerNumber}\n`);
    }
  }

  console.log('🏁 バグ条件探索テスト完了\n');
  console.log('📝 まとめ:');
  console.log('   - テスト1-4が失敗する場合、バグが存在することを証明');
  console.log('   - テスト5が成功する場合、1番電話フィールドは正常に動作');
  console.log('   - 根本原因: フロントエンドのAPIリクエストにphoneContactPersonが欠落');
  console.log('   - 根本原因: バックエンドのupdateSellerメソッドで3つのフィールドが処理されていない');
}

// テストを実行
runBugExplorationTest()
  .then(() => {
    console.log('✅ テストスクリプト完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ テストスクリプトエラー:', error);
    process.exit(1);
  });
