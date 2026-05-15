import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnterLast?: () => void;
  isLast?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function EditableCell({ value, onChange, placeholder, onEnterLast, isLast, inputRef: externalRef }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = externalRef || internalRef;

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      if (isLast) onEnterLast?.();
    }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
    if (e.key === 'Tab') commit();
  };

  if (editing) {
    return (
      <input
        ref={ref}
        className="cell-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus
      />
    );
  }

  return (
    <div
      className="cell-display"
      onClick={() => { setDraft(value); setEditing(true); }}
      title={value || placeholder}
    >
      {value || <span className="cell-placeholder">{placeholder}</span>}
    </div>
  );
}
