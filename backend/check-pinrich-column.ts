import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

supabase
  .from('buyers')
  .select('pinrich_500man_registration')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.log('ERROR:', error.message, error.code);
    } else {
      console.log('OK - column exists, data:', JSON.stringify(data));
    }
  });
