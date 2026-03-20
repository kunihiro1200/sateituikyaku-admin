# 1番電話フィールドをSelect→ボタン選択UIに変更（CRLF対応）
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧: Select UI（CRLF対応）
old_ui = '            {/* 1番電話フィールド */}\r\n            <Box sx={{ mb: 2 }}>\r\n              <Typography variant="subtitle2" gutterBottom>\r\n                1番電話\r\n              </Typography>\r\n              <FormControl fullWidth size="small">\r\n                <Select\r\n                  value={editedFirstCallPerson}\r\n                  onChange={(e) => setEditedFirstCallPerson(e.target.value)}\r\n                  displayEmpty\r\n                  sx={{ bgcolor: \'white\' }}\r\n                >\r\n                  <MenuItem value=""><em>未選択</em></MenuItem>\r\n                  {activeEmployees.map((emp) => (\r\n                    <MenuItem key={emp.initials || emp.name} value={emp.initials || \'\'}>\r\n                      {emp.initials || emp.name}\r\n                    </MenuItem>\r\n                  ))}\r\n                </Select>\r\n              </FormControl>\r\n            </Box>'

# 新: ボタン選択UI（CRLF対応）
new_ui = '            {/* 1番電話フィールド */}\r\n            <Box sx={{ mb: 2 }}>\r\n              <Typography variant="subtitle2" gutterBottom>\r\n                1番電話\r\n              </Typography>\r\n              <Box sx={{ display: \'flex\', gap: 1, flexWrap: \'wrap\' }}>\r\n                <Button\r\n                  variant={editedFirstCallPerson === \'\' ? \'contained\' : \'outlined\'}\r\n                  color="inherit"\r\n                  size="small"\r\n                  onClick={() => setEditedFirstCallPerson(\'\')}\r\n                  sx={{ minWidth: 60 }}\r\n                >\r\n                  未選択\r\n                </Button>\r\n                {activeEmployees.map((emp) => (\r\n                  <Button\r\n                    key={emp.initials || emp.name}\r\n                    variant={editedFirstCallPerson === (emp.initials || \'\') ? \'contained\' : \'outlined\'}\r\n                    color="primary"\r\n                    size="small"\r\n                    onClick={() => setEditedFirstCallPerson(emp.initials || \'\')}\r\n                    sx={{ minWidth: 60 }}\r\n                  >\r\n                    {emp.initials || emp.name}\r\n                  </Button>\r\n                ))}\r\n              </Box>\r\n            </Box>'

if old_ui in text:
    text = text.replace(old_ui, new_ui)
    print('✅ 1番電話UIをボタン選択に変更しました')
else:
    print('❌ 対象のコードが見つかりませんでした')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
