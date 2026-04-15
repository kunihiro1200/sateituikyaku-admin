# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx の replyTo デフォルト設定バグを修正するスクリプト

変更内容:
1. handleOpenEmailDialog から replyTo 設定ロジックを削除
2. handleSelectPropertyEmailTemplate から replyTo 設定ロジックを削除
3. emailDialog.open を監視する useEffect を追加
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# -----------------------------------------------------------------------
# 変更1: handleOpenEmailDialog から replyTo 設定ロジックを削除
# -----------------------------------------------------------------------
OLD1 = (
    "    setSelectedImages([]);\n"
    "    // sales_assignee に対応するスタッフのメールをデフォルト設定\n"
    "    const matchedStaff = jimuStaff.find((s) => s.initials === data?.sales_assignee);\n"
    "    setReplyTo(matchedStaff?.email || '');\n"
    "    setEmailDialog({ open: true, subject, body, recipient: data.seller_email });\n"
    "  };\n"
    "\n"
    "  // SMSテンプレート選択ハンドラ"
)

NEW1 = (
    "    setSelectedImages([]);\n"
    "    setEmailDialog({ open: true, subject, body, recipient: data.seller_email });\n"
    "  };\n"
    "\n"
    "  // SMSテンプレート選択ハンドラ"
)

if OLD1 in text:
    text = text.replace(OLD1, NEW1)
    print('変更1完了: handleOpenEmailDialog から replyTo 設定ロジックを削除')
else:
    print('変更1失敗: handleOpenEmailDialog の対象コードが見つかりません')

# -----------------------------------------------------------------------
# 変更2: handleSelectPropertyEmailTemplate から replyTo 設定ロジックを削除
# -----------------------------------------------------------------------
OLD2 = (
    "      setSelectedImages([]);\n"
    "      // sales_assignee に対応するスタッフのメールをデフォルト設定\n"
    "      const matchedStaff = jimuStaff.find((s) => s.initials === data?.sales_assignee);\n"
    "      setReplyTo(matchedStaff?.email || '');\n"
    "      setEmailDialog({ open: true, subject: subject || '', body: body || '', recipient: data.seller_email });"
)

NEW2 = (
    "      setSelectedImages([]);\n"
    "      setEmailDialog({ open: true, subject: subject || '', body: body || '', recipient: data.seller_email });"
)

if OLD2 in text:
    text = text.replace(OLD2, NEW2)
    print('変更2完了: handleSelectPropertyEmailTemplate から replyTo 設定ロジックを削除')
else:
    print('変更2失敗: handleSelectPropertyEmailTemplate の対象コードが見つかりません')

# -----------------------------------------------------------------------
# 変更3: emailDialog.open を監視する useEffect を追加
# fetchJimuStaff 関数の直後に追加する
# -----------------------------------------------------------------------
OLD3 = (
    "  // 事務ありスタッフ一覧を取得する関数\n"
    "  const fetchJimuStaff = async () => {\n"
    "    try {\n"
    "      const response = await api.get('/api/employees/jimu-staff');\n"
    "      setJimuStaff(response.data.staff || []);\n"
    "    } catch (error) {\n"
    "      console.error('Failed to fetch jimu staff:', error);\n"
    "    }\n"
    "  };\n"
    "\n"
    "  const fetchPropertyData"
)

NEW3 = (
    "  // 事務ありスタッフ一覧を取得する関数\n"
    "  const fetchJimuStaff = async () => {\n"
    "    try {\n"
    "      const response = await api.get('/api/employees/jimu-staff');\n"
    "      setJimuStaff(response.data.staff || []);\n"
    "    } catch (error) {\n"
    "      console.error('Failed to fetch jimu staff:', error);\n"
    "    }\n"
    "  };\n"
    "\n"
    "  // emailDialog.open が true になったとき、sales_assignee に対応するスタッフのメールをデフォルト設定\n"
    "  useEffect(() => {\n"
    "    if (emailDialog.open && jimuStaff.length > 0) {\n"
    "      const matchedStaff = jimuStaff.find((s) => s.initials === data?.sales_assignee);\n"
    "      setReplyTo(matchedStaff?.email || '');\n"
    "    }\n"
    "  }, [emailDialog.open, jimuStaff, data?.sales_assignee]);\n"
    "\n"
    "  const fetchPropertyData"
)

if OLD3 in text:
    text = text.replace(OLD3, NEW3)
    print('変更3完了: emailDialog.open を監視する useEffect を追加')
else:
    print('変更3失敗: fetchJimuStaff 関数の後の対象コードが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\nファイルの書き込み完了')

# BOMチェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print('BOM check:', repr(first_bytes[:3]), '(b"\\xef\\xbb\\xbf" はBOM付き、それ以外はOK)')
