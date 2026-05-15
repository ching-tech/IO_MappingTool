import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { EditableCell } from './EditableCell';
import { DataTypeCell } from './DataTypeCell';
import { AddressCell } from './AddressCell';
import { naturalSortAddress } from '../../utils/addressUtils';
import type { IORow } from '../../types';

interface Props {
  deviceId: string;
  deviceName: string;
  type: 'send' | 'receive';
  rows: IORow[];
  mainSystemPlaceholder: string;
  conflictingAddresses: Set<string>;
}

const columnHelper = createColumnHelper<IORow>();

const EDITABLE_COLS: (keyof IORow)[] = [
  'deviceAddress', 'signalName', 'dataType', 'mainSystemAddress', 'remark',
];
const COL_SEL_MAP: Record<string, number> = {
  deviceAddress: 0, signalName: 1, dataType: 2, mainSystemAddress: 3, remark: 4,
};

let activeTableKey = '';

export function IOTable({
  deviceId, deviceName, type, rows, mainSystemPlaceholder, conflictingAddresses,
}: Props) {
  const {
    updateIORow, deleteIORow, addIORow, insertRowsAfter,
    setTableClipboard, tableClipboard, pasteClipboard,
  } = useProjectStore();

  const tableKey = `${deviceId}-${type}`;

  const [sorting, setSorting]               = useState<SortingState>([]);
  const [collapsed, setCollapsed]           = useState(false);
  const [showCompleteOnly, setShowCompleteOnly] = useState(false);

  // ─── Selection state ─────────────────────────────────────────────
  // selAnchor / selEnd are set ONLY when an actual cross-cell drag occurs
  // (or shift+click). Single clicks never touch selection state → editing works.
  const [selAnchor, setSelAnchor] = useState<{ row: number; col: number } | null>(null);
  const [selEnd,    setSelEnd]    = useState<{ row: number; col: number } | null>(null);
  const [copyDone,  setCopyDone]  = useState(false);
  const [pasteResult, setPasteResult] = useState<number | null>(null);

  // Refs that never trigger re-render
  const dragStartRef     = useRef<{ row: number; col: number } | null>(null); // mousedown start
  const pasteRowRef      = useRef(0);          // row index for Ctrl+V
  const dragFromInputRef = useRef(false);      // true when drag started inside <input>
  const rowsRef          = useRef(rows);       rowsRef.current = rows;
  const selRectRef       = useRef<typeof selRect>(null);
  const tableClipboardRef = useRef(tableClipboard); tableClipboardRef.current = tableClipboard;

  // ─── Display rows ─────────────────────────────────────────────────
  const displayRows = useMemo(
    () => showCompleteOnly
      ? rows.filter((r) => r.deviceAddress.trim() && r.signalName.trim())
      : rows,
    [rows, showCompleteOnly],
  );
  const completeCount = useMemo(
    () => rows.filter((r) => r.deviceAddress.trim() && r.signalName.trim()).length,
    [rows],
  );

  // ─── Row / IO callbacks ───────────────────────────────────────────
  const update = useCallback(
    (rowId: string, field: keyof IORow, value: string) =>
      updateIORow(deviceId, type, rowId, field, value),
    [deviceId, type, updateIORow],
  );

  const handleFill = useCallback(
    (fromIndex: number, addresses: string[], autoBool: boolean) => {
      const existing = rows.length - fromIndex - 1;
      const needed   = Math.max(0, addresses.length - existing);
      if (needed > 0)
        insertRowsAfter(deviceId, type, rows.length - 1,
          addresses.slice(existing).map((a) => ({
            deviceAddress: a, ...(autoBool ? { dataType: 'BOOL' } : {}),
          })));
      rows.slice(fromIndex + 1, fromIndex + 1 + Math.min(addresses.length, existing))
        .forEach((row, i) => {
          updateIORow(deviceId, type, row.id, 'deviceAddress', addresses[i]);
          if (autoBool && !row.dataType) updateIORow(deviceId, type, row.id, 'dataType', 'BOOL');
        });
    },
    [rows, deviceId, type, updateIORow, insertRowsAfter],
  );

  const handleFillMainSystem = useCallback(
    (fromIndex: number, addresses: string[], autoBool: boolean) => {
      const existing = rows.length - fromIndex - 1;
      const needed   = Math.max(0, addresses.length - existing);
      if (needed > 0)
        insertRowsAfter(deviceId, type, rows.length - 1,
          addresses.slice(existing).map((a) => ({
            mainSystemAddress: a, ...(autoBool ? { dataType: 'BOOL' } : {}),
          })));
      rows.slice(fromIndex + 1, fromIndex + 1 + Math.min(addresses.length, existing))
        .forEach((row, i) => {
          updateIORow(deviceId, type, row.id, 'mainSystemAddress', addresses[i]);
          if (autoBool && !row.dataType) updateIORow(deviceId, type, row.id, 'dataType', 'BOOL');
        });
    },
    [rows, deviceId, type, updateIORow, insertRowsAfter],
  );

  const handleAddRow         = () => addIORow(deviceId, type);
  const handleEnterOnLastRow = () => addIORow(deviceId, type);

  // ─── Selection helpers ────────────────────────────────────────────
  const selRect = useMemo(() => {
    if (!selAnchor || !selEnd) return null;
    return {
      r1: Math.min(selAnchor.row, selEnd.row), r2: Math.max(selAnchor.row, selEnd.row),
      c1: Math.min(selAnchor.col, selEnd.col), c2: Math.max(selAnchor.col, selEnd.col),
    };
  }, [selAnchor, selEnd]);
  selRectRef.current = selRect;

  const isCellSelected = useCallback((rowIdx: number, colIdx: number) => {
    const r = selRectRef.current;
    if (!r) return false;
    return rowIdx >= r.r1 && rowIdx <= r.r2 && colIdx >= r.c1 && colIdx <= r.c2;
  }, []);  // selRectRef never changes identity → safe to omit from deps

  // ─── TABLE mousedown ──────────────────────────────────────────────
  // IMPORTANT: we NEVER call e.preventDefault() for normal clicks.
  // That would suppress the subsequent click event and break EditableCell.
  // We only record the click position in refs (zero state updates → zero re-renders
  // → click flows unobstructed to cell-display → setEditing(true)).
  const handleTableMouseDown = useCallback((e: React.MouseEvent<HTMLTableElement>) => {
    const td = (e.target as HTMLElement).closest('td') as HTMLElement | null;
    if (!td) return;

    const rowStr = td.dataset.row;
    const colStr = td.dataset.col;
    if (rowStr === undefined || colStr === undefined || colStr === '') return;

    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    activeTableKey = tableKey;
    pasteRowRef.current    = row;
    dragStartRef.current   = { row, col };
    dragFromInputRef.current =
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA' ||
      (e.target as HTMLElement).tagName === 'SELECT';

    if (e.shiftKey && selAnchor) {
      // Shift+click: extend selection without changing focus
      e.preventDefault();
      setSelEnd({ row, col });
      return;
    }

    // Normal click: clear any previous selection.
    // Using flushSync is NOT needed – React will batch these with the upcoming
    // click handler, so the DOM stays stable during the mousedown→click sequence.
    setSelAnchor(null);
    setSelEnd(null);
  }, [tableKey, selAnchor]);

  // ─── TD mouseenter (drag extension) ──────────────────────────────
  const handleCellMouseEnter = useCallback((e: React.MouseEvent, rowIdx: number, colIdx: number) => {
    if (!(e.buttons & 1))          return; // left button not held
    if (dragFromInputRef.current)  return; // dragging inside an <input>
    const start = dragStartRef.current;
    if (!start)                    return;
    // Only activate when mouse actually moves to a different cell
    if (start.row === rowIdx && start.col === colIdx) return;

    setSelAnchor({ row: start.row, col: start.col });
    setSelEnd({ row: rowIdx, col: colIdx });
    activeTableKey = tableKey;
  }, [tableKey]);

  // ─── Copy / Paste ─────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const rect = selRectRef.current;
    if (!rect) return;
    const colKeys = EDITABLE_COLS.slice(rect.c1, rect.c2 + 1);
    const data: string[][] = [];
    for (let r = rect.r1; r <= rect.r2 && r < rowsRef.current.length; r++)
      data.push(colKeys.map((col) => rowsRef.current[r][col] || ''));
    setTableClipboard({ colKeys, data });
    navigator.clipboard.writeText(data.map((r) => r.join('\t')).join('\n')).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1500);
  }, [setTableClipboard]);

  const handlePaste = useCallback(() => {
    const cb = tableClipboardRef.current;
    if (!cb) return;
    const n = pasteClipboard(deviceId, type, pasteRowRef.current);
    setSelEnd(null);
    setPasteResult(n);
    setTimeout(() => setPasteResult(null), 2000);
  }, [pasteClipboard, deviceId, type]);

  const handleCopyRef  = useRef(handleCopy);  handleCopyRef.current  = handleCopy;
  const handlePasteRef = useRef(handlePaste); handlePasteRef.current = handlePaste;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeTableKey !== tableKey) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selRectRef.current) {
        handleCopyRef.current(); e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && tableClipboardRef.current) {
        handlePasteRef.current(); e.preventDefault();
      } else if (e.key === 'Escape') {
        setSelAnchor(null); setSelEnd(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tableKey]);

  // ─── Columns ──────────────────────────────────────────────────────
  const columns = [
    columnHelper.accessor('id', {
      id: 'deviceName',
      header: '設備名稱',
      cell: () => <div className="cell-display cell-readonly">{deviceName}</div>,
      enableSorting: false,
      size: 120,
    }),
    columnHelper.accessor('deviceAddress', {
      header: '設備IO點位位址',
      sortingFn: (a, b) => naturalSortAddress(a.original.deviceAddress, b.original.deviceAddress),
      cell: ({ row, getValue }) => {
        const origIdx = rows.findIndex((r) => r.id === row.original.id);
        return (
          <AddressCell
            value={getValue()} rowIndex={origIdx}
            onChange={(v) => update(row.original.id, 'deviceAddress', v)}
            onFill={handleFill} onEnterLast={handleEnterOnLastRow}
            isLast={origIdx === rows.length - 1}
          />
        );
      },
      size: 160,
    }),
    columnHelper.accessor('signalName', {
      header: '訊號名稱',
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()} onChange={(v) => update(row.original.id, 'signalName', v)}
          placeholder="訊號名稱" onEnterLast={handleEnterOnLastRow}
          isLast={row.index === rows.length - 1}
        />
      ),
      size: 150,
    }),
    columnHelper.accessor('dataType', {
      header: '資料類型',
      cell: ({ row, getValue }) => (
        <DataTypeCell value={getValue()} onChange={(v) => update(row.original.id, 'dataType', v)} />
      ),
      size: 110,
    }),
    columnHelper.accessor('mainSystemAddress', {
      header: '主系統點位位址',
      sortingFn: (a, b) => naturalSortAddress(a.original.mainSystemAddress, b.original.mainSystemAddress),
      cell: ({ row, getValue }) => {
        const val = getValue();
        const isConflict = !!val && conflictingAddresses.has(val.trim().toUpperCase());
        const origIdx = rows.findIndex((r) => r.id === row.original.id);
        return (
          <AddressCell
            value={val} rowIndex={origIdx}
            onChange={(v) => update(row.original.id, 'mainSystemAddress', v)}
            onFill={handleFillMainSystem} onEnterLast={handleEnterOnLastRow}
            isLast={origIdx === rows.length - 1}
            placeholder={mainSystemPlaceholder} isConflict={isConflict}
          />
        );
      },
      size: 160,
    }),
    columnHelper.accessor('remark', {
      header: '備註',
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()} onChange={(v) => update(row.original.id, 'remark', v)}
          placeholder="備註" onEnterLast={handleEnterOnLastRow}
          isLast={row.index === rows.length - 1}
        />
      ),
      size: 150,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          className="delete-row-btn"
          onClick={() => deleteIORow(deviceId, type, row.original.id)}
          title="刪除此行"
        >✕</button>
      ),
      size: 40,
    }),
  ];

  const table = useReactTable({
    data: displayRows, columns,
    state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const baseLabel = type === 'send' ? '設備發送 IO' : '設備接受 IO';

  return (
    <div className="io-table-section">
      <div className="io-table-label collapsible-label" onClick={() => setCollapsed((c) => !c)}>
        <span className="collapse-icon">{collapsed ? '▶' : '▼'}</span>
        {baseLabel}
        <span className="row-count-badge">
          {showCompleteOnly ? `${completeCount} / ${rows.length} 筆` : `${rows.length} 筆`}
        </span>
        <button
          className={`filter-toggle-btn${showCompleteOnly ? ' active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowCompleteOnly((v) => !v); }}
          title={showCompleteOnly ? '顯示全部' : '只顯示完整資料行'}
        >
          {showCompleteOnly ? '全部展開' : '只看完整'}
        </button>

        {/* Selection badge */}
        {selRect && (
          <span className="sel-badge" onClick={(e) => e.stopPropagation()}>
            {selRect.r2 - selRect.r1 + 1}×{selRect.c2 - selRect.c1 + 1} 格已選
            {copyDone
              ? <span className="copy-done-tip"> ✓ 已複製</span>
              : <span className="copy-hint"> (Ctrl+C 複製)</span>}
          </span>
        )}

        {/* Paste button – shown when clipboard has data */}
        {tableClipboard && (
          <button
            className="filter-toggle-btn sel-action-btn"
            onClick={(e) => { e.stopPropagation(); handlePaste(); }}
            title="點任意格後按此或 Ctrl+V 貼上"
          >
            貼上 {tableClipboard.data.length} 行
            {pasteResult !== null && <span className="paste-tip"> ✓{pasteResult}格</span>}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="io-table-wrapper">
            <table
              className={`io-table${selRect ? ' cell-dragging' : ''}`}
              onMouseDown={handleTableMouseDown}
            >
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted  = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className={canSort ? 'sortable-header' : ''}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="sort-icon">
                              {sorted === 'asc' ? ' ↑' : sorted === 'desc' ? ' ↓' : ' ↕'}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="empty-table-hint">
                      {showCompleteOnly
                        ? '沒有完整資料行（需同時填寫設備IO點位位址與訊號名稱）'
                        : '尚無資料，點擊下方「＋ 新增行」開始建立'}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const origIdx    = rows.findIndex((r) => r.id === row.original.id);
                    const isComplete = !!(row.original.deviceAddress.trim() && row.original.signalName.trim());
                    return (
                      <tr key={row.id} className={`io-row${isComplete ? ' io-row-complete' : ''}`}>
                        {row.getVisibleCells().map((cell) => {
                          const selColIdx = COL_SEL_MAP[cell.column.id] ?? null;
                          const selected  = selColIdx !== null && isCellSelected(origIdx, selColIdx);
                          return (
                            <td
                              key={cell.id}
                              /* data-row / data-col let handleTableMouseDown locate the cell */
                              data-row={selColIdx !== null ? origIdx : undefined}
                              data-col={selColIdx !== null ? selColIdx : undefined}
                              className={selected ? 'cell-selected' : ''}
                              onMouseEnter={selColIdx !== null
                                ? (e) => handleCellMouseEnter(e, origIdx, selColIdx)
                                : undefined}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!showCompleteOnly && (
            <button className="add-row-btn" onClick={handleAddRow}>＋ 新增行</button>
          )}
        </>
      )}
    </div>
  );
}
