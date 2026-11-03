import { useState } from "react";
import { fmtMoney, fmtShort } from "../api.js";

// Simple responsive SVG bar chart. data = [{ label, value, full }]
export default function BarChart({ data, color = "#C77700", onPick }) {
  const [sel, setSel] = useState(null);
  const W = 600, H = 170, top = 18;
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = W / data.length;
  const dense = data.length > 12;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + top + 22}`} className="w-full" role="img">
        {data.map((d, i) => {
          const h = (d.value / max) * H;
          const x = i * bw;
          return (
            <g key={i} onClick={() => { setSel(i); onPick?.(d, i); }} className="cursor-pointer">
              <rect x={x} y={0} width={bw} height={H + top + 22} fill="transparent" />
              <rect x={x + bw * 0.15} y={top + H - h} width={bw * 0.7} height={Math.max(h, 2)} rx="3"
                fill={d.value ? color : "#12263A22"} opacity={sel === null || sel === i ? 1 : 0.45} />
              {!dense && d.value > 0 && <text x={x + bw / 2} y={top + H - h - 5} textAnchor="middle" fontSize="12" fontWeight="600" fill="#12263A">{fmtShort(d.value)}</text>}
              {(!dense || i % 5 === 0 || i === data.length - 1) && <text x={x + bw / 2} y={top + H + 16} textAnchor="middle" fontSize="11" fill="#12263A99">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <p className="h-5 text-center text-sm font-semibold text-ink/70">
        {sel !== null ? `${data[sel].full || data[sel].label}: ${fmtMoney(data[sel].value)}` : "Tap a bar to see the amount"}
      </p>
    </div>
  );
}
