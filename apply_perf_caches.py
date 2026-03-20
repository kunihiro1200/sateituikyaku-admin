# -*- coding: utf-8 -*-
"""
3つのボトルネックにインメモリキャッシュを追加するスクリプト
1. sellers.ts - /:id/duplicates エンドポイント (1559ms)
2. employees.ts - /active エンドポイント (889ms)
3. PropertyService.ts - getPropertyBySellerId (905ms)
"""
import os

def apply_patch(filepath, old, new, label):
    with open(filepath, 'rb') as f:
        raw = f.read()
    text = raw.decode('utf-8')
    if old not in text:
        print(f'[SKIP] {label}: pattern not found in {filepath}')
        return False
    text = text.replace(old, new, 1)
    with open(filepath, 'wb') as f:
        f.write(text.encode('utf-8'))
    print(f'[OK] {label}: patched {filepath}')
    return True

# ============================================================
# 1. sellers.ts - duplicates キャッシュ
# ============================================================
SELLERS_TS = 'backend/src/routes/sellers.ts'

sellers_old = '''const router = Router();
const sellerService = new SellerService();

// 全てのルートに認証を適用
router.use(authenticate);'''

sellers_new = '''const router = Router();
const sellerService = new SellerService();

// duplicates インメモリキャッシュ（TTL: 60秒）
const duplicatesCache = new Map<string, { data: any[]; expiresAt: number }>();
const DUPLICATES_CACHE_TTL_MS = 60 * 1000;

function getDuplicatesCache(sellerId: string): any[] | null {
  const entry = duplicatesCache.get(sellerId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    duplicatesCache.delete(sellerId);
    return null;
  }
  return entry.data;
}

function setDuplicatesCache(sellerId: string, data: any[]): void {
  duplicatesCache.set(sellerId, { data, expiresAt: Date.now() + DUPLICATES_CACHE_TTL_MS });
}

function invalidateDuplicatesCache(sellerId: string): void {
  duplicatesCache.delete(sellerId);
}

// 全てのルートに認証を適用
router.use(authenticate);'''

apply_patch(SELLERS_TS, sellers_old, sellers_new, 'sellers.ts - duplicates cache vars')

# duplicates エンドポイント本体にキャッシュ読み書きを追加
sellers_dup_old = '''router.get('/:id/duplicates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 売主情報を取得
    const seller = await sellerService.getSeller(id);
    
    if (!seller) {
      return res.status(404).json({
        error: {
          code: 'SELLER_NOT_FOUND',
          message: 'Seller not found',
          retryable: false,
        },
      });
    }
    
    // 重複を検出（自分自身を除外）
    const { duplicateDetectionService } = await import('../services/DuplicateDetectionService');
    const duplicates = await duplicateDetectionService.instance.checkDuplicates(
      seller.phoneNumber,
      seller.email,
      id
    );
    
    res.json({ duplicates });'''

sellers_dup_new = '''router.get('/:id/duplicates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // キャッシュ確認（60秒TTL）
    const cached = getDuplicatesCache(id);
    if (cached) {
      return res.json({ duplicates: cached });
    }
    
    // 売主情報を取得
    const seller = await sellerService.getSeller(id);
    
    if (!seller) {
      return res.status(404).json({
        error: {
          code: 'SELLER_NOT_FOUND',
          message: 'Seller not found',
          retryable: false,
        },
      });
    }
    
    // 重複を検出（自分自身を除外）
    const { duplicateDetectionService } = await import('../services/DuplicateDetectionService');
    const duplicates = await duplicateDetectionService.instance.checkDuplicates(
      seller.phoneNumber,
      seller.email,
      id
    );

    setDuplicatesCache(id, duplicates);
    res.json({ duplicates });'''

apply_patch(SELLERS_TS, sellers_dup_old, sellers_dup_new, 'sellers.ts - duplicates cache read/write')

# updateSeller 時にキャッシュ無効化
sellers_update_old = '''    } else {
      // 通常の更新
      const seller = await sellerService.updateSeller(req.params.id, req.body);
      res.json(seller);
    }'''

sellers_update_new = '''    } else {
      // 通常の更新
      const seller = await sellerService.updateSeller(req.params.id, req.body);
      invalidateDuplicatesCache(req.params.id);
      res.json(seller);
    }'''

apply_patch(SELLERS_TS, sellers_update_old, sellers_update_new, 'sellers.ts - invalidate on update')

# ============================================================
# 2. employees.ts - /active キャッシュ
# ============================================================
EMPLOYEES_TS = 'backend/src/routes/employees.ts'

emp_old = '''const router = Router();
const googleAuthService = new GoogleAuthService();
const employeeUtils = new EmployeeUtils();
const staffManagementService = new StaffManagementService();'''

emp_new = '''const router = Router();
const googleAuthService = new GoogleAuthService();
const employeeUtils = new EmployeeUtils();
const staffManagementService = new StaffManagementService();

// /active インメモリキャッシュ（TTL: 5分）
let activeEmployeesCache: { data: any[]; expiresAt: number } | null = null;
const ACTIVE_EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000;'''

apply_patch(EMPLOYEES_TS, emp_old, emp_new, 'employees.ts - active cache var')

emp_active_old = '''router.get('/active', async (req: Request, res: Response) => {
  try {
    // 有効な社員でメールアドレスが存在するものを取得
    const employees = await employeeUtils.getActiveEmployeesWithEmail();'''

emp_active_new = '''router.get('/active', async (req: Request, res: Response) => {
  try {
    // キャッシュ確認（5分TTL）
    if (activeEmployeesCache && Date.now() < activeEmployeesCache.expiresAt) {
      return res.json({ employees: activeEmployeesCache.data });
    }

    // 有効な社員でメールアドレスが存在するものを取得
    const employees = await employeeUtils.getActiveEmployeesWithEmail();'''

apply_patch(EMPLOYEES_TS, emp_active_old, emp_active_new, 'employees.ts - active cache read')

emp_active_return_old = '''    console.log(`Returning ${validEmployees.length} active employees (excluding GYOSHA users)`);
    res.json({ employees: validEmployees });'''

emp_active_return_new = '''    console.log(`Returning ${validEmployees.length} active employees (excluding GYOSHA users)`);
    activeEmployeesCache = { data: validEmployees, expiresAt: Date.now() + ACTIVE_EMPLOYEES_CACHE_TTL_MS };
    res.json({ employees: validEmployees });'''

apply_patch(EMPLOYEES_TS, emp_active_return_old, emp_active_return_new, 'employees.ts - active cache write')

# ============================================================
# 3. PropertyService.ts - getPropertyBySellerId キャッシュ
# ============================================================
PROPERTY_SVC = 'backend/src/services/PropertyService.ts'

prop_old = '''const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Service for managing property information'''

prop_new = '''const supabase = createClient(supabaseUrl, supabaseServiceKey);

// getPropertyBySellerId インメモリキャッシュ（TTL: 60秒）
const propertyBySellerCache = new Map<string, { data: any; expiresAt: number }>();
const PROPERTY_BY_SELLER_CACHE_TTL_MS = 60 * 1000;

/**
 * Service for managing property information'''

apply_patch(PROPERTY_SVC, prop_old, prop_new, 'PropertyService.ts - cache var')

prop_get_old = '''  async getPropertyBySellerId(sellerId: string, includeDeleted: boolean = false): Promise<PropertyInfo | null> {
    try {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('seller_id', sellerId);

      // propertiesテーブルにはdeleted_atカラムが存在しないためフィルターなし
      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error getting property by seller:', error);
        throw new Error(`Failed to get property by seller: ${error.message}`);
      }

      return this.mapToPropertyInfo(data);
    } catch (error) {
      console.error('Get property by seller error:', error);
      throw error;
    }
  }'''

prop_get_new = '''  async getPropertyBySellerId(sellerId: string, includeDeleted: boolean = false): Promise<PropertyInfo | null> {
    // キャッシュ確認（60秒TTL）
    const cacheEntry = propertyBySellerCache.get(sellerId);
    if (cacheEntry && Date.now() < cacheEntry.expiresAt) {
      return cacheEntry.data;
    }

    try {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('seller_id', sellerId);

      // propertiesテーブルにはdeleted_atカラムが存在しないためフィルターなし
      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          propertyBySellerCache.set(sellerId, { data: null, expiresAt: Date.now() + PROPERTY_BY_SELLER_CACHE_TTL_MS });
          return null;
        }
        console.error('Error getting property by seller:', error);
        throw new Error(`Failed to get property by seller: ${error.message}`);
      }

      const result = this.mapToPropertyInfo(data);
      propertyBySellerCache.set(sellerId, { data: result, expiresAt: Date.now() + PROPERTY_BY_SELLER_CACHE_TTL_MS });
      return result;
    } catch (error) {
      console.error('Get property by seller error:', error);
      throw error;
    }
  }

  invalidatePropertyBySellerCache(sellerId: string): void {
    propertyBySellerCache.delete(sellerId);
  }'''

apply_patch(PROPERTY_SVC, prop_get_old, prop_get_new, 'PropertyService.ts - cache read/write')

print('\n全パッチ適用完了')
