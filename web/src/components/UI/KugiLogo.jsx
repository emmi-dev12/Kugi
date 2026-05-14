export default function KugiLogo({ size = 28 }) {
  const uid = 'kl' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Base background gradient — dark forest to deep sage */}
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1a2e22"/>
          <stop offset="100%" stopColor="#0c1610"/>
        </linearGradient>

        {/* Specular radial — subtle sage glow top-left */}
        <radialGradient id={`${uid}-glow`} cx="8" cy="6" r="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#5d8a6a" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#5d8a6a" stopOpacity="0"/>
        </radialGradient>

        {/* Block fills — sage with varying depth */}
        <linearGradient id={`${uid}-b1`} x1="5" y1="5" x2="16" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#6fa07d"/>
          <stop offset="100%" stopColor="#4a7358"/>
        </linearGradient>
        <linearGradient id={`${uid}-b2`} x1="18" y1="5" x2="27" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#3d5c47" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#2c3a32" stopOpacity="0.7"/>
        </linearGradient>
        <linearGradient id={`${uid}-b3`} x1="5" y1="18" x2="12" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#3d5c47" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#2c3a32" stopOpacity="0.5"/>
        </linearGradient>
        <linearGradient id={`${uid}-b4`} x1="18" y1="18" x2="27" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#4a7358" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#2c3a32" stopOpacity="0.3"/>
        </linearGradient>

        {/* Top-edge specular highlight */}
        <linearGradient id={`${uid}-spec`} x1="4" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="white" stopOpacity="0"/>
          <stop offset="40%"  stopColor="white" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>

        <clipPath id={`${uid}-clip`}>
          <rect width="32" height="32" rx="8"/>
        </clipPath>
      </defs>

      {/* Base */}
      <rect width="32" height="32" rx="8" fill={`url(#${uid}-bg)`}/>

      <g clipPath={`url(#${uid}-clip)`}>
        {/* Glow layer */}
        <rect width="32" height="32" fill={`url(#${uid}-glow)`}/>

        {/* Grid gap lines (subtle) */}
        <line x1="15.5" y1="4" x2="15.5" y2="28" stroke="#1a2e22" strokeWidth="1.5"/>
        <line x1="4" y1="15.5" x2="28" y2="15.5" stroke="#1a2e22" strokeWidth="1.5"/>

        {/* Block TL — brightest, "today" highlight */}
        <rect x="5" y="5" width="9" height="9" rx="2" fill={`url(#${uid}-b1)`}/>
        {/* Inner specular on TL block */}
        <rect x="5" y="5" width="9" height="2.5" rx="2" fill="white" fillOpacity="0.12"/>

        {/* Block TR */}
        <rect x="17" y="5" width="10" height="9" rx="2" fill={`url(#${uid}-b2)`}/>

        {/* Block BL */}
        <rect x="5" y="17" width="9" height="10" rx="2" fill={`url(#${uid}-b3)`}/>

        {/* Block BR */}
        <rect x="17" y="17" width="10" height="10" rx="2" fill={`url(#${uid}-b4)`}/>

        {/* Specular top edge on whole icon */}
        <rect x="0" y="0" width="32" height="1.5" rx="0" fill={`url(#${uid}-spec)`}/>

        {/* Outer border ring (hairline) */}
        <rect x="0.5" y="0.5" width="31" height="31" rx="7.5"
              stroke="white" strokeOpacity="0.1" strokeWidth="1" fill="none"/>
      </g>
    </svg>
  );
}
