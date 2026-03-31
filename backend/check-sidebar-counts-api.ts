/**
 * サイドバーカウントAPIのレスポンスを確認するスクリプト
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function main() {
  console.log('=== サイドバーカウントAPIのレスポンス確認 ===\n');

  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  console.log(`API URL: ${baseURL}/api/sellers/sidebar-counts\n`);

  try {
    const response = await axios.get(`${baseURL}/api/sellers/sidebar-counts`);
    const data = response.data;

    console.log('【レスポンス】');
    console.log(JSON.stringify(data, null, 2));
    console.log();

    console.log('【当日TEL（担当）のカウント】');
    console.log(`todayCallAssigned（全体）: ${data.todayCallAssigned}件`);
    console.log();

    console.log('【担当者別カウント（todayCallAssignedCounts）】');
    if (data.todayCallAssignedCounts) {
      Object.entries(data.todayCallAssignedCounts).forEach(([assignee, count]) => {
        console.log(`  ${assignee}: ${count}件`);
      });
    } else {
      console.log('  （データなし）');
    }
    console.log();

    console.log('【担当者別カウント（visitAssignedCounts）】');
    if (data.visitAssignedCounts) {
      Object.entries(data.visitAssignedCounts).forEach(([assignee, count]) => {
        console.log(`  ${assignee}: ${count}件`);
      });
    } else {
      console.log('  （データなし）');
    }
    console.log();

    console.log('=== 分析 ===');
    if (data.todayCallAssignedCounts && data.todayCallAssignedCounts['I']) {
      console.log(`サイドバーに表示されるべき「当日TEL(I)」のカウント: ${data.todayCallAssignedCounts['I']}件`);
    } else {
      console.log('「I」の担当者別カウントが見つかりません');
    }
  } catch (error: any) {
    console.error('エラー:', error.message);
    if (error.response) {
      console.error('ステータス:', error.response.status);
      console.error('レスポンス:', error.response.data);
    }
  }
}

main().catch(console.error);
