/**
 * Gmail API メール送信テスト
 * tenant@ifoo-oita.com から tomoko.kunihiro@ifoo-oita.com にテストメールを送信
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { EmailService } from './src/services/EmailService';

async function main() {
  console.log('=== Gmail API メール送信テスト ===\n');

  const emailService = new EmailService();

  try {
    console.log('メール送信中...');
    await emailService.sendEmail({
      to: ['tomoko.kunihiro@ifoo-oita.com'],
      subject: 'テスト：内覧メール送信確認',
      body: [
        'これはメール送信テストです。',
        '',
        '内覧担当は国広智子です。',
        '物件所在地「別府市鶴見1953−13 ヴィブレアトリオ」',
        '内覧日：2026/3/14(土)',
        '時間：14:00〜15:00',
        '問合時コメント：テスト',
        '売主様：テスト売主',
        '所有者連絡先：090-0000-0000',
        '買主番号：7133',
        '物件番号：AA12721',
        '',
        'https://sateituikyaku-admin-frontend.vercel.app/buyers/7133',
      ].join('\n'),
    });
    console.log('✅ メール送信成功！');
  } catch (error: any) {
    console.error('❌ メール送信失敗:', error.message);
    if (error.response?.data) {
      console.error('詳細:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main().catch(console.error);
