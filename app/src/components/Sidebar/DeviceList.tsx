import { useProjectStore } from '../../store/useProjectStore';
import { DeviceItem } from './DeviceItem';

export function DeviceList() {
  const devices = useProjectStore((s) => s.devices);

  if (devices.length === 0) {
    return <div className="device-list-empty">尚無設備，請點擊下方新增</div>;
  }

  return (
    <div className="device-list">
      {devices.map((d) => (
        <DeviceItem key={d.id} device={d} />
      ))}
    </div>
  );
}
