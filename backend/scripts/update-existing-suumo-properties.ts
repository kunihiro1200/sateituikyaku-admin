/**
 * 既存のSUUMO物件データを更新するスクリプト
 * - 提供元情報（会社名・電話番号）を再取得
 * - 画像URLを再取得（不要な画像を除外）
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// .envファイルを読み込む
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// タグを除去してテキストを取得するヘルパー
const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function updateProperty(slug: string, sourceUrl: string) {
  console.log(`\n[${slug}] 更新開始: ${sourceUrl}`);

  try {
    // SUUMOのHTMLを取得
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

    // --- 提供元情報（会社名・電話番号） ---
    let provider_name: string | null = null;
    let provider_phone: string | null = null;

    // パターン1: 「お問い合わせ先」セクションから取得
    const contactMatch = html.match(/お問い?合わ?せ先[\s\S]{0,500}?<\/(?:th|dt)>[\s\S]{0,100}?<(?:td|dd)[^>]*>([\s\S]{10,500}?)<\/(?:td|dd)>/i);
    if (contactMatch) {
      const contactText = stripTags(contactMatch[1]);
      
      // 会社名を抽出
      const companyMatch = contactText.match(/([（(]株[）)]|株式会社|有限会社|合同会社|[ァ-ヶー]+(?:不動産|ハウス|ホーム|建設|工務店))[^\n\r]{0,50}/);
      if (companyMatch) {
        provider_name = companyMatch[0].trim();
      }
      
      // 電話番号を抽出
      const phoneMatch = contactText.match(/TEL\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i);
      if (phoneMatch) {
        provider_phone = phoneMatch[1].replace(/\s+/g, '').trim();
      }
    }

    // パターン2: HTMLから直接会社名を探す
    if (!provider_name) {
      const companyPatterns = [
        /([（(]株[）)]|株式会社|有限会社|合同会社)\s*[ァ-ヶー\w]+/,
        /[ァ-ヶー]+(?:不動産|ハウス|ホーム|建設|工務店|住宅)/,
      ];
      for (const pattern of companyPatterns) {
        const match = html.match(pattern);
        if (match) {
          provider_name = match[0].trim();
          break;
        }
      }
    }

    // パターン3: HTMLから直接電話番号を探す
    if (!provider_phone) {
      const phonePatterns = [
        /TEL\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i,
        /電話\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i,
        /\b(0\d{1,4}[-]\d{1,4}[-]\d{4})\b/,
      ];
      for (const pattern of phonePatterns) {
        const match = html.match(pattern);
        if (match) {
          provider_phone = match[1].replace(/\s+/g, '').trim();
          break;
        }
      }
    }

    // --- 画像 ---
    const images: string[] = [];
    
    // img01.suumo.com の resizeImage URL
    const resizeImageMatches = html.matchAll(/https:\/\/img01\.suumo\.com\/jj\/resizeImage\?src=gazo%2Fbukken%2F[^"'\s<>,]+?\.jpg[^"'\s<>,]*/gi);
    for (const match of resizeImageMatches) {
      let imgUrl = match[0];
      
      // HTMLエンティティをデコード（&amp; → &）
      imgUrl = imgUrl.replace(/&amp;/g, '&');
      
      // カンマ以降を削除（例: &w=500,現地土地写真 → &w=500）
      imgUrl = imgUrl.split(',')[0];
      
      // 小さいサイズパラメータをより大きいサイズに変更（高解像度化）
      imgUrl = imgUrl.replace(/&w=96&h=72/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=220&h=165/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=452&h=339/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=296&h=222/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=500/g, '&w=800&h=600');
      
      // 会社ロゴを除外（gazo/kaisha/）
      if (!imgUrl.includes('kaisha') && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    console.log(`[${slug}] 提供元情報: name=${provider_name}, phone=${provider_phone}`);
    console.log(`[${slug}] 画像: ${images.length}枚`);

    // DBを更新
    const updateData: any = {};
    if (provider_name) updateData.provider_name = provider_name;
    if (provider_phone) updateData.provider_phone = provider_phone;
    if (images.length > 0) updateData.images = images;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('property_previews')
        .update(updateData)
        .eq('slug', slug);

      if (error) {
        console.error(`[${slug}] 更新エラー:`, error);
        return false;
      }

      console.log(`[${slug}] ✅ 更新完了`);
      return true;
    } else {
      console.log(`[${slug}] ⚠️ 更新データなし`);
      return false;
    }

  } catch (err: any) {
    console.error(`[${slug}] エラー:`, err.message);
    return false;
  }
}

async function main() {
  console.log('既存のSUUMO物件データを更新します...\n');

  // 福岡のSUUMO物件を取得
  const { data: properties, error } = await supabase
    .from('property_previews')
    .select('slug, source_url, title')
    .eq('region', 'fukuoka')
    .eq('is_tateuri', true)
    .eq('is_active', true)
    .like('source_url', '%suumo.jp%');

  if (error) {
    console.error('物件取得エラー:', error);
    process.exit(1);
  }

  if (!properties || properties.length === 0) {
    console.log('更新対象の物件がありません');
    process.exit(0);
  }

  console.log(`更新対象: ${properties.length}件\n`);

  let successCount = 0;
  let failCount = 0;

  for (const property of properties) {
    const success = await updateProperty(property.slug, property.source_url);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // レート制限を避けるため、少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=== 更新完了 ===');
  console.log(`成功: ${successCount}件`);
  console.log(`失敗: ${failCount}件`);
}

main();
