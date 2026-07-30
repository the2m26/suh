import { useRef, useState } from 'react';

const SPRING = 'transform .55s cubic-bezier(.2,1.1,.25,1)';

// Доод самбар — swipe/чирэх дэмждэг (pointer capture-аар индикаторыг чирж болно)
export default function TabBar({ tabs, active, onChange }) {
  const trackRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startIndex = useRef(0);
  const count = tabs.length;
  const visualIndex = dragging && dragIndex !== null ? dragIndex : active;

  function onPointerDown(e) {
    if (!trackRef.current) return;
    trackRef.current.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startIndex.current = active;
    setDragIndex(active);
    setDragging(true);
  }
  function onPointerMove(e) {
    if (!dragging || !trackRef.current) return;
    const tabWidth = trackRef.current.getBoundingClientRect().width / count;
    const delta = (e.clientX - startX.current) / tabWidth;
    let next = startIndex.current + delta;
    if (next < 0) next *= 0.3;
    if (next > count - 1) next = count - 1 + (next - (count - 1)) * 0.3;
    setDragIndex(next);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    const rounded = Math.max(0, Math.min(count - 1, Math.round(dragIndex)));
    setDragIndex(null);
    if (rounded !== active) onChange(rounded);
  }

  return (
    <nav className="tab-bar" ref={trackRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="tab-indicator" style={{ transform: `translateX(${visualIndex * 100}%)`, transition: dragging ? 'none' : SPRING }} />
      {tabs.map((t, i) => (
        <button key={t.key} className={`tab-btn ${active === i ? 'active' : ''}`} onClick={() => !dragging && onChange(i)}>
          {t.icon}{t.label}
        </button>
      ))}
    </nav>
  );
}
