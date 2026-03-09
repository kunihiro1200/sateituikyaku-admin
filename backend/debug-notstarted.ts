import * as dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayJST = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
  console.log('Today JST:', todayJST);

  // 当日TEL分の基本条件（営担なし + コミュニケーション情報なし + 追客中 + 次電日今日以前）
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, confidence_level, exclusion_date')
    .is('deleted_at', null)
    .ilike('status', '%追客中%')
    .not('next_call_date', 'is', null)
    .lte('next_call_date', todayJST);

  if (error) { console.error('Error:', error.message); return; }

  // 営担なし
  const noAssignee = (data || []).filter(s =>
    !s.visit_assignee || s.visit_assignee.trim() === '' || s.visit_assignee.trim() === '外す'
  );

  // コミュニケーション情報なし（当日TEL分）
  const noInfo = noAssignee.filter(s =>
    !(s.phone_contact_person?.trim()) && !(s.preferred_contact_time?.trim()) && !(s.contact_method?.trim())
  );

  console.log('\n当日TEL分（コミュニケーション情報なし）:', noInfo.length, '件');
  console.log('\n--- 全件の詳細 ---');
  noInfo.forEach(s => {
    const status = s.status || '';
    const unreachable = s.unreachable_status || '';
    const confidence = s.confidence_level || '';
    const exclusionDate = s.exclusion_date || '';
    const inquiryDate = s.inquiry_date || '';

    // 当日TEL_未着手の条件チェック
    const isStatusOk = status === '追客中'; // 完全一致
    const isUnreachableOk = !unreachable || unreachable.trim() === '';
    const isConfidenceOk = confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定';
    const isExclusionOk = !exclusionDate || exclusionDate.trim() === '';
    const isInquiryDateOk = inquiryDate >= '2026-01-01';

    const isNotStarted = isStatusOk && isUnreachableOk && isConfidenceOk && isExclusionOk && isInquiryDateOk;

    console.log(`${s.seller_number}: status="${status}" unreachable="${unreachable}" confidence="${confidence}" exclusion="${exclusionDate}" inquiry="${inquiryDate}" => 未着手:${isNotStarted} [status:${isStatusOk} unreachable:${isUnreachableOk} confidence:${isConfidenceOk} exclusion:${isExclusionOk} inquiry:${isInquiryDateOk}]`);
  });

  // 未着手に該当するもの
  const notStarted = noInfo.filter(s => {
    const status = s.status || '';
    const unreachable = s.unreachable_status || '';
    const confidence = s.confidence_level || '';
    const exclusionDate = s.exclusion_date || '';
    const inquiryDate = s.inquiry_date || '';
    return status === '追客中' &&
      (!unreachable || unreachable.trim() === '') &&
      confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
      (!exclusionDate || exclusionDate.trim() === '') &&
      inquiryDate >= '2026-01-01';
  });

  console.log('\n当日TEL_未着手（全条件）:', notStarted.length, '件');
  notStarted.forEach(s => console.log(' -', s.seller_number, s.inquiry_date));
}

main().catch(console.error);
