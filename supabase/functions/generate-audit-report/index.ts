// supabase/functions/generate-audit-report/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument } from 'https://esm.sh/pdf-lib'; // Heavy library runs purely on server

serve(async (req) => {
  // 1. Authenticate the request via the Authorization header
  const authHeader = req.headers.get('Authorization')!;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { document_id } = await req.json();

  // 2. Fetch the sealed document and its full routing history
  const { data: timeline, error } = await supabase
    .from('routing_logs')
    .select(`*, destination_offices(office_name)`)
    .eq('document_id', document_id)
    .order('handed_over_at', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: 'Unauthorized or Not Found' }), { status: 403 });

  // 3. Generate the PDF Document natively on the server
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.drawText(`Audit Trail for Document ID: ${document_id}`, { x: 50, y: 800 });
  
  // (Loop through timeline to draw routing steps and fetch/embed signature images...)

  const pdfBytes = await pdfDoc.save();

  // 4. Return the generated PDF directly to the frontend
  return new Response(pdfBytes, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="audit.pdf"' },
  });
});