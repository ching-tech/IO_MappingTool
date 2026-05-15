import { useState } from 'react';
import { useProjectStore, DEFAULT_DATA_TYPES } from '../../store/useProjectStore';

export function DataTypeManager() {
  const [newType, setNewType] = useState('');
  const [error, setError] = useState('');
  const { dataTypes, addDataType, removeDataType } = useProjectStore();

  const handleAdd = () => {
    const trimmed = newType.trim().toUpperCase();
    if (!trimmed) return;
    const ok = addDataType(trimmed);
    if (!ok) {
      setError(`「${trimmed}」已存在`);
    } else {
      setNewType('');
      setError('');
    }
  };

  return (
    <div className="datatype-manager">
      <div className="datatype-manager-title">資料類型管理</div>
      <div className="datatype-list">
        {dataTypes.map((t) => {
          const isDefault = DEFAULT_DATA_TYPES.includes(t);
          return (
            <div key={t} className="datatype-tag">
              <span>{t}</span>
              {isDefault ? (
                <span className="default-badge" title="預設類型，無法刪除">🔒</span>
              ) : (
                <button onClick={() => removeDataType(t)} title="刪除">✕</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="datatype-add-row">
        <input
          value={newType}
          onChange={(e) => { setNewType(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="新增資料類型"
        />
        <button onClick={handleAdd}>新增</button>
      </div>
      {error && <div className="datatype-error">{error}</div>}
    </div>
  );
}
