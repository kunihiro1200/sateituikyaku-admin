import { google } from 'googleapis';
import { BaseRepository } from '../repositories/BaseRepository';
import { encrypt, decrypt } from '../utils/encryption';

export interface GoogleCalendarToken {
  id: string;
  employee_id: string;
  encrypted_refresh_token: string;
  token_expiry: string | null;
  scope: string;
  created_at: string;
  updated_at: string;
}

export class GoogleAuthService extends BaseRepository {
  private oauth2Client: any;
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.file',  // Google Drive API - アプリが作成したファイルのみアクセス
    'https://www.googleapis.com/auth/gmail.send',  // Gmail API - メール送信
    'https://www.googleapis.com/auth/gmail.compose',  // Gmail API - メール作成
    'https://www.googleapis.com/auth/gmail.settings.basic',  // Gmail API - Send As設定の読み取り
  ];
  private companyAccountId: string | null = null; // 会社アカウント用のemployee ID（動的に取得）

  constructor() {
    super();
    this.initializeOAuthClient();
    this.initializeCompanyAccountId();
  }

  /**
   * 会社アカウント用のemployee IDを初期化（tenant@ifoo-oita.comを優先）
   */
  private async initializeCompanyAccountId() {
    try {
      // tenant@ifoo-oita.com を優先的に取得
      const { data: tenantAccount, error: tenantError } = await this.table('employees')
        .select('id, email')
        .eq('email', 'tenant@ifoo-oita.com')
        .single();

      if (tenantAccount) {
        this.companyAccountId = tenantAccount.id;
        console.log('✅ Company calendar account ID initialized (tenant@ifoo-oita.com):', this.companyAccountId);
        return;
      }

      // tenant@ifoo-oita.com が見つからない場合は、role='admin'の最初のユーザーを使用
      const { data, error } = await this.table('employees')
        .select('id, email')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (error || !data) {
        console.warn('⚠️ No admin user found for company calendar account');
        return;
      }

      this.companyAccountId = data.id;
      console.log('✅ Company calendar account ID initialized (fallback to admin):', this.companyAccountId, data.email);
    } catch (error) {
      console.error('Error initializing company account ID:', error);
    }
  }

  /**
   * 会社アカウントIDを取得（初期化されていない場合は再取得）
   */
  private async getCompanyAccountId(): Promise<string> {
    if (!this.companyAccountId) {
      await this.initializeCompanyAccountId();
    }

    if (!this.companyAccountId) {
      throw new Error('Company calendar account not configured');
    }

    return this.companyAccountId;
  }

  /**
   * OAuth 2.0クライアントを初期化
   */
  private initializeOAuthClient() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    console.log('🔍 Google Calendar ENV Check:', {
      clientId: clientId ? `✓ Set (${clientId.substring(0, 4)}...)` : '✗ Missing',
      clientSecret: clientSecret ? `✓ Set (${clientSecret.substring(0, 4)}...)` : '✗ Missing',
      redirectUri: redirectUri ? `✓ Set (${redirectUri})` : '✗ Missing',
    });

    if (!clientId || !clientSecret || !redirectUri) {
      console.warn(
        '⚠️  Google Calendar API credentials not configured. Calendar features will be disabled.'
      );
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    console.log('✅ Google Calendar API initialized successfully');
  }

  /**
   * OAuth認証URLを生成（会社アカウント用）
   * @returns Google OAuth同意画面のURL
   */
  async getAuthUrl(): Promise<string> {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar API is not configured');
    }

    const accountId = await this.getCompanyAccountId();

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // リフレッシュトークンを取得
      scope: this.SCOPES,
      prompt: 'consent', // 常に同意画面を表示（リフレッシュトークン取得のため）
      state: accountId, // 会社アカウントIDをstateパラメータで渡す
    });
  }

  /**
   * 認証コードをトークンに交換して保存（会社アカウント用）
   * @param code Google OAuth認証コード
   */
  async exchangeCodeForTokens(code: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar API is not configured');
    }

    try {
      const accountId = await this.getCompanyAccountId();

      // 認証コードをトークンに交換
      const { tokens } = await this.oauth2Client.getToken(code);

      // refresh_tokenが返ってこない場合は、既存のトークンを確認
      if (!tokens.refresh_token) {
        console.log('⚠️ No refresh token received. Checking existing token...');
        
        // 既存のトークンがあるか確認
        const { data: existingToken } = await this.table(
          'google_calendar_tokens'
        )
          .select('*')
          .eq('employee_id', accountId)
          .single();

        if (existingToken) {
          console.log('✅ Using existing refresh token');
          // 既存のトークンがある場合は、access_tokenのみ更新
          const { error } = await this.table('google_calendar_tokens').update(
            {
              token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
              updated_at: new Date().toISOString(),
            }
          )
          .eq('employee_id', accountId);

          if (error) {
            throw new Error(`Failed to update token: ${error.message}`);
          }

          console.log(`✅ Google Calendar token refreshed for company account`);
          return;
        } else {
          // 既存のトークンもない場合は、ユーザーに再認証を促す
          throw new Error('No refresh token received and no existing token found. Please revoke access in Google account settings and try again.');
        }
      }

      // リフレッシュトークンを暗号化
      const encryptedRefreshToken = encrypt(tokens.refresh_token);

      // データベースに保存（既存のトークンがあれば更新）
      const { error } = await this.table('google_calendar_tokens').upsert(
        {
          employee_id: accountId,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scope: this.SCOPES.join(' '),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'employee_id',
        }
      );

      if (error) {
        throw new Error(`Failed to save tokens: ${error.message}`);
      }

      console.log(`✅ Google Calendar connected for company account`);

      // Webhook自動登録
      try {
        const { CalendarWebhookService } = await import('./CalendarWebhookService');
        const webhookService = new CalendarWebhookService();
        
        // OAuth2クライアントを取得
        const oauth2Client = await this.getAuthenticatedClient();
        
        // Webhookを登録
        await webhookService.registerWebhook(accountId, oauth2Client);
        console.log(`✅ Webhook registered automatically for company account`);
      } catch (webhookError: any) {
        // Webhook登録失敗はエラーとしない（カレンダー接続は成功）
        console.warn(`⚠️ Failed to register webhook: ${webhookError.message}`);
      }
    } catch (error: any) {
      console.error('Token exchange error:', error);
      throw new Error(`Failed to exchange authorization code: ${error.message}`);
    }
  }

  /**
   * アクセストークンを取得（必要に応じて更新）- 会社アカウント用
   * @returns アクセストークン
   */
  async getAccessToken(): Promise<string> {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar API is not configured');
    }

    try {
      const accountId = await this.getCompanyAccountId();
      
      console.log('[GoogleAuthService] 会社アカウントトークン取得開始:', {
        companyAccountId: accountId,
      });

      // データベースから会社アカウントのリフレッシュトークンを取得
      const { data: tokenData, error } = await this.table(
        'google_calendar_tokens'
      )
        .select('*')
        .eq('employee_id', accountId)
        .single();

      if (error || !tokenData) {
        console.error('[GoogleAuthService] 会社アカウントトークンが見つかりません:', {
          companyAccountId: accountId,
          error: error?.message,
        });
        throw new Error('GOOGLE_AUTH_REQUIRED');
      }
      
      console.log('[GoogleAuthService] 会社アカウントトークン取得成功');

      // リフレッシュトークンを復号化
      const refreshToken = decrypt(tokenData.encrypted_refresh_token);

      // OAuth クライアントにリフレッシュトークンを設定
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      // アクセストークンを取得（自動的に更新される）
      const { token } = await this.oauth2Client.getAccessToken();

      if (!token) {
        throw new Error('GOOGLE_AUTH_REQUIRED');
      }

      return token;
    } catch (error: any) {
      console.error('[GoogleAuthService] 認証エラー:', {
        companyAccountId: this.companyAccountId,
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code,
      });

      // 認証エラーの場合は特別なエラーコードを返す
      if (
        error.message === 'GOOGLE_AUTH_REQUIRED' ||
        error.message?.includes('invalid_grant') ||
        error.message?.includes('Token has been expired or revoked')
      ) {
        throw new Error('GOOGLE_AUTH_REQUIRED');
      }

      throw error;
    }
  }

  /**
   * Google Calendar連携を解除（会社アカウント用）
   */
  async revokeAccess(): Promise<void> {
    try {
      const accountId = await this.getCompanyAccountId();

      // Webhook自動削除
      try {
        const { CalendarWebhookService } = await import('./CalendarWebhookService');
        const webhookService = new CalendarWebhookService();
        
        // 既存のWebhookを取得
        const channel = await webhookService.getWebhookByEmployeeId(accountId);
        
        if (channel) {
          // OAuth2クライアントを取得
          const oauth2Client = await this.getAuthenticatedClient();
          
          // Webhookを削除
          await webhookService.unregisterWebhook(channel.channel_id, oauth2Client);
          console.log(`✅ Webhook unregistered automatically for company account`);
        }
      } catch (webhookError: any) {
        // Webhook削除失敗は警告として記録
        console.warn(`⚠️ Failed to unregister webhook: ${webhookError.message}`);
      }

      // データベースから会社アカウントのトークンを削除
      const { error } = await this.table('google_calendar_tokens')
        .delete()
        .eq('employee_id', accountId);

      if (error) {
        throw new Error(`Failed to revoke access: ${error.message}`);
      }

      console.log(`✅ Google Calendar disconnected for company account`);
    } catch (error: any) {
      console.error('Revoke access error:', error);
      throw error;
    }
  }

  /**
   * 会社アカウントがGoogle Calendarに接続しているか確認
   * @returns 接続している場合true
   */
  async isConnected(): Promise<boolean> {
    try {
      const accountId = await this.getCompanyAccountId();

      const { data, error } = await this.table('google_calendar_tokens')
        .select('id')
        .eq('employee_id', accountId)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * 一時的なエラーかどうかを判定する
   * 一時的エラー（レート制限・ネットワーク遅延・タイムアウト等）は true を返す
   * 永続的エラー（invalid_grant・Token has been expired or revoked 等）は false を返す
   */
  private isTransientError(error: any): boolean {
    // 永続的な認証エラーはリトライしない
    if (
      error.message?.includes('invalid_grant') ||
      error.message?.includes('Token has been expired or revoked') ||
      error.message === 'GOOGLE_AUTH_REQUIRED'
    ) {
      return false;
    }
    // レート制限、ネットワークエラー、一時的なサーバーエラーはリトライ対象
    const status = error.status || error.code || error.response?.status;
    return (
      status === 429 ||
      status === 500 ||
      status === 503 ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.message?.includes('timeout') ||
      error.message?.includes('network')
    );
  }

  /**
   * OAuth 2.0クライアントを取得（アクセストークン自動更新済み）- 会社アカウント用
   * getAuthenticatedClientForEmployee と同様のパターンで refreshAccessToken() を呼び出す
   * @returns 認証済みOAuth2クライアント
   */
  async getAuthenticatedClient() {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar API is not configured');
    }

    const accountId = await this.getCompanyAccountId();

    // 新しいクライアントインスタンスを作成
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // データベースから会社アカウントのリフレッシュトークンを一度だけ取得
    const { data: tokenData, error } = await this.table(
      'google_calendar_tokens'
    )
      .select('*')
      .eq('employee_id', accountId)
      .single();

    if (error || !tokenData) {
      console.error('[GoogleAuthService] 会社アカウントトークンが見つかりません:', {
        companyAccountId: accountId,
        error: error?.message,
      });
      throw new Error('GOOGLE_AUTH_REQUIRED');
    }

    // リフレッシュトークンのみ設定（アクセストークンは refreshAccessToken() で自動取得）
    const refreshToken = decrypt(tokenData.encrypted_refresh_token);
    client.setCredentials({
      refresh_token: refreshToken,
    });

    // アクセストークンを自動更新（エクスポネンシャルバックオフ付きリトライ）
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000; // 1秒

    let lastError: any;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { credentials } = await client.refreshAccessToken();
        client.setCredentials(credentials);
        break; // 成功したらループを抜ける
      } catch (refreshError: any) {
        lastError = refreshError;

        // 永続的なエラーはリトライしない
        if (!this.isTransientError(refreshError)) {
          console.error('[GoogleAuthService] 永続的な認証エラー（リトライなし）:', refreshError.message);
          throw new Error('GOOGLE_AUTH_REQUIRED');
        }

        // 最後の試行だった場合はエラーをスロー
        if (attempt === MAX_RETRIES) {
          console.error(`[GoogleAuthService] ${MAX_RETRIES}回リトライ後も失敗:`, refreshError.message);
          throw new Error('GOOGLE_AUTH_REQUIRED');
        }

        // エクスポネンシャルバックオフで待機
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[GoogleAuthService] トークン更新失敗（試行${attempt + 1}/${MAX_RETRIES + 1}）。${delay}ms後にリトライ:`, refreshError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return client;
  }

  /**
   * 認証済みOAuth2クライアントを取得（特定の従業員用）
   * @param employeeId 従業員ID
   * @returns 認証済みOAuth2クライアント
   */
  async getAuthenticatedClientForEmployee(employeeId: string) {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar API is not configured');
    }

    // 新しいクライアントインスタンスを作成
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // データベースから従業員のリフレッシュトークンを取得
    const { data: tokenData, error } = await this.table(
      'google_calendar_tokens'
    )
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error || !tokenData) {
      console.error('[GoogleAuthService] No calendar token found for employee:', employeeId);
      throw new Error('GOOGLE_AUTH_REQUIRED');
    }

    const refreshToken = decrypt(tokenData.encrypted_refresh_token);
    client.setCredentials({
      refresh_token: refreshToken,
    });

    // アクセストークンを自動的に更新（エクスポネンシャルバックオフ付きリトライ）
    const MAX_RETRIES_EMP = 3;
    const BASE_DELAY_MS_EMP = 1000; // 1秒

    let lastErrorEmp: any;
    for (let attempt = 0; attempt <= MAX_RETRIES_EMP; attempt++) {
      try {
        const { credentials } = await client.refreshAccessToken();
        client.setCredentials(credentials);
        break; // 成功したらループを抜ける
      } catch (refreshError: any) {
        lastErrorEmp = refreshError;

        // 永続的なエラーはリトライしない
        if (!this.isTransientError(refreshError)) {
          console.error('[GoogleAuthService] 永続的な認証エラー（従業員、リトライなし）:', refreshError.message);
          throw new Error('GOOGLE_AUTH_REQUIRED');
        }

        // 最後の試行だった場合はエラーをスロー
        if (attempt === MAX_RETRIES_EMP) {
          console.error(`[GoogleAuthService] 従業員トークン更新: ${MAX_RETRIES_EMP}回リトライ後も失敗:`, refreshError.message);
          throw new Error('GOOGLE_AUTH_REQUIRED');
        }

        // エクスポネンシャルバックオフで待機
        const delay = BASE_DELAY_MS_EMP * Math.pow(2, attempt);
        console.warn(`[GoogleAuthService] 従業員トークン更新失敗（試行${attempt + 1}/${MAX_RETRIES_EMP + 1}）。${delay}ms後にリトライ:`, refreshError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return client;
  }
}
