import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// シングルトン保証：window上に1つだけインスタンスを保持
// 複数のGoTrueClientインスタンスが同じストレージロックを奪い合い、
// ログイン時のリダイレクトがブロックされる問題を防止する
const GLOBAL_KEY = '__supabase_client__';

function getOrCreateClient(): SupabaseClient {
  if (typeof window !== 'undefined' && (window as any)[GLOBAL_KEY]) {
    return (window as any)[GLOBAL_KEY];
  }

  const client = createClient(
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

  if (typeof window !== 'undefined') {
    (window as any)[GLOBAL_KEY] = client;
  }

  return client;
}

export const supabase = getOrCreateClient();

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
