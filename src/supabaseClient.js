import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cjyazdguqagzaieyhols.supabase.co'
const supabaseAnonKey = 'sb_publishable_cKEwQ7m8S2pAD-BggJHyWA_js3geVyU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)