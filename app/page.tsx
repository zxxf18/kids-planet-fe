'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type MediaItem = {
  id: number;
  sourceCode: string;
  title: string;
  hasAudio: boolean;
  hasVideo: boolean;
  hasLyric: boolean;
  hasPoster: boolean;
  audioDurationMs?: number;
  videoDurationMs?: number;
  validationStatus: 'ready' | 'partial' | 'invalid';
  validationMessage?: string;
  audioUrl?: string;
  videoUrl?: string;
  lyricUrl?: string;
  posterUrl?: string;
};

type MediaKind = 'audio' | 'video';
type Category = 'all' | 'audio' | 'video';
type PlayMode = 'order' | 'shuffle' | 'repeatShuffle' | 'repeatAll' | 'single';

const playModes: { value: PlayMode; label: string; short: string; icon: string }[] = [
  { value: 'order', label: '按列表顺序播放，到末尾停止', short: '顺序播放', icon: '⇥' },
  { value: 'shuffle', label: '随机播放一轮，到末尾停止', short: '随机播放', icon: '🔀' },
  { value: 'repeatShuffle', label: '每轮重新随机并持续播放', short: '重复随机', icon: '⟳' },
  { value: 'repeatAll', label: '按列表顺序循环播放', short: '列表循环', icon: '🔁' },
  { value: 'single', label: '持续循环当前这一首', short: '单曲循环', icon: '↻' },
];

const coverTones = ['sun', 'night', 'mint', 'coral', 'sky', 'grape'];

export default function Home() {
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [kind, setKind] = useState<MediaKind>('audio');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [mode, setMode] = useState<PlayMode>('order');
  const [lyricOpen, setLyricOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const pendingPlayRef = useRef(false);
  const shuffleQueueRef = useRef<number[]>([]);
  const shuffleHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/media?page=1&pageSize=500', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`媒体服务返回 ${response.status}`);
        return response.json() as Promise<{ items: MediaItem[]; total: number }>;
      })
      .then((data) => {
        setLibrary(data.items);
        setActiveId((current) => current ?? data.items[0]?.id ?? null);
      })
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message || '媒体库加载失败');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const items = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return library.filter((item) => {
      if (category === 'audio' && !item.hasAudio) return false;
      if (category === 'video' && !item.hasVideo) return false;
      return !keyword || `${item.sourceCode} ${item.title}`.toLowerCase().includes(keyword);
    });
  }, [category, library, query]);

  const active = library.find((item) => item.id === activeId) ?? library[0];
  const activeCover = active?.posterUrl;
  const source = kind === 'video' ? active?.videoUrl : active?.audioUrl;
  const playableItems = useMemo(() => items.filter((item) => item.hasAudio || item.hasVideo), [items]);

  const randomize = useCallback((ids: number[]) => {
    const result = [...ids];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const nextIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
    }
    return result;
  }, []);

  const selectTrack = useCallback((item: MediaItem, shouldPlay: boolean, preferredKind = kind) => {
    const nextKind = preferredKind === 'video' && item.hasVideo ? 'video' : item.hasAudio ? 'audio' : 'video';
    mediaRef.current?.pause();
    pendingPlayRef.current = shouldPlay;
    setActiveId(item.id);
    setKind(nextKind);
    setPlaying(false);
    setVideoOpen(nextKind === 'video');
    setCurrentTime(0);
    setDuration(0);
  }, [kind]);

  const goNext = useCallback((fromEnded = false) => {
    if (!active || playableItems.length === 0) return;
    if (fromEnded && mode === 'single') {
      if (mediaRef.current) {
        mediaRef.current.currentTime = 0;
        void mediaRef.current.play();
      }
      return;
    }
    let next: MediaItem | undefined;
    if (mode === 'shuffle' || mode === 'repeatShuffle') {
      if (shuffleQueueRef.current.length === 0) {
        if (mode === 'shuffle' && shuffleHistoryRef.current.length > 0) {
          setPlaying(false);
          return;
        }
        shuffleQueueRef.current = randomize(playableItems.filter((item) => item.id !== active.id).map((item) => item.id));
      }
      const nextId = shuffleQueueRef.current.shift();
      next = playableItems.find((item) => item.id === nextId);
      if (next) shuffleHistoryRef.current.push(active.id);
    } else {
      const index = playableItems.findIndex((item) => item.id === active.id);
      if (index >= 0 && index < playableItems.length - 1) next = playableItems[index + 1];
      if (!next && mode === 'repeatAll') next = playableItems[0];
    }
    if (next) selectTrack(next, true);
    else setPlaying(false);
  }, [active, mode, playableItems, randomize, selectTrack]);

  const goPrevious = useCallback(() => {
    if (!active || playableItems.length === 0) return;
    if (currentTime > 4 && mediaRef.current) {
      mediaRef.current.currentTime = 0;
      return;
    }
    let previous: MediaItem | undefined;
    if ((mode === 'shuffle' || mode === 'repeatShuffle') && shuffleHistoryRef.current.length > 0) {
      const previousId = shuffleHistoryRef.current.pop();
      previous = playableItems.find((item) => item.id === previousId);
    } else {
      const index = playableItems.findIndex((item) => item.id === active.id);
      if (index > 0) previous = playableItems[index - 1];
      else if (mode === 'repeatAll') previous = playableItems[playableItems.length - 1];
    }
    if (previous) selectTrack(previous, true);
  }, [active, currentTime, mode, playableItems, selectTrack]);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element || !source) return;
    element.load();
    setPlaying(false);
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      void element.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [source]);

  useEffect(() => {
    shuffleQueueRef.current = [];
    shuffleHistoryRef.current = [];
  }, [mode, playableItems]);

  const togglePlayback = async () => {
    const element = mediaRef.current;
    if (!element || !source) return;
    if (element.paused) {
      try {
        await element.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      element.pause();
      setPlaying(false);
    }
  };

  const seekBy = (seconds: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, Math.min(duration || 0, mediaRef.current.currentTime + seconds));
  };

  const switchKind = (nextKind: MediaKind) => {
    if (!active || (nextKind === 'audio' && !active.hasAudio) || (nextKind === 'video' && !active.hasVideo)) return;
    pendingPlayRef.current = playing;
    mediaRef.current?.pause();
    setKind(nextKind);
    setVideoOpen(nextKind === 'video');
  };

  const playerDock = active ? (
    <section className={`player-dock ${videoOpen ? 'video-dock' : ''}`} aria-label="当前播放器">
      <div className="mini-cover">{activeCover ? <img src={activeCover} alt="" /> : <span aria-hidden="true">♫</span>}</div>
      <div className="track-summary">
        <span className="now-label">{playing ? '正在播放' : '准备播放'}</span><strong>{active.title}</strong><span>{active.sourceCode} · {kind === 'audio' ? '音频模式' : '视频模式'}</span>
        <div className="format-switch"><button className={kind === 'audio' ? 'active' : ''} disabled={!active.hasAudio} onClick={() => switchKind('audio')} type="button">♫ 听</button><button className={kind === 'video' ? 'active' : ''} disabled={!active.hasVideo} onClick={() => switchKind('video')} type="button">▶ 看</button><button disabled={!active.hasLyric} onClick={() => setLyricOpen(true)} type="button">▤ 歌词</button><ModePicker compact mode={mode} onChange={setMode} /></div>
      </div>
      <div className="transport"><button type="button" aria-label="后退十秒" onClick={() => seekBy(-10)}>↶<small>10</small></button><button type="button" aria-label="上一首" onClick={goPrevious}>|◀</button><button className="primary-play" type="button" aria-label={playing ? '暂停' : '播放'} onClick={togglePlayback}>{playing ? 'Ⅱ' : '▶'}</button><button type="button" aria-label="下一首" onClick={() => goNext(false)}>▶|</button><button type="button" aria-label="前进十秒" onClick={() => seekBy(10)}>↷<small>10</small></button></div>
      <div className="progress-area">
        <span>{formatTime(currentTime)}</span>
        <input aria-label="播放进度" type="range" min="0" max={Math.max(duration, 0)} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (mediaRef.current) mediaRef.current.currentTime = value; setCurrentTime(value); }} style={{ '--progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties} />
        <span>{formatTime(duration)}</span>
      </div>
      <div className="dock-tail"><label className="volume-control"><span>🔊</span><input aria-label="音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (mediaRef.current) mediaRef.current.volume = value; }} /></label><ModePicker mode={mode} onChange={setMode} /></div>
    </section>
  ) : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="童声星球首页"><span className="brand-mark" aria-hidden="true">🌟</span><span>童声星球</span></div>
        <label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">搜索儿歌</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索编号或儿歌名称" /></label>
        <span className="favorite-orb" aria-hidden="true">★</span>
      </header>

      <div className="workspace">
        <aside className="category-panel" aria-label="内容分类">
          <p className="eyebrow">内容分类</p>
          <CategoryButton active={category === 'all'} icon="▦" label="全部" tone="yellow" onClick={() => setCategory('all')} />
          <CategoryButton active={category === 'audio'} icon="♫" label="儿歌" tone="coral" onClick={() => setCategory('audio')} />
          <CategoryButton active={category === 'video'} icon="▶" label="视频" tone="blue" onClick={() => setCategory('video')} />
        </aside>

        <section className="library" aria-labelledby="library-title">
          <div className="section-heading"><div><p className="eyebrow">快乐启蒙时间</p><h1 id="library-title">今天想听哪一首？</h1></div><span className="result-count">找到 {items.length} 首</span></div>

          {kind === 'audio' && active?.audioUrl && !videoOpen && (
            <audio key={`audio-${active.id}`} ref={(node) => { mediaRef.current = node; if (node) node.volume = volume; }} src={active.audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onEnded={() => goNext(true)} />
          )}

          {loading && <div className="status-panel"><span className="spinner" />正在整理儿歌架…</div>}
          {error && <div className="status-panel error-panel"><strong>媒体服务还没准备好</strong><span>{error}</span></div>}

          {!loading && !error && (
            <div className="song-grid">
              {items.map((item) => (
                <article className={`song-card ${active?.id === item.id ? 'selected' : ''}`} key={item.id}>
                  <button className={`cover cover-${coverToneFor(item.title)}`} type="button" aria-label={`${category === 'video' ? '播放视频' : '播放儿歌'} ${item.title}`} onClick={() => category === 'video' && item.hasVideo ? selectTrack(item, true, 'video') : selectTrack(item, true, item.hasAudio ? 'audio' : 'video')}>
                    {item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">{coverIconFor(item.title)}</span>}
                    {item.validationStatus === 'invalid' && <em>需检查</em>}
                  </button>
                  <div className="card-copy"><button className="card-title" type="button" onClick={() => selectTrack(item, true, item.hasAudio ? 'audio' : 'video')}>{item.title}</button><div className="media-actions">{item.hasAudio && <button className="audio-action" aria-label={`播放 ${item.title} 音频`} type="button" onClick={() => selectTrack(item, true, 'audio')}>♫</button>}{item.hasVideo && <button className="video-action" aria-label={`播放 ${item.title} 视频`} type="button" onClick={() => selectTrack(item, true, 'video')}>▶</button>}</div></div>
                </article>
              ))}
            </div>
          )}

          {!loading && !error && items.length === 0 && <div className="empty-state"><span aria-hidden="true">☁</span><h2>还没有找到这首歌</h2><p>试试输入编号，或者换一个英文单词。</p></div>}

        </section>
      </div>

      <div className="player-zone">{playerDock}</div>

      {videoOpen && kind === 'video' && active?.videoUrl && (
        <div className="video-overlay" role="presentation">
          <section className="video-player" role="dialog" aria-modal="true" aria-label={`${active.title} 视频`}>
            <header><div><span>正在播放视频</span><strong>{active.title}</strong></div><button type="button" onClick={() => { mediaRef.current?.pause(); setVideoOpen(false); setPlaying(false); if (active.hasAudio) setKind('audio'); }} aria-label="关闭视频">×</button></header>
            <video key={`video-${active.id}`} ref={(node) => { mediaRef.current = node; if (node) node.volume = volume; }} src={active.videoUrl} poster={activeCover} playsInline onClick={togglePlayback} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onEnded={() => goNext(true)} />
            {!playing && <button className="video-big-play" type="button" onClick={togglePlayback} aria-label="播放视频">▶</button>}
          </section>
        </div>
      )}

      {lyricOpen && active?.lyricUrl && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setLyricOpen(false)}>
          <section className="lyric-dialog" role="dialog" aria-modal="true" aria-label={`${active.title} 歌词`} onClick={(event) => event.stopPropagation()}>
            <header><div><span>跟着一起唱</span><strong>{active.title}</strong></div><button type="button" onClick={() => setLyricOpen(false)} aria-label="关闭歌词">×</button></header>
            <div className="lyric-scroll"><img src={active.lyricUrl} alt={`${active.title} 歌词图片`} /></div>
          </section>
        </div>
      )}
    </main>
  );
}

function ModePicker({ mode, onChange, compact = false }: { mode: PlayMode; onChange: (mode: PlayMode) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selected = playModes.find((item) => item.value === mode) ?? playModes[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  return (
    <div className={`mode-picker ${compact ? 'compact-mode-picker' : ''}`} ref={pickerRef}>
      <button className="mode-button" type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`播放模式：${selected.short}`} title={selected.label} onClick={() => setOpen((value) => !value)}>
        <span className="mode-trigger-icon" aria-hidden="true">{selected.icon}</span>{!compact && <span>{selected.short}</span>}<span className="mode-caret" aria-hidden="true">⌃</span>
      </button>
      {open && (
        <div className="mode-menu" role="listbox" aria-label="选择播放模式">
          {playModes.map((item) => (
            <button className={`mode-option ${item.value === mode ? 'active' : ''}`} type="button" role="option" aria-selected={item.value === mode} key={item.value} onClick={() => { onChange(item.value); setOpen(false); }}>
              <span className="mode-option-icon" aria-hidden="true">{item.icon}</span>
              <span className="mode-option-copy"><strong>{item.short}</strong><small>{item.label}</small></span>
              {item.value === mode && <span className="mode-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryButton({ active, icon, label, tone, onClick }: { active: boolean; icon: string; label: string; tone: string; onClick: () => void }) {
  return <button className={`category ${active ? 'active' : ''}`} type="button" onClick={onClick}><span className={`category-icon ${tone}`}>{icon}</span>{label}</button>;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function coverToneFor(title: string) {
  const value = Array.from(title).reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
  return coverTones[value % coverTones.length];
}

function coverIconFor(title: string) {
  const value = title.toLowerCase();
  const rules: Array<[string[], string]> = [
    [['shark'], '🦈'], [['fish', 'ocean', 'sea', 'sailor', 'jellyfish'], '🐠'],
    [['duck', 'chick', 'bird', 'robin'], '🐥'], [['frog'], '🐸'], [['spider'], '🕷️'],
    [['dinosaur'], '🦕'], [['bear', 'teddy'], '🧸'], [['monkey'], '🐒'], [['pet', 'farm', 'macdonald'], '🐮'],
    [['bus'], '🚌'], [['car'], '🚗'], [['truck', 'tractor'], '🚚'], [['airplane', 'rocket', 'planet'], '🚀'], [['boat', 'bay'], '⛵'], [['bicycle'], '🚲'],
    [['christmas', 'santa', 'reindeer', 'jingle', 'snow', 'elf'], '🎄'], [['halloween', 'ghost', 'monster', 'pumpkin', 'spooky'], '🎃'],
    [['star', 'night', 'dream', 'sleep', 'bed', 'nap'], '🌙'], [['sun', 'weather', 'rain'], '🌤️'], [['rainbow', 'color', 'blue', 'pink', 'yellow', 'purple'], '🌈'],
    [['alphabet', 'abc'], '🔤'], [['count', 'number', 'ten', 'seven', 'six', 'five'], '🔢'],
    [['ice cream'], '🍦'], [['pizza'], '🍕'], [['apple'], '🍎'], [['banana'], '🍌'], [['cookie'], '🍪'],
    [['happy', 'friend', 'love', 'hello'], '💛'], [['dance', 'move', 'walking', 'follow'], '💃'],
  ];
  return rules.find(([keywords]) => keywords.some((keyword) => value.includes(keyword)))?.[1] ?? '🎵';
}
