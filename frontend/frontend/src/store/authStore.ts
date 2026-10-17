import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Employee } from '../types';
import api from '../services/api';
import { supabase } from '../config/supabase';

interface AuthState {
  employee: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  handleAuthCallback: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
  employee: null,
  isAuthenticated: false,
  isLoading: false, // 初期状態はfalseに変更

  loginWithGoogle: async () => {
    try {
      console.log('🔵 Starting Supabase Google login...');
      console.log('🔵 Redirect URL:', `${window.location.origin}/auth/callback`);
      
      // Supabase Authを使用してGoogleログイン
      // skipBrowserRedirect: true で URL を取得し、手動でリダイレクト（確実性のため）
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
          },
        },
      });

      if (error) {
        console.error('❌ Supabase login error:', error);
        throw new Error(`ログインに失敗しました: ${error.message}`);
      }

      if (data?.url) {
        console.log('✅ Supabase login initiated, redirecting to:', data.url.substring(0, 80) + '...');
        // 手動でGoogleの認証画面にリダイレクト
        window.location.href = data.url;
      } else {
        console.error('❌ No redirect URL returned from Supabase');
        throw new Error('ログインURLの取得に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  },

  handleAuthCallback: async () => {
    set({ isLoading: true });
    
    try {
      console.log('🔵 handleAuthCallback called');
      console.log('🔵 Current URL:', window.location.href);
      
      // 古いキャッシュをクリア（新しいログインの前に）
      localStorage.removeItem('auth-storage');
      console.log('🔵 Cleared old auth cache');
      
      // URLからハッシュフラグメントを確認（Supabase Authはハッシュフラグメントでトークンを返す）
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashAccessToken = hashParams.get('access_token');
      const hashRefreshToken = hashParams.get('refresh_token');
      const errorParam = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      console.log('🔵 Hash params:', {
        hasAccessToken: !!hashAccessToken,
        hasRefreshToken: !!hashRefreshToken,
        error: errorParam,
        errorDescription,
      });

      // エラーチェック
      if (errorParam) {
        throw new Error(errorDescription || errorParam);
      }

      let session = null;

      // ハッシュにトークンがある場合は直接セッションを設定（最優先）
      if (hashAccessToken) {
        console.log('🔵 Setting session from URL hash tokens...');
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken || '',
        });
        if (!setSessionError && data.session) {
          session = data.session;
          console.log('✅ Session set from hash tokens');
        } else {
          console.warn('⚠️ Failed to set session from hash:', setSessionError?.message);
        }
      }

      // ハッシュにトークンがない場合はgetSession()を試みる
      if (!session) {
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('🔵 Supabase getSession:', { 
          hasSession: !!existingSession,
          error: sessionError?.message
        });

        if (sessionError) {
          throw new Error(`セッション取得エラー: ${sessionError.message}`);
        }
        session = existingSession;
      }

      if (!session) {
        throw new Error('有効なセッションが見つかりません。もう一度ログインしてください。');
      }

      // バックエンドにトークンを送信して社員情報を取得（必ずAPIから取得）
      console.log('🔵 Calling backend /auth/callback...');
      const response = await api.post('/auth/callback', {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      console.log('✅ Got employee info from API:', {
        name: response.data.employee.name,
        initials: response.data.employee.initials,
        email: response.data.employee.email,
      });

      // トークンを保存
      localStorage.setItem('session_token', session.access_token);
      if (session.refresh_token) {
        localStorage.setItem('refresh_token', session.refresh_token);
      }
      
      set({
        employee: response.data.employee,
        isAuthenticated: true,
        isLoading: false,
      });
      
      console.log('✅ Auth callback completed successfully');
    } catch (error) {
      console.error('❌ Auth callback error:', error);
      localStorage.removeItem('session_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth-storage');
      set({ employee: null, isAuthenticated: false, isLoading: false });
      
      // エラーメッセージを改善
      if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error('認証処理中にエラーが発生しました。もう一度お試しください。');
      }
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('session_token');
      localStorage.removeItem('refresh_token');
      // Zustand persistのキャッシュもクリア
      localStorage.removeItem('auth-storage');
      set({ employee: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      console.log('🔍 Checking auth...');
      
      const currentState = useAuthStore.getState();
      // localStorage に保存した employee-cache を読み込む
      let cachedEmployee: any = null;
      try {
        cachedEmployee = JSON.parse(localStorage.getItem('employee-cache') || 'null');
      } catch { cachedEmployee = null; }

      // ─── ケース A: isAuthenticated=true かつ employee-cache あり ─────────
      // キャッシュを使って即座に画面を表示し、バックグラウンドで最新データを取得
      if (currentState.isAuthenticated && cachedEmployee) {
        console.log('🚀 Fast path: using employee cache, showing app immediately');
        set({ employee: cachedEmployee, isLoading: false });
        // バックグラウンドでセッション確認（失敗してもログアウトしない）
        setTimeout(async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              // セッションが本当に切れていたら静かにクリア（次回のAPI呼び出しで401になる）
              const storedRefreshToken = localStorage.getItem('refresh_token');
              if (storedRefreshToken) {
                const { data: refreshData } = await supabase.auth.refreshSession({ refresh_token: storedRefreshToken });
                if (refreshData.session) {
                  localStorage.setItem('session_token', refreshData.session.access_token);
                }
              }
            } else {
              // セッション有効: 最新の社員情報をバックグラウンドで取得
              try {
                const response = await api.get('/auth/me', { timeout: 20000 });
                localStorage.setItem('employee-cache', JSON.stringify(response.data));
                useAuthStore.setState({ employee: response.data });
              } catch { /* タイムアウトは無視 */ }
            }
          } catch { /* バックグラウンド処理失敗は無視 */ }
        }, 1000); // 1秒後にバックグラウンドで確認
        return;
      }

      // ─── ケース B: 初回ログイン or isAuthenticated=false ────────────────
      set({ isLoading: true });
      
      // Supabase Authからセッションを確認（期限切れの場合はrefresh_tokenで自動更新）
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('🔍 Session check:', {
        hasSession: !!session,
        error: sessionError?.message
      });

      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        set({ isLoading: false, isAuthenticated: false, employee: null });
        return;
      }

      if (!session) {
        // セッションがない場合、refresh_tokenで復元を試みる
        const storedRefreshToken = localStorage.getItem('refresh_token');
        if (storedRefreshToken) {
          console.log('🔄 Trying to refresh session...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: storedRefreshToken,
          });
          if (!refreshError && refreshData.session) {
            console.log('✅ Session refreshed successfully');
            localStorage.setItem('session_token', refreshData.session.access_token);
            localStorage.setItem('refresh_token', refreshData.session.refresh_token);
            try {
              // 必ずAPIから最新のemployeeデータを取得
              const response = await api.get('/auth/me');
              console.log('✅ Got employee info from API:', {
                name: response.data.name,
                initials: response.data.initials,
                email: response.data.email,
              });
              localStorage.setItem('employee-cache', JSON.stringify(response.data));
              set({ employee: response.data, isAuthenticated: true, isLoading: false });
              return;
            } catch {
              // fallthrough
            }
          }
        }
        console.log('ℹ️ No active session');
        set({ isLoading: false, isAuthenticated: false, employee: null });
        return;
      }

      // トークンを保存
      localStorage.setItem('session_token', session.access_token);
      if (session.refresh_token) {
        localStorage.setItem('refresh_token', session.refresh_token);
      }

      // 社員情報を取得（短いタイムアウト、api.ts の自動リトライを無効化）
      const AUTH_ME_TIMEOUT = 8000;
      let authMeSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await (api as any).get('/auth/me', {
            timeout: AUTH_ME_TIMEOUT,
            _retryCount: 10, // api.ts の自動リトライを実質無効化（上限3なので10で十分）
          });
          console.log('✅ Auth check successful, got employee info from API:', {
            name: response.data.name,
            initials: response.data.initials,
            email: response.data.email,
          });
          // 取得成功したらキャッシュに保存（次回のフォールバック用）
          localStorage.setItem('employee-cache', JSON.stringify(response.data));
          set({ employee: response.data, isAuthenticated: true, isLoading: false });
          authMeSuccess = true;
          break;
        } catch (apiError: any) {
          const status = apiError.response?.status;

          // 401 = 明確にセッション無効 → 即ログアウト
          if (status === 401) {
            console.log('ℹ️ Session expired (401), clearing tokens');
            await supabase.auth.signOut();
            localStorage.removeItem('session_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('employee-cache');
            set({ employee: null, isAuthenticated: false, isLoading: false });
            authMeSuccess = true;
            break;
          }

          if (attempt < 3) {
            const wait = 3000;
            console.warn(`⚠️ /auth/me attempt ${attempt} failed (${status ?? 'timeout'}), retrying in ${wait / 1000}s...`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            // 3回すべて失敗 → Supabase セッションは有効なのでキャッシュを使って画面を開く
            console.error('❌ Failed to get employee info after 3 attempts:', apiError);
            const cachedEmployee = JSON.parse(localStorage.getItem('employee-cache') || 'null');
            if (cachedEmployee) {
              console.warn('⚠️ Using cached employee data as fallback');
              set({ employee: cachedEmployee, isAuthenticated: true, isLoading: false });
            } else {
              // キャッシュもない → isAuthenticated: true で画面は開く（社員データは後で取得）
              set({ isAuthenticated: true, isLoading: false });
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Check auth error:', error);
      localStorage.removeItem('session_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth-storage');
      set({ employee: null, isAuthenticated: false, isLoading: false });
    }
  },
}),
    {
      name: 'auth-storage', // localStorageのキー名
      // employeeデータはキャッシュしない（常にAPIから取得）
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
