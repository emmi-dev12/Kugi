import styles from './KugiMark.module.css';

// Unified logo + icon: handwritten lowercase "kugi" on a sage→slate tile.
// size: 'sm' | 'md' | 'lg'
export default function KugiMark({ size = 'md', className = '' }) {
  return (
    <span className={`${styles.mark} ${styles[size]} ${className}`} role="img" aria-label="kugi">
      kugi
    </span>
  );
}
