import { useState } from 'react';
import { useNGFilter } from '../features/moderation/useNGFilter';
import { Link } from 'react-router-dom';

export default function NGSettingsPage() {
  const { ngConfig, saveConfig } = useNGFilter();
  const [word, setWord] = useState('');
  const [id, setId] = useState('');
  const [trip, setTrip] = useState('');

  const handleAddWord = () => {
    if (!word) return;
    saveConfig({ ...ngConfig, words: [...new Set([...ngConfig.words, word])] });
    setWord('');
  };

  const handleRemoveWord = (w: string) => {
    saveConfig({ ...ngConfig, words: ngConfig.words.filter(x => x !== w) });
  };

  const handleAddId = () => {
    if (!id) return;
    saveConfig({ ...ngConfig, ids: [...new Set([...ngConfig.ids, id])] });
    setId('');
  };

  const handleRemoveId = (i: string) => {
    saveConfig({ ...ngConfig, ids: ngConfig.ids.filter(x => x !== i) });
  };

  const handleAddTrip = () => {
    if (!trip) return;
    saveConfig({ ...ngConfig, trips: [...new Set([...ngConfig.trips, trip])] });
    setTrip('');
  };

  const handleRemoveTrip = (t: string) => {
    saveConfig({ ...ngConfig, trips: ngConfig.trips.filter(x => x !== t) });
  };

  return (
    <div className="glass-panel max-w-2xl mx-auto">
      <h2 className="mb-4">NG設定</h2>
      <p className="text-sm text-muted mb-6">
        指定したワードを含むスレッド・レスや、指定したID・トリップのレスを非表示（あぼーん）にします。<br/>
        この設定はブラウザに保存されます。
      </p>

      <div className="flex flex-col gap-6">
        <div>
          <h3 className="font-bold mb-2">NGワード</h3>
          <div className="flex gap-2 mb-2">
            <input type="text" value={word} onChange={e => setWord(e.target.value)} placeholder="NGワード" />
            <button className="btn" onClick={handleAddWord}>追加</button>
          </div>
          <ul className="list-disc pl-5">
            {ngConfig.words.map(w => (
              <li key={w} className="flex justify-between items-center mb-1">
                <span>{w}</span>
                <button className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded" onClick={() => handleRemoveWord(w)}>削除</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-bold mb-2">NG ID</h3>
          <div className="flex gap-2 mb-2">
            <input type="text" value={id} onChange={e => setId(e.target.value)} placeholder="NG ID" />
            <button className="btn" onClick={handleAddId}>追加</button>
          </div>
          <ul className="list-disc pl-5">
            {ngConfig.ids.map(i => (
              <li key={i} className="flex justify-between items-center mb-1">
                <span>{i}</span>
                <button className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded" onClick={() => handleRemoveId(i)}>削除</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-bold mb-2">NG トリップ</h3>
          <div className="flex gap-2 mb-2">
            <input type="text" value={trip} onChange={e => setTrip(e.target.value)} placeholder="NG トリップ" />
            <button className="btn" onClick={handleAddTrip}>追加</button>
          </div>
          <ul className="list-disc pl-5">
            {ngConfig.trips.map(t => (
              <li key={t} className="flex justify-between items-center mb-1">
                <span>{t}</span>
                <button className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded" onClick={() => handleRemoveTrip(t)}>削除</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="mt-8">
        <Link to="/" className="text-blue-600 underline">掲示板に戻る</Link>
      </div>
    </div>
  );
}
