import { EmployeeUtils } from './backend/src/utils/employeeUtils';

(async () => {
  const employeeUtils = new EmployeeUtils();
  
  console.log('=== テスト1: イニシャル「K」で検索 ===');
  const result1 = await employeeUtils.getEmployeeByInitials('K');
  console.log('結果:', result1);
  
  console.log('\n=== テスト2: 名前「国広」で検索 ===');
  const result2 = await employeeUtils.getEmployeeByInitials('国広');
  console.log('結果:', result2);
  
  console.log('\n=== テスト3: イニシャル「I」で検索 ===');
  const result3 = await employeeUtils.getEmployeeByInitials('I');
  console.log('結果:', result3);
  
  console.log('\n=== テスト4: 名前「角井」で検索 ===');
  const result4 = await employeeUtils.getEmployeeByInitials('角井');
  console.log('結果:', result4);
})();
