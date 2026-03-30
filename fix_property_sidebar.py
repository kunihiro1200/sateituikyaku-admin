# PropertySidebarStatus.tsx の修正スクリプト
# 1. 「一般公開中物件」の背景色を解除
# 2. 「買付申し込み以下」より上のカテゴリーに薄い背景色を追加
# 3. 担当者カテゴリーをatbb_status==='専任・公開中'のみに絞り込み

with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ---- 変更1: LOW_PRIORITY_STATUSES から「一般公開中物件」を除外し、専任公開中のみに ----
old_low_priority = """// 優先度低グループ（色付け対象）
const LOW_PRIORITY_STATUSES = new Set([
  '一般公開中物件',
  'Y専任公開中',
  '生・専任公開中',
  '久・専任公開中',
  'U専任公開中',
  '林・専任公開中',
  'K専任公開中',
  'R専任公開中',
  'I専任公開中',
]);"""

new_low_priority = """// 「買付申し込み」より上の優先度高グループ（薄い背景色対象）
// STATUS_PRIORITYで8未満のステータス（買付申込み（内覧なし）２ = 8 より上）
const HIGH_PRIORITY_BG_STATUSES = new Set([
  '未完了',
  '本日公開予定',
  '要値下げ',
  '値下げ未完了',
  '未報告',
  '一般媒介の掲載確認未',
  'SUUMO URL\u3000要登録',
  'レインズ登録＋SUUMO登録',
]);

// 専任公開中グループ（atbb_status === '専任・公開中' のもののみ表示）
const SENIN_ASSIGNEE_STATUSES = new Set([
  'Y専任公開中',
  '生・専任公開中',
  '久・専任公開中',
  'U専任公開中',
  '林・専任公開中',
  'K専任公開中',
  'R専任公開中',
  'I専任公開中',
]);"""

text = text.replace(old_low_priority, new_low_priority)

# ---- 変更2: statusCounts の計算で専任公開中はatbb_status === '専任・公開中' のみカウント ----
old_counts = """    listings.forEach(listing => {
      // calculatePropertyStatusで「要値下げ」を含む正確なステータスを計算
      const computed = calculatePropertyStatus(listing as any);
      if (computed.key === 'price_reduction_due') {
        counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
        return;
      }

      const status = listing.sidebar_status || '';
      if (status && status !== '値下げ未完了') {
        counts[status] = (counts[status] || 0) + 1;
      }
    });"""

new_counts = """    listings.forEach(listing => {
      // calculatePropertyStatusで「要値下げ」を含む正確なステータスを計算
      const computed = calculatePropertyStatus(listing as any);
      if (computed.key === 'price_reduction_due') {
        counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
        return;
      }

      const status = listing.sidebar_status || '';
      if (status && status !== '値下げ未完了') {
        // 専任公開中カテゴリーはatbb_status === '専任・公開中' のもののみカウント
        if (SENIN_ASSIGNEE_STATUSES.has(status)) {
          if (listing.atbb_status === '専任・公開中') {
            counts[status] = (counts[status] || 0) + 1;
          }
        } else {
          counts[status] = (counts[status] || 0) + 1;
        }
      }
    });"""

text = text.replace(old_counts, new_counts)

# ---- 変更3: statusList の isLowPriority を isHighPriorityBg に変更 ----
old_status_list = """  const statusList = useMemo(() => {
    const list: Array<{ key: string; label: string; count: number; isLowPriority?: boolean; isDivider?: boolean; isRed?: boolean; isBoldRed?: boolean }> = [
      { key: 'all', label: 'すべて', count: statusCounts.all }
    ];

    const sortedStatuses = Object.entries(statusCounts)
      .filter(([key]) => key !== 'all' && key !== '')
      .sort((a, b) => {
        const getPriority = (key: string) => {
          if (STATUS_PRIORITY[key] !== undefined) return STATUS_PRIORITY[key];
          // 「未報告 Y」「未報告 I」など担当者付きは「未報告」と同じ優先度
          if (key.startsWith('未報告')) return 2;
          return 999;
        };
        return getPriority(a[0]) - getPriority(b[0]);
      });

    let dividerAdded = false;
    sortedStatuses.forEach(([key, count]) => {
      const isLow = LOW_PRIORITY_STATUSES.has(key);
      if (isLow && !dividerAdded) {
        dividerAdded = true; // 区切り線・ラベルは表示しない
      }
      // 一般媒介の未完了は太字赤字、それ以外の高優先度は赤字
      const isBoldRed = key === '未完了' && generalMediationIncompleteCount > 0;
      const isRed = HIGH_PRIORITY_RED_STATUSES.has(key);
      list.push({ key, label: key, count, isLowPriority: isLow, isRed, isBoldRed });
    });

    return list;
  }, [statusCounts, generalMediationIncompleteCount]);"""

new_status_list = """  const statusList = useMemo(() => {
    const list: Array<{ key: string; label: string; count: number; isHighPriorityBg?: boolean; isDivider?: boolean; isRed?: boolean; isBoldRed?: boolean }> = [
      { key: 'all', label: 'すべて', count: statusCounts.all }
    ];

    const sortedStatuses = Object.entries(statusCounts)
      .filter(([key]) => key !== 'all' && key !== '')
      .sort((a, b) => {
        const getPriority = (key: string) => {
          if (STATUS_PRIORITY[key] !== undefined) return STATUS_PRIORITY[key];
          // 「未報告 Y」「未報告 I」など担当者付きは「未報告」と同じ優先度
          if (key.startsWith('未報告')) return 4;
          return 999;
        };
        return getPriority(a[0]) - getPriority(b[0]);
      });

    sortedStatuses.forEach(([key, count]) => {
      // 「買付申し込み」より上のカテゴリーに薄い背景色
      // 「未報告 X」など担当者付きも含む
      const isHighBg = HIGH_PRIORITY_BG_STATUSES.has(key) || key.startsWith('未報告');
      // 一般媒介の未完了は太字赤字、それ以外の高優先度は赤字
      const isBoldRed = key === '未完了' && generalMediationIncompleteCount > 0;
      const isRed = HIGH_PRIORITY_RED_STATUSES.has(key);
      list.push({ key, label: key, count, isHighPriorityBg: isHighBg, isRed, isBoldRed });
    });

    return list;
  }, [statusCounts, generalMediationIncompleteCount]);"""

text = text.replace(old_status_list, new_status_list)

# ---- 変更4: ListItemButton の isLowPriority スタイルを isHighPriorityBg に変更 ----
old_list_item = """              <ListItemButton
                key={item.key}
                selected={selectedStatus === item.key || (!selectedStatus && item.key === 'all')}
                onClick={() => onStatusChange(item.key === 'all' ? null : item.key)}
                sx={{
                  py: 0.75,
                  ...(item.isLowPriority && {
                    bgcolor: 'rgba(0, 188, 212, 0.10)',
                    '&:hover': { bgcolor: 'rgba(0, 188, 212, 0.20)' },
                    '&.Mui-selected': { bgcolor: 'rgba(0, 188, 212, 0.28)' },
                  }),
                }}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                    sx: item.isBoldRed
                      ? { color: 'error.main', fontWeight: 'bold' }
                      : item.isRed
                      ? { color: 'error.main' }
                      : item.isLowPriority
                      ? { color: 'text.secondary' }
                      : undefined,
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Badge
                  badgeContent={item.count}
                  max={9999}
                  sx={{
                    ml: 1,
                    '& .MuiBadge-badge': {
                      backgroundColor: item.isLowPriority ? '#9e9e9e' : SECTION_COLORS.property.main,
                      color: SECTION_COLORS.property.contrastText,
                    },
                  }}
                />
              </ListItemButton>"""

new_list_item = """              <ListItemButton
                key={item.key}
                selected={selectedStatus === item.key || (!selectedStatus && item.key === 'all')}
                onClick={() => onStatusChange(item.key === 'all' ? null : item.key)}
                sx={{
                  py: 0.75,
                  ...(item.isHighPriorityBg && {
                    bgcolor: 'rgba(255, 243, 224, 0.8)',
                    '&:hover': { bgcolor: 'rgba(255, 224, 178, 0.8)' },
                    '&.Mui-selected': { bgcolor: 'rgba(255, 204, 128, 0.6)' },
                  }),
                }}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                    sx: item.isBoldRed
                      ? { color: 'error.main', fontWeight: 'bold' }
                      : item.isRed
                      ? { color: 'error.main' }
                      : undefined,
                  }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Badge
                  badgeContent={item.count}
                  max={9999}
                  sx={{
                    ml: 1,
                    '& .MuiBadge-badge': {
                      backgroundColor: SECTION_COLORS.property.main,
                      color: SECTION_COLORS.property.contrastText,
                    },
                  }}
                />
              </ListItemButton>"""

text = text.replace(old_list_item, new_list_item)

# UTF-8で書き込む
with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('変更内容:')
print('1. 一般公開中物件の背景色を解除')
print('2. 買付申し込みより上のカテゴリーに薄いオレンジ背景色を追加')
print('3. 専任公開中カテゴリーをatbb_status===専任・公開中のみカウント')
