import { useProjectStore } from '../../store/useProjectStore';
import type { Device } from '../../types';

interface Props {
  device: Device;
}

export function DeviceItem({ device }: Props) {
  const { selectedDeviceId, selectDevice, deleteDevice } = useProjectStore();
  const isSelected = selectedDeviceId === device.id;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`確定要刪除「${device.name}」及其所有 IO 資料嗎？`)) {
      deleteDevice(device.id);
    }
  };

  return (
    <div
      className={`device-item ${isSelected ? 'selected' : ''}`}
      onClick={() => selectDevice(device.id)}
    >
      <span className="device-name">{device.name}</span>
      <button className="device-delete-btn" onClick={handleDelete} title="刪除設備">✕</button>
    </div>
  );
}
