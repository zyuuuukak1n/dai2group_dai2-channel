export function getDeviceId(): string {
  let deviceId = localStorage.getItem('dai2_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('dai2_device_id', deviceId);
  }
  return deviceId;
}
