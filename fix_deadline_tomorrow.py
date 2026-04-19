# workTaskStatusUtils.ts と WorkTasksPage.tsx を修正するスクリプト
# 1. StatusCategory に isDeadlineTomorrow フラグを追加
# 2. getStatusCategories で翌日判定を追加
# 3. WorkTasksPage.tsx でラベル色・フォントを調整

import re

# ===== workTaskStatusUtils.ts の修正 =====
with open('frontend/frontend/src/utils/workTaskStatusUtils.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# 1. StatusCategory インターフェースに isDeadlineTomorrow を追加
old_interface = '  isDeadlinePast?: boolean; // 期日が本日以前かどうか'
new_interface = '  isDeadlinePast?: boolean; // 期日が本日以前かどうか\n  isDeadlineTomorrow?: boolean; // 期日が明日かどうか'
content = content.replace(old_interface, new_interface)

# 2. getStatusCategories の日付判定に isDeadlineTomorrow を追加
old_logic = '''    let isDeadlinePast = false;
    let deadlineStr: string | undefined;
    if (dateMatch) {
      deadlineStr = `${dateMatch[1]}/${dateMatch[2]}`;
      const year = new Date().getFullYear();
      const deadlineDate = new Date(year, parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
      deadlineDate.setHours(0, 0, 0, 0);
      isDeadlinePast = deadlineDate <= today();
    }

    categories.push({
      key,
      label: status,
      count,
      deadline: deadlineStr,
      isDeadlinePast,'''

new_logic = '''    let isDeadlinePast = false;
    let isDeadlineTomorrow = false;
    let deadlineStr: string | undefined;
    if (dateMatch) {
      deadlineStr = `${dateMatch[1]}/${dateMatch[2]}`;
      const year = new Date().getFullYear();
      const deadlineDate = new Date(year, parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
      deadlineDate.setHours(0, 0, 0, 0);
      isDeadlinePast = deadlineDate <= today();
      // 翌日判定
      const tomorrow = new Date(today());
      tomorrow.setDate(tomorrow.getDate() + 1);
      isDeadlineTomorrow = deadlineDate.getTime() === tomorrow.getTime();
    }

    categories.push({
      key,
      label: status,
      count,
      deadline: deadlineStr,
      isDeadlinePast,
      isDeadlineTomorrow,'''

content = content.replace(old_logic, new_logic)

with open('frontend/frontend/src/utils/workTaskStatusUtils.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('workTaskStatusUtils.ts 修正完了')

# ===== WorkTasksPage.tsx の修正 =====
with open('frontend/frontend/src/pages/WorkTasksPage.tsx', 'rb') as f:
    content2 = f.read().decode('utf-8')

old_sx = '''                sx={{ 
                  py: 0.5,
                  backgroundColor: getCategoryGroupColor(cat.label),
                  '&:hover': {
                    backgroundColor: getCategoryGroupColor(cat.label),
                    filter: 'brightness(0.95)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                  },
                  '&.Mui-selected:hover': {
                    backgroundColor: 'action.selected',
                  },
                  '& .MuiListItemText-primary': {
                    color: cat.isDeadlinePast ? 'error.main' : 'inherit',
                  },
                }}
              >
                <ListItemText 
                  primary={cat.label} 
                  primaryTypographyProps={{ 
                    variant: 'body2',
                    sx: { 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }
                  }}
                  secondary={cat.deadline ? `締切: ${cat.deadline}` : undefined}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: 'error',
                  }}'''

new_sx = '''                sx={{ 
                  py: 0.5,
                  backgroundColor: getCategoryGroupColor(cat.label),
                  '&:hover': {
                    backgroundColor: getCategoryGroupColor(cat.label),
                    filter: 'brightness(0.95)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                  },
                  '&.Mui-selected:hover': {
                    backgroundColor: 'action.selected',
                  },
                }}
              >
                <ListItemText 
                  primary={cat.label} 
                  primaryTypographyProps={{ 
                    variant: cat.isDeadlineTomorrow ? 'body1' : 'body2',
                    sx: { 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: cat.isDeadlinePast ? 'error.main' : 'text.primary',
                      fontWeight: cat.isDeadlineTomorrow ? 'bold' : 'normal',
                    }
                  }}
                  secondary={cat.deadline ? `締切: ${cat.deadline}` : undefined}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: cat.isDeadlinePast ? 'error' : 'text.secondary',
                  }}'''

content2 = content2.replace(old_sx, new_sx)

with open('frontend/frontend/src/pages/WorkTasksPage.tsx', 'wb') as f:
    f.write(content2.encode('utf-8'))

print('WorkTasksPage.tsx 修正完了')
print('BOM check utils:', repr(open('frontend/frontend/src/utils/workTaskStatusUtils.ts', 'rb').read(3)))
print('BOM check page:', repr(open('frontend/frontend/src/pages/WorkTasksPage.tsx', 'rb').read(3)))
