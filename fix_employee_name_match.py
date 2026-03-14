#!/usr/bin/env python3
# employeeUtils.ts に名前部分一致フォールバックを追加

with open('backend/src/utils/employeeUtils.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 名前からイニシャルを抽出してマッチングが失敗した後に、名前部分一致フォールバックを追加
old = """      if (matchedEmployees.length === 0) {
        console.log(`[EmployeeUtils] No employee found with initials: ${normalizedInitials}`);
        return null;
      }"""

new = """      if (matchedEmployees.length === 0) {
        // フォールバック2: 名前の部分一致で検索（例: sales_assignee="国広" → name="国広智子"）
        console.log('[EmployeeUtils] Falling back to name partial match');
        const nameMatches = employees.filter((employee: any) => {
          return employee.name && employee.name.includes(initials.trim());
        });

        if (nameMatches.length === 1) {
          const matched = nameMatches[0];
          const result: EmployeeLookupResult = {
            id: matched.id,
            name: matched.name,
            email: matched.email,
            initials: normalizedInitials
          };
          console.log('[EmployeeUtils] Employee found via name partial match:', result);
          return result;
        } else if (nameMatches.length > 1) {
          const names = nameMatches.map((e: any) => e.name).join(', ');
          console.warn(`[EmployeeUtils] Multiple employees match name "${initials}": ${names}. Using first match.`);
          const matched = nameMatches[0];
          return {
            id: matched.id,
            name: matched.name,
            email: matched.email,
            initials: normalizedInitials
          };
        }

        console.log(`[EmployeeUtils] No employee found with initials: ${normalizedInitials}`);
        return null;
      }"""

if old in text:
    text = text.replace(old, new)
    print('✅ 名前部分一致フォールバックを追加しました')
else:
    print('❌ 対象箇所が見つかりません')
    import sys
    sys.exit(1)

with open('backend/src/utils/employeeUtils.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
