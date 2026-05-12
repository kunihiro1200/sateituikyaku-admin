import axios from 'axios';

async function testImageExtraction() {
  const url = 'https://suumo.jp/tochi/fukuoka/sc_fukuokashisawara/nc_20349022/';
  
  console.log(`テスト対象URL: ${url}\n`);
  
  const htmlRes = await axios.get(url, {
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

  // 物件番号を抽出
  const ncMatch = url.match(/nc_(\d+)/);
  const propertyNumber = ncMatch ? ncMatch[1] : null;
  console.log(`物件番号: ${propertyNumber}\n`);

  // HTMLの中で画像URLのパターンを探す
  console.log('=== HTMLの中の画像URL関連パターン ===');
  
  // パターン1: gazo/bukken/
  const gazoMatches = html.match(/gazo[^"'\s]{0,200}?\.jpg/gi);
  if (gazoMatches) {
    console.log('\n[gazo/bukken/ パターン]');
    gazoMatches.slice(0, 10).forEach((m, i) => console.log(`${i + 1}. ${m}`));
  }

  // パターン2: front/gazo/
  const frontMatches = html.match(/front\/gazo[^"'\s]{0,200}?\.jpg/gi);
  if (frontMatches) {
    console.log('\n[front/gazo/ パターン]');
    frontMatches.slice(0, 10).forEach((m, i) => console.log(`${i + 1}. ${m}`));
  }

  // パターン3: img01.suumo.com
  const img01Matches = html.match(/img01\.suumo\.com[^"'\s]{0,200}?\.jpg/gi);
  if (img01Matches) {
    console.log('\n[img01.suumo.com パターン]');
    img01Matches.slice(0, 10).forEach((m, i) => console.log(`${i + 1}. ${m}`));
  }

  // パターン4: 物件番号を含むURL
  if (propertyNumber) {
    const propNumMatches = html.match(new RegExp(`[^"'\\s]{0,200}?${propertyNumber}[^"'\\s]{0,200}?\\.jpg`, 'gi'));
    if (propNumMatches) {
      console.log(`\n[物件番号 ${propertyNumber} を含むURL]`);
      propNumMatches.slice(0, 10).forEach((m, i) => console.log(`${i + 1}. ${m}`));
    }
  }

  // data-src属性から画像URLを抽出
  console.log('\n=== data-src属性の画像URL ===');
  const dataSrcMatches = html.matchAll(/data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi);
  let count = 0;
  for (const match of dataSrcMatches) {
    count++;
    let imgUrl = match[1];
    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    } else if (imgUrl.startsWith('/')) {
      imgUrl = 'https://suumo.jp' + imgUrl;
    }
    console.log(`${count}. ${imgUrl}`);
  }

  // src属性から画像URLを抽出
  console.log('\n=== src属性の画像URL ===');
  const srcMatches = html.matchAll(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi);
  count = 0;
  for (const match of srcMatches) {
    count++;
    let imgUrl = match[1];
    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    } else if (imgUrl.startsWith('/')) {
      imgUrl = 'https://suumo.jp' + imgUrl;
    }
    console.log(`${count}. ${imgUrl}`);
  }
}

testImageExtraction().catch(console.error);
