with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old_code = (
    "                {/* \u4e00\u822c\u5a92\u4ecb\u306e\u5834\u5408\uff1a\u5c02\u4efb\uff08\u4ed6\u6c7a\uff09\u6c7a\u5b9a\u65e5\u3092\u8aad\u307f\u53d6\u308a\u5c02\u7528\u3067\u8868\u793a */}\n"
    "                {editedStatus === '\u4e00\u822c\u5a92\u4ecb' && (\n"
    "                  <Grid item xs={12}>\n"
    "                    <Box sx={{ p: 1.5, bgcolor: '#FFF3E0', borderRadius: 1, border: '1px solid #FF6D00' }}>\n"
    "                      <Typography variant=\"caption\" color=\"text.secondary\">\n"
    "                        \u5c02\u4efb\uff08\u4ed6\u6c7a\uff09\u6c7a\u5b9a\u65e5\n"
    "                      </Typography>\n"
    "                      <Typography variant=\"body1\" sx={{ fontWeight: 'bold', color: '#E65100' }}>\n"
    "                        {editedExclusiveDecisionDate\n"
    "                          ? new Date(editedExclusiveDecisionDate + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })\n"
    "                          : '\u672a\u8a2d\u5b9a'}\n"
    "                      </Typography>\n"
    "                    </Box>\n"
    "                  </Grid>\n"
    "                )}\n"
)

new_code = (
    "                {/* \u4e00\u822c\u5a92\u4ecb\u306e\u5834\u5408\uff1a\u5c02\u4efb\uff08\u4ed6\u6c7a\uff09\u6c7a\u5b9a\u65e5\u3092\u7de8\u96c6\u53ef\u80fd\u306a\u65e5\u4ed8\u30d5\u30a3\u30fc\u30eb\u30c9\u3067\u8868\u793a */}\n"
    "                {editedStatus === '\u4e00\u822c\u5a92\u4ecb' && (\n"
    "                  <Grid item xs={12}>\n"
    "                    <TextField\n"
    "                      fullWidth\n"
    "                      size=\"small\"\n"
    "                      label=\"\u5c02\u4efb\uff08\u4ed6\u6c7a\uff09\u6c7a\u5b9a\u65e5\"\n"
    "                      type=\"date\"\n"
    "                      value={editedExclusiveDecisionDate}\n"
    "                      onChange={(e) => { setEditedExclusiveDecisionDate(e.target.value); setStatusChanged(true); statusChangedRef.current = true; }}\n"
    "                      InputLabelProps={{ shrink: true }}\n"
    "                      sx={{\n"
    "                        '& .MuiOutlinedInput-root': {\n"
    "                          backgroundColor: '#FFF3E0',\n"
    "                          '& fieldset': { borderColor: '#FF6D00' },\n"
    "                          '&:hover fieldset': { borderColor: '#E65100' },\n"
    "                          '&.Mui-focused fieldset': { borderColor: '#E65100' },\n"
    "                        },\n"
    "                        '& .MuiInputLabel-root': { color: '#E65100' },\n"
    "                        '& .MuiInputLabel-root.Mui-focused': { color: '#E65100' },\n"
    "                      }}\n"
    "                    />\n"
    "                  </Grid>\n"
    "                )}\n"
)

if old_code in text:
    text = text.replace(old_code, new_code, 1)
    print('OK: replaced with editable date field')
else:
    print('NOT FOUND')
    idx = text.find('\u4e00\u822c\u5a92\u4ecb\u306e\u5834\u5408\uff1a\u5c02\u4efb')
    if idx >= 0:
        print(repr(text[idx-50:idx+400]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
