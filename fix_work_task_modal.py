# WorkTaskDetailModal.tsx の変更を UTF-8 で安全に適用するスクリプト

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 変更1 & 2 & 3 & 4: SiteRegistrationSection を丸ごと置き換え
# ============================================================

old_section = '''  // サイト登録セクション
  const SiteRegistrationSection = () => (
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
      <EditableField label="コメント（サイト登録）" field="site_registration_comment" />
      <EditableMultilineField label="サイト登録依頼コメント" field="site_registration_requestor" />
      <EditableField label="パノラマ" field="panorama" />
      <EditableButtonSelect label="サイト登録依頼者*" field="site_registration_requester" options={['K', 'Y', 'I', '林', '麻', 'U', 'R', '久', '和', 'H']} />
      <EditableField label="サイト登録納期予定日*" field="site_registration_due_date" type="date" />

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
  );'''

new_section = '''  // サイト登録セクション
  const SiteRegistrationSection = () => {
    // 変更4: サイト登録納期予定日の初期値ロジック
    const getDefaultDueDate = () => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
      // 火曜(2)の場合は+3日、それ以外は+2日
      const daysToAdd = dayOfWeek === 2 ? 3 : 2;
      const result = new Date(today);
      result.setDate(today.getDate() + daysToAdd);
      return result.toISOString().split('T')[0];
    };

    // 変更3: サイト登録依頼コメントのデフォルト値生成ロジック
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      } catch { return ''; }
    };

    const generateDefaultRequestorComment = () => {
      const propertyNumber = getValue('property_number') || '';
      const propertyAddress = getValue('property_address') || '';
      const requestDate = formatDate(getValue('site_registration_request_date'));
      const requester = getValue('site_registration_requestor') || '';
      const dueDate = formatDate(getValue('site_registration_due_date') || getDefaultDueDate());
      const panorama = getValue('panorama') || '';
      const floorPlanDue = formatDate(getValue('floor_plan_due_date'));
      const comment = getValue('site_registration_comment') || '';
      const spreadsheetUrl = getValue('spreadsheet_url') || '';
      const storageUrl = getValue('storage_url') || '';

      let text = `浅沼様\\nお世話になっております。\\nサイト登録関係お願いします。\\n物件番号：${propertyNumber}\\n物件所在地：${propertyAddress}\\n当社依頼日：${requestDate}（${requester}）\\n当社の希望納期：${dueDate}`;
      if (panorama) text += `\\nパノラマ：${panorama}`;
      if (floorPlanDue) text += `\\n間取図格納時期：${floorPlanDue}`;
      text += `\\nコメント：${comment}\\n詳細：${spreadsheetUrl}\\n格納先：${storageUrl}\\nご不明点等がございましたら、こちらに返信していただければと思います。`;
      return text;
    };

    // 変更2: email_distribution の値に応じた自動計算テキスト
    const getEmailDistributionAutoText = () => {
      const emailDist = getValue('email_distribution') || '';
      if (emailDist.includes('即') && emailDist.includes('不要')) {
        return '公開前配信メールは不要です。確認前に公開お願い致します。公開方法→https://docs.google.com/document/d/145LKr_Q7ftxnRVvNalaKPO1NH_FqncOlOY5bqP5P48c/edit?usp=sharing';
      }
      if (emailDist === '新着配信、即公開（期日関係無）') {
        return '公開前配信メールを「新着配信」に変更して、同時に公開もお願い致します。公開方法→https://docs.google.com/document/d/145LKr_Q7ftxnRVvNalaKPO1NH_FqncOlOY5bqP5P48c/edit?usp=sharing';
      }
      return '';
    };

    const emailDistAutoText = getEmailDistributionAutoText();

    // 変更4: cw_request_email_site が空でない場合は必須表示
    const isSiteDueDateRequired = !!(getValue('cw_request_email_site'));
    const siteDueDateLabel = `サイト登録納期予定日${isSiteDueDateRequired ? '*（必須）' : '*'}`;

    return (
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
      {/* 変更2: email_distribution に応じた自動計算テキスト */}
      {emailDistAutoText && (
        <Box sx={{ bgcolor: 'info.light', p: 1.5, mb: 1.5, borderRadius: 1 }}>
          <Typography
            variant="body2"
            sx={{ userSelect: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {emailDistAutoText}
          </Typography>
        </Box>
      )}
      <EditableField label="コメント（サイト登録）" field="site_registration_comment" />
      {/* 変更3: site_registration_requestor のデフォルト値 */}
      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>サイト登録依頼コメント</Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField
            size="small"
            value={getValue('site_registration_requestor') || generateDefaultRequestorComment()}
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
    );
  };'''

if old_section in text:
    text = text.replace(old_section, new_section)
    print('✅ SiteRegistrationSection を置き換えました')
else:
    print('❌ 対象テキストが見つかりませんでした')
    # デバッグ: 部分一致を確認
    if 'const SiteRegistrationSection = () => (' in text:
        print('  → SiteRegistrationSection は存在しますが、内容が一致しません')

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
