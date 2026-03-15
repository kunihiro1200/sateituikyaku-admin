#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyReportPage.tsx の修正:
1. ページロード時にテンプレートのマージ結果をプリフェッチ（遅延解消）
2. <<>> プレースホルダーのデバッグ用にマージ結果をログ出力
"""

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# mergedTemplates の state を追加
old_state = """  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);"""
new_state = """  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [mergedTemplates, setMergedTemplates] = useState<Record<string, { subject: string; body: string; sellerName?: string }>>({});
  const [prefetching, setPrefetching] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);"""
text = text.replace(old_state, new_state)

# useEffect で fetchMergedTemplates も呼ぶ（fetchData完了後に呼ぶため別途useEffectは不要、fetchData内で呼ぶ）
# fetchTemplates の後に prefetchMergedTemplates を呼ぶ
old_useeffect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchTemplates();
    }
  }, [propertyNumber]);"""
new_useeffect = """  useEffect(() => {
    if (propertyNumber) {
      fetchData();
      fetchJimuInitials();
      fetchTemplates().then(() => {
        // テンプレート取得後にプリフェッチ（バックグラウンドで実行）
        prefetchMergedTemplates();
      });
    }
  }, [propertyNumber]);"""
text = text.replace(old_useeffect, new_useeffect)

# fetchTemplates の後に prefetchMergedTemplates 関数を追加
old_fetch_templates = """  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/email-templates/property');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch property templates:', error);
      setTemplates([]);
    }
  };"""
new_fetch_templates = """  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/email-templates/property');
      setTemplates(response.data || []);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch property templates:', error);
      setTemplates([]);
      return [];
    }
  };

  const prefetchMergedTemplates = async () => {
    if (!propertyNumber) return;
    setPrefetching(true);
    try {
      // 現在のテンプレート一覧を取得してプリフェッチ
      const tmplResponse = await api.get('/api/email-templates/property');
      const tmplList: EmailTemplate[] = tmplResponse.data || [];
      setTemplates(tmplList);

      const merged: Record<string, { subject: string; body: string; sellerName?: string }> = {};
      await Promise.all(
        tmplList.map(async (template) => {
          try {
            const mergeResponse = await api.post('/api/email-templates/property/merge', {
              propertyNumber,
              templateId: template.id,
            });
            merged[template.id] = {
              subject: mergeResponse.data.subject || template.subject,
              body: mergeResponse.data.body || template.body,
              sellerName: mergeResponse.data.sellerName,
            };
            // 売主名をセット
            if (mergeResponse.data.sellerName) {
              setReportData((prev) => ({ ...prev, owner_name: mergeResponse.data.sellerName }));
            }
          } catch (err) {
            console.error('Failed to prefetch template:', template.id, err);
            merged[template.id] = { subject: template.subject, body: template.body };
          }
        })
      );
      setMergedTemplates(merged);
      console.log('[PropertyReportPage] Prefetched merged templates:', Object.keys(merged).length);
    } catch (error) {
      console.error('Failed to prefetch merged templates:', error);
    } finally {
      setPrefetching(false);
    }
  };"""
text = text.replace(old_fetch_templates, new_fetch_templates)

# handleTemplateSelect をキャッシュ優先に変更
old_handle = """  const handleTemplateSelect = async (template: EmailTemplate) => {
    setTemplateDialogOpen(false);
    try {
      // プレースホルダー置換済みの件名・本文を取得
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody, sellerName } = mergeResponse.data;
      // 売主名をヘッダーにセット
      if (sellerName) {
        setReportData((prev) => ({ ...prev, owner_name: sellerName }));
      }
      const subject = encodeURIComponent(mergedSubject || template.subject);
      const body = encodeURIComponent(mergedBody || template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    } catch (error) {
      console.error('Failed to merge template:', error);
      // フォールバック: 置換なしで開く
      const subject = encodeURIComponent(template.subject);
      const body = encodeURIComponent(template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    }
  };"""
new_handle = """  const handleTemplateSelect = async (template: EmailTemplate) => {
    setTemplateDialogOpen(false);

    // プリフェッチ済みのデータがあればそれを使う（即時）
    if (mergedTemplates[template.id]) {
      const cached = mergedTemplates[template.id];
      const subject = encodeURIComponent(cached.subject);
      const body = encodeURIComponent(cached.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      return;
    }

    // プリフェッチがまだの場合はAPIを呼ぶ
    try {
      const mergeResponse = await api.post('/api/email-templates/property/merge', {
        propertyNumber,
        templateId: template.id,
      });
      const { subject: mergedSubject, body: mergedBody, sellerName } = mergeResponse.data;
      if (sellerName) {
        setReportData((prev) => ({ ...prev, owner_name: sellerName }));
      }
      const subject = encodeURIComponent(mergedSubject || template.subject);
      const body = encodeURIComponent(mergedBody || template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    } catch (error) {
      console.error('Failed to merge template:', error);
      const subject = encodeURIComponent(template.subject);
      const body = encodeURIComponent(template.body);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    }
  };"""
text = text.replace(old_handle, new_handle)

# Gmail送信ボタンにプリフェッチ中インジケーターを追加
old_gmail_btn = """          <Button
            variant="outlined"
            fullWidth
            startIcon={<EmailIcon />}
            onClick={() => setTemplateDialogOpen(true)}
            sx={{
              borderColor: '#1a73e8',
              color: '#1a73e8',
              '&:hover': { borderColor: '#1557b0', backgroundColor: '#1a73e808' },
            }}
          >
            Gmail送信
          </Button>"""
new_gmail_btn = """          <Button
            variant="outlined"
            fullWidth
            startIcon={prefetching ? <CircularProgress size={16} /> : <EmailIcon />}
            onClick={() => setTemplateDialogOpen(true)}
            sx={{
              borderColor: '#1a73e8',
              color: '#1a73e8',
              '&:hover': { borderColor: '#1557b0', backgroundColor: '#1a73e808' },
            }}
          >
            {prefetching ? 'テンプレート準備中...' : 'Gmail送信'}
          </Button>"""
text = text.replace(old_gmail_btn, new_gmail_btn)

with open('frontend/frontend/src/pages/PropertyReportPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('PropertyReportPage.tsx 修正完了')
print('- ページロード時にテンプレートをプリフェッチ')
print('- Gmail送信ボタンはキャッシュから即時開く')
