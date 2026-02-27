require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session user ID:', session?.user?.id);

    // Fallback: Just insert with a known UUID if session is null
    // Let's list users
    const { data: users, error: userErr } = await supabase.from('profiles').select('id').limit(1);
    const userId = session?.user?.id || users?.[0]?.id;
    console.log('Using User ID:', userId);

    if (!userId) {
        console.log('No user found');
        return;
    }

    console.log('Testing friend insert...');
    const friendRes = await supabase.from('friends').insert({
        name: 'Test Friend 123',
        user_id: userId,
    });
    console.log('Friend insert result:', JSON.stringify(friendRes, null, 2));

    console.log('Testing expense insert...');
    const expenseRes = await supabase.from('expenses').insert({
        description: 'Test Expense 123',
        amount: 10,
        payer_id: userId,
        created_by: userId,
        category: 'general'
    });
    console.log('Expense insert result:', JSON.stringify(expenseRes, null, 2));

}
run()
    .then(() => console.log('Done'))
    .catch(console.error);
