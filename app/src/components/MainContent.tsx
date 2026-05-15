import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { IOTable } from './IOTable/IOTable';
import { DataTypeManager } from './IOTable/DataTypeManager';
import { BatchReplaceModal } from './IOTable/BatchReplaceModal';
import { findConflictingAddresses } from '../utils/addressUtils';
import type { MainSystemBrand } from '../types';

const PLACEHOLDERS: Record<MainSystemBrand, string> = {
  KEYENCE: '如：DM100、MR0',
  Mitsubishi: '如：D100、M0、X0',
  Siemens: '如：MW100、M0.0',
  Omron: '如：DM0000、CIO0.00',
  Modbus: '如：40001、00001',
  Custom: '自訂位址',
};

export function MainContent() {
  const { devices, selectedDeviceId, mainSystem } = useProjectStore();
  const [showBatchReplace, setShowBatchReplace] = useState(false);
  const device = devices.find((d) => d.id === selectedDeviceId);

  // 計算所有設備的主系統點位位址重複集合（跨設備全域偵測）
  const conflictingAddresses = useMemo(() => {
    const allAddresses = devices.flatMap((d) =>
      [...d.sendIO, ...d.receiveIO].map((r) => r.mainSystemAddress)
    );
    return findConflictingAddresses(allAddresses);
  }, [devices]);

  if (!device) {
    return (
      <main className="main-content main-content-empty">
        <div className="empty-hint">請從左側選擇或新增設備</div>
      </main>
    );
  }

  const placeholder = PLACEHOLDERS[mainSystem] || '自訂位址';

  return (
    <main className="main-content">
      <div className="device-header">
        <h2>{device.name}</h2>
        <button className="batch-replace-btn" onClick={() => setShowBatchReplace(true)}>
          ⚡ 批量替換
        </button>
      </div>
      {showBatchReplace && (
        <BatchReplaceModal
          currentDeviceId={device.id}
          onClose={() => setShowBatchReplace(false)}
        />
      )}
      <IOTable
        deviceId={device.id}
        deviceName={device.name}
        type="send"
        rows={device.sendIO}
        mainSystemPlaceholder={placeholder}
        conflictingAddresses={conflictingAddresses}
      />
      <IOTable
        deviceId={device.id}
        deviceName={device.name}
        type="receive"
        rows={device.receiveIO}
        mainSystemPlaceholder={placeholder}
        conflictingAddresses={conflictingAddresses}
      />
      <DataTypeManager />
    </main>
  );
}
