import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkImages() {
  const { data, error } = await supabase
    .from('property_previews')
    .select('slug, title, source_url, images')
    .eq('source_url', 'https://suumo.jp/ikkodate/fukuoka/sc_fukuokashijonan/nc_20024050/')
    .single();

  if (error) {
    console.error('エラー:', error);
    return;
  }

  if (!data) {
    console.log('物件が見つかりません');
    return;
  }

  console.log('物件:', data.title);
  console.log('画像数:', data.images?.length || 0);
  console.log('画像URL:');
  data.images?.forEach((url: string, i: number) => {
    console.log(`${i + 1}. ${url}`);
  });
}

checkImages();
