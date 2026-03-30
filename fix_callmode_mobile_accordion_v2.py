#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx のスマホ表示修正 v2
シンプルなアプローチ:
- スマホ時の開閉状態を管理するstateを追加
- 各セクションの先頭にアコーディオンヘッダーを挿入
- セクション本体はスマホ時に開閉状態で表示/非表示
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: スマホ用アコーディオン開閉stateを追加
old_state = """  const [rankingDialogOpen, setRankingDialogOpen] = useState(false); // 1番電話月間ランキングダイアログ"""

new_state = """  const [rankingDialogOpen, setRankingDialogOpen] = useState(false); // 1番電話月間ランキングダイアログ
  // スマホ時のアコーディオン開閉状態
  const [mobileCommentOpen, setMobileCommentOpen] = useState(true); // コメント（デフォルト展開）
  const [mobilePropertyOpen, setMobilePropertyOpen] = useState(false); // 物件情報
  const [mobileCallLogOpen, setMobileCallLogOpen] = useState(false); // 追客ログ"""

if old_state in text:
    text = text.replace(old_state, new_state)
    print("✅ スマホ用stateを追加しました")
else:
    print("❌ state追加箇所が見つかりませんでした")

# 修正2: サイドバー（追客ログ）の先頭にアコーディオンヘッダーを追加
old_sidebar_calllog = """          {/* 売主追客ログ（一番上） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <CallLogDisplay ref={callLogRef} sellerId={id!} />
          </Box>"""

new_sidebar_calllog = """          {/* 売主追客ログ（一番上） */}
          {isMobile && (
            <Box
              onClick={() => setMobileCallLogOpen(!mobileCallLogOpen)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#f5f5f5', cursor: 'pointer', borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight="bold">📞 追客ログ</Typography>
              <ExpandMoreIcon sx={{ transform: mobileCallLogOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />
            </Box>
          )}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider', display: isMobile && !mobileCallLogOpen ? 'none' : undefined }}>
            <CallLogDisplay ref={callLogRef} sellerId={id!} />
          </Box>"""

if old_sidebar_calllog in text:
    text = text.replace(old_sidebar_calllog, new_sidebar_calllog)
    print("✅ 追客ログにアコーディオンヘッダーを追加しました")
else:
    print("❌ 追客ログBoxが見つかりませんでした")

# 修正3: SMS履歴・活動ログもスマホ時は追客ログと一緒に開閉
old_sms_box = """          {/* メール・SMS履歴（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

new_sms_box = """          {/* メール・SMS履歴（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider', display: isMobile && !mobileCallLogOpen ? 'none' : undefined }}>"""

if old_sms_box in text:
    text = text.replace(old_sms_box, new_sms_box)
    print("✅ SMS履歴にアコーディオン制御を追加しました")
else:
    print("❌ SMS履歴Boxが見つかりませんでした")

old_activity_box = """          {/* 過去の活動ログ（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

new_activity_box = """          {/* 過去の活動ログ（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider', display: isMobile && !mobileCallLogOpen ? 'none' : undefined }}>"""

if old_activity_box in text:
    text = text.replace(old_activity_box, new_activity_box)
    print("✅ 活動ログにアコーディオン制御を追加しました")
else:
    print("❌ 活動ログBoxが見つかりませんでした")

# 修正4: 右側コメント欄にアコーディオンヘッダーを追加
old_comment_header = """          {/* 右側：統一コメント欄エリア（50%）- スマホ時は最初に全幅表示（order:0） */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: isMobile ? 'visible' : 'auto',
              p: isMobile ? 1 : 3,
              order: isMobile ? 0 : 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="h6">
                📝 コメント
              </Typography>"""

new_comment_header = """          {/* 右側：統一コメント欄エリア（50%）- スマホ時は最初に全幅表示（order:0） */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: isMobile ? 'visible' : 'auto',
              p: isMobile ? 0 : 3,
              order: isMobile ? 0 : 1,
            }}
          >
            {isMobile && (
              <Box
                onClick={() => setMobileCommentOpen(!mobileCommentOpen)}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#e3f2fd', cursor: 'pointer', borderBottom: 1, borderColor: 'divider' }}
              >
                <Typography variant="subtitle2" fontWeight="bold">📝 コメント</Typography>
                <ExpandMoreIcon sx={{ transform: mobileCommentOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />
              </Box>
            )}
            <Box sx={{ display: isMobile && !mobileCommentOpen ? 'none' : undefined, p: isMobile ? 1 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ display: isMobile ? 'none' : undefined }}>
                📝 コメント
              </Typography>"""

if old_comment_header in text:
    text = text.replace(old_comment_header, new_comment_header)
    print("✅ コメント欄にアコーディオンヘッダーを追加しました")
else:
    print("❌ コメント欄ヘッダーが見つかりませんでした")

# 修正5: 左側カラム（物件情報）にアコーディオンヘッダーを追加
old_left_grid = """          {/* 左側：情報表示エリア（50%）- スマホ時はコメントの後（order:1） */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: isMobile ? 'visible' : 'auto',
              borderRight: isMobile ? 0 : 1,
              borderColor: 'divider',
              p: isMobile ? 1 : 3,
              pb: isMobile ? '80px' : 3,
              order: isMobile ? 1 : 0,
            }}
          >
            {/* モバイル：売主基本情報固定ヘッダー（非表示 - ヘッダーに名前があるため） */}
            {false && isMobile && seller && ("""

new_left_grid = """          {/* 左側：情報表示エリア（50%）- スマホ時はコメントの後（order:1） */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: isMobile ? 'visible' : 'auto',
              borderRight: isMobile ? 0 : 1,
              borderColor: 'divider',
              p: isMobile ? 0 : 3,
              pb: isMobile ? '80px' : 3,
              order: isMobile ? 1 : 0,
            }}
          >
            {isMobile && (
              <Box
                onClick={() => setMobilePropertyOpen(!mobilePropertyOpen)}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#f3e5f5', cursor: 'pointer', borderBottom: 1, borderColor: 'divider' }}
              >
                <Typography variant="subtitle2" fontWeight="bold">📍 物件情報・売主情報</Typography>
                <ExpandMoreIcon sx={{ transform: mobilePropertyOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />
              </Box>
            )}
            <Box sx={{ display: isMobile && !mobilePropertyOpen ? 'none' : undefined, p: isMobile ? 1 : 0, pb: isMobile ? '80px' : 0 }}>
            {/* モバイル：売主基本情報固定ヘッダー（非表示 - ヘッダーに名前があるため） */}
            {false && isMobile && seller && ("""

if old_left_grid in text:
    text = text.replace(old_left_grid, new_left_grid)
    print("✅ 物件情報欄にアコーディオンヘッダーを追加しました")
else:
    print("❌ 物件情報欄が見つかりませんでした")

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
