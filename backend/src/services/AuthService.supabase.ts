import { BaseRepository } from '../repositories/BaseRepository';
import { Employee, EmployeeRole } from '../types';
import { extractDisplayName, GoogleUserMetadata } from '../utils/employeeUtils';
import { StaffManagementService } from './StaffManagementService';

export class AuthService extends BaseRepository {
  private staffManagementService = new StaffManagementService();

  /**
   * スタッフ管理シートのE列（メアド）にあるメールアドレスか確認
   */
  private async isAllowedEmail(email: string): Promise<boolean> {
    try {
      const staffData = await this.staffManagementService.fetchStaffData();
      const allowed = staffData.some(
        s => s.email && s.email.trim().toLowerCase() === email.trim().toLowerCase()
      );
      console.log('[AuthService] Email allowlist check:', { email, allowed });
      return allowed;
    } catch (error) {
      console.error('[AuthService] Failed to check staff email list:', error);
      // スプレッドシート取得失敗時はログインを拒否（安全側に倒す）
      return false;
    }
  }

  /**
   * Supabase Authのユーザー情報から社員レコードを取得または作成
   * スタッフ管理シートのE列にあるメールアドレスのみ許可
   */
  async getOrCreateEmployee(
    userId: string,
    email: string,
    userMetadata: GoogleUserMetadata | null | undefined
  ): Promise<Employee> {
    // スタッフ管理シートのメールアドレスか確認
    const allowed = await this.isAllowedEmail(email);
    if (!allowed) {
      console.warn('[AuthService] Login rejected - email not in staff list:', email);
      throw new Error('このメールアドレスはログインが許可されていません');
    }

    // メタデータから名前を抽出
    const extractedName = extractDisplayName(userMetadata, email);
    
    console.log('[AuthService] getOrCreateEmployee called:', {
      userId,
      email,
      metadata: userMetadata,
      extractedName,
    });

    // 既存の社員を検索
    const { data: existing, error: fetchError } = await this.table('employees')
      .select('*')
      .eq('google_id', userId)
      .single();

    if (existing && !fetchError) {
      console.log('[AuthService] Existing employee found:', {
        id: existing.id,
        currentName: existing.name,
        extractedName,
      });

      // is_activeがfalseの場合はtrueに戻す（シートにある = 有効）
      const updates: any = { last_login_at: new Date().toISOString() };
      if (!existing.is_active) {
        updates.is_active = true;
        console.log('[AuthService] Reactivating employee:', existing.id);
      }

      // 既存の名前が無効な場合は更新する
      if (this.isInvalidName(existing.name)) {
        updates.name = extractedName;
        console.log('[AuthService] Updating invalid employee name:', {
          oldName: existing.name,
          newName: extractedName,
        });
      }

      await this.table('employees').update(updates).eq('id', existing.id);

      return { ...existing, ...updates, lastLoginAt: new Date() };
    }

    // 新規社員を作成
    console.log('[AuthService] Creating new employee:', {
      userId,
      email,
      name: extractedName,
    });

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

    console.log('[AuthService] New employee created:', {
      id: newEmployee.id,
      name: newEmployee.name,
    });

    return newEmployee;
  }

  /**
   * 名前が無効かどうかをチェック
   * 暗号化されたような文字列、"不明"、空文字列などを検出
   */
  private isInvalidName(name: string): boolean {
    if (!name || name.trim().length === 0) {
      return true;
    }

    // "不明"をチェック
    if (name === '不明' || name === 'Unknown') {
      return true;
    }

    // 暗号化されたような文字列をチェック（Base64パターン）
    // 長い英数字の羅列で、スペースがない場合
    const base64Pattern = /^[A-Za-z0-9+/=]{20,}$/;
    if (base64Pattern.test(name)) {
      return true;
    }

    // メールアドレスそのものが名前になっている場合
    if (name.includes('@')) {
      return true;
    }

    return false;
  }

  /**
   * セッションを検証
   * employeesテーブルに登録済み（is_active=true）であればOK
   * 未登録の場合のみスタッフ管理シートで確認
   */
  async validateSession(accessToken: string): Promise<Employee> {
    // Supabase Authでトークンを検証（SERVICE_ROLE_KEYを使用）
    const { data: { user }, error } = await this.supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new Error('Invalid or expired session');
    }

    // 社員情報を取得（登録済みであればシートチェック不要）
    const { data: employee, error: employeeError } = await this.table('employees')
      .select('*')
      .eq('google_id', user.id)
      .eq('is_active', true)
      .single();

    if (employee && !employeeError) {
      // 登録済みのアカウントはそのまま許可
      return employee;
    }

    // 未登録の場合のみスタッフ管理シートで確認
    if (user.email) {
      const allowed = await this.isAllowedEmail(user.email);
      if (!allowed) {
        console.warn('[AuthService] Session rejected - email not in staff list:', user.email);
        throw new Error('このメールアドレスはログインが許可されていません');
      }
    }

    throw new Error('Employee not found or inactive');
  }

  /**
   * ログアウト
   */
  async logout(accessToken: string): Promise<void> {
    // Supabase Authでログアウト
    await this.supabase.auth.admin.signOut(accessToken);
  }
}
