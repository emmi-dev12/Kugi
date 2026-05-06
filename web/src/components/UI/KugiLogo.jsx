export default function KugiLogo({ size = 28 }) {
  const id = 'kg' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f7cff"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`}/>
      <rect x="5" y="5" width="10" height="10" rx="2.5" fill="white" fillOpacity="0.95"/>
      <rect x="17" y="5" width="10" height="10" rx="2.5" fill="white" fillOpacity="0.72"/>
      <rect x="5" y="17" width="10" height="10" rx="2.5" fill="white" fillOpacity="0.72"/>
      <rect x="17" y="17" width="10" height="10" rx="2.5" fill="white" fillOpacity="0.45"/>
    </svg>
  );
}
