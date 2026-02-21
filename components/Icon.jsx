/**
 * Icon — Centralized SVG icon system from w14 prototypes.
 *
 * Usage:
 *   <Ic name="wallet" color="#34C759" size={32} r={9} />       — colored circle with icon
 *   <Ic name="wallet" color="#34C759" size={20} r={5} raw />   — just SVG, no background
 *
 * Props:
 *   name  — icon key (see PATHS below)
 *   color — background color (or stroke color in raw mode)
 *   size  — overall dimension (default 36)
 *   r     — border radius (default 10)
 *   raw   — if true, renders SVG only without circle/rect wrapper
 */

/* eslint-disable react/no-unknown-property */

const PATHS = {
  home: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
      <rect x="9" y="14" width="6" height="7" />
    </g>
  ),
  task: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 12l3 3 5-6" />
    </g>
  ),
  leaf: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 21c3-3 8-4 12-8 1-2 2-5 0-8-3-2-6-1-8 0C6 9 5 14 2 17" />
      <path d="M6 21c0-4 2-7 6-10" />
    </g>
  ),
  more: (
    <g fill="#fff" stroke="none">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </g>
  ),
  wallet: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="15" rx="2" />
      <path d="M17 10h3v4h-3a2 2 0 010-4z" fill="#fff" />
    </g>
  ),
  card: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </g>
  ),
  chart: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </g>
  ),
  trend: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
      <polyline points="16,7 22,7 22,13" />
    </g>
  ),
  mic: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0014 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </g>
  ),
  camera: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </g>
  ),
  food: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v5.5a2.5 2.5 0 005 0V3" />
      <line x1="8.5" y1="8.5" x2="8.5" y2="21" />
      <path d="M18 3v4c0 1.7-1.3 3-3 3" />
      <line x1="18" y1="10" x2="18" y2="21" />
    </g>
  ),
  gym: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M3 10v4" />
      <path d="M21 10v4" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </g>
  ),
  repeat: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17,1 21,5 17,9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7,23 3,19 7,15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </g>
  ),
  moon: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </g>
  ),
  drop: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </g>
  ),
  barcode: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
      <line x1="4" y1="4" x2="4" y2="20" />
      <line x1="8" y1="4" x2="8" y2="20" />
      <line x1="11" y1="4" x2="11" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
      <line x1="18" y1="4" x2="18" y2="20" />
      <line x1="21" y1="4" x2="21" y2="20" />
    </g>
  ),
  note: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </g>
  ),
  bell: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </g>
  ),
  flag: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </g>
  ),
  shield: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l7 4v5c0 5-3 9-7 11-4-2-7-6-7-11V6z" />
      <path d="M9 12l2 2 4-4" />
    </g>
  ),
  lock: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </g>
  ),
  percent: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </g>
  ),
  // Additional icons not in P but used in prototypes
  bot: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <circle cx="9" cy="14" r="1.5" fill="#fff" />
      <circle cx="15" cy="14" r="1.5" fill="#fff" />
      <line x1="12" y1="2" x2="12" y2="8" />
      <circle cx="12" cy="2" r="1.5" />
    </g>
  ),
  flame: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c4.97 0 8-3.58 8-8 0-4-2.5-6-4-8-1 2-2 3-4 3s-2.5-2-3-4c-2 3-5 5-5 9 0 4.42 3.03 8 8 8z" />
      <path d="M12 22c2 0 3-1.5 3-4 0-2-1-3-1.5-4-.5 1-1 1.5-1.5 1.5s-1-1-1.5-2c-1 1.5-1.5 2.5-1.5 4.5 0 2.5 1 4 3 4z" />
    </g>
  ),
  weight: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a4 4 0 00-4 4h8a4 4 0 00-4-4z" />
      <path d="M5 7h14l-1 14H6z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </g>
  ),
  transport: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14V6a2 2 0 00-2-2H7a2 2 0 00-2 2z" />
      <circle cx="8" cy="19" r="2" />
      <circle cx="16" cy="19" r="2" />
      <line x1="5" y1="10" x2="19" y2="10" />
    </g>
  ),
  cart: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </g>
  ),
  plus: (
    <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </g>
  ),
  check: (
    <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </g>
  ),
  chevron: (
    <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,18 15,12 9,6" />
    </g>
  ),
  gear: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </g>
  ),
  share: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16,6 12,2 8,6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </g>
  ),
  trash: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </g>
  ),
  edit: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </g>
  ),
  clock: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </g>
  ),
  calendar: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </g>
  ),
  star: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </g>
  ),
  archive: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21,8 21,21 3,21 3,8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </g>
  ),
  download: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </g>
  ),
  target: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </g>
  ),
  money: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </g>
  ),
  receipt: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </g>
  ),
  subscription: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </g>
  ),
  piggy: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 10c0-4-3.58-7-8-7S3 6 3 10c0 3 2 5.5 5 6.5V19h2v-2h4v2h2v-2.5c3-1 5-3.5 5-6.5z" />
      <line x1="11" y1="4" x2="11" y2="7" />
      <circle cx="8" cy="11" r="1" fill="#fff" />
    </g>
  ),
  sleep: (
    <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      <path d="M15 4h3l-3 4h3" />
      <path d="M18 8h2l-2 3h2" />
    </g>
  ),
};

export default function Ic({ name, color, size = 36, r = 10, raw = false, className = '' }) {
  const p = PATHS[name];
  const svgSize = Math.round(size * 0.52);

  if (!p) {
    if (raw) return null;
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: r,
          background: (color || '#999') + '20',
          flexShrink: 0,
        }}
      />
    );
  }

  if (raw) {
    return (
      <svg
        className={className}
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        style={{ flexShrink: 0 }}
      >
        {p}
      </svg>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 24 24">
        {p}
      </svg>
    </div>
  );
}
