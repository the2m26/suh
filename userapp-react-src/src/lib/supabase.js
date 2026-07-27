import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndbhgzohmjumicziefnr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYmhnem9obWp1bWljemllZm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTE3OTYsImV4cCI6MjA5OTQyNzc5Nn0.6iDl7omVwM4_cp5zRFE-2lnl_Y6CBgTWO6JUPxmqu-g';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
