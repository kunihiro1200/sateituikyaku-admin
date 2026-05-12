import axios from 'axios';
import * as fs from 'fs';

async function analyzeHtml() {
  const url = 'https://suumo.jp/tochi/fukuoka/sc_fukuokashisawara/nc_20088495/';
  
  console.log('SUUMOページを取得中...\n');
  
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
  
  // HTMLをファイルに保存
  fs.writeFileSync('scripts/suumo-page.html', html, 'utf-8');
  console.log('HTMLを scripts/suumo-page.html に保存しました\n');
  
  // 画像関連のパターンを全て探す
  console.log('=== 画像関連のパターン ===\n');
  
  // パターン1: <img タグ
  console.log('[1] <img タグ:');
  const imgTags = html.match(/<img[^>]{0,500}>/gi);
  if (imgTags) {
    imgTags.slice(0, 5).forEach((tag, i) => {
      console.log(`${i + 1}. ${tag.substring(0, 200)}`);
    });
  } else {
    console.log('見つかりませんでした');
  }
  
  // パターン2: .jpg を含む行
  console.log('\n[2] .jpg を含むURL（最初の10件）:');
  const jpgMatches = html.match(/https?:\/\/[^"'\s<>]{0,200}?\.jpg/gi);
  if (jpgMatches) {
    const unique = [...new Set(jpgMatches)];
    unique.slice(0, 10).forEach((url, i) => {
      console.log(`${i + 1}. ${url}`);
    });
  } else {
    console.log('見つかりませんでした');
  }
  
  // パターン3: gazo を含む文字列
  console.log('\n[3] "gazo" を含む文字列（最初の10件）:');
  const gazoLines = html.split('\n').filter(line => line.includes('gazo'));
  gazoLines.slice(0, 10).forEach((line, i) => {
    console.log(`${i + 1}. ${line.trim().substring(0, 150)}`);
  });
  
  // パターン4: 物件番号を含むURL
  console.log('\n[4] 物件番号 20088495 を含むURL:');
  const propMatches = html.match(/[^"'\s<>]{0,200}?20088495[^"'\s<>]{0,200}?\.jpg/gi);
  if (propMatches) {
    const unique = [...new Set(propMatches)];
    unique.slice(0, 10).forEach((url, i) => {
      console.log(`${i + 1}. ${url}`);
    });
  } else {
    console.log('見つかりませんでした');
  }
}

analyzeHtml().catch(console.error);
