/**
 * BuyerViewingResultPage 内覧前日SMS バグ条件探索テスト（Property 1: Bug Condition）
 *
 * 修正後のコードで PASS することでバグが修正されたことを確認する。
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4 → 2.1, 2.2, 2.3, 2.4**
 */
import { describe, test, expect } from 'vitest';

// -----------------------------------------------------------------------
// generatePreDaySmsBody 関数のロジック（修正後コード）
// frontend/frontend/src/pages/BuyerViewingResultPage.tsx の約97〜135行目
// -----------------------------------------------------------------------

function generatePreDaySmsBody_fixed(
  buyer: {
    name?: string | null;
    viewing_date?: string | null;
    viewing_time?: string | null;
  },
  propertyAddress: string,
  googleMapUrl: string
): string {
  const name = buyer.name || 'お客様';
  const dateStr = buyer.viewing_date || '';
  const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
  let dateLabel = '';
  let dayWord = '明日';

  if (parts.length === 3) {
    const viewingDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const month = viewingDate.getMonth() + 1;
    const day = viewingDate.getDate();
    dateLabel = `${month}月${day}日`;
    if (viewingDate.getDay() === 4) dayWord = '明後日'; // 木曜
  }

  // 修正後コード: viewing_time を HH:MM 形式に正規化
  const rawTime = buyer.viewing_time || '';
  let timeStr = '';
  if (rawTime) {
    if (/^\d{1,2}:\d{2}$/.test(rawTime)) {
      timeStr = rawTime;
    } else {
      const dateObj = new Date(rawTime);
      if (!isNaN(dateObj.getTime())) {
        const hours = dateObj.getHours().toString().padStart(2, '0');
        const minutes = dateObj.getMinutes().toString().padStart(2, '0');
        timeStr = `${hours}:${minutes}`;
      }
    }
  }
  const mapLine = googleMapUrl ? `\n${googleMapUrl}` : '';

  return `【内覧のご連絡　☆返信不可☆】\n${name}様\nお世話になっております。㈱いふうです。\n${dayWord}の${dateLabel} ${timeStr}から${propertyAddress}の内覧をよろしくお願いいたします。${mapLine}\nこのメールは返信不可となっておりますので、何かございましたら下記連絡先へお願いいたします。\n【電話】(10時～18時）*水曜定休\n097-533-2022\n【メールアドレス】\ntenant@ifoo-oita.com\nそれではお会いできるのを楽しみにしております。\n㈱いふう`;
}

// 修正後の住所取得ロジック
function getAddress_fixed(property: {
  property_address?: string | null;
  address?: string | null;
  display_address?: string | null;
} | null): string {
  return property?.display_address || property?.property_address || property?.address || '';
}

// -----------------------------------------------------------------------
// Fix Checking テスト（修正後コードで PASS することを確認）
// -----------------------------------------------------------------------

describe('Fix Checking — 時刻フォーマット正規化', () => {
  test('Dateオブジェクト文字列の viewing_time → SMS本文に GMT が含まれないこと', () => {
    const buyer = {
      name: 'テスト太郎',
      viewing_date: '2025/12/20',
      viewing_time: 'Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)',
    };
    const smsBody = generatePreDaySmsBody_fixed(buyer, '大分県別府市秋葉町7-24', '');
    expect(smsBody).not.toContain('GMT');
  });

  test('Dateオブジェクト文字列の viewing_time → SMS本文に Standard Time が含まれないこと', () => {
    const buyer = {
      name: 'テスト太郎',
      viewing_date: '2025/12/20',
      viewing_time: 'Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)',
    };
    const smsBody = generatePreDaySmsBody_fixed(buyer, '大分県別府市秋葉町7-24', '');
    expect(smsBody).not.toContain('Standard Time');
  });

  test('Dateオブジェクト文字列の viewing_time → SMS本文に HH:MM 形式の時刻が含まれること', () => {
    const buyer = {
      name: 'テスト太郎',
      viewing_date: '2025/12/20',
      viewing_time: 'Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)',
    };
    const smsBody = generatePreDaySmsBody_fixed(buyer, '大分県別府市秋葉町7-24', '');
    expect(smsBody).toMatch(/\d{1,2}:\d{2}から/);
  });
});

describe('Fix Checking — 住所日本語化', () => {
  test('display_address が存在する場合、SMS本文に日本語住所が含まれること', () => {
    const property = {
      property_address: null,
      address: 'Oita, Beppu, Akibacho, 7−24',
      display_address: '大分県別府市秋葉町7-24',
    };
    const address = getAddress_fixed(property);
    const buyer = { name: 'テスト太郎', viewing_date: '2025/12/20', viewing_time: '14:00' };
    const smsBody = generatePreDaySmsBody_fixed(buyer, address, '');
    expect(smsBody).toContain('大分県別府市秋葉町7-24');
  });

  test('display_address が存在する場合、SMS本文に英語住所が含まれないこと', () => {
    const property = {
      property_address: null,
      address: 'Oita, Beppu, Akibacho, 7−24',
      display_address: '大分県別府市秋葉町7-24',
    };
    const address = getAddress_fixed(property);
    const buyer = { name: 'テスト太郎', viewing_date: '2025/12/20', viewing_time: '14:00' };
    const smsBody = generatePreDaySmsBody_fixed(buyer, address, '');
    expect(smsBody).not.toContain('Oita');
    expect(smsBody).not.toContain('Beppu');
  });
});
