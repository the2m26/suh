// qpay-create-invoice — Supabase Edge Function
// ⚠️ SCAFFOLD: Архитектур зөв (developer.qpay.mn-ийн бодит v2 endpoint-үүд ашигласан),
// гэхдээ ТАНАЙ бодит QPay мерчант эрх (username/password/invoice_code) байхгүй
// бол ажиллахгүй. Эдгээрийг QPay-тай гэрээ байгуулаад авна (info@qpay.mn эсвэл
// таны харилцдаг банк — QPay нь ихэвчлэн банкаар дамжиж мерчант эрх олгодог).
//
// Deploy хийхийн өмнө Supabase Dashboard → Edge Functions → Secrets-д тохируулах:
//   QPAY_BASE_URL       (sandbox: https://merchant-sandbox.qpay.mn, prod: https://merchant.qpay.mn)
//   QPAY_USERNAME
//   QPAY_PASSWORD
//   QPAY_INVOICE_CODE   (QPay-ээс олгосон invoice template код)
//   QPAY_CALLBACK_URL   (энэ project-ийн qpay-webhook function-ий бүрэн URL)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY автоматаар Edge Function-д өгөгддөг.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const QPAY_BASE = Deno.env.get('QPAY_BASE_URL') || 'https://merchant-sandbox.qpay.mn';

async function getQpayToken(): Promise<string> {
  const res = await fetch(`${QPAY_BASE}/v2/auth/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${Deno.env.get('QPAY_USERNAME')}:${Deno.env.get('QPAY_PASSWORD')}`),
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error('QPay auth амжилтгүй: ' + await res.text());
  const json = await res.json();
  return json.access_token;
}

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // ⚠️ req.headers.get('Authorization')-оор ирсэн JWT-г шалгаж, тухайн хэрэглэгч
    // үнэхээр тухайн apt/resident_id/business_id-д хамаарахыг баталгаажуулах
    // нэмэлт шалгалт бодит нэвтрүүлэлтэд заавал нэмэх ёстой (энд орхигдсон —
    // scaffold дотор anon хэн ч дурын дүн эвлэрсэн байгаа мэт invoice үүсгэж болзошгүй).
    const { residentId, businessId, apt, month, year, amount } = await req.json();
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Дүн буруу байна' }), { status: 400, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: intent, error: insErr } = await supabase.from('payment_intents').insert({
      resident_id: residentId || null,
      business_id: businessId || null,
      apt: apt || null,
      month, year, amount,
      status: 'pending',
    }).select().single();
    if (insErr) throw insErr;

    const token = await getQpayToken();
    const callbackUrl = `${Deno.env.get('QPAY_CALLBACK_URL')}?intent_id=${intent.id}`;
    const invoiceRes = await fetch(`${QPAY_BASE}/v2/invoice`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_code: Deno.env.get('QPAY_INVOICE_CODE'),
        sender_invoice_no: String(intent.id),
        invoice_receiver_code: apt || 'terminal',
        invoice_description: `${apt || ''} — ${month}-р сарын СӨХ төлбөр`.trim(),
        amount,
        callback_url: callbackUrl,
      }),
    });
    if (!invoiceRes.ok) throw new Error('QPay invoice үүсгэхэд алдаа: ' + await invoiceRes.text());
    const invoice = await invoiceRes.json();

    await supabase.from('payment_intents').update({
      qpay_invoice_id: invoice.invoice_id,
      qpay_qr_text: invoice.qr_text,
      qpay_qr_image: invoice.qr_image,
    }).eq('id', intent.id);

    return new Response(JSON.stringify({
      intentId: intent.id,
      qrText: invoice.qr_text,
      qrImage: invoice.qr_image,   // base64 PNG — <img src="data:image/png;base64,...">
      urls: invoice.urls || [],    // банк аппны deeplink-үүд
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('qpay-create-invoice error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
