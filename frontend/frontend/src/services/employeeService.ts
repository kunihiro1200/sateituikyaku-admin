import api from './api';

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string;
}

interface EmployeeCache {
  data: Employee[];
  timestamp: number;
}

// キャッシュの有効期限: 5分
const CACHE_DURATION = 5 * 60 * 1000;
const CACHE_KEY = 'employees_cache';

/**
 * 有効な社員一覧を取得（キャッシュ付き）
 */
export const getActiveEmployees = async (): Promise<Employee[]> => {
  try {
    // キャッシュを確認
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp }: EmployeeCache = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.log('✅ Using cached employee data');
          return data;
        }
        console.log('⏰ Cache expired, fetching fresh data');
      } catch (error) {
        console.error('❌ Error parsing cached data:', error);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    // APIから取得
    console.log('📡 Fetching active employees from API');
    const response = await api.get<{ employees: Employee[] }>('/api/employees/active');
    const employees = response.data.employees;

    // キャッシュに保存
    const cacheData: EmployeeCache = {
      data: employees,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

    console.log(`✅ Fetched ${employees.length} active employees`);
    return employees;
  } catch (error) {
    console.error('❌ Error fetching active employees:', error);
    
    // エラー時はデフォルトアドレスのみ返す
    return [];
  }
};

/**
 * キャッシュをクリア
 */
export const clearEmployeeCache = (): void => {
  localStorage.removeItem(CACHE_KEY);
  console.log('🗑️ Employee cache cleared');
};
