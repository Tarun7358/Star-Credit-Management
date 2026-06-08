const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    const r1 = await supabase.from('users').select('*');
    console.log('Users count:', r1.data?.length, 'error:', r1.error);
    if (r1.data) {
      console.log('Users:', r1.data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testConnection();
