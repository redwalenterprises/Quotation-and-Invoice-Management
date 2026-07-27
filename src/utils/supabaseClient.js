import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bapwlraardldjoymfoly.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcHdscmFhcmRsZGpveW1mb2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDU3MjUsImV4cCI6MjEwMDcyMTcyNX0.FqJu-i0sCJnMiJjVTtYKdA2JNX3O8_AS5T_9_l37cpk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);