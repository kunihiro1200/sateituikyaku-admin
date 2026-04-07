import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './GoogleSheetsClient';

/**
 * スタッフ管理シート → employeesテーブルの同期サービス
 * 
 * スタッフ管理シートを唯一の正解（Single Source of Truth）として扱い、
 * employeesテーブルに自動同期します。
 */
export class StaffSyncService {
  private supabase: SupabaseClient;
  private sheetsClient: GoogleSheetsClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    this.sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
  }

  /**
   * スタッフ管理シートからemployeesテーブルに同期
   */
  async syncStaff(): Promise<void> {
    console.log('[StaffSync] スタッフ同期を開始...');

    try {
      // スタッフ管理シートを認証
      await this.sheetsClient.authenticate();

      // スタッフ管理シートからデータを取得（A:Z列）
      const values = await this.sheetsClient.readRawRange('A:Z');

      if (!values || values.length === 0) {
        console.log('[StaffSync] スタッフ管理シートにデータがありません');
        return;
      }

      // ヘッダー行を取得
      const headers = values[0];
      const initialsIndex = headers.indexOf('イニシャル');
      const nameIndex = headers.indexOf('姓名');
      const emailIndex = headers.indexOf('メアド');
      const isActiveIndex = headers.indexOf('有効');

      if (initialsIndex === -1 || nameIndex === -1 || emailIndex === -1 || isActiveIndex === -1) {
        console.error('[StaffSync] 必須カラムが見つかりません');
        return;
      }

      console.log(`[StaffSync] ${values.length - 1}行のスタッフデータを取得しました`);

      // データ行を処理
      let addedCount = 0;
      let updatedCount = 0;
      let deactivatedCount = 0;

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const initials = row[initialsIndex];
        const name = row[nameIndex];
        const email = row[emailIndex];
        const isActiveStr = String(row[isActiveIndex]).toUpperCase();
        const isActive = isActiveStr === 'TRUE' || isActiveStr === 'YES' || isActiveStr === '1';

        // イニシャルが空の場合はスキップ
        if (!initials || String(initials).trim() === '') {
          continue;
        }

        // 特殊なイニシャルをスキップ（事務、業者、外す、不要、未など）
        const specialInitials = ['事務', 'GYOSHA', '業者', '外す', '不要', '未'];
        if (specialInitials.includes(String(initials))) {
          continue;
        }

        // メールアドレスが空の場合はダミーメールを生成
        const finalEmail = email && String(email).trim() !== '' 
          ? String(email).trim() 
          : `${initials}@dummy.local`;

        // employeesテーブルで既存のスタッフを検索（イニシャルで検索）
        const { data: existingEmployee } = await this.supabase
          .from('employees')
          .select('*')
          .eq('initials', initials)
          .single();

        if (existingEmployee) {
          // 既存スタッフの更新
          const updates: any = {};
          let needsUpdate = false;

          if (existingEmployee.name !== name) {
            updates.name = name;
            needsUpdate = true;
          }

          if (existingEmployee.email !== finalEmail) {
            updates.email = finalEmail;
            needsUpdate = true;
          }

          if (existingEmployee.is_active !== isActive) {
            updates.is_active = isActive;
            needsUpdate = true;
          }

          if (needsUpdate) {
            const { error } = await this.supabase
              .from('employees')
              .update(updates)
              .eq('id', existingEmployee.id);

            if (error) {
              console.error(`[StaffSync] 更新エラー（${initials}）:`, error);
            } else {
              console.log(`[StaffSync] ✅ 更新: ${initials} (${name})`);
              updatedCount++;
            }
          }
        } else {
          // 新規スタッフの追加
          const { error } = await this.supabase
            .from('employees')
            .insert({
              google_id: finalEmail,
              email: finalEmail,
              name: name || initials,
              role: 'agent',
              is_active: isActive,
              initials: initials,
            });

          if (error) {
            console.error(`[StaffSync] 追加エラー（${initials}）:`, error);
          } else {
            console.log(`[StaffSync] ✅ 追加: ${initials} (${name})`);
            addedCount++;
          }
        }
      }

      console.log('[StaffSync] 同期完了:');
      console.log(`  追加: ${addedCount}人`);
      console.log(`  更新: ${updatedCount}人`);
      console.log(`  無効化: ${deactivatedCount}人`);
    } catch (error) {
      console.error('[StaffSync] 同期エラー:', error);
      throw error;
    }
  }

  /**
   * 特定のスタッフを同期
   */
  async syncSingleStaff(initials: string): Promise<void> {
    console.log(`[StaffSync] スタッフ「${initials}」を同期中...`);

    try {
      await this.sheetsClient.authenticate();
      const values = await this.sheetsClient.readRawRange('A:Z');

      if (!values || values.length === 0) {
        console.log('[StaffSync] スタッフ管理シートにデータがありません');
        return;
      }

      const headers = values[0];
      const initialsIndex = headers.indexOf('イニシャル');
      const nameIndex = headers.indexOf('姓名');
      const emailIndex = headers.indexOf('メアド');
      const isActiveIndex = headers.indexOf('有効');

      // 対象スタッフを検索
      const targetRow = values.find((row, index) => index > 0 && row[initialsIndex] === initials);

      if (!targetRow) {
        console.log(`[StaffSync] スタッフ「${initials}」が見つかりませんでした`);
        return;
      }

      const name = targetRow[nameIndex];
      const email = targetRow[emailIndex];
      const isActiveStr = String(targetRow[isActiveIndex]).toUpperCase();
      const isActive = isActiveStr === 'TRUE' || isActiveStr === 'YES' || isActiveStr === '1';

      const finalEmail = email && String(email).trim() !== '' 
        ? String(email).trim() 
        : `${initials}@dummy.local`;

      // employeesテーブルで既存のスタッフを検索
      const { data: existingEmployee } = await this.supabase
        .from('employees')
        .select('*')
        .eq('initials', initials)
        .single();

      if (existingEmployee) {
        // 更新
        const { error } = await this.supabase
          .from('employees')
          .update({
            name: name,
            email: finalEmail,
            is_active: isActive,
          })
          .eq('id', existingEmployee.id);

        if (error) {
          console.error(`[StaffSync] 更新エラー:`, error);
        } else {
          console.log(`[StaffSync] ✅ 更新完了: ${initials} (${name})`);
        }
      } else {
        // 追加
        const { error } = await this.supabase
          .from('employees')
          .insert({
            google_id: finalEmail,
            email: finalEmail,
            name: name || initials,
            role: 'agent',
            is_active: isActive,
            initials: initials,
          });

        if (error) {
          console.error(`[StaffSync] 追加エラー:`, error);
        } else {
          console.log(`[StaffSync] ✅ 追加完了: ${initials} (${name})`);
        }
      }
    } catch (error) {
      console.error('[StaffSync] 同期エラー:', error);
      throw error;
    }
  }
}
