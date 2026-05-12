# -*- coding: utf-8 -*-
"""
媒介契約タブの修正スクリプト
- 媒介確認者フィールドを削除
- 媒介契約修正内容まとめを削除
- お渡し手段、郵送前営業確認、印刷OR郵送準備フィールドを追加
"""

import re

# ファイルを読み込む
with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\components\WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. WorkTaskDataインターフェースに新しいフィールドを追加
# mediation_checker の行を削除して、新しいフィールドを追加
old_interface = '''  mediation_creator: string;
  mediation_checker: string;
  mediation_revision: string;'''

new_interface = '''  mediation_creator: string;
  mediation_delivery_method: string;
  mediation_pre_mail_check: string;
  mediation_print_or_mail_prep: string;
  mediation_revision: string;'''

text = text.replace(old_interface, new_interface)

# 2. renderMediationSection関数を修正
# 媒介確認者と媒介契約修正内容まとめのセクションを削除し、新しいフィールドを追加

old_section = '''      <EditableButtonSelect label="媒介作成者" field="mediation_creator" options={normalInitials} />

      {/* 媒介作成完了に値がある場合のみ媒介確認者を表示 */}
      {getValue('mediation_completed') && (
        <>
          <EditableButtonSelect
            label={isMediationCheckerRequired ? '媒介確認者*（必須）' : '媒介確認者'}
            field="mediation_checker"
            options={normalInitials}
            labelColor={isMediationCheckerRequired && !getValue('mediation_checker') ? 'error' : undefined}
          />

          {/* 媒介確認者に値がある場合のみ媒介契約修正を表示 */}
          {getValue('mediation_checker') && (
            <>
              <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>媒介契約修正*（必須）</Typography>
                </Grid>
                <Grid item xs={8}>
                  <ButtonGroup size="small" variant="outlined">
                    {['あり', 'なし'].map((opt) => (
                      <Button
                        key={opt}
                        variant={getValue('mediation_revision') === opt ? 'contained' : 'outlined'}
                        color={getValue('mediation_revision') === opt ? (opt === 'あり' ? 'error' : 'primary') : 'inherit'}
                        onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('mediation_revision', getValue('mediation_revision') === opt ? null : opt); }}
                      >
                        {opt}
                      </Button>
                    ))}
                  </ButtonGroup>
                </Grid>
              </Grid>

              {/* 媒介契約修正が「あり」の場合のみ修正内容を表示 */}
              {getValue('mediation_revision') === 'あり' && (
                <MediationRevisionContentField
                  value={getValue('mediation_revision_content') || ''}
                  onCommit={(v) => handleFieldChange('mediation_revision_content', v)}
                />
              )}
            </>
          )}
        </>
      )}

      <EditableYesNo label="保留" field="on_hold" />

      {/* 媒介契約修正内容まとめ（常時表示・全担当者） */}
      {mediationRevisionHistory.length > 0 && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff3e0', border: '2px solid #ff9800', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#e65100', mb: 1 }}>
            ⚠️ 媒介契約修正内容まとめ
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#ffe0b2' }}>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>物件番号</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>媒介作成完了日</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>媒介確認者</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>媒介作成者</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', width: '35%' }}>修正内容</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', width: '25%' }}>対策案</th>
                </tr>
              </thead>
              <tbody>
                {mediationRevisionHistory.map((item, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff8f0' : '#fff3e0' }}>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>
                      {item.property_number
                        ? <span onClick={() => onNavigate?.(item.property_number, 0)} style={{ color: '#1565c0', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>{item.property_number}</span>
                        : '-'}
                    </td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>{formatDateShort(item.mediation_completed)}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.mediation_checker || '-'}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.mediation_creator || '-'}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'pre-wrap', width: '35%', color: 'inherit', fontWeight: 'normal' }}><span dangerouslySetInnerHTML={{ __html: item.mediation_revision_content }} /></td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', width: '25%', color: 'inherit', fontWeight: 'normal' }}>
                      <CountermeasureCell
                        propertyNumber={item.property_number}
                        field="mediation_revision_countermeasure"
                        value={item.mediation_revision_countermeasure || ''}
                        onSaved={(val) => {
                          setMediationRevisionHistory(prev => prev.map((r, i) => i === idx ? { ...r, mediation_revision_countermeasure: val } : r));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      )}'''

new_section = '''      <EditableButtonSelect label="媒介作成者" field="mediation_creator" options={normalInitials} />

      {/* お渡し手段（GASから転記、編集不可） */}
      <EditableField label="お渡し手段" field="mediation_delivery_method" readOnly />

      {/* 郵送前営業確認（お渡し手段に「郵送」が含まれる場合のみ表示、GASから転記、編集不可） */}
      {getValue('mediation_delivery_method')?.includes('郵送') && (
        <EditableField label="郵送前営業確認" field="mediation_pre_mail_check" readOnly />
      )}

      {/* 印刷OR郵送準備（DB編集可能、選択肢は「済」のみ） */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>印刷OR郵送準備</Typography>
        </Grid>
        <Grid item xs={8}>
          <Button
            size="small"
            variant={getValue('mediation_print_or_mail_prep') === '済' ? 'contained' : 'outlined'}
            color={getValue('mediation_print_or_mail_prep') === '済' ? 'primary' : 'inherit'}
            onClick={(e) => {
              (e.currentTarget as HTMLButtonElement).blur();
              handleFieldChange('mediation_print_or_mail_prep', getValue('mediation_print_or_mail_prep') === '済' ? null : '済');
            }}
          >
            済
          </Button>
        </Grid>
      </Grid>

      <EditableYesNo label="保留" field="on_hold" />'''

text = text.replace(old_section, new_section)

# 3. isMediationCheckerRequired の定義を削除
# この変数は使用されなくなるため削除
old_checker_required = '''  // 媒介確認者が必須かどうかの判定（媒介作成完了が2026/4/23以降）
  const isMediationCheckerRequired = (() => {
    const completed = getValue('mediation_completed');'''

# この部分は複数行にわたるため、正規表現で削除
text = re.sub(
    r'  // 媒介確認者が必須かどうかの判定.*?\n  const isMediationCheckerRequired = \(\(\) => \{.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n  \}\)\(\);',
    '',
    text,
    flags=re.DOTALL
)

# UTF-8で書き込む（BOMなし）
with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\components\WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! WorkTaskDetailModal.tsx を修正しました。')
