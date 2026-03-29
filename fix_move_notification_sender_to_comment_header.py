#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通知送信者フィールドをコメントセクションのヘッダー右隣に移動する
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. 現在の通知送信者フィールドブロックを削除
old_block = (
    "\n"
    "          {/* \u901a\u77e5\u9001\u4fe1\u8005\u30d5\u30a3\u30fc\u30eb\u30c9\uff08\u2606\u8a2a\u554f\u524d\u65e5\u901a\u77e5\u30e1\u30fc\u30eb\u9001\u4fe1\u6e08\u307f OR visitReminderAssignee \u306b\u5024\u304c\u3042\u308b\u5834\u5408\u306b\u8868\u793a\uff09 */}\n"
    "          {(() => {\n"
    "            const hasVisitReminderEmailHistory = activities.some(\n"
    "              (act) => act.type === 'email' && act.content?.includes('\u2606\u8a2a\u554f\u524d\u65e5\u901a\u77e5\u30e1\u30fc\u30eb')\n"
    "            );\n"
    "            const showVisitReminderSender =\n"
    "              hasVisitReminderEmailHistory || !!(seller?.visitReminderAssignee);\n"
    "            if (!showVisitReminderSender) return null;\n"
    "            return (\n"
    "              <Box sx={{ width: 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>\n"
    "                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>\n"
    "                  <Typography\n"
    '                    variant="caption"\n'
    '                    color="text.secondary"\n'
    "                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}\n"
    "                  >\n"
    "                    \u901a\u77e5\u9001\u4fe1\u8005\n"
    "                  </Typography>\n"
    "                  <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>\n"
    "                    {normalInitials.map((initial) => {\n"
    "                      const isSelected = seller?.visitReminderAssignee === initial;\n"
    "                      return (\n"
    "                        <Button\n"
    "                          key={initial}\n"
    '                          size="small"\n'
    "                          variant={isSelected ? 'contained' : 'outlined'}\n"
    '                          color="primary"\n'
    "                          onClick={async () => {\n"
    "                            const newValue = isSelected ? '' : initial;\n"
    "                            if (!seller?.id) return;\n"
    "                            try {\n"
    "                              await api.put(`/api/sellers/${seller.id}`, {\n"
    "                                visitReminderAssignee: newValue,\n"
    "                              });\n"
    "                              setSeller((prev) =>\n"
    "                                prev ? { ...prev, visitReminderAssignee: newValue } : prev\n"
    "                              );\n"
    "                            } catch (err) {\n"
    "                              console.error('\u901a\u77e5\u9001\u4fe1\u8005\u4fdd\u5b58\u30a8\u30e9\u30fc:', err);\n"
    "                              setSnackbarMessage('\u901a\u77e5\u9001\u4fe1\u8005\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f');\n"
    "                              setSnackbarOpen(true);\n"
    "                            }\n"
    "                          }}\n"
    "                          sx={{\n"
    "                            flex: 1,\n"
    "                            py: 0.5,\n"
    "                            fontWeight: isSelected ? 'bold' : 'normal',\n"
    "                            borderRadius: 1,\n"
    "                          }}\n"
    "                        >\n"
    "                          {initial}\n"
    "                        </Button>\n"
    "                      );\n"
    "                    })}\n"
    "                  </Box>\n"
    "                </Box>\n"
    "              </Box>\n"
    "            );\n"
    "\n"
)

if old_block not in text:
    print('ERROR: \u901a\u77e5\u9001\u4fe1\u8005\u30d5\u30a3\u30fc\u30eb\u30c9\u306e\u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('\u901a\u77e5\u9001\u4fe1\u8005\u30d5\u30a3\u30fc\u30eb\u30c9')
    if idx >= 0:
        print(repr(text[idx-50:idx+200]))
    import sys; sys.exit(1)

# 削除（空文字に置換）
text = text.replace(old_block, '\n', 1)
print('OK: \u901a\u77e5\u9001\u4fe1\u8005\u30d5\u30a3\u30fc\u30eb\u30c9\u3092\u5143\u306e\u5834\u6240\u304b\u3089\u524a\u9664\u3057\u307e\u3057\u305f')

# 2. コメントセクションのヘッダーに通知送信者を追加
old_comment_header = (
    '            <Box sx={{ display: \'flex\', alignItems: \'center\', gap: 2, mb: 2 }}>\n'
    '              <Typography variant="h6">\n'
    '                \U0001f4dd \u30b3\u30e1\u30f3\u30c8\n'
    '              </Typography>\n'
    '              {exclusionAction && ('
)

new_comment_header = (
    '            <Box sx={{ display: \'flex\', alignItems: \'center\', gap: 2, mb: 2, flexWrap: \'wrap\' }}>\n'
    '              <Typography variant="h6">\n'
    '                \U0001f4dd \u30b3\u30e1\u30f3\u30c8\n'
    '              </Typography>\n'
    '              {/* \u901a\u77e5\u9001\u4fe1\u8005\uff08\u2606\u8a2a\u554f\u524d\u65e5\u901a\u77e5\u30e1\u30fc\u30eb\u9001\u4fe1\u6e08\u307f OR visitReminderAssignee \u306b\u5024\u304c\u3042\u308b\u5834\u5408\u306b\u8868\u793a\uff09 */}\n'
    '              {(() => {\n'
    "                const hasVisitReminderEmailHistory = activities.some(\n"
    "                  (act) => act.type === 'email' && act.content?.includes('\u2606\u8a2a\u554f\u524d\u65e5\u901a\u77e5\u30e1\u30fc\u30eb')\n"
    "                );\n"
    "                const showVisitReminderSender =\n"
    "                  hasVisitReminderEmailHistory || !!(seller?.visitReminderAssignee);\n"
    "                if (!showVisitReminderSender) return null;\n"
    "                return (\n"
    "                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>\n"
    "                    <Typography\n"
    '                      variant="caption"\n'
    '                      color="text.secondary"\n'
    "                      sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.7rem' }}\n"
    "                    >\n"
    "                      \u901a\u77e5\u9001\u4fe1\u8005:\n"
    "                    </Typography>\n"
    "                    <Box sx={{ display: 'flex', gap: 0.5 }}>\n"
    "                      {normalInitials.map((initial) => {\n"
    "                        const isSelected = seller?.visitReminderAssignee === initial;\n"
    "                        return (\n"
    "                          <Button\n"
    "                            key={initial}\n"
    '                            size="small"\n'
    "                            variant={isSelected ? 'contained' : 'outlined'}\n"
    '                            color="primary"\n'
    "                            onClick={async () => {\n"
    "                              const newValue = isSelected ? '' : initial;\n"
    "                              if (!seller?.id) return;\n"
    "                              try {\n"
    "                                await api.put(`/api/sellers/${seller.id}`, {\n"
    "                                  visitReminderAssignee: newValue,\n"
    "                                });\n"
    "                                setSeller((prev) =>\n"
    "                                  prev ? { ...prev, visitReminderAssignee: newValue } : prev\n"
    "                                );\n"
    "                              } catch (err) {\n"
    "                                console.error('\u901a\u77e5\u9001\u4fe1\u8005\u4fdd\u5b58\u30a8\u30e9\u30fc:', err);\n"
    "                              }\n"
    "                            }}\n"
    "                            sx={{\n"
    "                              minWidth: 32,\n"
    "                              px: 0.5,\n"
    "                              py: 0.25,\n"
    "                              fontSize: '0.7rem',\n"
    "                              fontWeight: isSelected ? 'bold' : 'normal',\n"
    "                              borderRadius: 1,\n"
    "                            }}\n"
    "                          >\n"
    "                            {initial}\n"
    "                          </Button>\n"
    "                        );\n"
    "                      })}\n"
    "                    </Box>\n"
    "                  </Box>\n"
    "                );\n"
    "              })()}\n"
    '              {exclusionAction && ('
)

if old_comment_header not in text:
    print('ERROR: \u30b3\u30e1\u30f3\u30c8\u30d8\u30c3\u30c0\u30fc\u306e\u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('\U0001f4dd \u30b3\u30e1\u30f3\u30c8')
    if idx >= 0:
        print(repr(text[idx-200:idx+200]))
    import sys; sys.exit(1)

text = text.replace(old_comment_header, new_comment_header, 1)
print('OK: \u30b3\u30e1\u30f3\u30c8\u30d8\u30c3\u30c0\u30fc\u306b\u901a\u77e5\u9001\u4fe1\u8005\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
