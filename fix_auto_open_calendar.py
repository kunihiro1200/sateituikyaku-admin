#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
訪問予約保存後にカレンダーを自動で開く修正
- 訪問日が設定されている場合のみカレンダーURLを自動で開く
- visitDateStr が null の場合（削除時）は開かない
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_code = """      setAppointmentSuccessMessage('訪問予約情報を更新しました');
      setEditingAppointment(false);
      
      // データを再読み込み
      try {
        await loadAllData();
      } catch (reloadError) {
        console.error('❌ データの再読み込みに失敗:', reloadError);
        // 再読み込みエラーは警告のみ（保存は成功しているため）
        setError('データの再読み込みに失敗しました。ページを更新してください。');
      }

      // カレンダーイベントはバックエンドで自動的に作成されます"""

new_code = """      setAppointmentSuccessMessage('訪問予約情報を更新しました');
      setEditingAppointment(false);
      
      // データを再読み込み
      try {
        await loadAllData();
      } catch (reloadError) {
        console.error('❌ データの再読み込みに失敗:', reloadError);
        // 再読み込みエラーは警告のみ（保存は成功しているため）
        setError('データの再読み込みに失敗しました。ページを更新してください。');
      }

      // 訪問日が設定されている場合、カレンダーを自動で開く
      if (visitDateStr) {
        try {
          // visitDateStr (YYYY-MM-DD) と visitTimeStr (HH:mm:ss) からDateを生成
          const timeStr = visitTimeStr || '00:00:00';
          const [hh, mm] = timeStr.split(':');
          const dateTimeStr = `${visitDateStr}T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:00`;
          const date = new Date(dateTimeStr);
          const startDateStr2 = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const endDate2 = new Date(date.getTime() + 60 * 60 * 1000);
          const endDateStr2 = endDate2.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

          const propertyAddress = property?.address || seller?.address || '物件所在地未設定';
          const calTitle = encodeURIComponent(`【訪問】${propertyAddress}`);
          const calLocation = encodeURIComponent(propertyAddress);
          const calDetails = encodeURIComponent(`売主名: ${seller?.name || ''}\n電話: ${seller?.phoneNumber || ''}`);

          // 営担のメールアドレスを取得
          const assignedToValue = editedAssignedTo || seller?.visitAssignee || seller?.assignedTo;
          const assignedEmployee = employees.find((e: any) =>
            e.name === assignedToValue || e.initials === assignedToValue || e.email === assignedToValue
          );
          const assignedEmail = assignedEmployee?.email || '';
          const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';

          window.open(
            `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${startDateStr2}/${endDateStr2}&details=${calDetails}&location=${calLocation}${srcParam}`,
            '_blank'
          );
        } catch (calError) {
          console.error('❌ カレンダーを開けませんでした:', calError);
        }
      }"""

if old_code in text:
    text = text.replace(old_code, new_code, 1)
    print('✅ カレンダー自動オープンを追加しました')
else:
    print('❌ 対象コードが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
