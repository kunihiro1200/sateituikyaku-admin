import axios from 'axios';

async function testImageUrl() {
  const testUrl = 'https://suumo.jp/gazo/bukken/090/N010000/img/495/20088495/20088495_0037.jpg';
  
  console.log('テスト対象URL:', testUrl);
  console.log('');
  
  try {
    const response = await axios.head(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://suumo.jp/',
      },
      timeout: 10000,
    });
    
    console.log('✅ 画像は存在します');
    console.log('ステータスコード:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content-Length:', response.headers['content-length']);
  } catch (error: any) {
    if (error.response) {
      console.log('❌ 画像が見つかりません');
      console.log('ステータスコード:', error.response.status);
      console.log('エラー:', error.response.statusText);
    } else {
      console.log('❌ リクエストエラー:', error.message);
    }
  }
  
  // 元のSUUMOページから正しい画像URLを確認
  console.log('\n元のSUUMOページを確認:');
  const sourceUrl = 'https://suumo.jp/tochi/fukuoka/sc_fukuokashisawara/nc_20088495/';
  
  try {
    const htmlRes = await axios.get(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://suumo.jp/',
      },
      timeout: 30000,
      responseType: 'text',
    });
    
    const html: string = htmlRes.data;
    
    // gazo/bukken/ パターンを探す
    const gazoMatches = html.match(/gazo%2Fbukken%2F[^"'\s&]+?\.jpg/gi);
    if (gazoMatches) {
      console.log('\nHTMLから見つかった画像URL（最初の5件）:');
      gazoMatches.slice(0, 5).forEach((m, i) => {
        const decoded = decodeURIComponent(m);
        console.log(`${i + 1}. https://suumo.jp/${decoded}`);
      });
    } else {
      console.log('画像URLが見つかりませんでした');
    }
    
    // front/gazo/ パターンも確認
    const frontMatches = html.match(/\/front\/gazo[^"'\s]{0,200}?\.jpg/gi);
    if (frontMatches) {
      console.log('\nfront/gazo/ パターン（最初の5件）:');
      frontMatches.slice(0, 5).forEach((m, i) => {
        console.log(`${i + 1}. https://suumo.jp${m}`);
      });
    }
    
    // img src/data-src 属性を確認
    const imgMatches = html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+\.jpg)["']/gi);
    console.log('\nimg要素のsrc/data-src（最初の10件）:');
    let count = 0;
    for (const match of imgMatches) {
      count++;
      if (count <= 10) {
        let url = match[1];
        if (url.startsWith('//')) url = 'https:' + url;
        else if (url.startsWith('/')) url = 'https://suumo.jp' + url;
        console.log(`${count}. ${url}`);
      }
    }
    
  } catch (error: any) {
    console.log('HTMLの取得に失敗:', error.message);
  }
}

testImageUrl();
