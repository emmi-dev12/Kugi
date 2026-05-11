import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { parseQuickAdd } from '../../utils/parseQuickAdd';
import styles from './QuickAdd.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPreviewDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAYS[d.getDay()]} ${day} ${MONTHS[month - 1]}`;
}

const QuickAdd = forwardRef(function QuickAdd({ onAdd, defaultDate }, ref) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus();
    },
  }));

  const parsed = value.trim() ? parseQuickAdd(value, defaultDate || new Date()) : null;

  function getPreview() {
    if (!parsed) return null;
    let label = formatPreviewDate(parsed.date);
    if (parsed.start_time) {
      label += ` · ${parsed.start_time}`;
      if (parsed.end_time) label += `–${parsed.end_time}`;
    }
    return label;
  }

  function submit() {
    if (!parsed || !parsed.title) return;
    onAdd(parsed);
    setValue('');
  }

  function handleKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      setValue('');
      inputRef.current?.blur();
    }
  }

  const preview = getPreview();

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Add a block… (e.g. 'Deep work 9–11am tomorrow')"
        />
        <button
          className={styles.addBtn}
          onClick={submit}
          disabled={!parsed?.title}
          title="Add block"
        >
          +
        </button>
      </div>
      {value.trim() && (
        <div className={styles.preview}>
          → {preview || 'Today'}
          {parsed?.title && parsed.title !== value.trim() && (
            <span className={styles.previewTitle}> · "{parsed.title}"</span>
          )}
        </div>
      )}
    </div>
  );
});

export default QuickAdd;
