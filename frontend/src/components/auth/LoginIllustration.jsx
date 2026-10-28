// Decorative artwork with fictional rows; never renders application data.
export default function LoginIllustration() {
  return (
    <div className="login-illustration" aria-hidden="true">
      <svg viewBox="0 0 640 330" fill="none" focusable="false">
        <defs>
          <linearGradient id="uf-window" x1="100" y1="40" x2="540" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#284d80" /><stop offset="1" stopColor="#102d54" /></linearGradient>
          <linearGradient id="uf-float" x2="1" y2="1"><stop stopColor="#285d99" /><stop offset="1" stopColor="#153967" /></linearGradient>
          <radialGradient id="uf-glow"><stop stopColor="#167bff" stopOpacity=".35" /><stop offset="1" stopColor="#167bff" stopOpacity="0" /></radialGradient>
          <filter id="uf-shadow" x="-30%" y="-40%" width="170%" height="200%"><feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#020c20" floodOpacity=".45" /></filter>
        </defs>
        <ellipse cx="325" cy="190" rx="300" ry="138" fill="url(#uf-glow)" />
        <g stroke="#4784c2" strokeOpacity=".35">
          <ellipse cx="319" cy="197" rx="290" ry="106" transform="rotate(-13 319 197)" />
          <path d="M70 112C5 228 182 330 516 257M141 48C296-5 574 52 589 190" strokeDasharray="4 7" />
          <circle cx="103" cy="265" r="5" fill="#287ee3" /><circle cx="566" cy="99" r="4" fill="#287ee3" />
        </g>
        <g transform="translate(104 49) rotate(-7 218 112) skewX(3)" filter="url(#uf-shadow)">
          <rect width="438" height="235" rx="11" fill="url(#uf-window)" stroke="#6895c7" strokeOpacity=".5" />
          <path d="M0 30H438" stroke="#688eb8" strokeOpacity=".3" />
          <circle cx="15" cy="15" r="3" fill="#70a5db" /><circle cx="26" cy="15" r="3" fill="#517fae" /><circle cx="37" cy="15" r="3" fill="#406d9d" />
          <rect x="153" y="10" width="132" height="10" rx="5" fill="#0e284a" />
          <path d="M81 30V235" stroke="#6286b0" strokeOpacity=".25" />
          <rect x="13" y="45" width="20" height="20" rx="5" fill="#1379f7" />
          <path d="M19 50v6a4 4 0 0 0 8 0v-6" stroke="#c1e0ff" strokeWidth="2" />
          {[83, 111, 139, 167].map((y, i) => <g key={y}><rect x="10" y={y - 4} width="61" height="21" rx="4" fill={i === 0 ? '#2465b0' : 'transparent'} /><rect x="17" y={y + 2} width="8" height="8" rx="2" stroke="#94b8df" /><path d={`M33 ${y + 4}h26M33 ${y + 8}h18`} stroke="#94b8df" strokeWidth="2" /></g>)}
          <text x="100" y="56" fill="#e0edff" fontSize="12" fontFamily="Arial, sans-serif" fontWeight="700">Solicitudes de cambio</text>
          <rect x="359" y="43" width="61" height="17" rx="4" fill="#1678ee" /><path d="M367 51h5m-2.5-2.5v5M379 51h32" stroke="#d8ebff" strokeWidth="2" />
          {[100, 210, 320].map((x, i) => <g key={x}><rect x={x} y="72" width="100" height="39" rx="5" fill="#779ac0" fillOpacity=".1" /><rect x={x + 9} y="81" width="44" height="3" rx="1.5" fill="#8caed2" /><text x={x + 9} y="102" fill="#d6e9ff" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700">{['24', '08', '16'][i]}</text><path d={`M${x + 68} 99l7-6 5 3 10-11`} stroke="#429bff" strokeWidth="2" /></g>)}
          <rect x="100" y="124" width="320" height="19" rx="3" fill="#8aacd2" fillOpacity=".12" />
          <g fill="#a6c1df" fontSize="6" fontFamily="Arial, sans-serif"><text x="110" y="136">SOLICITUD</text><text x="254" y="136">ESTADO</text><text x="349" y="136">FECHA</text></g>
          {[157, 182, 207].map((y, i) => <g key={y}><rect x="110" y={y - 3} width="9" height="11" rx="2" stroke="#71a0cf" /><path d={`M128 ${y}h95M128 ${y + 6}h62M351 ${y + 2}h46`} stroke="#8cafcf" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" /><rect x="253" y={y - 4} width="63" height="14" rx="7" fill={['#245a92', '#245c68', '#5a5366'][i]} /><circle cx="261" cy={y + 3} r="2" fill={['#67b5ff', '#66d0be', '#ecc27f'][i]} /><path d={`M268 ${y + 3}h39`} stroke={['#94c9ff', '#98d8cb', '#e4cda5'][i]} strokeWidth="2" /><path d={`M100 ${y + 16}h320`} stroke="#7595b8" strokeOpacity=".15" /></g>)}
        </g>
        <g transform="translate(44 82) rotate(-12)" filter="url(#uf-shadow)"><rect width="62" height="73" rx="12" fill="url(#uf-float)" stroke="#568dc5" strokeOpacity=".6" /><path d="M20 18h16l9 9v28H20V18Zm16 0v10h9M26 36h13M26 42h13M26 48h8" stroke="#91c4ff" strokeWidth="2" strokeLinejoin="round" /></g>
        <g transform="translate(525 213) rotate(9)" filter="url(#uf-shadow)"><rect width="72" height="62" rx="12" fill="url(#uf-float)" stroke="#568dc5" strokeOpacity=".6" /><path d="M18 44h38M23 37V28m12 9V19m12 18V12" stroke="#79b9ff" strokeWidth="5" strokeLinecap="round" /></g>
        <g transform="translate(517 39) rotate(12)"><rect width="44" height="44" rx="12" fill="url(#uf-float)" stroke="#568dc5" strokeOpacity=".5" /><path d="m22 10 3 4 5 1 1 5 3 3-4 4-1 5-5 1-3 2-4-4-5-1-1-5-2-4 4-4 1-5 5-1Z" stroke="#89bfff" strokeWidth="1.5" /><circle cx="22" cy="23" r="5" stroke="#89bfff" strokeWidth="1.5" /></g>
      </svg>
    </div>
  )
}
