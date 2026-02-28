import { BaseRepository } from '../repositories/BaseRepository';
import {
  Seller,
  PropertyInfo,
  CreateSellerRequest,
  UpdateSellerRequest,
  ListSellersParams,
  PaginatedResult,
  SellerStatus,
} from '../types';
import { encrypt, decrypt } from '../utils/encryption';

export class SellerService extends BaseRepository {
  /**
   * 螢ｲ荳ｻ繧堤匳骭ｲ
   */

  /**
   * 螢ｲ荳ｻ諠・ｱ繧貞叙蠕・   */
  async getSeller(sellerId: string): Promise<Seller | null> {
    const seller = await this.queryOne<Seller>(
      'SELECT * FROM sellers WHERE id = $1',
      [sellerId]
    );

    if (!seller) {
      return null;
    }

    // 迚ｩ莉ｶ諠・ｱ繧ょ叙蠕・    const property = await this.queryOne<PropertyInfo>(
      'SELECT * FROM properties WHERE seller_id = $1',
      [sellerId]
    );

    const decryptedSeller = this.decryptSeller(seller);
    
    // 迚ｩ莉ｶ諠・ｱ繧貞性繧√ｋ
    if (property) {
      decryptedSeller.property = property;
    }

    return decryptedSeller;
  }

  /**
   * 螢ｲ荳ｻ逡ｪ蜿ｷ縺ｧ螢ｲ荳ｻ繧貞叙蠕・   */
  async getSellerByNumber(sellerNumber: string): Promise<Seller | null> {
    const seller = await this.queryOne<Seller>(
      'SELECT * FROM sellers WHERE seller_number = $1',
      [sellerNumber]
    );

    if (!seller) {
      return null;
    }

    // 迚ｩ莉ｶ諠・ｱ繧ょ叙蠕・    const property = await this.queryOne<PropertyInfo>(
      'SELECT * FROM properties WHERE seller_id = $1',
      [seller.id]
    );

    const decryptedSeller = this.decryptSeller(seller);
    
    // 迚ｩ莉ｶ諠・ｱ繧貞性繧√ｋ
    if (property) {
      decryptedSeller.property = property;
    }

    return decryptedSeller;
  }

  /**
   * 螢ｲ荳ｻ諠・ｱ繧呈峩譁ｰ
   */
  async updateSeller(
    sellerId: string,
    data: UpdateSellerRequest
  ): Promise<Seller> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // 證怜捷蛹悶′蠢・ｦ√↑繝輔ぅ繝ｼ繝ｫ繝・    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(encrypt(data.name));
    }
    if (data.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(encrypt(data.address));
    }
    if (data.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(encrypt(data.phoneNumber));
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(data.email ? encrypt(data.email) : null);
    }

    // 證怜捷蛹紋ｸ崎ｦ√↑繝輔ぅ繝ｼ繝ｫ繝・    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(data.assignedTo);
    }
    if (data.nextCallDate !== undefined) {
      updates.push(`next_call_date = $${paramIndex++}`);
      values.push(data.nextCallDate);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(sellerId);

    const seller = await this.queryOne<Seller>(
      `UPDATE sellers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!seller) {
      throw new Error('Seller not found');
    }

    return this.decryptSeller(seller);
  }

  /**
   * 螢ｲ荳ｻ繝ｪ繧ｹ繝医ｒ蜿門ｾ暦ｼ医・繝ｼ繧ｸ繝阪・繧ｷ繝ｧ繝ｳ縲√ヵ繧｣繝ｫ繧ｿ蟇ｾ蠢懶ｼ・   */
  async listSellers(params: ListSellersParams): Promise<PaginatedResult<Seller>> {
    const { 
      page = 1, 
      pageSize = 50, 
      status, 
      assignedTo, 
      nextCallDateFrom, 
      nextCallDateTo, 
      searchQuery,
      sortBy = 'created_at', 
      sortOrder = 'desc' 
    } = params;

    // 讀懃ｴ｢繧ｯ繧ｨ繝ｪ縺後≠繧句ｴ蜷医・縲《earchSellers 繧剃ｽｿ逕ｨ
    if (searchQuery) {
      const searchResults = await this.searchSellers(searchQuery);
      
      // 繝輔ぅ繝ｫ繧ｿ繧帝←逕ｨ
      let filteredResults = searchResults;
      
      if (status) {
        filteredResults = filteredResults.filter(s => s.status === status);
      }
      if (assignedTo) {
        filteredResults = filteredResults.filter(s => s.assignedTo === assignedTo);
      }
      if (nextCallDateFrom) {
        filteredResults = filteredResults.filter(s => 
          s.nextCallDate && new Date(s.nextCallDate) >= new Date(nextCallDateFrom)
        );
      }
      if (nextCallDateTo) {
        filteredResults = filteredResults.filter(s => 
          s.nextCallDate && new Date(s.nextCallDate) <= new Date(nextCallDateTo)
        );
      }

      // 繝壹・繧ｸ繝阪・繧ｷ繝ｧ繝ｳ
      const total = filteredResults.length;
      const offset = (page - 1) * pageSize;
      const paginatedResults = filteredResults.slice(offset, offset + pageSize);

      return {
        data: paginatedResults,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // 繝輔ぅ繝ｫ繧ｿ譚｡莉ｶ繧呈ｧ狗ｯ・    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (assignedTo) {
      conditions.push(`assigned_to = $${paramIndex++}`);
      values.push(assignedTo);
    }
    if (nextCallDateFrom) {
      conditions.push(`next_call_date >= $${paramIndex++}`);
      values.push(nextCallDateFrom);
    }
    if (nextCallDateTo) {
      conditions.push(`next_call_date <= $${paramIndex++}`);
      values.push(nextCallDateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 邱丈ｻｶ謨ｰ繧貞叙蠕・    const countResult = await this.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM sellers ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // 繝壹・繧ｸ繝阪・繧ｷ繝ｧ繝ｳ
    const offset = (page - 1) * pageSize;
    values.push(pageSize, offset);

    // 繝・・繧ｿ繧貞叙蠕・    const sellers = await this.query<Seller>(
      `SELECT * FROM sellers ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      values
    );

    // 蠕ｩ蜿ｷ蛹・    const decryptedSellers = sellers.map((seller: Seller) => this.decryptSeller(seller));

    return {
      data: decryptedSellers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 螢ｲ荳ｻ繧呈､懃ｴ｢・磯Κ蛻・ｸ閾ｴ・・   */
  async searchSellers(query: string): Promise<Seller[]> {
    // 證怜捷蛹悶＆繧後◆繝・・繧ｿ縺ｯ讀懃ｴ｢縺ｧ縺阪↑縺・◆繧√∝・莉ｶ蜿門ｾ励＠縺ｦ蠕ｩ蜿ｷ蛹門ｾ後↓讀懃ｴ｢
    // 譛ｬ逡ｪ迺ｰ蠅・〒縺ｯ讀懃ｴ｢逕ｨ縺ｮ蛻･繝・・繝悶Ν繧Еlasticsearch縺ｮ菴ｿ逕ｨ繧呈耳螂ｨ
    const sellers = await this.query<Seller>(
      'SELECT * FROM sellers ORDER BY created_at DESC LIMIT 1000'
    );

    const decryptedSellers = sellers.map((seller: Seller) => this.decryptSeller(seller));

    // 蠕ｩ蜿ｷ蛹門ｾ後↓驛ｨ蛻・ｸ閾ｴ讀懃ｴ｢
    const lowerQuery = query.toLowerCase();
    return decryptedSellers.filter(
      (seller: Seller) =>
        seller.name.toLowerCase().includes(lowerQuery) ||
        seller.address.toLowerCase().includes(lowerQuery) ||
        seller.phoneNumber.toLowerCase().includes(lowerQuery) ||
        (seller.sellerNumber && seller.sellerNumber.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 螢ｲ荳ｻ繝・・繧ｿ繧貞ｾｩ蜿ｷ蛹・   */
  private decryptSeller(seller: Seller): Seller {
    return {
      ...seller,
      name: decrypt(seller.name),
      address: decrypt(seller.address),
      phoneNumber: decrypt(seller.phoneNumber),
      email: seller.email ? decrypt(seller.email) : undefined,
    };
  }
}

