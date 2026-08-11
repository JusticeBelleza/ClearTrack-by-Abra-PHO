import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Required for the frontend to be able to talk to this function without CORS errors
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize the Admin client securely inside the Edge Function
    // The Edge environment automatically provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse the payload sent from your React frontend
    const { email, password, name, emp_id, department, designation, contactNumber } = await req.json()

    // 2. Create the user in Auth Admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    })

    if (authError) throw authError

    const userId = authData.user.id

    // 3. Insert into the public employees directory
    const { error: dirError } = await supabaseAdmin.from('employees').insert([{
      emp_id,
      name,
      email,
      designation,
      department,
      contact_number: contactNumber
    }])

    if (dirError) throw dirError

    // 4. Guarantee the profile is created and fully synced
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: name,
      emp_id,
      department,
      designation,
      contact_number: contactNumber,
      role: 'pho_staff'
    })

    if (profileError) throw profileError

    // 5. Fetch the inserted employee record to return to the frontend for state updates
    const { data: newEmployee } = await supabaseAdmin.from('employees').select('*').eq('emp_id', emp_id).single()

    // Send back success and the newly created employee
    return new Response(
      JSON.stringify({ success: true, employee: newEmployee }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})