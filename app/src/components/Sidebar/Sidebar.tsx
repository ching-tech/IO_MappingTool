import { DeviceList } from './DeviceList';
import { AddDeviceButton } from './AddDeviceButton';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">設備列表</div>
      <DeviceList />
      <AddDeviceButton />
    </aside>
  );
}
