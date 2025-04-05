import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gftsfjfgnlbklfrqktqm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdHNmamZnbmxia2xmcnFrdHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MjU1MDMsImV4cCI6MjA1OTQwMTUwM30.ySCKV1zfkqPQYOThEd9ADtNpnDHGDcDCoN8ZqQ1hZpE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
