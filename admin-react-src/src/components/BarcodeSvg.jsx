import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

// assets.js-ийн _assetBarcodeSvg() (мөр ~7) — Code128 barcode SVG дүрслэл,
// хэрэглэгчийн 2026-08-06 зөвшөөрлөөр React рүү портлогдов. JsBarcode-г
// npm package-аар (CDN биш) ашиглав.
export default function BarcodeSvg({ value, height = 40 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!value || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128', displayValue: false, margin: 0,
        height, width: 1.4, background: 'transparent', lineColor: '#E2E8F0',
      });
    } catch (e) {
      console.error('barcode үүсгэхэд алдаа:', e);
    }
  }, [value, height]);

  if (!value) return null;
  return <svg ref={svgRef} />;
}
