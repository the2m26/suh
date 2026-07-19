// qpay-webhook — Supabase Edge Function
// QPay нь хэрэглэгч төлбөрөө хийсний дараа энэ URL руу callback дуудна
// (QPAY_CALLBACK_URL, qpay-create-invoice-д бүртгэсэн). ⚠️ Webhook body-г
// шууд итгэж болохгүй — ЗААВАЛ /v2/payment/check-ээр QPay-ээс дахин
// баталгаажуулна (доор хийсэн шиг), эс бол хуурамч дуудлагаар "төлсөн" гэж
// хуурах боломжтой.

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
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const intentId = url.searchParams.get('intent_id');
    if (!intentId) return new Response('missing intent_id', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: intent } = await supabase.from('payment_intents').select('*').eq('id', intentId).maybeSingle();
    if (!intent) return new Response('intent not found', { status: 404 });
    if (intent.status === 'paid') return new Response('already processed'); // давхар webhook-оос сэргийлэх

    const token = await getQpayToken();
    const checkRes = await fetch(`${QPAY_BASE}/v2/payment/check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_type: 'INVOICE', object_id: intent.qpay_invoice_id }),
    });
    const checkData = await checkRes.json();
    const paidRow = checkData?.rows?.find((r: any) => r.payment_status === 'PAID');
    if (!paidRow) return new Response('not paid yet');

    await supabase.from('payment_intents').update({
      status: 'paid', paid_at: new Date().toISOString(), qpay_payment_id: paidRow.payment_id,
    }).eq('id', intentId);

    // ⚠️ Бодит transactions мөр — suh.html-ийн "Гүйлгээний бүртгэл"/НББ-д шууд орно.
    // Энд accounting-bridge.js-ийн create_journal_entry()-той адил ЖУРНАЛ БИЧИЛТ хийх
    // логикийг ч (эсвэл харгалзах RPC дуудлагыг) нэмж холбох шаардлагатай — одоохондоо
    // зөвхөн transactions мөр vvсгэж байгаа тул НББ-той бүрэн уялдуулахын тулд
    // Клод/хөгжүүлэгчтэй хамт accountingRecordResidentPayment()-тэй адилтгах алхам үлдсэн.
    await supabase.from('transactions').insert({
      apt: intent.apt,
      type: 'income',
      category: intent.business_id ? 'business' : 'resident',
      amount: intent.amount,
      method: 'qpay',
      month: intent.month, year: intent.year,
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '/'),
      status: 'completed',
      desc: 'QPay онлайн төлбөр',
    });

    return new Response('OK');
  } catch (e) {
    console.error('qpay-webhook error:', e);
    return new Response('error: ' + e.message, { status: 500 });
  }
});
