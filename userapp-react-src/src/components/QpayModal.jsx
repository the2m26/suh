import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';

// ⚠️ userapp.html-ийн openQpayModal()-той ЯГ ИЖИЛ логик — Edge Function
// (qpay-create-invoice), realtime сонсох + 5 секундын polling fallback.
export default function QpayModal({ amount, apt, residentId, missingMonths, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error | paid
  const [qrImage, setQrImage] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const channelRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await sb.functions.invoke('qpay-create-invoice', {
        body: { residentId, businessId: null, apt, month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount, monthsCovered: missingMonths },
      });
      if (cancelled) return;
      if (error || !data || data.error) {
        setStatus('error');
        setErrMsg((data && data.error) || error?.message || 'алдаа');
        return;
      }
      setQrImage(data.qrImage);
      setStatus('ready');

      channelRef.current = sb.channel('qpay-intent-' + data.intentId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_intents', filter: `id=eq.${data.intentId}` }, (payload) => {
          if (payload.new.status === 'paid') handlePaid();
        })
        .subscribe();

      pollRef.current = setInterval(async () => {
        const { data: intent } = await sb.from('payment_intents').select('status').eq('id', data.intentId).maybeSingle();
        if (intent && intent.status === 'paid') handlePaid();
      }, 5000);
    })();

    function handlePaid() {
      clearInterval(pollRef.current);
      if (channelRef.current) { sb.removeChannel(channelRef.current); channelRef.current = null; }
      setStatus('paid');
      setTimeout(onClose, 1800);
    }

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
      if (channelRef.current) sb.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="qpay-modal">
        <button className="icon-btn" style={{ float: 'right' }} onClick={onClose}>✕</button>
        {status === 'loading' && <div className="pool-empty">QR үүсгэж байна...</div>}
        {status === 'error' && <div className="pool-empty">QPay үйлчилгээ идэвхжээгүй байна.<br />({errMsg})</div>}
        {(status === 'ready' || status === 'paid') && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{amount.toLocaleString()}₮</div>
            <img src={`data:image/png;base64,${qrImage}`} alt="QPay QR" style={{ width: 220, height: 220, borderRadius: 12, marginBottom: 12 }} />
            <div className="pool-empty">
              {status === 'paid' ? '✓ Төлбөр амжилттай орлоо!' : 'Банкны аппаараа уншуулна уу — төлбөр орж ирэнгүүт автоматаар шинэчлэгдэнэ'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
