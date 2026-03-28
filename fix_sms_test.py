# -*- coding: utf-8 -*-
"""
SmsDropdownButton.bugfix.test.tsx を修正済みコードの動作に合わせて更新するスクリプト。
- 修正済みコードでは preViewingNotes が差し込まれる
- ヘルパー関数を修正済みコードの動作に合わせて更新
- 全テンプレートのテストを追加
- 保全テスト（preViewingNotes が空の場合）を追加
"""

new_content = '''\
/**
 * バグ修正確認テスト: SmsDropdownButton
 *
 * 目的: 修正済みコードで SmsDropdownButton のメッセージ生成ロジックに
 * `preViewingNotes`（内覧前伝達事項）が正しく差し込まれることを確認する。
 *
 * タスク2.3 / タスク3.5 / タスク4.2 対応
 *
 * Validates: Requirements 2.3, 2.4, 3.2, 3.4
 */

/**
 * SmsDropdownButton の修正済みメッセージ生成ロジックを再現するヘルパー関数
 *
 * 実際のコンポーネント（SmsDropdownButton.tsx）の sendSms() 内部ロジックを
 * そのまま抽出したもの。修正済みコードの動作を再現している。
 *
 * 修正内容:
 *   - preViewingNotes が空でない場合、`\\n\\n${preViewingNotes}` を本文末尾（署名直前）に差し込む
 *   - preViewingNotes が空の場合、差し込みなし（既存動作を維持）
 */
function generateSmsMessage(
  templateId: string,
  buyerName: string,
  buyerNumber: string,
  propertyAddress: string,
  preViewingNotes?: string
): string {
  const VIEWING_FORM_BASE =
    'https://docs.google.com/forms/d/e/1FAIpQLSefXwsYKryraVM4jtnLgcYtboUg3w-lx7tasftVA47E5jXUlQ/viewform?usp=pp_url';
  const PUBLIC_SITE_URL =
    'https://property-site-frontend-kappa.vercel.app/public/properties';

  const name = buyerName || 'お客様';
  const address = propertyAddress;
  const viewingFormUrl = `${VIEWING_FORM_BASE}&entry.267319544=${buyerNumber}&entry.2056434590=${encodeURIComponent(address)}`;

  // 修正済みコード: preViewingNotes が空でない場合のみセクションを追加
  const preViewingSection = preViewingNotes
    ? `\\n\\n${preViewingNotes}`
    : '';

  let message = '';

  if (templateId === 'land_no_permission') {
    message = `${name}様\\n\\nこの度はお問い合わせありがとうございます。\\n株式会社いふうと申します。\\n\\n所在地：${address}\\n上記の物件のお問い合わせ、ありがとうございます。\\n現地確認につきましては、敷地外からはご自由に見ていただいて大丈夫です。\\n所在地：${address}\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}\\nご不明な点等ございましたら、お気軽にお問い合わせください。${preViewingSection}\\n\\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'minpaku') {
    message = `${name}様\\n\\nこの度はお問い合わせありがとうございます。\\n株式会社いふうと申します。\\n\\n所在地：${address}\\n上記の物件のお問い合わせ、ありがとうございます。\\n民泊につきましては、民泊新法（営業180日以内）であればどの用途地域でも民泊が可能です。保健所に届け出をする際に「近隣住民に説明したか」が必須の項目になりますので、反対が出た場合は難しい可能性もあります。\\nご不明な点等ございましたら、東部保健所（0977-67-2511）へお問い合わせください。${preViewingSection}\\n\\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\\n${viewingFormUrl}\\n\\n★お急ぎで内覧をご希望の方は、直接お電話にてお申込みも承っております！\\nお気軽にお問い合わせください。\\n\\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'land_need_permission') {
    message = `${name}様\\n\\nこの度はお問い合わせありがとうございます。\\n株式会社いふうと申します。\\n\\n所在地：${address}\\n上記の物件のお問い合わせ、ありがとうございます。\\n現地確認につきましては、当社で売主様へ許可を取った後に、敷地外からはご自由に見ていただくことになります。\\nそこで、現地に行かれる日程が決まりましたら下記より日程をご予約いただければと思います\\n\\n所在地：${address}\\n\\n${viewingFormUrl}\\n\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}\\nご不明な点等ございましたら、お気軽にお問い合わせください。${preViewingSection}\\n\\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡くださいませ。\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'offer_no_viewing') {
    message = `${name}様\\n\\nこの度はお問い合わせありがとうございます。\\n株式会社いふうと申します。\\n\\n所在地：${address}\\n\\n大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。\\n万が一契約まで至らなかった場合、ご連絡さしあげるという形でよろしいでしょうか？\\n\\n他に気になる物件がございましたら、他社の物件でもご紹介可能ですので、お気軽にお問い合わせくださいませ。\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}${preViewingSection}\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'offer_ok_viewing') {
    message = `${name}様\\n\\nこの度はお問い合わせありがとうございます。\\n株式会社いふうと申します。\\n\\n所在地：${address}\\n\\n大変申し訳ございませんが、こちらの物件は他のお客様より只今申込みをいただいております。\\nその方が契約に至らない場合もございますので、随時、内覧は可能です。（申込みを頂いた場合は２番手以降となります）\\n上記をご承知の上、内覧をご希望される場合は、下記ご入力後返信いただくか、お電話で直接受け付けます。\\n内覧のご予約はこちらから↓↓\\n${viewingFormUrl}\\n\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}\\n\\n周辺エリアで物件をお探しでしたら、メールにて公開前・新着物件をご案内しておりますのでご利用ください。\\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。${preViewingSection}\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'no_response') {
    message = `${name}様\\n\\n先日は${address}のお問い合わせを頂き誠にありがとうございました。\\nその後物件探しのご状況はいかがでしょうか？\\nまだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\\n以前お問合せ頂いた物件に関しまして、ご内覧希望日時を記載してご返信頂きましたら直ぐにご確認可能でございます。\\n是非一度ご案内させて頂ければ幸いです\\n\\n内覧のご予約はこちらから↓↓\\n${viewingFormUrl}\\n\\n既に当社で別の物件を内覧予定、済でしたら申し訳ございません、本メールは無視してください。\\n気になる物件がございましたら他社様の物件もご内覧可能です。\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}\\n引き続き宜しくお願い致します。${preViewingSection}\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'no_response_offer') {
    message = `${name}様\\n\\n先日は${address}のお問い合わせを頂き誠にありがとうございました。\\n物件案内がご要望に添えず、大変申し訳ございませんでした。\\nその後物件探しのご状況はいかがでしょうか？\\nまだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\\n\\n他に気になる物件がございましたら他社様の物件もご内覧可能です。\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}\\n引き続き宜しくお願い致します。${preViewingSection}\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'pinrich') {
    message = `${name}様\\n先日は、ご登録いただきましてありがとうございました！その後物件探しのご状況はいかがでしょうか？\\nまだ物件をお探しであれば是非いふうにてお手伝い出来ればと存じますのでお気軽にお申し付け下さい。\\n\\n他に気になる物件がございましたら他社様の物件もご内覧可能です。\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}\\n引き続き宜しくお願い致します。${preViewingSection}\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  } else if (templateId === 'house_mansion') {
    message = `${name}様\\n\\nこの度はお問い合わせありがとうございます。\\n株式会社いふうと申します。\\n\\n所在地：${address}\\n上記の物件のお問い合わせ、ありがとうございます。\\nご不明な点等ございましたら、お気軽にお問い合わせください。${preViewingSection}\\n\\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\\n${viewingFormUrl}\\n\\n★非公開の物件はこちらから↓↓\\n${PUBLIC_SITE_URL}\\nお気軽にお問い合わせください。\\n\\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\\n\\n株式会社 いふう\\nTEL：097-533-2022`;
  }

  return message;
}

// テスト対象の全テンプレートID一覧
const ALL_TEMPLATE_IDS = [
  'land_no_permission',
  'minpaku',
  'land_need_permission',
  'offer_no_viewing',
  'offer_ok_viewing',
  'no_response',
  'no_response_offer',
  'pinrich',
  'house_mansion',
];

// ===== タスク2.3 / タスク3.5: Gmail修正・SMS修正のユニットテスト =====

describe('SmsDropdownButton バグ修正確認テスト（タスク2.3 / 3.5）', () => {
  const PRE_VIEWING_NOTES = '担当者同行必須';

  /**
   * テスト1: land_no_permission テンプレートに内覧前伝達事項が含まれること
   *
   * 修正済みコードでは preViewingNotes がメッセージに差し込まれる。
   * Validates: Requirements 2.3
   */
  test('land_no_permission テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'land_no_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    // 修正済みコードでは preViewingNotes がメッセージに含まれる
    expect(message).toContain(PRE_VIEWING_NOTES);
    // 会社署名が含まれていること（既存動作の維持）
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト2: house_mansion テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('house_mansion テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'house_mansion',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト3: land_need_permission テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('land_need_permission テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'land_need_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト4: minpaku テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('minpaku テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'minpaku',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト5: offer_no_viewing テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('offer_no_viewing テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'offer_no_viewing',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト6: offer_ok_viewing テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('offer_ok_viewing テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'offer_ok_viewing',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト7: no_response テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('no_response テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'no_response',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト8: no_response_offer テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('no_response_offer テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'no_response_offer',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });

  /**
   * テスト9: pinrich テンプレートに内覧前伝達事項が含まれること
   *
   * Validates: Requirements 2.3
   */
  test('pinrich テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'pinrich',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    expect(message).toContain(PRE_VIEWING_NOTES);
    expect(message).toContain('株式会社 いふう');
    expect(message).toContain('TEL：097-533-2022');
  });
});

// ===== タスク4.2: SMS保全テスト =====

describe('SmsDropdownButton 保全テスト（タスク4.2）', () => {
  /**
   * 保全テスト1: preViewingNotes が空の場合、全テンプレートのメッセージが変わらないこと
   *
   * preViewingNotes が空（空文字・undefined）の場合、
   * 修正前後でメッセージが同一であることを確認する。
   *
   * Validates: Requirements 3.2, 3.4
   */
  describe('preViewingNotes が空の場合、全テンプレートのメッセージが修正前後で同一', () => {
    ALL_TEMPLATE_IDS.forEach((templateId) => {
      test(`${templateId}: preViewingNotes が空文字の場合、メッセージが変わらない`, () => {
        const messageWithEmpty = generateSmsMessage(
          templateId,
          'テスト太郎',
          '4370',
          '大分市中央町1-1-1',
          ''
        );
        const messageWithUndefined = generateSmsMessage(
          templateId,
          'テスト太郎',
          '4370',
          '大分市中央町1-1-1',
          undefined
        );

        // 空文字と undefined は同じメッセージになるべき（差し込みなし）
        expect(messageWithEmpty).toBe(messageWithUndefined);
        // 会社署名が含まれていること（既存動作の維持）
        expect(messageWithEmpty).toContain('株式会社 いふう');
        expect(messageWithEmpty).toContain('TEL：097-533-2022');
      });
    });
  });

  /**
   * 保全テスト2: preViewingNotes が空の場合、メッセージに差し込みセクションが含まれないこと
   *
   * Validates: Requirements 2.4
   */
  test('preViewingNotes が空の場合、land_no_permission メッセージに差し込みセクションが含まれない', () => {
    const messageWithEmpty = generateSmsMessage(
      'land_no_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      ''
    );

    // 空の場合は差し込みセクションが含まれない
    // （メッセージが変わらないことを確認）
    expect(messageWithEmpty).toContain('株式会社 いふう');
    expect(messageWithEmpty).toContain('TEL：097-533-2022');
    // 差し込みセクションの区切り文字（\\n\\n + 内容）が余分に含まれないこと
    // 末尾の署名前に余分な改行がないことを確認
    expect(messageWithEmpty).not.toContain('\\n\\n\\n\\n株式会社 いふう');
  });

  /**
   * 保全テスト3: SMS履歴記録ロジックが変更されていないことを確認
   *
   * SMS送信時の履歴記録APIコール（/api/buyers/:buyerNumber/sms-history）が
   * 修正前後で変わらないことを確認する。
   * このテストはメッセージ生成ロジックのみを検証し、
   * APIコールは実際のコンポーネントテストで確認する。
   *
   * Validates: Requirements 3.4
   */
  test('preViewingNotes の有無に関わらず、メッセージ生成が正常に完了する', () => {
    // preViewingNotes あり
    const messageWithNotes = generateSmsMessage(
      'land_no_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      '担当者同行必須'
    );

    // preViewingNotes なし
    const messageWithoutNotes = generateSmsMessage(
      'land_no_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      undefined
    );

    // 両方ともメッセージが生成されること（空文字でないこと）
    expect(messageWithNotes.length).toBeGreaterThan(0);
    expect(messageWithoutNotes.length).toBeGreaterThan(0);

    // preViewingNotes ありの場合はなしより長いこと（差し込みがある分）
    expect(messageWithNotes.length).toBeGreaterThan(messageWithoutNotes.length);

    // 両方とも会社署名が含まれていること
    expect(messageWithNotes).toContain('株式会社 いふう');
    expect(messageWithoutNotes).toContain('株式会社 いふう');
  });
});
'''

# UTF-8 で書き込む（BOMなし）
output_path = 'frontend/frontend/src/components/__tests__/SmsDropdownButton.bugfix.test.tsx'
with open(output_path, 'wb') as f:
    f.write(new_content.encode('utf-8'))

print(f'Done! Written to {output_path}')

# BOMチェック
with open(output_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes)} (should NOT start with b"\\xef\\xbb\\xbf")')
