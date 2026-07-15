import { useState, useEffect } from 'react';

interface NGConfig {
  words: string[];
  ids: string[];
  trips: string[];
}

const DEFAULT_NG: NGConfig = { words: [], ids: [], trips: [] };

export function useNGFilter() {
  const [ngConfig, setNgConfig] = useState<NGConfig>(DEFAULT_NG);

  useEffect(() => {
    const stored = localStorage.getItem('dai2channel_ng');
    if (stored) {
      try {
        setNgConfig(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  const saveConfig = (newConfig: NGConfig) => {
    localStorage.setItem('dai2channel_ng', JSON.stringify(newConfig));
    setNgConfig(newConfig);
  };

  const isHidden = (post: { body?: string; dailyId?: string; trip?: string }): boolean => {
    if (post.body && ngConfig.words.some(word => word && post.body?.includes(word))) return true;
    if (post.dailyId && ngConfig.ids.some(id => id && post.dailyId === id)) return true;
    if (post.trip && ngConfig.trips.some(trip => trip && post.trip === trip)) return true;
    return false;
  };

  const isThreadHidden = (thread: { title?: string }): boolean => {
    if (thread.title && ngConfig.words.some(word => word && thread.title?.includes(word))) return true;
    return false;
  };

  return { ngConfig, saveConfig, isHidden, isThreadHidden };
}
