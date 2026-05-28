import React, { useState, useEffect } from 'react';

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function KioskClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const spTime = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const spDate = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' });

  const [h, m] = spTime.split(':');

  return (
    <div className="text-center select-none">
      <p className="text-white/50 text-lg mb-1 capitalize">{spDate}</p>
      <div className="flex items-center justify-center gap-1">
        <span className="text-white font-bold drop-shadow-lg" style={{ fontSize: 'clamp(56px, 12vw, 80px)', lineHeight: 1 }}>{h}</span>
        <span className="text-white/60 font-thin" style={{ fontSize: 'clamp(48px, 10vw, 68px)', lineHeight: 1 }}>:</span>
        <span className="text-white font-bold drop-shadow-lg" style={{ fontSize: 'clamp(56px, 12vw, 80px)', lineHeight: 1 }}>{m}</span>
      </div>
    </div>
  );
}
