import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ackmedbeslsqdikcfazm.supabase.co"
const supabaseKey = "sb_publishable_7w0CyzhQ0oGJqvL8xNsGCQ_XYZ7yRPW"
export const supabase = createClient(supabaseUrl, supabaseKey)
