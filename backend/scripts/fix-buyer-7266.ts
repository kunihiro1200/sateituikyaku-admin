import { createClient } from '@supabase/supabase-js';
import { GeolocationService } from '../src/services/GeolocationService';

const SUPABASE_URL = 'https://krxhrbtlgfjzsseegaqq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8';

async function fix() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const geoService = new GeolocationService();

  const googleMapUrl = 'https://maps.app.goo.gl/ZhKT19ZGUrCxw1ou6';
  console.log('URL:', googleMapUrl);

  const coords = await geoService.extractCoordinatesFromUrl(googleMapUrl);
  console.log('座標:', coords);

  if (!coords) {
    console.error('座標抽出失敗');
    return;
  }

  const { error } = await supabase
    .from('buyers')
    .update({ desired_area_lat: coords.lat, desired_area_lng: coords.lng })
    .eq('buyer_number', '7266');

  if (error) {
    console.error('更新エラー:', error);
  } else {
    console.log(`✅ 7266 更新完了: (${coords.lat}, ${coords.lng})`);
  }
}

fix().catch(console.error);
