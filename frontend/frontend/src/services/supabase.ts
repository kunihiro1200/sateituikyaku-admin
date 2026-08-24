// config/supabase.ts の単一インスタンスを再エクスポート
// ⚠️ 複数のGoTrueClientインスタンスが作成されるとログインが失敗するため、
// 必ず config/supabase.ts のインスタンスを使い回すこと
export { supabase } from '../config/supabase';
export { supabase as default } from '../config/supabase';
