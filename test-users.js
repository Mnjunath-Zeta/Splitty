require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

    console.log('Profiles count:', count);
    console.log('Profiles error:', error);

    const { data: users } = await supabase.from('profiles').select().limit(5);
    console.log('Sample profiles:', users);
}
run();
