import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { parseQuickAdd } from '../../utils/parseQuickAdd';
import { getLocale } from '../../utils/language';
import styles from './QuickAdd.module.css';

function formatPreviewDate(dateStr, locale) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
  const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
  return `${weekday} ${day} ${monthShort}`;
}

const QuickAdd = forwardRef(function QuickAdd({ onAdd, defaultDate }, ref) {
  const { t } = useTranslation();
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
    let label = formatPreviewDate(parsed.date, getLocale());
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
          placeholder={t('quickAdd.placeholder')}
        />
        <button
          className={styles.addBtn}
          onClick={submit}
          disabled={!parsed?.title}
          title={t('quickAdd.addBlock')}
        >
          +
        </button>
      </div>
      {value.trim() && (
        <div className={styles.preview}>
          → {preview || t('quickAdd.today')}
          {parsed?.title && parsed.title !== value.trim() && (
            <span className={styles.previewTitle}> · "{parsed.title}"</span>
          )}
        </div>
      )}
    </div>
  );
});

export default QuickAdd;
