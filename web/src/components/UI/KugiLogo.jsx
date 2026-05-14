export default function KugiLogo({ size = 28 }) {
  const uid = 'kl' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Background */}
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#182a1e"/>
          <stop offset="100%" stopColor="#0c110e"/>
        </linearGradient>

        {/* Spine — top-to-bottom, bright sage → deep moss */}
        <linearGradient id={`${uid}-spine`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#8fc49f"/>
          <stop offset="100%" stopColor="#3d5c47"/>
        </linearGradient>

        {/* Upper arm — inner-to-outer */}
        <linearGradient id={`${uid}-ua`} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#4a7358"/>
          <stop offset="100%" stopColor="#78ae8a"/>
        </linearGradient>

        {/* Lower arm — inner-to-outer, slightly cooler */}
        <linearGradient id={`${uid}-la`} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#3d5c47"/>
          <stop offset="100%" stopColor="#5d8a6a"/>
        </linearGradient>

        {/* Ambient glow top-left */}
        <radialGradient id={`${uid}-glow`} cx="10" cy="8" r="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#5d8a6a" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#5d8a6a" stopOpacity="0"/>
        </radialGradient>

        <clipPath id={`${uid}-clip`}>
          <rect width="32" height="32" rx="8"/>
        </clipPath>
      </defs>

      {/* Base */}
      <rect width="32" height="32" rx="8" fill={`url(#${uid}-bg)`}/>

      <g clipPath={`url(#${uid}-clip)`}>
        <rect width="32" height="32" fill={`url(#${uid}-glow)`}/>

        {/*
          K from 3 bento blocks:
          - Both arms pivot from (10, 16), the midpoint of the spine's right edge
          - Rect is centered at y=16 (y = 16 - h/2 = 13.5), starts at x=9.5
          - Upper arm: rotate -35°  →  tip reaches approx (23.6, 6.6)
          - Lower arm: rotate +35°  →  tip reaches approx (23.6, 25.4)
          Draw order: lower → upper → spine (spine sits proudly on top)
        */}

        {/* Lower arm block */}
        <rect
          x="9.5" y="13.5" width="17" height="5" rx="2.2"
          fill={`url(#${uid}-la)`}
          transform="rotate(35 10 16)"
        />

        {/* Upper arm block */}
        <rect
          x="9.5" y="13.5" width="17" height="5" rx="2.2"
          fill={`url(#${uid}-ua)`}
          transform="rotate(-35 10 16)"
        />

        {/* Spine block — sits on top, covering the arm roots for a clean junction */}
        <rect
          x="5" y="5" width="5.5" height="22" rx="2.5"
          fill={`url(#${uid}-spine)`}
        />
        {/* Specular top-edge sheen on spine */}
        <rect
          x="5" y="5" width="5.5" height="3" rx="2.5"
          fill="white" fillOpacity="0.15"
        />

        {/* Hairline outer border */}
        <rect
          x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25"
          stroke="white" strokeOpacity="0.08" strokeWidth="1" fill="none"
        />
      </g>
    </svg>
  );
}
