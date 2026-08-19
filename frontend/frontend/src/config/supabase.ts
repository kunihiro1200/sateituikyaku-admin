import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ビルド時はダミー値を使用、実行時にチェック
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ⚠️ 重要：supabase-jsのautoRefreshTokenとaxios用localStorageコピーの同期
//
// このアプリはトークンを2箇所で管理している：
//   1. supabase-js内部のセッション（autoRefreshTokenでバックグラウンド自動更新）
//   2. localStorageの 'session_token' / 'refresh_token'（api.tsのaxios interceptorが使用）
//
// Supabaseのrefresh_tokenは1回使うと失効するローテーション方式のため、
// supabase-jsがバックグラウンドで自動リフレッシュすると、localStorageに残っている
// 古いrefresh_tokenのコピーが同時に失効してしまう。
// これに気づかずaxios側が古いコピーでリフレッシュを試みると必ず失敗し、
// 実際にはセッションが有効なのに「セッションが切れました」ダイアログが誤って表示される。
//
// onAuthStateChangeを購読し、supabase-jsがトークンを更新するたびに
// localStorageのコピーも必ず最新化することで、この誤表示を防ぐ。
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    localStorage.setItem('session_token', session.access_token);
    if (session.refresh_token) {
      localStorage.setItem('refresh_token', session.refresh_token);
    }
  } else if (event === 'SIGNED_OUT') {
    localStorage.removeItem('session_token');
    localStorage.removeItem('refresh_token');
  }
});

export default supabase;
