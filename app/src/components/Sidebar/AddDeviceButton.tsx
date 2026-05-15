import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export function AddDeviceButton() {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addDevice = useProjectStore((s) => s.addDevice);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (trimmed) {
      addDevice(trimmed);
    }
    setName('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') { setName(''); setIsAdding(false); }
  };

  if (isAdding) {
    return (
      <div className="add-device-input-row">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirm}
          placeholder="設備名稱"
          className="add-device-input"
        />
      </div>
    );
  }

  return (
    <button className="add-device-btn" onClick={() => setIsAdding(true)}>
      ＋ 新增設備
    </button>
  );
}
