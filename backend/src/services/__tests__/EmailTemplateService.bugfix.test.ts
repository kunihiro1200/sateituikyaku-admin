/**
 * バグ修正確認テスト: mergeAngleBracketPlaceholders() の内覧前伝達事項バグ
 *
 * タスク2.3: Gmail修正のユニットテスト
 * タスク4.1: Gmail保全テスト
 *
 * Validates: Requirements 2.1, 2.2, 3.1, 3.3, 3.5
 */

import { EmailTemplateService } from '../EmailTemplateService';

// ===== タスク2.3: Gmail修正のユニットテスト =====

describe('バグ修正確認: mergeAngleBracketPlaceholders() の内覧前伝達事項（タスク2.3）', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  describe('テストシナリオ1: pre_viewing_notes に値がある場合', () => {
    it('内覧前伝達事項の値が結果に含まれること', () => {
      // Arrange
      const template = '<<氏名>>様\n\n内覧前のご確認事項:\n<<内覧前伝達事項v>>\n\nよろしくお願いします。';
      const buyer = {
        name: '田中太郎',
        pre_viewing_notes: '駐車場は右側',
      };
      const properties = [
        {
          propertyNumber: 'AA12345',
          address: '大分市中央町1-2-3',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 内覧前伝達事項の値が結果に含まれること（修正済みコードでは PASS）
      expect(result).toContain('駐車場は右側');
      // <<内覧前伝達事項v>> プレースホルダーが残っていないこと
      expect(result).not.toContain('<<内覧前伝達事項v>>');
    });
  });

  describe('テストシナリオ2: pre_viewing_notes に別の値がある場合', () => {
    it('内覧前伝達事項の値が結果に含まれること', () => {
      // Arrange
      const template = '<<氏名>>様\n\n<<内覧前伝達事項v>>';
      const buyer = {
        name: '山田花子',
        pre_viewing_notes: '玄関の暗証番号は1234です',
      };
      const properties = [
        {
          propertyNumber: 'BB67890',
          address: '大分市府内町2-3-4',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 内覧前伝達事項の値が結果に含まれること
      expect(result).toContain('玄関の暗証番号は1234です');
    });
  });

  describe('テストシナリオ3: pre_viewing_notes が空の場合', () => {
    it('<<内覧前伝達事項v>> が空文字に置換されること', () => {
      // Arrange
      const template = '<<氏名>>様\n\n<<内覧前伝達事項v>>';
      const buyer = {
        name: '鈴木一郎',
        pre_viewing_notes: '',
      };
      const properties = [
        {
          propertyNumber: 'CC11111',
          address: '大分市春日町3-4-5',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 空文字に置換されること（既存動作の維持）
      expect(result).not.toContain('<<内覧前伝達事項v>>');
    });
  });

  describe('テストシナリオ4: pre_viewing_notes が未定義の場合', () => {
    it('<<内覧前伝達事項v>> が空文字に置換されること', () => {
      // Arrange
      const template = '<<氏名>>様\n\n<<内覧前伝達事項v>>';
      const buyer = {
        name: '佐藤次郎',
        // pre_viewing_notes は未定義
      };
      const properties = [
        {
          propertyNumber: 'DD22222',
          address: '大分市大手町4-5-6',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 空文字に置換されること（既存動作の維持）
      expect(result).not.toContain('<<内覧前伝達事項v>>');
    });
  });

  describe('テストシナリオ5: 他プレースホルダーの正常動作確認（タスク2.3）', () => {
    it('<<氏名>> が正しく置換されること', () => {
      // Arrange
      const template = '<<氏名>>様\n\nよろしくお願いします。';
      const buyer = {
        name: '田中太郎',
        pre_viewing_notes: '',
      };
      const properties = [
        {
          propertyNumber: 'AA12345',
          address: '大分市中央町1-2-3',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: <<氏名>> が正しく置換されること
      expect(result).toContain('田中太郎様');
      expect(result).not.toContain('<<氏名>>');
    });

    it('<<住居表示>> が正しく置換されること', () => {
      // Arrange
      const template = '所在地：<<住居表示>>\n\nよろしくお願いします。';
      const buyer = {
        name: '田中太郎',
        pre_viewing_notes: '',
      };
      const properties = [
        {
          propertyNumber: 'AA12345',
          address: '大分市中央町1-2-3',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: <<住居表示>> が正しく置換されること
      expect(result).toContain('大分市中央町1-2-3');
      expect(result).not.toContain('<<住居表示>>');
    });

    it('<<SUUMO　URLの表示>> が空文字に置換されること', () => {
      // Arrange: SUUMO URLプレースホルダーを含むテンプレート
      const template = '<<氏名>>様\n\n<<SUUMO　URLの表示>>\n\nよろしくお願いします。';
      const buyer = {
        name: '田中太郎',
        pre_viewing_notes: '',
      };
      const properties = [
        {
          propertyNumber: 'AA12345',
          address: '大分市中央町1-2-3',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: <<SUUMO　URLの表示>> が空文字に置換されること（既存動作の維持）
      expect(result).not.toContain('<<SUUMO　URLの表示>>');
    });
  });
});

// ===== タスク4.1: Gmail保全テスト =====

describe('Gmail保全テスト: 他プレースホルダーが修正前後で同じ結果になること（タスク4.1）', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  /**
   * 保全テスト1: <<氏名>> の置換が内覧前伝達事項の有無に関わらず同じ結果になること
   *
   * Validates: Requirements 3.1, 3.3
   */
  it('<<氏名>> の置換は pre_viewing_notes の有無に関わらず同じ結果になること', () => {
    // Arrange: <<内覧前伝達事項v>> を含まないテンプレート
    const template = '<<氏名>>様\n\nよろしくお願いします。';
    const buyerWithNotes = {
      name: '田中太郎',
      pre_viewing_notes: '駐車場は右側',
    };
    const buyerWithoutNotes = {
      name: '田中太郎',
      pre_viewing_notes: '',
    };
    const properties = [
      {
        propertyNumber: 'AA12345',
        address: '大分市中央町1-2-3',
      },
    ];

    // Act
    const resultWithNotes = service.mergeAngleBracketPlaceholders(template, buyerWithNotes, properties);
    const resultWithoutNotes = service.mergeAngleBracketPlaceholders(template, buyerWithoutNotes, properties);

    // Assert: <<内覧前伝達事項v>> を含まないテンプレートでは結果が同一
    expect(resultWithNotes).toBe(resultWithoutNotes);
    expect(resultWithNotes).toContain('田中太郎様');
  });

  /**
   * 保全テスト2: <<住居表示>> の置換が内覧前伝達事項の有無に関わらず同じ結果になること
   *
   * Validates: Requirements 3.1, 3.3
   */
  it('<<住居表示>> の置換は pre_viewing_notes の有無に関わらず同じ結果になること', () => {
    // Arrange: <<内覧前伝達事項v>> を含まないテンプレート
    const template = '所在地：<<住居表示>>';
    const buyerWithNotes = {
      name: '田中太郎',
      pre_viewing_notes: '駐車場は右側',
    };
    const buyerWithoutNotes = {
      name: '田中太郎',
      pre_viewing_notes: '',
    };
    const properties = [
      {
        propertyNumber: 'AA12345',
        address: '大分市中央町1-2-3',
      },
    ];

    // Act
    const resultWithNotes = service.mergeAngleBracketPlaceholders(template, buyerWithNotes, properties);
    const resultWithoutNotes = service.mergeAngleBracketPlaceholders(template, buyerWithoutNotes, properties);

    // Assert: <<内覧前伝達事項v>> を含まないテンプレートでは結果が同一
    expect(resultWithNotes).toBe(resultWithoutNotes);
    expect(resultWithNotes).toContain('大分市中央町1-2-3');
  });

  /**
   * 保全テスト3: <<SUUMO　URLの表示>> が空文字に置換されること（既存動作の維持）
   *
   * Validates: Requirements 3.5
   */
  it('<<SUUMO　URLの表示>> が空文字に置換されること', () => {
    // Arrange
    const template = '<<氏名>>様\n\n<<SUUMO　URLの表示>>\n\n<<内覧前伝達事項v>>';
    const buyer = {
      name: '田中太郎',
      pre_viewing_notes: '駐車場は右側',
    };
    const properties = [
      {
        propertyNumber: 'AA12345',
        address: '大分市中央町1-2-3',
      },
    ];

    // Act
    const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

    // Assert: <<SUUMO　URLの表示>> が空文字に置換されること
    expect(result).not.toContain('<<SUUMO　URLの表示>>');
    // <<内覧前伝達事項v>> は正しく置換されること
    expect(result).toContain('駐車場は右側');
    // <<氏名>> は正しく置換されること
    expect(result).toContain('田中太郎様');
  });

  /**
   * 保全テスト4: 複数プレースホルダーが同時に正しく置換されること
   *
   * Validates: Requirements 3.1, 3.3, 3.5
   */
  it('複数プレースホルダーが同時に正しく置換されること', () => {
    // Arrange: 複数のプレースホルダーを含むテンプレート
    const template = '<<氏名>>様\n\n所在地：<<住居表示>>\n\n<<SUUMO　URLの表示>>\n\n内覧前のご確認事項:\n<<内覧前伝達事項v>>\n\nよろしくお願いします。';
    const buyer = {
      name: '田中太郎',
      pre_viewing_notes: '駐車場は右側をご利用ください',
    };
    const properties = [
      {
        propertyNumber: 'AA12345',
        address: '大分市中央町1-2-3',
      },
    ];

    // Act
    const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

    // Assert: 全プレースホルダーが正しく置換されること
    expect(result).toContain('田中太郎様');
    expect(result).toContain('大分市中央町1-2-3');
    expect(result).not.toContain('<<SUUMO　URLの表示>>');
    expect(result).toContain('駐車場は右側をご利用ください');
    // プレースホルダーが残っていないこと
    expect(result).not.toContain('<<氏名>>');
    expect(result).not.toContain('<<住居表示>>');
    expect(result).not.toContain('<<内覧前伝達事項v>>');
  });
});


// ===== 署名担当者情報バグ修正確認テスト =====

describe('バグ修正確認: mergeAngleBracketPlaceholders() の担当者情報プレースホルダー（署名TEL・MAIL・固定休）', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  /**
   * バグ条件探索テスト1: <<担当名（営業）電話番号>> が空文字になるバグ
   * 未修正コードでは FAIL（バグ確認）、修正後は PASS
   */
  it('<<担当名（営業）電話番号>> が staffInfo.phone で置換されること', () => {
    const template = 'TEL：<<担当名（営業）電話番号>>';
    const buyer = { name: '田中太郎' };
    const properties = [{ propertyNumber: 'AA12345', address: '大分市中央町1-2-3' }];
    const staffInfo = { name: '裏天真', phone: '090-1234-5678', email: 'ura@ifoo.com', regularHoliday: '水曜日' };

    const result = (service as any).mergeAngleBracketPlaceholders(template, buyer, properties, staffInfo);

    expect(result).toContain('090-1234-5678');
    expect(result).not.toContain('<<担当名（営業）電話番号>>');
  });

  /**
   * バグ条件探索テスト2: <<担当名（営業）メールアドレス>> が空文字になるバグ
   */
  it('<<担当名（営業）メールアドレス>> が staffInfo.email で置換されること', () => {
    const template = 'MAIL: <<担当名（営業）メールアドレス>>';
    const buyer = { name: '田中太郎' };
    const properties = [{ propertyNumber: 'AA12345', address: '大分市中央町1-2-3' }];
    const staffInfo = { name: '裏天真', phone: '090-1234-5678', email: 'ura@ifoo.com', regularHoliday: '水曜日' };

    const result = (service as any).mergeAngleBracketPlaceholders(template, buyer, properties, staffInfo);

    expect(result).toContain('ura@ifoo.com');
    expect(result).not.toContain('<<担当名（営業）メールアドレス>>');
  });

  /**
   * バグ条件探索テスト3: <<担当名（営業）固定休>> が空文字になるバグ
   */
  it('<<担当名（営業）固定休>> が staffInfo.regularHoliday で置換されること', () => {
    const template = '固定休：<<担当名（営業）固定休>>';
    const buyer = { name: '田中太郎' };
    const properties = [{ propertyNumber: 'AA12345', address: '大分市中央町1-2-3' }];
    const staffInfo = { name: '裏天真', phone: '090-1234-5678', email: 'ura@ifoo.com', regularHoliday: '水曜日' };

    const result = (service as any).mergeAngleBracketPlaceholders(template, buyer, properties, staffInfo);

    expect(result).toContain('水曜日');
    expect(result).not.toContain('<<担当名（営業）固定休>>');
  });

  /**
   * バグ条件探索テスト4: 署名全体のテスト（内覧後お礼メール相当）
   */
  it('署名全体の担当者情報プレースホルダーが正しく置換されること', () => {
    const template = `***************************
株式会社 いふう
<<担当名（営業）名前>>
〒870-0044大分市舞鶴町1丁目3-30
TEL：<<担当名（営業）電話番号>>
FAX：097-529-7160
MAIL: <<担当名（営業）メールアドレス>>
固定休：<<担当名（営業）固定休>>
HP：https://ifoo-oita.com/
***************************`;
    const buyer = { name: '田中太郎' };
    const properties = [{ propertyNumber: 'AA12345', address: '大分市中央町1-2-3' }];
    const staffInfo = { name: '裏天真', phone: '090-1234-5678', email: 'ura@ifoo.com', regularHoliday: '水曜日' };

    const result = (service as any).mergeAngleBracketPlaceholders(template, buyer, properties, staffInfo);

    expect(result).toContain('裏天真');
    expect(result).toContain('090-1234-5678');
    expect(result).toContain('ura@ifoo.com');
    expect(result).toContain('水曜日');
    expect(result).not.toContain('<<担当名（営業）名前>>');
    expect(result).not.toContain('<<担当名（営業）電話番号>>');
    expect(result).not.toContain('<<担当名（営業）メールアドレス>>');
    expect(result).not.toContain('<<担当名（営業）固定休>>');
  });

  /**
   * 保全テスト: staffInfo なしの場合は空文字に置換されること（既存動作維持）
   */
  it('staffInfo が渡されない場合、担当者情報プレースホルダーは空文字に置換されること', () => {
    const template = 'TEL：<<担当名（営業）電話番号>>\nMAIL: <<担当名（営業）メールアドレス>>';
    const buyer = { name: '田中太郎' };
    const properties = [{ propertyNumber: 'AA12345', address: '大分市中央町1-2-3' }];

    const result = (service as any).mergeAngleBracketPlaceholders(template, buyer, properties);

    expect(result).not.toContain('<<担当名（営業）電話番号>>');
    expect(result).not.toContain('<<担当名（営業）メールアドレス>>');
    expect(result).toContain('TEL：');
    expect(result).toContain('MAIL: ');
  });

  /**
   * 保全テスト: 既存の買主情報・物件情報プレースホルダーは引き続き正常に動作すること
   */
  it('staffInfo を渡しても既存の買主情報・物件情報プレースホルダーは正常に置換されること', () => {
    const template = '<<氏名>>様\n所在地：<<住居表示>>\nTEL：<<担当名（営業）電話番号>>';
    const buyer = { name: '田中太郎' };
    const properties = [{ propertyNumber: 'AA12345', address: '大分市中央町1-2-3' }];
    const staffInfo = { name: '裏天真', phone: '090-1234-5678', email: 'ura@ifoo.com', regularHoliday: '水曜日' };

    const result = (service as any).mergeAngleBracketPlaceholders(template, buyer, properties, staffInfo);

    expect(result).toContain('田中太郎様');
    expect(result).toContain('大分市中央町1-2-3');
    expect(result).toContain('090-1234-5678');
  });
});
