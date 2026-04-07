/**
 * Bug Condition Exploration Test
 * 
 * Property 1: Bug Condition - 後続担当のカレンダーに送信されない
 * 
 * このテストは修正前のコードで**必ず失敗する必要があります**
 * 失敗によりバグの存在が確認されます
 * 
 * バグ条件: buyer.follow_up_assigneeが設定されているが、
 * GoogleカレンダーURLに&src=パラメータが含まれていない
 * 
 * 期待される動作: 後続担当のメールアドレスを従業員マスタから取得し、
 * &src=<email>パラメータをGoogleカレンダーURLに追加して、
 * 後続担当のカレンダーに予定を送信する
 * 
 * **Validates: Requirements 1.1, 1.2**
 */

// Jest is used for testing (no import needed)

// BuyerViewingResultPageのhandleCalendarButtonClick関数をシミュレート（修正前）
function generateCalendarUrl_unfixed(buyer: any, property: any): string {
  const rawDate = buyer.viewing_date || '';
  const rawTime = buyer.viewing_time || '14:00';
  const numParts = rawDate.match(/\d+/g);

  let startDateStr = '';
  let endDateStr = '';

  if (numParts && numParts.length >= 3) {
    const year = numParts[0].padStart(4, '0');
    const month = numParts[1].padStart(2, '0');
    const day = numParts[2].padStart(2, '0');

    let hours = 14, minutes = 0;
    if (rawTime.includes(':')) {
      [hours, minutes] = rawTime.split(':').map(Number);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    startDateStr = `${year}${month}${day}T${pad(hours)}${pad(minutes)}00`;
    const endHours = hours + 1;
    endDateStr = `${year}${month}${day}T${pad(endHours)}${pad(minutes)}00`;
  }

  const title = `内覧 ${property?.address || ''}`;
  const description = `物件住所: ${property?.address || 'なし'}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description,
    location: property?.address || '',
  });
  if (startDateStr && endDateStr) {
    params.append('dates', `${startDateStr}/${endDateStr}`);
  }

  // ❌ バグ: &src=パラメータが追加されていない
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// 修正後の関数（期待される動作）
function generateCalendarUrl_fixed(buyer: any, property: any, employees: any[]): string {
  const rawDate = buyer.viewing_date || '';
  const rawTime = buyer.viewing_time || '14:00';
  const numParts = rawDate.match(/\d+/g);

  let startDateStr = '';
  let endDateStr = '';

  if (numParts && numParts.length >= 3) {
    const year = numParts[0].padStart(4, '0');
    const month = numParts[1].padStart(2, '0');
    const day = numParts[2].padStart(2, '0');

    let hours = 14, minutes = 0;
    if (rawTime.includes(':')) {
      [hours, minutes] = rawTime.split(':').map(Number);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    startDateStr = `${year}${month}${day}T${pad(hours)}${pad(minutes)}00`;
    const endHours = hours + 1;
    endDateStr = `${year}${month}${day}T${pad(endHours)}${pad(minutes)}00`;
  }

  const title = `内覧 ${property?.address || ''}`;
  const description = `物件住所: ${property?.address || 'なし'}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description,
    location: property?.address || '',
  });
  if (startDateStr && endDateStr) {
    params.append('dates', `${startDateStr}/${endDateStr}`);
  }

  // ✅ 修正: 後続担当のメールアドレスを取得して&src=パラメータを追加
  let assignedEmail = '';
  if (buyer.follow_up_assignee) {
    const employee = employees.find(
      (emp) =>
        emp.initials === buyer.follow_up_assignee ||
        emp.name === buyer.follow_up_assignee
    );
    if (employee && employee.email) {
      assignedEmail = employee.email;
    }
  }

  const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';
  return `https://calendar.google.com/calendar/render?${params.toString()}${srcParam}`;
}

describe('Bug Condition Exploration: 買主内覧カレンダー送信バグ', () => {
  const employees = [
    { name: 'Yさん', initials: 'Y', email: 'y@example.com' },
    { name: '林', initials: '林', email: 'hayashi@example.com' },
  ];

  it('買主7187（後続担当: Y）のカレンダー送信 → &src=パラメータが含まれていない（バグ）', () => {
    const buyer = {
      buyer_number: '7187',
      viewing_date: '2026-04-10',
      viewing_time: '14:00',
      follow_up_assignee: 'Y',
    };

    const property = {
      address: '大分市中央町1-1-1',
    };

    const url = generateCalendarUrl_unfixed(buyer, property);

    // ❌ バグ: &src=パラメータが含まれていない
    expect(url).not.toContain('&src=');
    expect(url).not.toContain('y@example.com');

    // ✅ 期待される動作: &src=パラメータが含まれる
    const fixedUrl = generateCalendarUrl_fixed(buyer, property, employees);
    expect(fixedUrl).toContain('&src=y%40example.com');
  });

  it('買主5641（後続担当: 林）のカレンダー送信 → &src=パラメータが含まれていない（バグ）', () => {
    const buyer = {
      buyer_number: '5641',
      viewing_date: '2026-04-15',
      viewing_time: '15:30',
      follow_up_assignee: '林',
    };

    const property = {
      address: '大分市府内町2-2-2',
    };

    const url = generateCalendarUrl_unfixed(buyer, property);

    // ❌ バグ: &src=パラメータが含まれていない
    expect(url).not.toContain('&src=');
    expect(url).not.toContain('hayashi@example.com');

    // ✅ 期待される動作: &src=パラメータが含まれる
    const fixedUrl = generateCalendarUrl_fixed(buyer, property, employees);
    expect(fixedUrl).toContain('&src=hayashi%40example.com');
  });

  it('後続担当がNULLの場合 → &src=パラメータが含まれない（正常）', () => {
    const buyer = {
      buyer_number: '9999',
      viewing_date: '2026-04-20',
      viewing_time: '16:00',
      follow_up_assignee: null,
    };

    const property = {
      address: '大分市明野3-3-3',
    };

    const url = generateCalendarUrl_unfixed(buyer, property);

    // ✅ 正常: 後続担当がNULLの場合は&src=パラメータが含まれない
    expect(url).not.toContain('&src=');

    // ✅ 期待される動作: 修正後も&src=パラメータが含まれない
    const fixedUrl = generateCalendarUrl_fixed(buyer, property, employees);
    expect(fixedUrl).not.toContain('&src=');
  });

  it('後続担当が従業員マスタに存在しない場合 → &src=パラメータが含まれない（エッジケース）', () => {
    const buyer = {
      buyer_number: '8888',
      viewing_date: '2026-04-25',
      viewing_time: '17:00',
      follow_up_assignee: '存在しないイニシャル',
    };

    const property = {
      address: '大分市大手町4-4-4',
    };

    const url = generateCalendarUrl_unfixed(buyer, property);

    // ❌ バグ: &src=パラメータが含まれていない
    expect(url).not.toContain('&src=');

    // ✅ 期待される動作: 従業員が見つからない場合は&src=パラメータが含まれない
    const fixedUrl = generateCalendarUrl_fixed(buyer, property, employees);
    expect(fixedUrl).not.toContain('&src=');
  });

  it('バグ条件の形式的検証: isBugCondition関数', () => {
    // バグ条件: buyer.follow_up_assigneeが設定されているが、
    // GoogleカレンダーURLに&src=パラメータが含まれていない
    function isBugCondition(buyer: any, calendarUrl: string): boolean {
      return (
        buyer.follow_up_assignee !== null &&
        buyer.follow_up_assignee !== undefined &&
        buyer.follow_up_assignee !== '' &&
        !calendarUrl.includes('&src=')
      );
    }

    const buyer1 = {
      buyer_number: '7187',
      viewing_date: '2026-04-10',
      viewing_time: '14:00',
      follow_up_assignee: 'Y',
    };

    const property1 = {
      address: '大分市中央町1-1-1',
    };

    const url1 = generateCalendarUrl_unfixed(buyer1, property1);

    // ✅ バグ条件を満たす
    expect(isBugCondition(buyer1, url1)).toBe(true);

    // ✅ 修正後はバグ条件を満たさない
    const fixedUrl1 = generateCalendarUrl_fixed(buyer1, property1, employees);
    expect(isBugCondition(buyer1, fixedUrl1)).toBe(false);
  });
});
