import { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/MainContent';
import { useProjectStore } from './store/useProjectStore';
import { useFileActions } from './hooks/useFileActions';
import { isTauri } from './utils/fileUtils';
import './App.css';

const SHORTCUTS = [
  { desc: '選取格子',   keys: ['Click'] },
  { desc: '進入編輯',   keys: ['2× Click'] },
  { desc: '多格選取',   keys: ['Drag'] },
  { desc: '複製',       keys: ['Ctrl', 'C'] },
  { desc: '貼上',       keys: ['Ctrl', 'V'] },
  { desc: '剪下',       keys: ['Ctrl', 'X'] },
  { desc: '清除格子',   keys: ['Del'] },
  { desc: '復原',       keys: ['Ctrl', 'Z'] },
  { desc: '取消選取',   keys: ['Esc'] },
];

function App() {
  const { hasUnsavedChanges, undo, projectName, setRecentFiles, currentFilePath, getProjectData, markSaved, showSavedTip } =
    useProjectStore();
  const { handleNew, handleOpen, handleSave, handleSaveAs, handleExport, handleOpenPath } = useFileActions();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Browser beforeunload (non-Tauri) ──────────────────────
  useEffect(() => {
    if (isTauri()) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // ── Global Ctrl+Z (non-Tauri, or when menu doesn't intercept) ──
  useEffect(() => {
    if (isTauri()) return; // Tauri handles via menu-action event
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        undo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  // ── Tauri: all event listeners ─────────────────────────────
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenMenu: (() => void) | undefined;
    let unlistenOpenFile: (() => void) | undefined;
    let unlistenRecentFiles: (() => void) | undefined;
    let unlistenAutoSave: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const appWindow = getCurrentWindow();

      // Menu action events from Rust
      unlistenMenu = await listen<string>('menu-action', async ({ payload }) => {
        switch (payload) {
          case 'new':        handleNew();     break;
          case 'open':       await handleOpen(); break;
          case 'save':       await handleSave(); break;
          case 'save-as':    await handleSaveAs(); break;
          case 'export-excel': handleExport(); break;
          case 'undo':       undo();          break;
        }
      });

      // File association / recent file menu click
      unlistenOpenFile = await listen<string>('open-file', async ({ payload }) => {
        if (payload) await handleOpenPath(payload);
      });

      // Recent files list sent from Rust on startup
      unlistenRecentFiles = await listen<string>('recent-files-loaded', ({ payload }) => {
        try {
          const paths: string[] = JSON.parse(payload);
          setRecentFiles(paths);
        } catch { /* ignore malformed */ }
      });

      // Auto-save tick from Rust timer
      unlistenAutoSave = await listen('auto-save-tick', async () => {
        const path = (window as unknown as Record<string, unknown>).__ioCurrentPath__ as string | null;
        if (!path) return;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const data = getProjectData();
          await invoke('write_file', { path, content: JSON.stringify(data, null, 2) });
          markSaved();
          showSavedTip();
        } catch { /* silent auto-save failure */ }
      });

      // Close-requested protection (read from window ref to always get latest value)
      unlistenClose = await appWindow.onCloseRequested(async (event) => {
        const unsaved = (window as unknown as Record<string, unknown>).__ioHasUnsaved__ as boolean;
        if (!unsaved) return;
        event.preventDefault();
        const ok = await confirm('有未存儲的變更，確定要關閉嗎？', { title: 'IO 設備通訊對照表', kind: 'warning' });
        if (ok) await appWindow.destroy();
      });
    })();

    return () => {
      unlistenMenu?.();
      unlistenOpenFile?.();
      unlistenRecentFiles?.();
      unlistenAutoSave?.();
      unlistenClose?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tauri: sync window title ───────────────────────────────
  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const title = `${hasUnsavedChanges ? '● ' : ''}${projectName} - IO 設備通訊對照表`;
      await getCurrentWindow().setTitle(title);
    })();
  }, [projectName, hasUnsavedChanges]);

  // ── Sync dynamic refs used by one-time Tauri event handlers ──
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__ioHasUnsaved__ = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__ioCurrentPath__ = currentFilePath;
  }, [currentFilePath]);

  return (
    <>
      <div className="app-layout">
        <Toolbar />
        <div className="app-body">
          <Sidebar />
          <MainContent />
        </div>
      </div>

      <button
        className="shortcut-fab"
        onClick={() => setShowShortcuts((v) => !v)}
        title="鍵盤快捷鍵"
      >?</button>

      {showShortcuts && (
        <>
          <div className="shortcut-overlay" onClick={() => setShowShortcuts(false)} />
          <div className="shortcut-panel">
            <div className="shortcut-panel-header">鍵盤快捷鍵</div>
            {SHORTCUTS.map(({ desc, keys }) => (
              <div key={desc} className="shortcut-row">
                <span className="shortcut-desc">{desc}</span>
                <span className="shortcut-keys">
                  {keys.map((k) => <kbd key={k}>{k}</kbd>)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default App;
