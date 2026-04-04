/**
 * 保存プロパティテスト - 買主リストサイドバーカテゴリー表示バグ修正
 * 
 * このテストは修正前のコードで実行し、非バグ条件の動作を観察します。
 * 
 * 保存要件:
 * - 売主リストページのサイドバーは正常に表示される
 * - 買主データの同期は正常に動作する
 * - 買主リストページの他の機能は正常に動作する
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'https://sateituikyaku-admin-backend.vercel.app';

interface PreservationTestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

async function testSellerSidebarDisplay(): Promise<PreservationTestResult> {
  try {
    console.log('\n📊 テスト: 売主リストサイドバーの表示');
    
    const response = await axios.get(`${API_BASE_URL}/api/sellers/status-categories-with-sellers`);
    
    const { statusCategoriesWithSellers } = response.data;
    
    // 売主リストのサイドバーカテゴリーが正常に表示されることを確認
    const hasCategories = statusCategoriesWithSellers && statusCategoriesWithSellers.length > 0;
    
    if (hasCategories) {
      console.log(`✅ 売主リストサイドバーカテゴリー数: ${statusCategoriesWithSellers.length}`);
      console.log(`   カテゴリー: ${statusCategoriesWithSellers.map((c: any) => c.category).join(', ')}`);
      
      return {
        testName: '売主リストサイドバーの表示',
        passed: true,
        message: `売主リストサイドバーは正常に表示されています（${statusCategoriesWithSellers.length}カテゴリー）`,
        details: { categoryCount: statusCategoriesWithSellers.length }
      };
    } else {
      return {
        testName: '売主リストサイドバーの表示',
        passed: false,
        message: '売主リストサイドバーカテゴリーが空です',
        details: { statusCategoriesWithSellers }
      };
    }
  } catch (error: any) {
    return {
      testName: '売主リストサイドバーの表示',
      passed: false,
      message: `エラー: ${error.message}`,
      details: { error: error.message }
    };
  }
}

async function testBuyerDataSync(): Promise<PreservationTestResult> {
  try {
    console.log('\n📊 テスト: 買主データの同期');
    
    // 買主一覧を取得
    const response = await axios.get(`${API_BASE_URL}/api/buyers`, {
      params: { page: 1, limit: 10 }
    });
    
    const { buyers, total } = response.data;
    
    // 買主データが正常に取得できることを確認
    const hasBuyers = buyers && buyers.length > 0;
    
    if (hasBuyers) {
      console.log(`✅ 買主データ取得成功: ${buyers.length}件（全${total}件）`);
      
      // 最初の買主のフィールドを確認
      const firstBuyer = buyers[0];
      const hasRequiredFields = firstBuyer.buyer_number && firstBuyer.latest_status;
      
      if (hasRequiredFields) {
        console.log(`   買主番号: ${firstBuyer.buyer_number}`);
        console.log(`   最新状況: ${firstBuyer.latest_status}`);
        
        return {
          testName: '買主データの同期',
          passed: true,
          message: `買主データは正常に同期されています（${total}件）`,
          details: { buyerCount: total, sampleBuyer: firstBuyer.buyer_number }
        };
      } else {
        return {
          testName: '買主データの同期',
          passed: false,
          message: '買主データに必須フィールドが不足しています',
          details: { firstBuyer }
        };
      }
    } else {
      return {
        testName: '買主データの同期',
        passed: false,
        message: '買主データが取得できません',
        details: { buyers, total }
      };
    }
  } catch (error: any) {
    return {
      testName: '買主データの同期',
      passed: false,
      message: `エラー: ${error.message}`,
      details: { error: error.message }
    };
  }
}

async function testBuyerListOtherFeatures(): Promise<PreservationTestResult> {
  try {
    console.log('\n📊 テスト: 買主リストページの他の機能');
    
    // 買主一覧のフィルタリング機能をテスト
    const response = await axios.get(`${API_BASE_URL}/api/buyers`, {
      params: { 
        page: 1, 
        limit: 10,
        statusCategory: 'all'  // 「全て」カテゴリーでフィルタリング
      }
    });
    
    const { buyers, total } = response.data;
    
    // フィルタリング機能が正常に動作することを確認
    const hasFilteredBuyers = buyers && buyers.length > 0;
    
    if (hasFilteredBuyers) {
      console.log(`✅ フィルタリング機能正常: ${buyers.length}件（全${total}件）`);
      
      return {
        testName: '買主リストページの他の機能',
        passed: true,
        message: `買主リストページの他の機能は正常に動作しています`,
        details: { filteredCount: buyers.length, total }
      };
    } else {
      return {
        testName: '買主リストページの他の機能',
        passed: false,
        message: 'フィルタリング機能が正常に動作していません',
        details: { buyers, total }
      };
    }
  } catch (error: any) {
    return {
      testName: '買主リストページの他の機能',
      passed: false,
      message: `エラー: ${error.message}`,
      details: { error: error.message }
    };
  }
}

async function runPreservationTests(): Promise<void> {
  console.log('🧪 保存プロパティテスト開始');
  console.log('=====================================');
  console.log('このテストは修正前のコードで実行し、非バグ条件の動作を観察します。');
  console.log('');
  
  const results: PreservationTestResult[] = [];
  
  // テスト1: 売主リストサイドバーの表示
  results.push(await testSellerSidebarDisplay());
  
  // テスト2: 買主データの同期
  results.push(await testBuyerDataSync());
  
  // テスト3: 買主リストページの他の機能
  results.push(await testBuyerListOtherFeatures());
  
  // 結果サマリー
  console.log('\n=====================================');
  console.log('📊 保存プロパティテスト結果サマリー');
  console.log('=====================================');
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.testName}: ${result.message}`);
  });
  
  console.log('');
  console.log(`合計: ${passedTests}/${totalTests} テストがパス`);
  
  if (passedTests === totalTests) {
    console.log('');
    console.log('✅ 全ての保存プロパティテストがパスしました');
    console.log('   修正前のコードで非バグ条件の動作が正常であることを確認しました。');
    console.log('   これらのテストは修正後も同じ動作を保持することを確認するために使用されます。');
  } else {
    console.log('');
    console.log('❌ 一部の保存プロパティテストが失敗しました');
    console.log('   修正前のコードで非バグ条件の動作に問題がある可能性があります。');
  }
}

// テスト実行
runPreservationTests().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
