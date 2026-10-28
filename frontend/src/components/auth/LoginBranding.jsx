export default function LoginBranding() {
  return (
    <div className="login-brand d-flex align-items-center">
      <svg className="brand-mark" width="29" height="29" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x=".5" y=".5" width="31" height="31" rx="7" fill="#101b30" stroke="#293449" />
        <path d="M9 10v8a7 7 0 0 0 14 0v-8M13 10v8a3 3 0 0 0 6 0v-5" stroke="#16a9f3" strokeWidth="2.7" strokeLinecap="round" />
      </svg>
      <div>
        <span className="brand-name">UtaFlow</span>
        <span className="brand-caption">ENTERPRISE RELEASE ORCHESTRATION</span>
      </div>
    </div>
  )
}
