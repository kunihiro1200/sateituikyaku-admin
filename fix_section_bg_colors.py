with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

replacements = [
    # 物件情報セクションのPaper
    (
        '            <Paper sx={{ p: 2, mb: 3 }}>\n'
        '              {(() => {\n'
        '                console.log(\'🏠 [物件情報表示] propInfo:\', propInfo);',
        '            <Paper sx={{ p: 2, mb: 3, bgcolor: \'#f0f7f4\' }}>\n'
        '              {(() => {\n'
        '                console.log(\'🏠 [物件情報表示] propInfo:\', propInfo);'
    ),
    # 売主情報セクションのPaper
    (
        '            <Paper sx={{ p: 2, mb: 3 }}>\n'
        '              {seller ? (\n'
        '                <>\n'
        '                  {!editingSeller ? (',
        '            <Paper sx={{ p: 2, mb: 3, bgcolor: \'#f0f4ff\' }}>\n'
        '              {seller ? (\n'
        '                <>\n'
        '                  {!editingSeller ? ('
    ),
    # ステータスセクションのPaper
    (
        '            <Paper sx={{ p: 2, mb: 3 }}>\n'
        '              {successMessage && (',
        '            <Paper sx={{ p: 2, mb: 3, bgcolor: \'#fffbf0\' }}>\n'
        '              {successMessage && ('
    ),
    # 訪問予約セクションのPaper
    (
        '              <Paper sx={{ p: 2, mb: 3 }}>\n'
        '                {appointmentSuccessMessage && (',
        '              <Paper sx={{ p: 2, mb: 3, bgcolor: \'#f0fff4\' }}>\n'
        '                {appointmentSuccessMessage && ('
    ),
    # 査定計算セクションのPaper
    (
        '              <Paper sx={{ p: 2 }}>\n'
        '                {!property && !editedValuationAmount1 && (',
        '              <Paper sx={{ p: 2, bgcolor: \'#fff8f0\' }}>\n'
        '                {!property && !editedValuationAmount1 && ('
    ),
    # 除外申請セクションのPaper
    (
        '            <Paper sx={{ p: 2, mb: 3 }}>\n'
        '              <Grid container spacing={2}>\n'
        '                <Grid item xs={12}>\n'
        '                  <InlineEditableField\n'
        '                    label="サイト"',
        '            <Paper sx={{ p: 2, mb: 3, bgcolor: \'#fff0f0\' }}>\n'
        '              <Grid container spacing={2}>\n'
        '                <Grid item xs={12}>\n'
        '                  <InlineEditableField\n'
        '                    label="サイト"'
    ),
]

for old, new in replacements:
    if old in text:
        text = text.replace(old, new)
        # セクション名を特定するため最初の数文字を表示
        label = old.split('\n')[1].strip()[:40]
        print(f'✅ 修正完了: {label}')
    else:
        label = old.split('\n')[1].strip()[:40]
        print(f'❌ 見つかりません: {label}')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.replace('\n', '\r\n').encode('utf-8'))

print('完了')
