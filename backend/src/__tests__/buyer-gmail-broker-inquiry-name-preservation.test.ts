import { EmailTemplateService } from '../services/EmailTemplateService';

/**
 * 保全プロパティテスト: 非業者問合せ時の従来動作が維持される
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * このテストは修正前のコードで PASS することが期待される。
 * 非バグ条件（broker_inquiry !== '業者問合せ'）の入力で、
 * 従来の動作が保全されていることを確認する。
 */
describe('Preservation: 非業者問合せ時の従来動作が維持される', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  it('broker_inquiry が空文字 + company_name あり → {name}・{company_name} 形式', () => {
    const text = '<<●氏名・会社名>>様';
    const buyer = { name: '鈴木一郎', company_name: '株式会社ABC', broker_inquiry: '' };
    const result = (service as any).mergeAngleBracketPlaceholders(text, buyer, []);
    expect(result).toBe('鈴木一郎・株式会社ABC様');
  });

  it('broker_inquiry が空文字 + company_name なし → name のみ', () => {
    const text = '<<●氏名・会社名>>様';
    const buyer = { name: '鈴木一郎', company_name: '', broker_inquiry: '' };
    const result = (service as any).mergeAngleBracketPlaceholders(text, buyer, []);
    expect(result).toBe('鈴木一郎様');
  });

  it('broker_inquiry が "その他" + company_name あり → {name}・{company_name} 形式', () => {
    const text = '<<●氏名・会社名>>様';
    const buyer = { name: '佐藤次郎', company_name: '株式会社DEF', broker_inquiry: 'その他' };
    const result = (service as any).mergeAngleBracketPlaceholders(text, buyer, []);
    expect(result).toBe('佐藤次郎・株式会社DEF様');
  });

  it('<<氏名>> プレースホルダーは broker_inquiry に関わらず name のみに置換される', () => {
    const text = '<<氏名>>様';
    const buyer = { name: '田中太郎', company_name: '株式会社ABC', broker_inquiry: '業者問合せ' };
    const result = (service as any).mergeAngleBracketPlaceholders(text, buyer, []);
    expect(result).toBe('田中太郎様');
    expect(result).not.toContain('株式会社ABC');
  });
});
