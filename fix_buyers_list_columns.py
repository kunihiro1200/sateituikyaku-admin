with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# getAllメソッドのreturn部分の直前に、property_listingsからaddressとsales_assigneeを取得して結合する処理を追加
old_return = """    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages
    };
  }"""

new_return = """    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // property_listingsからaddress（物件所在地）とsales_assignee（物件担当者）を取得して結合
    const buyers = data || [];
    const propertyNumbers = [...new Set(
      buyers.map((b: any) => b.property_number).filter(Boolean)
    )] as string[];

    let propertyMap: Record<string, { address: string | null; sales_assignee: string | null }> = {};
    if (propertyNumbers.length > 0) {
      const { data: properties } = await this.supabase
        .from('property_listings')
        .select('property_number, address, sales_assignee')
        .in('property_number', propertyNumbers);
      if (properties) {
        properties.forEach((p: any) => {
          propertyMap[p.property_number] = {
            address: p.address,
            sales_assignee: p.sales_assignee,
          };
        });
      }
    }

    const enrichedData = buyers.map((b: any) => ({
      ...b,
      property_address: propertyMap[b.property_number]?.address ?? null,
      property_sales_assignee: propertyMap[b.property_number]?.sales_assignee ?? null,
    }));

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages
    };
  }"""

content = content.replace(old_return, new_return)

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('BuyerService.ts updated')
print('Replaced:', old_return[:50] in content)
