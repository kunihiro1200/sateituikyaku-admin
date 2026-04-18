import { EmailTemplateService } from '../services/EmailTemplateService';

describe('Bug Condition Exploration: 業者問合せ時の宛名に法人名が付加されるバグ', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  it('業者問合せ + 法人名あり → <<●氏名・会社名>> に法人名が含まれない（修正前コードで FAIL）', () => {
    const text = '<<●氏名・会社名>>様';
    const buyer = {
      name: '田中太郎',
      company_name: '株式会社ABC',
      broker_inquiry: '業者問合せ',
    };
    const result = (service as any).mergeAngleBracketPlaceholders(text, buyer, []);
    // 修正前コードでは '田中太郎・株式会社ABC様' になるため FAIL する
    expect(result).toBe('田中太郎様');
    expect(result).not.toContain('株式会社ABC');
  });

  it('業者問合せ + 法人名あり（別パターン）→ <<●氏名・会社名>> に法人名が含まれない（修正前コードで FAIL）', () => {
    const text = '<<●氏名・会社名>>様';
    const buyer = {
      name: '山田花子',
      company_name: '不動産会社XYZ',
      broker_inquiry: '業者問合せ',
    };
    const result = (service as any).mergeAngleBracketPlaceholders(text, buyer, []);
    // 修正前コードでは '山田花子・不動産会社XYZ様' になるため FAIL する
    expect(result).toBe('山田花子様');
    expect(result).not.toContain('不動産会社XYZ');
  });
});
