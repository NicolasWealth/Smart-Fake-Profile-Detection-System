import { createClient } from "@supabase/supabase-js"

const DEFAULT_SUPABASE_URL = "https://zoxmchlwfxnudopusksr.supabase.co"
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_QZ9pnITIaIclvMvaQup0lQ_90gx9OoK"

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL

const supabaseKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

export const supabase =
    supabaseUrl && supabaseKey
        ? createClient(
            supabaseUrl,
            supabaseKey
        )
        : null
