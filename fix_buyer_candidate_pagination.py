with open('backend/src/services/BuyerCandidateService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_str = '''    // 買主を取得（削除済みを除外、最新状況/問合せ時確度でフィルタリング）
    const { data: buyers, error: buyersError } = await this.supabase
      .from('buyers')
      .select('*')
      .is('deleted_at', null)  // 削除済みを除外
      .order('reception_date', { ascending: false, nullsFirst: false });

    if (buyersError) {
      throw new Error(`Failed to fetch buyers: ${buyersError.message}`);
    }'''

new_str = '''    // 買主を全件取得（Supabaseの1000件制限を回避するためページネーション）
    const buyers: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error: buyersError } = await this.supabase
        .from('buyers')
        .select('*')
        .is('deleted_at', null)  // 削除済みを除外
        .order('reception_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (buyersError) {
        throw new Error(`Failed to fetch buyers: ${buyersError.message}`);
      }

      if (!data || data.length === 0) break;
      buyers.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    console.log(`[BuyerCandidateService] Total buyers fetched: ${buyers.length}`);'''

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ ページネーション対応に修正しました')
else:
    print('❌ 対象文字列が見つかりませんでした')

with open('backend/src/services/BuyerCandidateService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
