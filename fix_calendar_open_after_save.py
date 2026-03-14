# -*- coding: utf-8 -*-
"""
カレンダー登録成功後にGoogleカレンダーを開くよう修正
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_success = """      console.log('[BuyerViewingResultPage] Calendar event created:', response.data);

      setSnackbar({
        open: true,
        message: `後続担当（${buyer.follow_up_assignee}）のGoogleカレンダーに内覧予約を登録しました`,
        severity: 'success',
      });"""

new_success = """      console.log('[BuyerViewingResultPage] Calendar event created:', response.data);

      setSnackbar({
        open: true,
        message: `後続担当（${buyer.follow_up_assignee}）のGoogleカレンダーに内覧予約を登録しました`,
        severity: 'success',
      });

      // 登録成功後にGoogleカレンダーを開く
      const calendarEventId = response.data?.calendarEventId;
      if (calendarEventId) {
        window.open(`https://calendar.google.com/calendar/r/eventedit/${calendarEventId}`, '_blank');
      } else {
        window.open('https://calendar.google.com/calendar/r', '_blank');
      }"""

text = text.replace(old_success, new_success)

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
