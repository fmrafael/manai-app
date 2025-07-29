import { createClient } from '@supabase/supabase-js';

const supabaseUrl ='https://kergucfvtfqpikeimsxm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlcmd1Y2Z2dGZxcGlrZWltc3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NjQwNjcsImV4cCI6MjA2OTA0MDA2N30.1CHOETiravMxmU_YfXDairVfBDtITfPJCnEE51WquvU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
