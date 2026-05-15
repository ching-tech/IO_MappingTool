import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function DataTypeCell({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const dataTypes = useProjectStore((s) => s.dataTypes);

  const handleSelect = (type: string) => {
    onChange(type);
    setOpen(false);
  };

  return (
    <div className="datatype-cell" style={{ position: 'relative' }}>
      <div className="cell-display" onClick={() => setOpen((o) => !o)}>
        {value || <span className="cell-placeholder">選擇類型</span>}
        <span style={{ marginLeft: 4, opacity: 0.5 }}>▾</span>
      </div>
      {open && (
        <div className="datatype-dropdown">
          {dataTypes.map((t) => (
            <div
              key={t}
              className={`datatype-option ${t === value ? 'selected' : ''}`}
              onClick={() => handleSelect(t)}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
