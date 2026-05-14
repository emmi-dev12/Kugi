export default function KugiLogo({ size = 28 }) {
  const uid = 'kl' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Background: deep forest → near-black */}
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#18271e"/>
          <stop offset="100%" stopColor="#0b100d"/>
        </linearGradient>

        {/* K stroke gradient: bright sage tip → deep moss base */}
        <linearGradient id={`${uid}-k`} x1="9" y1="5" x2="23" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#90c4a0"/>
          <stop offset="55%"  stopColor="#5d8a6a"/>
          <stop offset="100%" stopColor="#3a5e46"/>
        </linearGradient>

        {/* Accent block gradient */}
        <linearGradient id={`${uid}-accent`} x1="18" y1="17" x2="24" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#5d8a6a" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#2c3a32" stopOpacity="0.35"/>
        </linearGradient>

        {/* Soft center glow */}
        <radialGradient id={`${uid}-glow`} cx="11" cy="10" r="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#5d8a6a" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#5d8a6a" stopOpacity="0"/>
        </radialGradient>

        <clipPath id={`${uid}-clip`}>
          <rect width="32" height="32" rx="8"/>
        </clipPath>
      </defs>

      {/* Background */}
      <rect width="32" height="32" rx="8" fill={`url(#${uid}-bg)`}/>

      <g clipPath={`url(#${uid}-clip)`}>
        {/* Ambient glow */}
        <rect width="32" height="32" fill={`url(#${uid}-glow)`}/>

        {/* ── K lettermark ── */}
        {/* Vertical spine */}
        <line
          x1="10" y1="5.5"
          x2="10" y2="26.5"
          stroke={`url(#${uid}-k)`}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Upper arm */}
        <line
          x1="10.5" y1="15.5"
          x2="24"   y2="5.5"
          stroke={`url(#${uid}-k)`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Lower arm */}
        <line
          x1="10.5" y1="15.5"
          x2="24"   y2="26.5"
          stroke={`url(#${uid}-k)`}
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* ── Accent block (bento nod, floats in lower-right negative space) ── */}
        <rect
          x="18.5" y="17.5" width="5.5" height="5.5" rx="1.5"
          fill={`url(#${uid}-accent)`}
          stroke="rgba(93,138,106,0.25)"
          strokeWidth="0.75"
        />

        {/* Hairline border */}
        <rect
          x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25"
          stroke="white" strokeOpacity="0.09" strokeWidth="1" fill="none"
        />
      </g>
    </svg>
  );
}
