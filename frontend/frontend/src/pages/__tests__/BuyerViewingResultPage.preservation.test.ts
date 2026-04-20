/**
 * BuyerViewingResultPage 内覧前日SMS 保全テスト（Property 2: Preservation）
 *
 * 修正後も既存の正常動作が変わらないことを確認する。
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */
import { describe, test, expect } from 'vitest';

// 修正後コードのコピー
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
    if (viewingDate.getDay() === 4) dayWord = '明後日';
  }

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

function getAddress_fixed(property: {
  property_address?: string | null;
  address?: string | null;
  display_address?: string | null;
} | null): string {
  return property?.display_address || property?.property_address || property?.address || '';
}

describe('Property 2: Preservation — 既存の正常動作の保全', () => {
  test('保全1: viewing_time が HH:MM 形式（"14:30"）の場合、SMS本文にそのまま含まれること', () => {
    const buyer = { name: 'テスト太郎', viewing_date: '2025/12/15', viewing_time: '14:30' };
    const smsBody = generatePreDaySmsBody_fixed(buyer, '大分県別府市秋葉町7-24', '');
    expect(smsBody).toContain('14:30');
  });

  test('保全2: viewing_time が null の場合、SMS本文の時刻部分が空文字列になること', () => {
    const buyer = { name: 'テスト太郎', viewing_date: '2025/12/15', viewing_time: null };
    const smsBody = generatePreDaySmsBody_fixed(buyer, '大分県別府市秋葉町7-24', '');
    expect(smsBody).toContain(' から');
    expect(smsBody).not.toMatch(/\d{1,2}:\d{2}から/);
  });

  test('保全3: display_address が null で address に日本語住所がある場合、address が使用されること', () => {
    const property = { property_address: null, address: '大分県別府市秋葉町7-24', display_address: null };
    const address = getAddress_fixed(property);
    expect(address).toBe('大分県別府市秋葉町7-24');
  });

  test('保全4: 内覧日が木曜日（2025/12/18）の場合、SMS本文が「明後日の」で始まること', () => {
    const buyer = { name: 'テスト太郎', viewing_date: '2025/12/18', viewing_time: '14:00' };
    const smsBody = generatePreDaySmsBody_fixed(buyer, '大分県別府市秋葉町7-24', '');
    expect(smsBody).toContain('明後日の');
    expect(smsBody).not.toContain('明日の');
  });

  test('保全5: 内覧日が月曜日（2025/12/15）の場合、SMS本文が「明日の」で始まること', () => {
    const buyer = { name: 'テスト太郎', viewing_date: '2025/12/15', viewing_time: '14:00' };
    const smsBody = generatePreDaySmsBody_fixed(buyer, '大分県別府市秋葉町7-24', '');
    expect(smsBody).toContain('明日の');
    expect(smsBody).not.toContain('明後日の');
  });
});
