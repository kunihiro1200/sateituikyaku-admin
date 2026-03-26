#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx の重複 import を削除し、
ValidationWarningDialog の missingFieldLabels を state で管理するよう修正する
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. 重複 import を削除（2行あるので1行にする）
old_double_import = """import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';
import { ValidationWarningDialog } from '../components/ValidationWarningDialog';
import { ValidationWarningDialog } from '../components/ValidationWarningDialog';"""

new_single_import = """import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';
import { ValidationWarningDialog } from '../components/ValidationWarningDialog';"""

text = text.replace(old_double_import, new_single_import, 1)

# 2. ValidationWarningDialog の missingFieldLabels を state で管理するよう修正
# handleNavigate で missing を state に保存する
old_handle_navigate = """  // 遷移前バリデーション共通ハンドラー
  const handleNavigate = (url: string) => {
    const missing = checkMissingFields();
    if (missing.length > 0) {
      setPendingNavigationUrl(url);
      setValidationDialogOpen(true);
    } else {
      navigate(url);
    }
  };"""

new_handle_navigate = """  // バリデーション警告ダイアログ用 missing labels state
  const [pendingMissingLabels, setPendingMissingLabels] = useState<string[]>([]);

  // 遷移前バリデーション共通ハンドラー
  const handleNavigate = (url: string) => {
    const missing = checkMissingFields();
    if (missing.length > 0) {
      setPendingNavigationUrl(url);
      setPendingMissingLabels(missing);
      setValidationDialogOpen(true);
    } else {
      navigate(url);
    }
  };"""

text = text.replace(old_handle_navigate, new_handle_navigate, 1)

# 3. ValidationWarningDialog の missingFieldLabels を state から取得するよう修正
old_dialog_jsx = """      {/* バリデーション警告ダイアログ */}
      <ValidationWarningDialog
        open={validationDialogOpen}
        missingFieldLabels={pendingNavigationUrl ? checkMissingFields() : []}
        onProceed={() => {
          setValidationDialogOpen(false);
          navigate(pendingNavigationUrl);
        }}
        onStay={() => setValidationDialogOpen(false)}
      />"""

new_dialog_jsx = """      {/* バリデーション警告ダイアログ */}
      <ValidationWarningDialog
        open={validationDialogOpen}
        missingFieldLabels={pendingMissingLabels}
        onProceed={() => {
          setValidationDialogOpen(false);
          navigate(pendingNavigationUrl);
        }}
        onStay={() => setValidationDialogOpen(false)}
      />"""

text = text.replace(old_dialog_jsx, new_dialog_jsx, 1)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Cleanup complete.')
