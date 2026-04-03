/**
 * ValidationService 縺ｮ繝・せ繝・ */

import { ValidationService } from '../ValidationService';

describe('ValidationService', () => {
  describe('validateRequiredFields', () => {
    it('蜈ｨ縺ｦ縺ｮ蠢・医ヵ繧｣繝ｼ繝ｫ繝峨′遨ｺ縺ｮ蝣ｴ蜷医√ヰ繝ｪ繝・・繧ｷ繝ｧ繝ｳ縺悟､ｱ謨励☆繧・, () => {
      const buyer = {
        buyer_number: '6666',
        viewing_date: '',
        viewing_time: '',
        viewing_mobile: '',
        follow_up_assignee: '',
      };
      const linkedProperties = [{ property_number: 'AA13501', atbb_status: '蟆ゆｻｻ' }];

      const result = ValidationService.validateRequiredFields(buyer, linkedProperties);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('蜀・ｦｧ譌･・域怙譁ｰ・・);
      expect(result.errors).toContain('譎る俣');
      expect(result.errors).toContain('蜀・ｦｧ蠖｢諷・);
      expect(result.errors).toContain('蠕檎ｶ壽球蠖・);
    });

    it('蜈ｨ縺ｦ縺ｮ蠢・医ヵ繧｣繝ｼ繝ｫ繝峨′蜈･蜉帙＆繧後※縺・ｋ蝣ｴ蜷医√ヰ繝ｪ繝・・繧ｷ繝ｧ繝ｳ縺梧・蜉溘☆繧・, () => {
      const buyer = {
        buyer_number: '6666',
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        viewing_mobile: '縲仙・隕ｧ_蟆ゑｼ郁・遉ｾ迚ｩ莉ｶ・峨・,
        follow_up_assignee: 'Y',
      };
      const linkedProperties = [{ property_number: 'AA13501', atbb_status: '蟆ゆｻｻ' }];

      const result = ValidationService.validateRequiredFields(buyer, linkedProperties);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('蟆ゆｻｻ迚ｩ莉ｶ縺ｮ蝣ｴ蜷医∝・隕ｧ蠖｢諷九′譛ｪ蜈･蜉帙□縺ｨ繧ｨ繝ｩ繝ｼ縺ｫ縲悟・隕ｧ蠖｢諷九阪′蜷ｫ縺ｾ繧後ｋ', () => {
      const buyer = {
        buyer_number: '6666',
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        viewing_mobile: '',
        follow_up_assignee: 'Y',
      };
      const linkedProperties = [{ property_number: 'AA13501', atbb_status: '蟆ゆｻｻ' }];

      const result = ValidationService.validateRequiredFields(buyer, linkedProperties);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('蜀・ｦｧ蠖｢諷・);
    });

    it('荳闊ｬ蟐剃ｻ狗黄莉ｶ縺ｮ蝣ｴ蜷医∝・隕ｧ蠖｢諷九′譛ｪ蜈･蜉帙□縺ｨ繧ｨ繝ｩ繝ｼ縺ｫ縲悟・隕ｧ蠖｢諷祇荳闊ｬ蟐剃ｻ九阪′蜷ｫ縺ｾ繧後ｋ', () => {
      const buyer = {
        buyer_number: '6666',
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        viewing_mobile: '',
        follow_up_assignee: 'Y',
      };
      const linkedProperties = [{ property_number: 'AA13501', atbb_status: '荳闊ｬ' }];

      const result = ValidationService.validateRequiredFields(buyer, linkedProperties);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('蜀・ｦｧ蠖｢諷祇荳闊ｬ蟐剃ｻ・);
    });

    it('迚ｩ莉ｶ縺檎ｴ舌▼縺・※縺・↑縺・ｴ蜷医∝・隕ｧ蠖｢諷九・繝√ぉ繝・け縺ｯ繧ｹ繧ｭ繝・・縺輔ｌ繧・, () => {
      const buyer = {
        buyer_number: '6666',
        viewing_date: '2026-02-10',
        viewing_time: '14:30',
        viewing_mobile: '',
        follow_up_assignee: 'Y',
      };
      const linkedProperties: any[] = [];

      const result = ValidationService.validateRequiredFields(buyer, linkedProperties);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getValidationErrorMessage', () => {
    it('繧ｨ繝ｩ繝ｼ縺・縺､縺ｮ蝣ｴ蜷医√娯酪笳上′譛ｪ蜈･蜉帙〒縺吶阪・蠖｢蠑上〒繝｡繝・そ繝ｼ繧ｸ繧定ｿ斐☆', () => {
      const errors = ['蜀・ｦｧ譌･・域怙譁ｰ・・];
      const message = ValidationService.getValidationErrorMessage(errors);
      expect(message).toBe('蜀・ｦｧ譌･・域怙譁ｰ・峨′譛ｪ蜈･蜉帙〒縺・);
    });

    it('繧ｨ繝ｩ繝ｼ縺瑚､・焚縺ｮ蝣ｴ蜷医√娯酪笳上≫酪笳上′譛ｪ蜈･蜉帙〒縺吶阪・蠖｢蠑上〒繝｡繝・そ繝ｼ繧ｸ繧定ｿ斐☆', () => {
      const errors = ['蜀・ｦｧ譌･・域怙譁ｰ・・, '譎る俣', '蠕檎ｶ壽球蠖・];
      const message = ValidationService.getValidationErrorMessage(errors);
      expect(message).toBe('蜀・ｦｧ譌･・域怙譁ｰ・峨∵凾髢薙∝ｾ檎ｶ壽球蠖薙′譛ｪ蜈･蜉帙〒縺・);
    });

    it('繧ｨ繝ｩ繝ｼ縺・縺ｮ蝣ｴ蜷医∫ｩｺ譁・ｭ怜・繧定ｿ斐☆', () => {
      const errors: string[] = [];
      const message = ValidationService.getValidationErrorMessage(errors);
      expect(message).toBe('');
    });
  });
});
