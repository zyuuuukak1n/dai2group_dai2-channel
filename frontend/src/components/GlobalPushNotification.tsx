import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { getDeviceId } from '../utils/deviceId';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function GlobalPushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleSubscribe = async () => {
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== 'granted') {
        alert('通知が許可されませんでした。');
        return;
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('このブラウザはプッシュ通知に対応していません。');
        return;
      }

      const res = await apiFetch('/push/public-key');
      const { publicKey } = res;
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      const deviceId = getDeviceId();
      await apiFetch('/push/subscribe-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          subscription
        })
      });
      alert('プッシュ通知を有効にしました。自分宛ての返信を受け取れるようになりました！');
    } catch (e) {
      alert('通知の登録に失敗しました。ブラウザの通知許可設定を確認してください。');
      console.error(e);
    }
  };

  if (permission === 'granted' || permission === 'denied') {
    return null; // Hide if already granted or denied
  }

  return (
    <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-6 flex justify-between items-center text-sm">
      <span>🔔 <b>通知設定</b>：オンにすると、自分への返信がプッシュ通知で届くようになります！</span>
      <button 
        onClick={handleSubscribe}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded shadow-sm transition-colors"
      >
        通知を許可する
      </button>
    </div>
  );
}
