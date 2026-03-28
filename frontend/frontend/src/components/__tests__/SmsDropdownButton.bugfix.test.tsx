/**
 * バグ条件の探索テスト: SmsDropdownButton
 *
 * 目的: 未修正コードで SmsDropdownButton のメッセージ生成ロジックに
 * `preViewingNotes`（内覧前伝達事項）の差し込みが存在しないことを確認する。
 *
 * CRITICAL: このテストは未修正コードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。コードを修正しないこと。
 *
 * Validates: Requirements 1.2 (SMS送信時に内覧前伝達事項が含まれないバグ)
 */

/**
 * SmsDropdownButton のメッセージ生成ロジックを再現するヘルパー関数
 *
 * 実際のコンポーネント（SmsDropdownButton.tsx）の sendSms() 内部ロジックを
 * そのまま抽出したもの。コンポーネントを修正せずにメッセージ内容を検証するため。
 *
 * 注意: このヘルパーは「未修正コード」の動作を再現している。
 * preViewingNotes パラメータを受け取るが、メッセージには差し込まない。
 */
function generateSmsMessage(
  templateId: string,
  buyerName: string,
  buyerNumber: string,
  propertyAddress: string,
  _preViewingNotes?: string  // 未修正コードでは使用されない（バグ）
): string {
  const VIEWING_FORM_BASE =
    'https://docs.google.com/forms/d/e/1FAIpQLSefXwsYKryraVM4jtnLgcYtboUg3w-lx7tasftVA47E5jXUlQ/viewform?usp=pp_url';
  const PUBLIC_SITE_URL =
    'https://property-site-frontend-kappa.vercel.app/public/properties';

  const name = buyerName || 'お客様';
  const address = propertyAddress;
  const viewingFormUrl = `${VIEWING_FORM_BASE}&entry.267319544=${buyerNumber}&entry.2056434590=${encodeURIComponent(address)}`;

  let message = '';

  if (templateId === 'land_no_permission') {
    message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n現地確認につきましては、敷地外からはご自由に見ていただいて大丈夫です。\n所在地：${address}\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nご不明な点等ございましたら、お気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\n株式会社 いふう\nTEL：097-533-2022`;
  } else if (templateId === 'minpaku') {
    message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n民泊につきましては、民泊新法（営業180日以内）であればどの用途地域でも民泊が可能です。保健所に届け出をする際に「近隣住民に説明したか」が必須の項目になりますので、反対が出た場合は難しい可能性もあります。\nご不明な点等ございましたら、東部保健所（0977-67-2511）へお問い合わせください。\n\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\n${viewingFormUrl}\n\n★お急ぎで内覧をご希望の方は、直接お電話にてお申込みも承っております！\nお気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\n株式会社 いふう\nTEL：097-533-2022`;
  } else if (templateId === 'land_need_permission') {
    message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\n現地確認につきましては、当社で売主様へ許可を取った後に、敷地外からはご自由に見ていただくことになります。\nそこで、現地に行かれる日程が決まりましたら下記より日程をご予約いただければと思います\n\n所在地：${address}\n\n${viewingFormUrl}\n\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nご不明な点等ございましたら、お気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡くださいませ。\n\n株式会社 いふう\nTEL：097-533-2022`;
  } else if (templateId === 'house_mansion') {
    message = `${name}様\n\nこの度はお問い合わせありがとうございます。\n株式会社いふうと申します。\n\n所在地：${address}\n上記の物件のお問い合わせ、ありがとうございます。\nご不明な点等ございましたら、お気軽にお問い合わせください。\n\nまた、ご内覧希望の場合は、こちらからご予約お願いいたします↓↓\n${viewingFormUrl}\n\n★非公開の物件はこちらから↓↓\n${PUBLIC_SITE_URL}\nお気軽にお問い合わせください。\n\nまた、他社物件もご紹介できますので、気になる物件がございましたらお気軽にご連絡ください。\n\n株式会社 いふう\nTEL：097-533-2022`;
  }

  return message;
}

describe('SmsDropdownButton バグ条件の探索テスト', () => {
  const PRE_VIEWING_NOTES = '担当者同行必須';

  /**
   * テスト1: land_no_permission テンプレートに内覧前伝達事項が含まれるべき
   *
   * preViewingNotes = "担当者同行必須" を渡した場合、
   * 未修正コードではメッセージに内容が含まれないことを確認する。
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   * （メッセージに "担当者同行必須" が含まれないため）
   */
  test('land_no_permission テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'land_no_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    // バグ: 未修正コードでは preViewingNotes がメッセージに含まれない
    // このアサーションは未修正コードで FAIL する
    expect(message).toContain(PRE_VIEWING_NOTES);
  });

  /**
   * テスト2: house_mansion テンプレートに内覧前伝達事項が含まれるべき
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   */
  test('house_mansion テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'house_mansion',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    // バグ: 未修正コードでは preViewingNotes がメッセージに含まれない
    expect(message).toContain(PRE_VIEWING_NOTES);
  });

  /**
   * テスト3: land_need_permission テンプレートに内覧前伝達事項が含まれるべき
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   */
  test('land_need_permission テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'land_need_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    // バグ: 未修正コードでは preViewingNotes がメッセージに含まれない
    expect(message).toContain(PRE_VIEWING_NOTES);
  });

  /**
   * テスト4: minpaku テンプレートに内覧前伝達事項が含まれるべき
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   */
  test('minpaku テンプレート: preViewingNotes が含まれる', () => {
    const message = generateSmsMessage(
      'minpaku',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      PRE_VIEWING_NOTES
    );

    // バグ: 未修正コードでは preViewingNotes がメッセージに含まれない
    expect(message).toContain(PRE_VIEWING_NOTES);
  });

  /**
   * テスト5: preViewingNotes が空の場合はメッセージが変わらないこと（保全テスト）
   *
   * preViewingNotes が空の場合、既存のメッセージ内容が変わらないことを確認する。
   * このテストは未修正コードでも PASS する（バグ条件に該当しないため）。
   */
  test('preViewingNotes が空の場合、land_no_permission メッセージは変わらない', () => {
    const messageWithEmpty = generateSmsMessage(
      'land_no_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      ''
    );
    const messageWithUndefined = generateSmsMessage(
      'land_no_permission',
      'テスト太郎',
      '4370',
      '大分市中央町1-1-1',
      undefined
    );

    // 空の場合は同じメッセージになるべき
    expect(messageWithEmpty).toBe(messageWithUndefined);
    // 会社署名が含まれていること（既存動作の維持）
    expect(messageWithEmpty).toContain('株式会社 いふう');
    expect(messageWithEmpty).toContain('TEL：097-533-2022');
  });
});
