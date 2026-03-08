import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aqtcewdowqzutqdgbwui.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdGNld2Rvd3F6dXRxZGdid3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODY2OTEsImV4cCI6MjA4ODU2MjY5MX0.xf0mKOuOCwiwXRcpPE517uHIMdHpJpFZcsiJS-LhwGU'

export const supabase = createClient(supabaseUrl, supabaseKey)