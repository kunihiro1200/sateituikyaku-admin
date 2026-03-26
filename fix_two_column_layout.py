with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# SiteRegistrationSection の return 部分を2カラムレイアウトに置き換え
old_return = """    return (
    <Box sx={{ p: 2 }}>
      <EditableField label="サイト登録締め日" field="site_registration_deadline" type="date" />
      <EditableField label="種別" field="property_type" />

      <SectionHeader label="【サイト登録依頼】" />
      <EditableField label="サイト備考" field="site_notes" />
      {getValue('property_type') === '土' && (
        <>
          <EditableField label="字図、地積測量図URL*" field="cadastral_map_url" type="url" />
          <EditableField label="地積測量図・字図（営業入力）" field="cadastral_map_sales_input" />
          <CadastralMapFieldSelect />
        </>
      )}
      <RedNote text={'地積測量図や字図を格納→「リンク知っている人全員」\\nの共有URLをスプシの「内覧前伝達事項」に貼り付ける'} />
      <EditableField label="格納先URL" field="storage_url" type="url" />
      <EditableYesNo label="CWの方へ依頼メール（サイト登録）" field="cw_request_email_site" />
      <EditableButtonSelect label="CWの方*" field="cw_person" options={['浅沼様（土日OK, 平日は中１日あけて納期）']} />
      {/* 変更1: メール配信フィールド（site_registration_comment の直前） */}
      <EditableField label="メール配信" field="email_distribution" />

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>コメント（サイト登録）</Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField
            size="small"
            value={getValue('site_registration_comment') || ''}
            onChange={(e) => handleFieldChange('site_registration_comment', e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Grid>
      </Grid>
      {/* 変更3: site_registration_requestor のデフォルト値 */}
      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>サイト登録依頼コメント</Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField
            size="small"
            value={(() => { const v = getValue('site_registration_requestor'); return (v && String(v).startsWith('浅沼様')) ? v : generateDefaultRequestorComment(); })()}
            onChange={(e) => handleFieldChange('site_registration_requestor', e.target.value)}
            fullWidth
            multiline
            rows={4}
          />
        </Grid>
      </Grid>
      <EditableField label="パノラマ" field="panorama" />
      <EditableButtonSelect label="サイト登録依頼者*" field="site_registration_requester" options={['K', 'Y', 'I', '林', '麻', 'U', 'R', '久', '和', 'H']} />
      {/* 変更4: サイト登録納期予定日（初期値・必須化） */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography
            variant="body2"
            color={isSiteDueDateRequired ? 'error' : 'text.secondary'}
            sx={{ fontWeight: isSiteDueDateRequired ? 700 : 500 }}
          >
            {siteDueDateLabel}
          </Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField
            size="small"
            type="date"
            value={formatDateForInput(getValue('site_registration_due_date') || getDefaultDueDate())}
            onChange={(e) => handleFieldChange('site_registration_due_date', e.target.value || null)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>CWの方、広瀬さん記入↓↓</Typography>
      <EditableField label="サイト登録確認依頼日" field="site_registration_confirm_request_date" type="date" />

      <SectionHeader label="【★サイト登録確認】" />
      <EditableButtonSelect label="サイト登録確認" field="site_registration_confirmed" options={['確認中', '完了', '他']} />
      <EditableField label="メール配信v" field="email_distribution" />

      <SectionHeader label="【図面作成依頼】" />
      <EditableButtonSelect label="間取図" field="floor_plan" options={['クラウドワークス', '他', '不要']} />
      <EditableButtonSelect label="方位記号" field="direction_symbol" options={['確認済', '不要（営業相談済）']} />
      <EditableField label="コメント（間取図関係）" field="floor_plan_comment" />
      <EditableField label="道路寸法" field="road_dimensions" />
      <EditableYesNo label="CWの方へ依頼メール（間取り、区画図）" field="cw_request_email_floor_plan" />
      <EditableYesNo label="CWの方へ依頼メール（2階以上）" field="cw_request_email_2f_above" />
      <EditableField label="間取図完了予定*" field="floor_plan_due_date" type="date" />

      <SectionHeader label="【★図面確認】" />
      <EditableButtonSelect label="間取図確認者*" field="floor_plan_confirmer" options={['K', 'Y', 'I', '林', '麻', 'U', 'R', '久', '和', 'H']} />
      <EditableField label="間取図確認OK/修正コメント" field="floor_plan_ok_comment" />
      <EditableYesNo label="間取図確認OK送信*" field="floor_plan_ok_sent" />
      <EditableButtonSelect label="間取図修正回数" field="floor_plan_revision_count" options={['1', '2', '3', '4']} />
      <EditableField label="間取図完了日*" field="floor_plan_completed_date" type="date" />
      <EditableYesNo label="間取図格納済み連絡メール" field="floor_plan_stored_email" />

      <SectionHeader label="【確認後処理】" />
      <EditableField label="配信日" field="distribution_date" type="date" />
      <EditableButtonSelect label="物件一覧に行追加*" field="property_list_row_added" options={['追加済', '未']} />
      <EditableButtonSelect label="物件ファイル" field="property_file" options={['担当に渡し済み', '未']} />
      <EditableField label="公開予定日" field="publish_scheduled_date" type="date" />
      <EditableField label="メール配信" field="pre_distribution_check" />
      <EditableField label="サイト登録締め日v" field="site_registration_deadline" type="date" />
    </Box>
    );"""

new_return = """    return (
    <Box sx={{ display: 'flex', gap: 0, height: '100%' }}>
      {/* 左側：登録関係 */}
      <Box sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0', mb: 1 }}>【登録関係】</Typography>
        <EditableField label="サイト登録締め日" field="site_registration_deadline" type="date" />
        <EditableField label="種別" field="property_type" />

        <SectionHeader label="【サイト登録依頼】" />
        <EditableField label="サイト備考" field="site_notes" />
        {getValue('property_type') === '土' && (
          <>
            <EditableField label="字図、地積測量図URL*" field="cadastral_map_url" type="url" />
            <EditableField label="地積測量図・字図（営業入力）" field="cadastral_map_sales_input" />
            <CadastralMapFieldSelect />
          </>
        )}
        <RedNote text={'地積測量図や字図を格納→「リンク知っている人全員」\\nの共有URLをスプシの「内覧前伝達事項」に貼り付ける'} />
        <EditableField label="格納先URL" field="storage_url" type="url" />
        <EditableYesNo label="CWの方へ依頼メール（サイト登録）" field="cw_request_email_site" />
        <EditableButtonSelect label="CWの方*" field="cw_person" options={['浅沼様（土日OK, 平日は中１日あけて納期）']} />
        <EditableField label="メール配信" field="email_distribution" />
        <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>コメント（サイト登録）</Typography>
          </Grid>
          <Grid item xs={8}>
            <TextField
              size="small"
              value={getValue('site_registration_comment') || ''}
              onChange={(e) => handleFieldChange('site_registration_comment', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Grid>
        </Grid>
        <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>サイト登録依頼コメント</Typography>
          </Grid>
          <Grid item xs={8}>
            <TextField
              size="small"
              value={(() => { const v = getValue('site_registration_requestor'); return (v && String(v).startsWith('浅沼様')) ? v : generateDefaultRequestorComment(); })()}
              onChange={(e) => handleFieldChange('site_registration_requestor', e.target.value)}
              fullWidth
              multiline
              rows={4}
            />
          </Grid>
        </Grid>
        <EditableField label="パノラマ" field="panorama" />
        <EditableButtonSelect label="サイト登録依頼者*" field="site_registration_requester" options={['K', 'Y', 'I', '林', '麻', 'U', 'R', '久', '和', 'H']} />
        <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
          <Grid item xs={4}>
            <Typography
              variant="body2"
              color={isSiteDueDateRequired ? 'error' : 'text.secondary'}
              sx={{ fontWeight: isSiteDueDateRequired ? 700 : 500 }}
            >
              {siteDueDateLabel}
            </Typography>
          </Grid>
          <Grid item xs={8}>
            <TextField
              size="small"
              type="date"
              value={formatDateForInput(getValue('site_registration_due_date') || getDefaultDueDate())}
              onChange={(e) => handleFieldChange('site_registration_due_date', e.target.value || null)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>CWの方、広瀬さん記入↓↓</Typography>
        <EditableField label="サイト登録確認依頼日" field="site_registration_confirm_request_date" type="date" />

        <SectionHeader label="【図面作成依頼】" />
        <EditableButtonSelect label="間取図" field="floor_plan" options={['クラウドワークス', '他', '不要']} />
        <EditableButtonSelect label="方位記号" field="direction_symbol" options={['確認済', '不要（営業相談済）']} />
        <EditableField label="コメント（間取図関係）" field="floor_plan_comment" />
        <EditableField label="道路寸法" field="road_dimensions" />
        <EditableYesNo label="CWの方へ依頼メール（間取り、区画図）" field="cw_request_email_floor_plan" />
        <EditableYesNo label="CWの方へ依頼メール（2階以上）" field="cw_request_email_2f_above" />
        <EditableField label="間取図完了予定*" field="floor_plan_due_date" type="date" />
      </Box>

      {/* 右側：確認関係 */}
      <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1 }}>【確認関係】</Typography>

        <SectionHeader label="【★サイト登録確認】" />
        <EditableButtonSelect label="サイト登録確認" field="site_registration_confirmed" options={['確認中', '完了', '他']} />
        <EditableField label="メール配信v" field="email_distribution" />

        <SectionHeader label="【★図面確認】" />
        <EditableButtonSelect label="間取図確認者*" field="floor_plan_confirmer" options={['K', 'Y', 'I', '林', '麻', 'U', 'R', '久', '和', 'H']} />
        <EditableField label="間取図確認OK/修正コメント" field="floor_plan_ok_comment" />
        <EditableYesNo label="間取図確認OK送信*" field="floor_plan_ok_sent" />
        <EditableButtonSelect label="間取図修正回数" field="floor_plan_revision_count" options={['1', '2', '3', '4']} />
        <EditableField label="間取図完了日*" field="floor_plan_completed_date" type="date" />
        <EditableYesNo label="間取図格納済み連絡メール" field="floor_plan_stored_email" />

        <SectionHeader label="【確認後処理】" />
        <EditableField label="配信日" field="distribution_date" type="date" />
        <EditableButtonSelect label="物件一覧に行追加*" field="property_list_row_added" options={['追加済', '未']} />
        <EditableButtonSelect label="物件ファイル" field="property_file" options={['担当に渡し済み', '未']} />
        <EditableField label="公開予定日" field="publish_scheduled_date" type="date" />
        <EditableField label="メール配信" field="pre_distribution_check" />
        <EditableField label="サイト登録締め日v" field="site_registration_deadline" type="date" />
      </Box>
    </Box>
    );"""

text = text.replace(old_return, new_return)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done:', '適用済み' if '【登録関係】' in text else '失敗')
