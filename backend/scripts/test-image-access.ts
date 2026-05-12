import axios from 'axios';

async function testImageAccess() {
  // HTMLエンティティをデコード
  const testUrl1 = 'https://img01.suumo.com/jj/resizeImage?src=gazo%2Fbukken%2F090%2FN010000%2Fimg%2F043%2F79144043%2F79144043_0003.jpg&amp;w=452&amp;h=339';
  const testUrl2 = testUrl1.replace(/&amp;/g, '&');
  
  console.log('テスト1（&amp;のまま）:');
  console.log(testUrl1);
  
  try {
    await axios.head(testUrl1, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://suumo.jp/',
      },
      timeout: 10000,
    });
    console.log('✅ アクセス成功\n');
  } catch (error: any) {
    console.log(`❌ 失敗: ${error.response?.status || error.message}\n`);
  }
  
  console.log('テスト2（&に変換）:');
  console.log(testUrl2);
  
  try {
    const response = await axios.head(testUrl2, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://suumo.jp/',
      },
      timeout: 10000,
    });
    console.log('✅ アクセス成功');
    console.log('ステータスコード:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
  } catch (error: any) {
    console.log(`❌ 失敗: ${error.response?.status || error.message}`);
  }
}

testImageAccess();
