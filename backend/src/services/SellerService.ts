import { BaseRepository } from '../repositories/BaseRepository';
import {
  Seller,
  PropertyInfo,
  CreateSellerRequest,
  UpdateSellerRequest,
  ListSellersParams,
  PaginatedResult,
} from '../types';
import { encrypt, decrypt } from '../utils/encryption';

export class SellerService extends BaseRepository {
  /**
   * Get seller by ID
   */
  async getSeller(sellerId: string): Promise<Seller | null> {
    const seller = await this.queryOne<Seller>(
      'SELECT * FROM sellers WHERE id = $1',
      [sellerId]
    );

    if (!seller) {
      return null;
    }

    // Get property info
    const property = await this.queryOne<PropertyInfo>(
      'SELECT * FROM properties WHERE seller_id = $1',
      [sellerId]
    );

    const decryptedSeller = this.decryptSeller(seller);

    // Include property info
    if (property) {
      decryptedSeller.property = property;
    }

    return decryptedSeller;
  }

  /**
   * Get seller by seller number
   */
  async getSellerByNumber(sellerNumber: string): Promise<Seller | null> {
    const seller = await this.queryOne<Seller>(
      'SELECT * FROM sellers WHERE seller_number = $1',
      [sellerNumber]
    );

    if (!seller) {
      return null;
    }

    // Get property info
    const property = await this.queryOne<PropertyInfo>(
      'SELECT * FROM properties WHERE seller_id = $1',
      [seller.id]
    );

    const decryptedSeller = this.decryptSeller(seller);

    // Include property info
    if (property) {
      decryptedSeller.property = property;
    }

    return decryptedSeller;
  }

  /**
   * Update seller info
   */
  async updateSeller(
    sellerId: string,
    data: UpdateSellerRequest
  ): Promise<Seller> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Fields requiring encryption
    if (data.name !== undefined) {
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

    // Fields not requiring encryption
    if (data.status !== undefined) {
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
   * List sellers with pagination and filtering
   */
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
      sortOrder = 'desc',
    } = params;

    // Use searchSellers when search query is provided
    if (searchQuery) {
      const searchResults = await this.searchSellers(searchQuery);

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

    if (status) {
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

    // Get total count
    const countResult = await this.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM sellers ${whereClause}`,
      values
    );
    const total = parseInt(countResult[0].count, 10);

    // Pagination
    const offset = (page - 1) * pageSize;
    values.push(pageSize, offset);

    // Fetch data
    const sellers = await this.query<Seller>(
      `SELECT * FROM sellers ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      values
    );

    const decryptedSellers = sellers.map((seller: Seller) => this.decryptSeller(seller));

    return {
      data: decryptedSellers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Search sellers (partial match)
   */
  async searchSellers(query: string): Promise<Seller[]> {
    // Encrypted data cannot be searched directly, so fetch all and filter after decryption
    const sellers = await this.query<Seller>(
      'SELECT * FROM sellers ORDER BY created_at DESC LIMIT 1000'
    );

    const decryptedSellers = sellers.map((seller: Seller) => this.decryptSeller(seller));

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
   * Decrypt seller data
   */
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
