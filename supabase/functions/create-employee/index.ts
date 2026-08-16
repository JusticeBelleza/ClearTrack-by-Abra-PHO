import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Initialize the Admin client securely using the Service Role Key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, name, emp_id, department, designation, contactNumber } = await req.json()

    // 1. Check if Employee ID already exists in your employees table
    const { data: existingEmp, error: empCheckError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('emp_id', emp_id)
      .maybeSingle()

    if (empCheckError) throw empCheckError

    if (existingEmp) {
      return new Response(
        JSON.stringify({ error: "Employee ID has already been registered." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Create User in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    })

    if (authError) {
      let errorMessage = authError.message;
      // Catch Supabase's default duplicate email error and make it user-friendly
      if (errorMessage.toLowerCase().includes('already registered') || errorMessage.toLowerCase().includes('already exists')) {
        errorMessage = "Email has already been registered.";
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Insert into employees directory table
    const { error: dbError } = await supabaseAdmin
      .from('employees')
      .insert([{
        id: authData.user.id,
        emp_id: emp_id,
        name: name,
        email: email,
        department: department,
        designation: designation,
        contact_number: contactNumber || null
      }])

    if (dbError) {
      // Rollback auth user creation if directory insert fails so we don't have ghost accounts
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    // Success!
    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})