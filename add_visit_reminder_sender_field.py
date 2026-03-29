#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx に「通知送信者」フィールドを追加するスクリプト
UTF-8 エンコーディングを保持
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# アンカー: FollowUpLogHistoryTable Box の閉じタグ + 空行 + カテゴリーコメント
# 実際のファイルは行3411: '          </Box>'、行3412: '          '（空行）、行3413: '          {/* カテゴリー（一番下） */'
anchor = '          </Box>\n          \n          {/* \u30ab\u30c6\u30b4\u30ea\u30fc\uff08\u4e00\u756a\u4e0b\uff09 */'

if anchor not in text:
    print('ERROR: anchor not found')
    # デバッグ用: 周辺テキストを出力
    lines = text.split('\n')
    for i, line in enumerate(lines[3408:3416], start=3409):
        print(f'{i}: {repr(line)}')
    import sys; sys.exit(1)

new_block = (
    '          </Box>\n'
    '\n'
    '          {/* \u901a\u77e5\u9001\u4fe1\u8005\u30d5\u30a3\u30fc\u30eb\u30c9\uff08\u2606\u8a2a\u554f\u524d\u65e5\u901a\u77e5\u30e1\u30fc\u30eb\u9001\u4fe1\u6e08\u307f OR visitReminderAssignee \u306b\u5024\u304c\u3042\u308b\u5834\u5408\u306b\u8868\u793a\uff09 */}\n'
    '          {(() => {\n'
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
    "          })()}\n"
    "\n"
    "          {/* \u30ab\u30c6\u30b4\u30ea\u30fc\uff08\u4e00\u756a\u4e0b\uff09 */"
)

text = text.replace(anchor, new_block, 1)

# 確認
if '\u901a\u77e5\u9001\u4fe1\u8005' not in text:
    print('ERROR: 挿入に失敗しました')
    import sys; sys.exit(1)

print('OK: 通知送信者フィールドを追加しました')

# UTF-8 で書き込む（BOMなし）
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

# BOM チェック
with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
