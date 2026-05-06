export default function KugiLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="8" height="8" rx="2" fill="white" fillOpacity="0.95"/>
      <rect x="11" y="1" width="8" height="8" rx="2" fill="white" fillOpacity="0.72"/>
      <rect x="1" y="11" width="8" height="8" rx="2" fill="white" fillOpacity="0.72"/>
      <rect x="11" y="11" width="8" height="8" rx="2" fill="white" fillOpacity="0.45"/>
    </svg>
  );
}
