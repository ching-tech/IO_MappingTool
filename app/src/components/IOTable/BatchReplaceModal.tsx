import { useState, useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';

interface Props {
  currentDeviceId: string;
  onClose: () => void;
}

type Column = 'deviceAddress' | 'mainSystemAddress';
type Scope = 'current' | 'all';
type MatchType = 'exact' | 'contains';

export function BatchReplaceModal({ currentDeviceId, onClose }: Props) {
  const { devices, batchReplaceAddress } = useProjectStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [columns, setColumns] = useState<Set<Column>>(new Set(['deviceAddress', 'mainSystemAddress']));
  const [scope, setScope] = useState<Scope>('current');
  const [matchType, setMatchType] = useState<MatchType>('exact');
  const [result, setResult] = useState<number | null>(null);

  const toggleColumn = (col: Column) => {
    setColumns((prev) => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
    setResult(null);
  };

  // 預覽符合筆數
  const matchCount = useMemo(() => {
    if (!searchTerm) return 0;
    const norm = (s: string) => s.trim().toUpperCase();
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');

    let count = 0;
    const targetDevices = scope === 'current'
      ? devices.filter((d) => d.id === currentDeviceId)
      : devices;

    for (const device of targetDevices) {
      for (const row of [...device.sendIO, ...device.receiveIO]) {
        for (const col of columns) {
          const val = row[col];
          if (!val) continue;
          if (matchType === 'exact') {
            if (norm(val) === norm(searchTerm)) count++;
          } else {
            const found = val.match(regex);
            if (found) count += found.length;
          }
        }
      }
    }
    return count;
  }, [searchTerm, columns, scope, matchType, devices, currentDeviceId]);

  const handleConfirm = () => {
    if (!searchTerm || columns.size === 0) return;
    const n = batchReplaceAddress(
      searchTerm,
      replaceTerm,
      [...columns],
      scope,
      currentDeviceId,
      matchType
    );
    setResult(n);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>⚡ IO 批量替換</span>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label>搜尋位址</label>
            <input
              className="modal-input"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setResult(null); }}
              placeholder="例：D1510"
              autoFocus
            />
          </div>
          <div className="modal-field">
            <label>替換為</label>
            <input
              className="modal-input"
              value={replaceTerm}
              onChange={(e) => { setReplaceTerm(e.target.value); setResult(null); }}
              placeholder="例：D1550"
            />
          </div>

          <div className="modal-divider" />

          <div className="modal-field">
            <label>套用欄位</label>
            <div className="modal-checks">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={columns.has('deviceAddress')}
                  onChange={() => toggleColumn('deviceAddress')}
                />
                設備 IO 點位位址
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={columns.has('mainSystemAddress')}
                  onChange={() => toggleColumn('mainSystemAddress')}
                />
                主系統點位位址
              </label>
            </div>
          </div>

          <div className="modal-field">
            <label>套用範圍</label>
            <div className="modal-radios">
              <label className="radio-label">
                <input type="radio" checked={scope === 'current'} onChange={() => { setScope('current'); setResult(null); }} />
                目前設備
              </label>
              <label className="radio-label">
                <input type="radio" checked={scope === 'all'} onChange={() => { setScope('all'); setResult(null); }} />
                全部設備
              </label>
            </div>
          </div>

          <div className="modal-field">
            <label>比對方式</label>
            <div className="modal-radios">
              <label className="radio-label">
                <input type="radio" checked={matchType === 'exact'} onChange={() => { setMatchType('exact'); setResult(null); }} />
                完整比對
              </label>
              <label className="radio-label">
                <input type="radio" checked={matchType === 'contains'} onChange={() => { setMatchType('contains'); setResult(null); }} />
                包含文字
              </label>
            </div>
          </div>

          <div className="modal-divider" />

          <div className="modal-preview">
            {result !== null ? (
              <span className="preview-done">✓ 已替換 {result} 筆</span>
            ) : searchTerm ? (
              <span className={matchCount > 0 ? 'preview-match' : 'preview-none'}>
                {matchCount > 0 ? `找到 ${matchCount} 筆符合` : '無符合項目'}
              </span>
            ) : (
              <span className="preview-hint">輸入搜尋位址以預覽</span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="modal-btn-confirm"
            onClick={handleConfirm}
            disabled={!searchTerm || matchCount === 0 || columns.size === 0}
          >
            確認替換{matchCount > 0 ? ` (${matchCount} 筆)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
