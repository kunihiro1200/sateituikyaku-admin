# Fix 1: backend/src/types/index.ts - statusCategoryにstringを追加
with open('backend/src/types/index.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = "  statusCategory?: 'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' | 'visitDayBefore' | 'visitScheduled' | 'visitCompleted' | 'unvaluated' | 'mailingPending' | 'todayCallNotStarted' | 'pinrichEmpty' | 'pinrichChangeRequired' | 'exclusive' | 'general' | 'visitOtherDecision' | 'unvisitedOtherDecision';"
new = "  statusCategory?: 'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' | 'visitDayBefore' | 'visitScheduled' | 'visitCompleted' | 'unvaluated' | 'mailingPending' | 'todayCallNotStarted' | 'pinrichEmpty' | 'pinrichChangeRequired' | 'exclusive' | 'general' | 'visitOtherDecision' | 'unvisitedOtherDecision' | string;"

if old in text:
    text = text.replace(old, new)
    print('Fix 1 applied: statusCategory type updated')
else:
    print('Fix 1 NOT applied: pattern not found')

with open('backend/src/types/index.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

# Fix 2: backend/src/services/TokiExtractService.ts - landsにareaNumericを追加
with open('backend/src/services/TokiExtractService.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old2 = """  lands: Array<{
    location: string | null;         // A91以降（所在）
    lotNumber: string | null;        // C91以降（地番）
    landType: string | null;         // D91以降（地目）
    area: string | null;             // E91以降（地積）
  }>;"""
new2 = """  lands: Array<{
    location: string | null;         // A91以降（所在）
    lotNumber: string | null;        // C91以降（地番）
    landType: string | null;         // D91以降（地目）
    area: string | null;             // E91以降（地積）
    areaNumeric: number | null;      // ソート用（書き込みには使わない）
  }>;"""

if old2 in text:
    text = text.replace(old2, new2)
    print('Fix 2 applied: areaNumeric added to TokiKodateExtractResult.lands')
else:
    print('Fix 2 NOT applied: pattern not found')

with open('backend/src/services/TokiExtractService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
