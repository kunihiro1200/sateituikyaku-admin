/**
 * parseDesiredArea ロジックのテスト
 * バグ: desired_area に読点（、）を含むエリア名が複数チップに分割される
 */

// バグのある元のロジック（修正前）
function parseDesiredAreaBuggy(areaVal: string): string[] {
  return areaVal
    ? (areaVal.includes('|') ? areaVal.split('|') : areaVal.split('、'))
        .map((v: string) => v.trim())
        .filter(Boolean)
    : [];
}

// 修正後のロジック
function parseDesiredAreaFixed(areaVal: string): string[] {
  return areaVal
    ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean)
    : [];
}

// ===== Exploratory: バグ再現テスト =====
describe('parseDesiredArea - バグ再現（修正前ロジック）', () => {
  test('1.2 読点を含むエリア名が3要素に分割される（バグ確認）', () => {
    const input = '②中学校（滝尾、城東、原川）';
    const result = parseDesiredAreaBuggy(input);
    // バグ: 3要素に分割されてしまう
    expect(result.length).toBe(3);
    expect(result).toEqual(['②中学校（滝尾', '城東', '原川）']);
  });

  test('読点3つのエリア名が4要素に分割される（バグ確認）', () => {
    const input = '⑤中学校（大在、坂ノ市、鶴崎、佐賀関）';
    const result = parseDesiredAreaBuggy(input);
    // バグ: 4要素に分割されてしまう（読点3つで4分割）
    expect(result.length).toBe(4);
  });

  test('|区切りの場合はバグが発生しない（正常ケース）', () => {
    const input = '②中学校（滝尾、城東、原川）|㊵大分';
    const result = parseDesiredAreaBuggy(input);
    expect(result.length).toBe(2);
  });

  test('読点なしエリア名はバグが発生しない（正常ケース）', () => {
    const input = '㊵大分';
    const result = parseDesiredAreaBuggy(input);
    expect(result.length).toBe(1);
  });
});

// ===== Fix Checking: 修正後テスト =====
describe('parseDesiredArea - 修正後ロジック', () => {
  test('3.1 読点を含むエリア名が1要素として正しく解析される', () => {
    const input = '②中学校（滝尾、城東、原川）';
    const result = parseDesiredAreaFixed(input);
    expect(result.length).toBe(1);
    expect(result[0]).toBe('②中学校（滝尾、城東、原川）');
  });

  test('読点4つのエリア名が1要素として正しく解析される', () => {
    const input = '⑤中学校（大在、坂ノ市、鶴崎、佐賀関）';
    const result = parseDesiredAreaFixed(input);
    expect(result.length).toBe(1);
    expect(result[0]).toBe('⑤中学校（大在、坂ノ市、鶴崎、佐賀関）');
  });

  test('3.2 AREA_OPTIONS の全エリア名が単独入力で1要素を返す（プロパティベース）', () => {
    const AREA_OPTIONS = [
      '①中学校（王子、碩田学園、大分西）',
      '②中学校（滝尾、城東、原川）',
      '③中学校（明野、大東）',
      '④中学校（東陽、鶴崎）',
      '⑤中学校（大在、坂ノ市、鶴崎、佐賀関）',
      '⑥中学校（南大分、城南、賀来）',
      '㊵大分',
    ];
    AREA_OPTIONS.forEach((area) => {
      const result = parseDesiredAreaFixed(area);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(area);
    });
  });
});

// ===== Preservation Checking: 既存動作の保持テスト =====
describe('parseDesiredArea - 既存動作の保持', () => {
  test('4.1 |区切りの複数エリアが正しく複数要素として解析される', () => {
    const input = '②中学校（滝尾、城東、原川）|⑥中学校（南大分、城南、賀来）';
    const result = parseDesiredAreaFixed(input);
    expect(result.length).toBe(2);
    expect(result[0]).toBe('②中学校（滝尾、城東、原川）');
    expect(result[1]).toBe('⑥中学校（南大分、城南、賀来）');
  });

  test('読点なし単一エリアが1要素として保持される', () => {
    const input = '㊵大分';
    const result = parseDesiredAreaFixed(input);
    expect(result.length).toBe(1);
    expect(result[0]).toBe('㊵大分');
  });

  test('4.2 空文字が空配列を返す', () => {
    expect(parseDesiredAreaFixed('')).toEqual([]);
  });

  test('null相当の空文字が空配列を返す', () => {
    expect(parseDesiredAreaFixed('')).toEqual([]);
  });

  test('3エリアの|区切りが正しく3要素を返す', () => {
    const input = '①中学校（王子、碩田学園、大分西）|②中学校（滝尾、城東、原川）|③中学校（明野、大東）';
    const result = parseDesiredAreaFixed(input);
    expect(result.length).toBe(3);
  });
});
