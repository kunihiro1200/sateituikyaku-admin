# fix_calendar_button_email.py
# handleCalendarButtonClick にメール送信APIの呼び出しを追加する

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleCalendarButtonClick の末尾（window.open の後）にメール送信を追加
old_end = """    window.open(`https://calendar.google.com/calendar/render?${params.toString()}${srcParam}`, '_blank');
    setCalendarOpened(true);
  };"""

new_end = """    window.open(`https://calendar.google.com/calendar/render?${params.toString()}${srcParam}`, '_blank');
    setCalendarOpened(true);

    // カレンダーを開いたタイミングで物件担当へメール通知を送信（失敗しても無視）
    try {
      const rawDate2 = buyer.viewing_date || '';
      const numParts2 = rawDate2.match(/\\d+/g);
      let startIso = '';
      let endIso = '';
      if (numParts2 && numParts2.length >= 3) {
        const y = numParts2[0].padStart(4, '0');
        const mo = numParts2[1].padStart(2, '0');
        const d = numParts2[2].padStart(2, '0');
        let h = 14, mi = 0;
        if (rawTime.includes(':')) {
          [h, mi] = rawTime.split(':').map(Number);
        }
        const vd = new Date(`${y}-${mo}-${d}T00:00:00`);
        vd.setHours(h, mi, 0, 0);
        const ed = new Date(vd);
        ed.setHours(vd.getHours() + 1);
        startIso = vd.toISOString();
        endIso = ed.toISOString();
      }
      await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: startIso,
        endTime: endIso,
        assignedTo: buyer.follow_up_assignee,
        followUpAssignee: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile || '',
        viewingTypeGeneral: buyer.viewing_type_general || '',
        viewingDate: buyer.viewing_date || '',
        viewingTime: buyer.viewing_time || '',
        propertyAddress: property?.address || '',
        propertyNumber: property?.property_number || '',
        propertyGoogleMapUrl: property?.google_map_url || '',
        inquiryHearing: buyer.inquiry_hearing || '',
        creatorName: buyer.name,
      });
      console.log('[BuyerViewingResultPage] Notification email sent via calendar button');
    } catch (emailErr: any) {
      console.warn('[BuyerViewingResultPage] Notification email failed (non-fatal):', emailErr.message);
    }
  };"""

if old_end in text:
    text = text.replace(old_end, new_end)
    print('✅ handleCalendarButtonClick にメール送信を追加しました')
else:
    print('❌ 対象箇所が見つかりませんでした')

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを UTF-8（BOMなし）で保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    head = f.read(3)
print('BOM check:', repr(head[:3]))
