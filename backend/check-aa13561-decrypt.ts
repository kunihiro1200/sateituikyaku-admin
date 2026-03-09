import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// employees テーブルを確認
async function main() {
  // employees テーブルで initials = 'I' のレコードを確認
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .limit(10);
  
  if (empError) {
    console.log('employees table error:', empError.message);
  } else {
    console.log('employees sample:', JSON.stringify(employees?.slice(0, 3), null, 2));
  }

  // getEmployeeNameByInitials(null) の動作確認
  // null の場合は早期リターンするので問題なし
  // では getEmployeeNameByInitials('') の場合は？
  
  // AA13561 の visit_assignee が null なのに visitAssignee が 'I' になる可能性
  // → decryptSeller で visitAssigneeFullName = await getEmployeeNameByInitials(null) = null
  // → visitAssignee: null || null || undefined = undefined
  // → visitAssigneeInitials: null || undefined = undefined
  // → hasVisitAssignee: false
  // → isTodayCallAssignedTo(seller, 'I'): false
  
  // 別の可能性: フロントエンドで sellers API が todayCallAssigned:I カテゴリで
  // フィルタリングせずに全件返し、その中に AA13561 が含まれている
  // → フロントエンドの filterSellersByCategory が AA13561 を誤って含める
  
  // AA13561 の実際のAPIレスポンスを確認するため、
  // getSellers の todayCallAssigned:I 処理を確認
  // switch に 'todayCallAssigned:I' のケースがないため、フィルタなしで全件返る
  // → フロントエンドで filterSellersByCategory(sellers, 'todayCallAssigned:I') を適用
  // → isTodayCallAssignedTo(aa13561, 'I') が true になる理由は？
  
  // 可能性: sellers API のレスポンスで AA13561 の visitAssignee が 'I' になっている
  // これは decryptSeller の visitAssigneeFullName が 'I' を返す場合
  // getEmployeeNameByInitials(null) → null なので問題なし
  
  // 別の可能性: sellers テーブルの assignee カラムが 'I' になっている
  const { data: aa13561 } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, assignee, phone_assignee, valuation_assignee, next_call_date, status')
    .eq('seller_number', 'AA13561')
    .single();
  
  console.log('\nAA13561 all assignee fields:');
  console.log(JSON.stringify(aa13561, null, 2));
  
  // 現在の todayCallAssigned:I の条件でクエリ（switch に該当ケースなし → 全件返る）
  // フロントエンドで filterSellersByCategory を適用
  // AA13561 が含まれる理由を特定するため、
  // 実際に todayCallAssigned:I カテゴリで表示される売主を確認
  
  // バックエンドの switch に 'todayCallAssigned:I' のケースを追加する必要がある
  console.log('\n=== 問題の根本原因 ===');
  console.log('getSellers の switch に todayCallAssigned:xxx のケースがない');
  console.log('→ フィルタなしで全件返る');
  console.log('→ フロントエンドで filterSellersByCategory を適用');
  console.log('→ AA13561 が isTodayCallAssignedTo(seller, I) で true になる理由を調査中');
}

main().catch(console.error);
