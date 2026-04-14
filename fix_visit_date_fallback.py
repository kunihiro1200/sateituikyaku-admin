with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_code = '''    // 訪問日時
    if (seller.appointmentDate) {
      const appointmentDate = new Date(seller.appointmentDate);
      const dateStr = `${appointmentDate.getMonth() + 1}月${appointmentDate.getDate()}日`;
      const timeStr = `${appointmentDate.getHours()}:${appointmentDate.getMinutes().toString().padStart(2, '0')}`;
      result = result.replace(/<<訪問日>>/g, dateStr);
      result = result.replace(/<<時間>>/g, timeStr);
    } else {
      result = result.replace(/<<訪問日>>/g, '');
      result = result.replace(/<<時間>>/g, '');
    }'''

new_code = '''    // 訪問日時
    if (seller.appointmentDate) {
      const appointmentDate = new Date(seller.appointmentDate);
      const dateStr = `${appointmentDate.getMonth() + 1}月${appointmentDate.getDate()}日`;
      const timeStr = `${appointmentDate.getHours()}:${appointmentDate.getMinutes().toString().padStart(2, '0')}`;
      result = result.replace(/<<訪問日>>/g, dateStr);
      result = result.replace(/<<時間>>/g, timeStr);
    } else if (seller.visitDate) {
      // appointmentDate が未設定の場合は visitDate にフォールバック
      const visitDateObj = new Date(seller.visitDate);
      const dateStr = `${visitDateObj.getMonth() + 1}月${visitDateObj.getDate()}日`;
      let timeStr: string;
      if (visitDateObj.getHours() === 0 && visitDateObj.getMinutes() === 0 && seller.visitTime) {
        // visitDate の時刻が 00:00 かつ visitTime が存在する場合は visitTime の HH:mm を使用
        const timeParts = (seller.visitTime as string).split(':');
        timeStr = `${timeParts[0]}:${timeParts[1]}`;
      } else {
        timeStr = `${visitDateObj.getHours()}:${visitDateObj.getMinutes().toString().padStart(2, '0')}`;
      }
      result = result.replace(/<<訪問日>>/g, dateStr);
      result = result.replace(/<<時間>>/g, timeStr);
    } else {
      result = result.replace(/<<訪問日>>/g, '');
      result = result.replace(/<<時間>>/g, '');
    }'''

if old_code in text:
    text = text.replace(old_code, new_code)
    print('置換成功')
else:
    print('置換対象が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
