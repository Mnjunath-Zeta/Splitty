import { supabase } from './lib/supabase';

async function run() {
    const { data: session } = await supabase.auth.getSession();
    console.log('Session user:', session?.session?.user?.id);
    
    // Test friend insert
    const friendRes = await supabase.from('friends').insert({
        name: 'Test Friend',
        user_id: session?.session?.user?.id,
    });
    console.log('Friend insert result:', friendRes);
}
run();
