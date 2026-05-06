export const CATEGORIES = {
  Work:      { color: '#4f7cff', emoji: '💼' },
  Personal:  { color: '#f59e0b', emoji: '🏠' },
  Health:    { color: '#10b981', emoji: '💪' },
  'Deep Work': { color: '#8b5cf6', emoji: '🧠' },
  Social:    { color: '#f43f5e', emoji: '🎉' },
  Admin:     { color: '#6b7280', emoji: '📋' },
  Creative:  { color: '#ec4899', emoji: '🎨' },
  Other:     { color: '#94a3b8', emoji: '✨' },
};

export const EMOJIS = ['💼','🧠','💪','🎉','📋','🎨','✈️','📚','☕','🏃','🍎','💡','🔥','⚡','🎯','🎵','🏠','🌿','💻','📞','🤝','💰','🎓','🛒'];

export function getColor(cat) {
  return (CATEGORIES[cat] || CATEGORIES.Other).color;
}

export function getCatEmoji(cat) {
  return (CATEGORIES[cat] || CATEGORIES.Other).emoji;
}

export function hexRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}
