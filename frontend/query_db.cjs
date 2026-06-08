const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    const { data: clients, error: err1 } = await supabase.from('clients').select('count', { count: 'exact', head: true });
    console.log('Clients count:', clients, err1);

    const { data: leads, error: err2 } = await supabase.from('leads').select('count', { count: 'exact', head: true });
    console.log('Leads count:', leads, err2);

    const { data: tasks, error: err3 } = await supabase.from('tasks').select('count', { count: 'exact', head: true });
    console.log('Tasks count:', tasks, err3);

    const { data: disputes, error: err4 } = await supabase.from('disputes').select('count', { count: 'exact', head: true });
    console.log('Disputes count:', disputes, err4);
  } catch (error) {
    console.error('Error:', error);
  }
}

testConnection();
