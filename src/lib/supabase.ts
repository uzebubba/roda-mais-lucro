import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qwjfimrqpomeqlsrquej.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)