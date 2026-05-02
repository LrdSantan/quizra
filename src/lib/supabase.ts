import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if variables are valid URLs/Keys rather than placeholders
const isValid = supabaseUrl && 
               supabaseUrl.startsWith('http') && 
               !supabaseUrl.includes('YOUR_SUPABASE_URL');

export const supabase = isValid
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder-project.supabase.co', 'placeholder-key');

