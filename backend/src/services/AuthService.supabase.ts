import { BaseRepository } from '../repositories/BaseRepository';
import { Employee, EmployeeRole } from '../types';
import { extractDisplayName, GoogleUserMetadata } from '../utils/employeeUtils';

// validateSession のインメモリキャッシュ（5分TTL）
// Vercel サーバーレスでも同一プロセス内のリクエスト間でキャッシュが共有される
const _sessionCache = new Map<string, { employee: Employee; expiresAt: number }>();
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5分

export class AuthService extends BaseRepository {

  /**
   * employeesテーブルに登録済みのメールアドレスか確認
   * （スタッフシートへのアクセスが不安定なため、DBベースのチェックに変更）
   */
  private async isAllowedEmail(email: string): Promise<boolean> {
    try {
      const { data, error } = await this.table('employees')
        .select('id, is_active')
        .ilike('email', email.trim())
        .single();

      if (error || !data) {
        console.log('[AuthService] Email not found in employees table:', email);
        return false;
      }

      if (!data.is_active) {
        console.log('[AuthService] Employee is inactive:', email);
        return false;
      }

      console.log('[AuthService] Email allowed (found in employees table):', email);
      return true;
    } catch (error) {
      console.error('[AuthService] Failed to check email in employees table:', error);
      return false;
    }
  }

  /**
   * Supabase Authのユーザー情報から社員レコードを取得または作成
   * employeesテーブルに登録済みのメールアドレスのみ許可
   */
  async getOrCreateEmployee(
    userId: string,
    email: string,
    userMetadata: GoogleUserMetadata | null | undefined
  ): Promise<Employee> {
    const extractedName = extractDisplayName(userMetadata, email);

    console.log('[AuthService] getOrCreateEmployee called:', { userId, email, extractedName });

    // 1. google_idで既存レコードを検索
    const { data: existing, error: fetchError } = await this.table('employees')
      .select('*')
      .eq('google_id', userId)
      .single();

    if (existing && !fetchError) {
      console.log('[AuthService] Existing employee found by google_id:', existing.id);
      const updates: any = { last_login_at: new Date().toISOString() };
      if (!existing.is_active) updates.is_active = true;
      if (this.isInvalidName(existing.name)) updates.name = extractedName;
      await this.table('employees').update(updates).eq('id', existing.id);
      return { ...existing, ...updates, lastLoginAt: new Date() };
    }

    // 2. メールアドレスで既存レコードを検索（google_idが未設定の場合）
    const { data: existingByEmail } = await this.table('employees')
      .select('*')
      .ilike('email', email.trim())
      .eq('is_active', true)
      .single();

    if (existingByEmail) {
      console.log('[AuthService] Existing employee found by email, linking google_id:', existingByEmail.id);
      const updates: any = {
        google_id: userId,
        last_login_at: new Date().toISOString(),
      };
      if (this.isInvalidName(existingByEmail.name)) updates.name = extractedName;
      await this.table('employees').update(updates).eq('id', existingByEmail.id);
      return { ...existingByEmail, ...updates, lastLoginAt: new Date() };
    }

    // 3. 完全に新規の場合はメールアドレスチェック（DBに登録済みかどうか）
    const allowed = await this.isAllowedEmail(email);
    if (!allowed) {
      console.warn('[AuthService] Login rejected - email not registered:', email);
      throw new Error('このメールアドレスはログインが許可されていません。管理者に連絡してください。');
    }

    // 4. 新規社員を作成
    console.log('[AuthService] Creating new employee:', { userId, email, name: extractedName });
    const { data: newEmployee, error: createError } = await this.table('employees')
      .insert({
        google_id: userId,
        email,
        name: extractedName,
        role: EmployeeRole.AGENT,
        is_active: true,
        last_login_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !newEmployee) {
      console.error('[AuthService] Failed to create employee:', createError);
      throw new Error('Failed to create employee');
    }

    return newEmployee;
  }

  /**
   * 名前が無効かどうかをチェック
   */
  private isInvalidName(name: string): boolean {
    if (!name || name.trim().length === 0) return true;
    if (name === '不明' || name === 'Unknown') return true;
    if (/^[A-Za-z0-9+/=]{20,}$/.test(name)) return true;
    if (name.includes('@')) return true;
    return false;
  }

  /**
   * セッションを検証
   * employeesテーブルに登録済み（is_active=true）であればOK
   */
  async validateSession(accessToken: string): Promise<Employee> {
    // キャッシュをチェック（トークンの先頭32文字をキーに使用）
    const cacheKey = accessToken.substring(0, 32);
    const cached = _sessionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.employee;
    }

    const { data: { user }, error } = await this.supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new Error('Invalid or expired session');
    }

    const { data: employee, error: employeeError } = await this.table('employees')
      .select('*')
      .eq('google_id', user.id)
      .eq('is_active', true)
      .single();

    if (employee && !employeeError) {
      _sessionCache.set(cacheKey, { employee, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
      return employee;
    }

    // google_idで見つからない場合、メールアドレスで検索
    if (user.email) {
      const { data: employeeByEmail } = await this.table('employees')
        .select('*')
        .ilike('email', user.email.trim())
        .eq('is_active', true)
        .single();

      if (employeeByEmail) {
        // google_idを紐付け
        await this.table('employees')
          .update({ google_id: user.id })
          .eq('id', employeeByEmail.id);
        _sessionCache.set(cacheKey, { employee: employeeByEmail, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
        return employeeByEmail;
      }
    }

    throw new Error('Employee not found or inactive');
  }

  /**
   * ログアウト
   */
  async logout(accessToken: string): Promise<void> {
    // キャッシュをクリア
    const cacheKey = accessToken.substring(0, 32);
    _sessionCache.delete(cacheKey);
    console.log('[AuthService] Session cache cleared for token:', cacheKey);
    
    await this.supabase.auth.admin.signOut(accessToken);
  }
}
