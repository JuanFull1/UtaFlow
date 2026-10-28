const paths = {
  at: <><circle cx="12" cy="12" r="4" /><path d="M16 8v6a2 2 0 0 0 4 0v-2a8 8 0 1 0-3.1 6.3" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4.2M6.3 6.3A19 19 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.7-1.5M10 10a3 3 0 0 0 4 4" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  sso: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="M12 3v18M4 10h8" /></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  badge: <><path d="m12 2 3 2 3.5.5.8 3.5 2 3-2 3-.8 3.5L15 18l-3 3-3-3-3.5-.5-.8-3.5-2-3 2-3 .8-3.5L9 4l3-2Z" /><path d="m8 11 3 3 5-5" /></>,
  trace: <path d="m4 16 5-5 4 3 7-9M15 5h5v5" />,
  list: <><rect x="5" y="4" width="15" height="17" rx="2" /><path d="M9 2v4M9 10h7M9 14h7M9 18h4" /></>,
  layers: <path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" />,
}

export default function AuthIcon({ name, className = '' }) {
  return (
    <svg className={`auth-icon ${className}`} width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
