/**
 * CalendarLinkGenerator 縺ｮ繝・せ繝・ */

import { CalendarLinkGenerator } from '../CalendarLinkGenerator';

describe('CalendarLinkGenerator', () => {
  describe('generateCalendarLink', () => {
    it('蠕檎ｶ壽球蠖薙・繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縺径dd繝代Λ繝｡繝ｼ繧ｿ縺ｫ蜷ｫ縺ｾ繧後ｋ', () => {
      const buyer = {
        buyer_number: '6666',
        name: '螻ｱ逕ｰ螟ｪ驛・,
        phone_number: '090-1234-5678',
        email: 'yamada@example.com',
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        follow_up_assignee: 'Y',
        pre_viewing_notes: '繝・せ繝育畑繝｡繝｢',
      };
      const employees = [
        { name: '菴占陸', initials: 'Y', email: 'sato@example.com' },
        { name: '驤ｴ譛ｨ', initials: 'K', email: 'suzuki@example.com' },
      ];

      const link = CalendarLinkGenerator.generateCalendarLink(buyer, employees);

      expect(link).toContain('add=sato%40example.com');
    });

    it('繧ｫ繝ｬ繝ｳ繝繝ｼ繝ｪ繝ｳ繧ｯ縺ｫ蜀・ｦｧ譌･譎ゅ′蜷ｫ縺ｾ繧後ｋ', () => {
      const buyer = {
        buyer_number: '6666',
        name: '螻ｱ逕ｰ螟ｪ驛・,
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        follow_up_assignee: 'Y',
      };
      const employees = [
        { name: '菴占陸', initials: 'Y', email: 'sato@example.com' },
      ];

      const link = CalendarLinkGenerator.generateCalendarLink(buyer, employees);

      // 譌･譎ゅヵ繧ｩ繝ｼ繝槭ャ繝・ 20260210T143000
      expect(link).toContain('20260210T143000');
      // 邨ゆｺ・凾蛻ｻ・・譎る俣蠕鯉ｼ・ 20260210T153000
      expect(link).toContain('20260210T153000');
    });

    it('繧ｫ繝ｬ繝ｳ繝繝ｼ繝ｪ繝ｳ繧ｯ縺ｫ雋ｷ荳ｻ諠・ｱ縺悟性縺ｾ繧後ｋ', () => {
      const buyer = {
        buyer_number: '6666',
        name: '螻ｱ逕ｰ螟ｪ驛・,
        phone_number: '090-1234-5678',
        email: 'yamada@example.com',
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        follow_up_assignee: 'Y',
        pre_viewing_notes: '繝・せ繝育畑繝｡繝｢',
      };
      const employees = [
        { name: '菴占陸', initials: 'Y', email: 'sato@example.com' },
      ];

      const link = CalendarLinkGenerator.generateCalendarLink(buyer, employees);

      // 繧ｿ繧､繝医Ν縺ｫ雋ｷ荳ｻ蜷阪′蜷ｫ縺ｾ繧後ｋ
      expect(link).toContain(encodeURIComponent('蜀・ｦｧ: 螻ｱ逕ｰ螟ｪ驛・));
      // 隧ｳ邏ｰ縺ｫ雋ｷ荳ｻ逡ｪ蜿ｷ縺悟性縺ｾ繧後ｋ
      expect(link).toContain(encodeURIComponent('雋ｷ荳ｻ逡ｪ蜿ｷ: 6666'));
      // 隧ｳ邏ｰ縺ｫ髮ｻ隧ｱ逡ｪ蜿ｷ縺悟性縺ｾ繧後ｋ
      expect(link).toContain(encodeURIComponent('090-1234-5678'));
    });

    it('蠕檎ｶ壽球蠖薙′蠕捺･ｭ蜩｡繝ｪ繧ｹ繝医↓蟄伜惠縺励↑縺・ｴ蜷医∥dd繝代Λ繝｡繝ｼ繧ｿ縺ｪ縺・, () => {
      const buyer = {
        buyer_number: '6666',
        name: '螻ｱ逕ｰ螟ｪ驛・,
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        follow_up_assignee: 'Z', // 蟄伜惠縺励↑縺・う繝九す繝｣繝ｫ
      };
      const employees = [
        { name: '菴占陸', initials: 'Y', email: 'sato@example.com' },
      ];

      const link = CalendarLinkGenerator.generateCalendarLink(buyer, employees);

      expect(link).not.toContain('add=');
    });

    it('viewing_time縺梧悴險ｭ螳壹・蝣ｴ蜷医√ョ繝輔か繝ｫ繝・4:00繧剃ｽｿ逕ｨ', () => {
      const buyer = {
        buyer_number: '6666',
        name: '螻ｱ逕ｰ螟ｪ驛・,
        viewing_date: '2026-02-10',
        viewing_time: '',
        follow_up_assignee: 'Y',
      };
      const employees = [
        { name: '菴占陸', initials: 'Y', email: 'sato@example.com' },
      ];

      const link = CalendarLinkGenerator.generateCalendarLink(buyer, employees);

      // 繝・ヵ繧ｩ繝ｫ繝・4:00縺ｮ蝣ｴ蜷・ 20260210T140000
      expect(link).toContain('20260210T140000');
    });
  });
});
