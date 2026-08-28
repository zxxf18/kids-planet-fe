'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Tag = { slug: string; name: string; icon: string; count?: number };
type MediaItem = {
  id: number;
  sourceCode: string;
  title: string;
  titleZh: string;
  hasAudio: boolean;
  hasVideo: boolean;
  hasLyrics: boolean;
  hasPoster: boolean;
  audioDurationMs?: number;
  videoDurationMs?: number;
  validationStatus: 'ready' | 'partial' | 'invalid';
  audioUrl?: string;
  videoUrl?: string;
  lyricsUrl?: string;
  posterUrl?: string;
  tags: Tag[];
};
type MediaKind = 'audio' | 'video';
type PlayMode = 'order' | 'shuffle' | 'repeatShuffle' | 'repeatAll' | 'single';
type Filter = 'all' | 'favorites' | string;
type LyricLine = { time: number; text: string };

const PAGE_SIZE = 30;
const FAVORITES_KEY = 'kids-planet-favorites-v1';
const playModes: { value: Exclude<PlayMode, 'single'>; label: string; short: string; icon: string }[] = [
  { value: 'order', label: '按顺序播完后停止', short: '顺序播放', icon: '⇥' },
  { value: 'shuffle', label: '随机播放一轮', short: '随机播放', icon: '⤨' },
  { value: 'repeatShuffle', label: '每轮重新随机并持续播放', short: '重复随机', icon: '⟳' },
  { value: 'repeatAll', label: '按列表顺序循环播放', short: '列表循环', icon: '↻' },
];
const coverTones = ['sun', 'night', 'mint', 'coral', 'sky', 'grape'];

export default function Home() {
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
      return Array.isArray(stored) ? stored.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
    } catch { return []; }
  });
  const [active, setActive] = useState<MediaItem | null>(null);
  const [kind, setKind] = useState<MediaKind>('audio');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [mode, setMode] = useState<PlayMode>('order');
  const [lastNonSingleMode, setLastNonSingleMode] = useState<Exclude<PlayMode, 'single'>>('order');
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsStatus, setLyricsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoCountdown, setVideoCountdown] = useState<number | null>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingPlayRef = useRef(false);
  const pendingTimeRef = useRef<number | null>(null);
  const shuffleQueueRef = useRef<number[]>([]);
  const shuffleHistoryRef = useRef<number[]>([]);
  const requestVersionRef = useRef(0);
  const libraryRef = useRef<HTMLDivElement | null>(null);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const lyricLineRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    fetch('/kidstar/api/v1/tags')
      .then((response) => response.ok ? response.json() as Promise<{ items: Tag[] }> : Promise.reject(new Error('标签加载失败')))
      .then((data) => setTags(data.items))
      .catch(() => setTags([]));
  }, []);

  const favoriteQuery = filter === 'favorites' ? favoriteIds.join(',') : '';
  const buildListURL = useCallback((targetPage: number) => {
    const params = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) });
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (filter !== 'all' && filter !== 'favorites') params.set('tag', filter);
    if (filter === 'favorites' && favoriteQuery) params.set('ids', favoriteQuery);
    return `/kidstar/api/v1/media?${params.toString()}`;
  }, [debouncedQuery, favoriteQuery, filter]);

  const fetchPage = useCallback(async (targetPage: number, version: number) => {
    if (filter === 'favorites' && !favoriteQuery) {
      return { items: [] as MediaItem[], total: 0, page: 1, pageSize: PAGE_SIZE };
    }
    const response = await fetch(buildListURL(targetPage));
    if (!response.ok) throw new Error(`媒体服务返回 ${response.status}`);
    const data = await response.json() as { items: MediaItem[]; total: number; page: number; pageSize: number };
    if (version !== requestVersionRef.current) throw new DOMException('stale request', 'AbortError');
    return data;
  }, [buildListURL, favoriteQuery, filter]);

  useEffect(() => {
    const version = ++requestVersionRef.current;
    void (async () => {
      setLoading(true); setError(''); setPage(1); setLibrary([]);
      libraryRef.current?.scrollTo({ top: 0 });
      try {
        const data = await fetchPage(1, version);
        setLibrary(data.items); setTotal(data.total);
      } catch (reason) {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message || '媒体库加载失败');
      } finally { if (version === requestVersionRef.current) setLoading(false); }
    })();
  }, [fetchPage]);

  const hasMore = library.length < total;
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return [] as MediaItem[];
    const version = requestVersionRef.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextPage, version);
      setLibrary((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...data.items.filter((item) => !known.has(item.id))];
      });
      setPage(nextPage);
      setTotal(data.total);
      return data.items;
    } catch (reason) {
      if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      return [] as MediaItem[];
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    const root = libraryRef.current;
    const target = loadSentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { root, rootMargin: '280px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

  const playableItems = useMemo(() => library.filter((item) => item.hasAudio || item.hasVideo), [library]);
  const currentLyricIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    for (let index = lyrics.length - 1; index >= 0; index -= 1) if (currentTime >= lyrics[index].time) return index;
    return 0;
  }, [currentTime, lyrics]);

  useEffect(() => {
    if (lyricsOpen && currentLyricIndex >= 0) {
      lyricLineRefs.current[currentLyricIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLyricIndex, lyricsOpen]);

  useEffect(() => {
    if (!lyricsOpen || !active?.lyricsUrl) return;
    const controller = new AbortController();
    void (async () => {
      setLyricsStatus('loading'); setLyrics([]);
      try {
        const response = await fetch(active.lyricsUrl!, { signal: controller.signal });
        if (!response.ok) throw new Error(`歌词服务返回 ${response.status}`);
        setLyrics(parseLyrics(await response.text())); setLyricsStatus('ready');
      } catch (reason) {
        if (reason instanceof Error && reason.name !== 'AbortError') setLyricsStatus('error');
      }
    })();
    return () => controller.abort();
  }, [active?.id, active?.lyricsUrl, lyricsOpen]);

  const randomize = useCallback((ids: number[]) => {
    const result = [...ids];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const nextIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
    }
    return result;
  }, []);

  const selectTrack = useCallback((item: MediaItem, shouldPlay: boolean, preferredKind: MediaKind = 'audio') => {
    const nextKind = preferredKind === 'video' && item.hasVideo ? 'video' : item.hasAudio ? 'audio' : 'video';
    audioRef.current?.pause();
    videoRef.current?.pause();
    pendingPlayRef.current = shouldPlay;
    pendingTimeRef.current = null;
    setActive(item);
    setKind(nextKind);
    setVideoOpen(nextKind === 'video');
    if (nextKind === 'video') setLyricsOpen(false);
    setVideoCountdown(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (nextKind === 'audio' && item.audioUrl && audioRef.current) {
      const element = audioRef.current;
      mediaRef.current = element;
      element.src = item.audioUrl;
      pendingPlayRef.current = false;
      if (shouldPlay) void element.play().catch(() => setPlaying(false));
    }
  }, []);

  const goNext = useCallback(async (fromEnded = false) => {
    if (!active || playableItems.length === 0) return;
    if (fromEnded && mode === 'single') {
      if (mediaRef.current) { mediaRef.current.currentTime = 0; void mediaRef.current.play(); }
      return;
    }
    let next: MediaItem | undefined;
    if (mode === 'shuffle' || mode === 'repeatShuffle') {
      if (shuffleQueueRef.current.length === 0) {
        if (mode === 'shuffle' && shuffleHistoryRef.current.length > 0) { setPlaying(false); return; }
        shuffleQueueRef.current = randomize(playableItems.filter((item) => item.id !== active.id).map((item) => item.id));
      }
      const nextId = shuffleQueueRef.current.shift();
      next = playableItems.find((item) => item.id === nextId);
      if (next) shuffleHistoryRef.current.push(active.id);
    } else {
      const index = playableItems.findIndex((item) => item.id === active.id);
      if (index >= 0 && index < playableItems.length - 1) next = playableItems[index + 1];
      if (!next && hasMore) next = (await loadMore()).find((item) => item.hasAudio || item.hasVideo);
      if (!next && mode === 'repeatAll') next = playableItems[0];
    }
    if (next) selectTrack(next, true, kind === 'video' && next.hasVideo ? 'video' : 'audio');
    else setPlaying(false);
  }, [active, hasMore, kind, loadMore, mode, playableItems, randomize, selectTrack]);

  const goPrevious = useCallback(() => {
    if (!active || playableItems.length === 0) return;
    if (currentTime > 4 && mediaRef.current) { mediaRef.current.currentTime = 0; return; }
    let previous: MediaItem | undefined;
    if ((mode === 'shuffle' || mode === 'repeatShuffle') && shuffleHistoryRef.current.length > 0) {
      const previousId = shuffleHistoryRef.current.pop();
      previous = playableItems.find((item) => item.id === previousId);
    } else {
      const index = playableItems.findIndex((item) => item.id === active.id);
      if (index > 0) previous = playableItems[index - 1];
      else if (mode === 'repeatAll') previous = playableItems[playableItems.length - 1];
    }
    if (previous) selectTrack(previous, true, kind === 'video' && previous.hasVideo ? 'video' : 'audio');
  }, [active, currentTime, kind, mode, playableItems, selectTrack]);

  useEffect(() => { shuffleQueueRef.current = []; shuffleHistoryRef.current = []; }, [mode, playableItems]);

  const handleMediaReady = async (element: HTMLMediaElement) => {
    if (pendingTimeRef.current !== null) {
      element.currentTime = Math.min(pendingTimeRef.current, Number.isFinite(element.duration) ? element.duration : pendingTimeRef.current);
      pendingTimeRef.current = null;
    }
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      try { await element.play(); } catch { setPlaying(false); }
    }
  };

  const togglePlayback = async () => {
    if (!active) return;
    const element = mediaRef.current;
    if (!element) return;
    if (element.paused) {
      try { await element.play(); } catch { setPlaying(false); }
    } else element.pause();
  };

  const seekBy = (seconds: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, Math.min(duration || 0, mediaRef.current.currentTime + seconds));
  };

  const switchKind = (nextKind: MediaKind) => {
    if (!active || (nextKind === 'audio' && !active.hasAudio) || (nextKind === 'video' && !active.hasVideo)) return;
    pendingPlayRef.current = playing;
    pendingTimeRef.current = currentTime;
    mediaRef.current?.pause();
    setKind(nextKind);
    setVideoOpen(nextKind === 'video');
    if (nextKind === 'video') setLyricsOpen(false);
    if (nextKind === 'audio' && active.audioUrl && audioRef.current) {
      const element = audioRef.current;
      mediaRef.current = element;
      element.src = active.audioUrl;
      element.currentTime = currentTime;
      pendingPlayRef.current = false;
      pendingTimeRef.current = null;
      if (playing) void element.play().catch(() => setPlaying(false));
    }
  };

  const closeVideo = () => {
    setVideoCountdown(null);
    if (active?.hasAudio) switchKind('audio');
    else { mediaRef.current?.pause(); setVideoOpen(false); setPlaying(false); }
  };

  const handleEnded = () => {
    if (kind !== 'video' || mode === 'single') { void goNext(true); return; }
    setVideoCountdown(3);
  };

  useEffect(() => {
    if (videoCountdown === null) return;
    const timeout = window.setTimeout(() => {
      if (videoCountdown <= 1) { setVideoCountdown(null); void goNext(true); }
      else setVideoCountdown(videoCountdown - 1);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [goNext, videoCountdown]);

  const toggleFavorite = (id: number) => {
    setFavoriteIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setListMode = (next: Exclude<PlayMode, 'single'>) => {
    setLastNonSingleMode(next);
    setMode(next);
  };

  const toggleSingleRepeat = () => setMode((current) => current === 'single' ? lastNonSingleMode : 'single');
  const selectedMode = mode === 'single' ? lastNonSingleMode : mode;

  return (
    <main className={`app-shell ${lyricsOpen ? 'lyrics-expanded' : ''}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => { setFilter('all'); setQuery(''); }} aria-label="返回全部儿歌">
          <span className="brand-mark" aria-hidden="true">🌟</span><span>童声星球</span>
        </button>
        <label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">搜索儿歌</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名、英文名或编号" /></label>
        <button className={`favorite-orb ${filter === 'favorites' ? 'active' : ''}`} type="button" aria-label="查看收藏" onClick={() => setFilter('favorites')}>★</button>
      </header>

      <div className="workspace">
        <nav className="category-panel" aria-label="儿歌主题">
          <FilterButton active={filter === 'all'} icon="▦" label="全部" count={filter === 'all' ? total : undefined} onClick={() => setFilter('all')} />
          <FilterButton active={filter === 'favorites'} icon="★" label="收藏" count={favoriteIds.length} onClick={() => setFilter('favorites')} />
          {tags.map((tag) => <FilterButton key={tag.slug} active={filter === tag.slug} icon={tag.icon} label={tag.name} count={tag.count} onClick={() => setFilter(tag.slug)} />)}
        </nav>

        <section className="library" aria-label="儿歌列表" ref={libraryRef}>
          <div className="library-heading"><div><strong>{filterLabel(filter, tags)}</strong><span>{total ? `共 ${total} 首` : '挑一首开始吧'}</span></div>{debouncedQuery && <button type="button" onClick={() => setQuery('')}>清除搜索</button>}</div>

          <audio ref={(node) => { audioRef.current = node; if (node) { node.volume = volume; if (kind === 'audio') mediaRef.current = node; } }} preload="none" onLoadedMetadata={(event) => void handleMediaReady(event.currentTarget)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onEnded={handleEnded} />

          {loading && <div className="song-grid skeleton-grid">{Array.from({ length: 12 }, (_, index) => <div className="song-card skeleton-card" key={index}><span /><i /><i /></div>)}</div>}
          {error && !loading && <div className="status-panel error-panel"><strong>儿歌架暂时没有打开</strong><span>{error}</span><button type="button" onClick={() => window.location.reload()}>重新试试</button></div>}

          {!loading && !error && (
            <div className="song-grid">
              {library.map((item) => {
                const favorite = favoriteIds.includes(item.id);
                return (
                  <article className={`song-card ${active?.id === item.id ? 'selected' : ''} ${active?.id === item.id && playing ? 'is-playing' : ''}`} key={item.id}>
                    <button className={`cover cover-${coverToneFor(item.title)}`} type="button" aria-label={`播放 ${item.titleZh || item.title}`} onClick={() => selectTrack(item, true, item.hasAudio ? 'audio' : 'video')}>
                      {item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">{coverIconFor(item.title)}</span>}
                      <small>{item.sourceCode}</small>
                      <em>{formatTime((item.audioDurationMs ?? item.videoDurationMs ?? 0) / 1000)}</em>
                      {active?.id === item.id && playing && <b className="playing-bars" aria-label="正在播放"><i /><i /><i /></b>}
                    </button>
                    <button className={`card-favorite ${favorite ? 'active' : ''}`} type="button" aria-label={favorite ? '取消收藏' : '加入收藏'} onClick={() => toggleFavorite(item.id)}>★</button>
                    {item.hasVideo && <button className="watch-action" type="button" onClick={() => selectTrack(item, true, 'video')}><span>▶</span>看动画</button>}
                    <button className="card-copy" type="button" onClick={() => selectTrack(item, true, item.hasAudio ? 'audio' : 'video')} title={`${item.titleZh}\n${item.title}`}>
                      <strong>{item.titleZh || '快乐英文儿歌'}</strong><span>{item.title}</span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && !error && library.length === 0 && <div className="empty-state"><span aria-hidden="true">☁</span><h2>{filter === 'favorites' ? '还没有收藏儿歌' : '没有找到这首歌'}</h2><p>{filter === 'favorites' ? '点卡片右上角的小星星，就能放进这里。' : '试试中文名、英文名或三位编号。'}</p></div>}
          <div className="load-sentinel" ref={loadSentinelRef}>{loadingMore ? <><span className="spinner" />正在搬来更多儿歌…</> : hasMore ? '继续向下滑，还有更多' : library.length > 0 ? '已经看到这一组的全部儿歌啦' : ''}</div>
        </section>
      </div>

      <div className="player-zone">
        <section className={`player-dock ${lyricsOpen ? 'with-lyrics' : ''}`} aria-label="当前播放器">
          {lyricsOpen && <div className="lyrics-panel">
            <button className="drawer-handle" type="button" onClick={() => setLyricsOpen(false)} aria-label="收起歌词"><span /></button>
            <div className="lyrics-title"><span>♫ 跟着一起唱</span><button type="button" onClick={() => setLyricsOpen(false)}>收起歌词⌄</button></div>
            <div className="lyrics-scroll">
              {lyricsStatus === 'loading' && <p className="lyric-message">歌词正在打开…</p>}
              {lyricsStatus === 'error' && <p className="lyric-message">这首歌词暂时没有准备好</p>}
              {lyricsStatus === 'ready' && lyrics.length === 0 && <p className="lyric-message">这首歌词还是空的</p>}
              {lyrics.map((line, index) => <p key={`${line.time}-${index}`} ref={(node) => { lyricLineRefs.current[index] = node; }} className={index === currentLyricIndex ? 'active' : index < currentLyricIndex ? 'passed' : ''} onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = line.time; }}>{line.text}</p>)}
            </div>
          </div>}

          <div className="player-main">
            <div className="track-info">
              <div className="mini-cover">{active?.posterUrl ? <img src={active.posterUrl} alt="" /> : <span aria-hidden="true">♫</span>}</div>
              <div className="track-summary"><span className="now-label">{active ? playing ? '正在播放' : '已选中' : '欢迎来到童声星球'}</span><strong>{active?.titleZh ?? '选一首儿歌开始'}</strong><span>{active?.title ?? '听儿歌、看动画、跟唱歌词'}</span></div>
            </div>

            <div className="transport">
              <button type="button" aria-label="后退十秒" disabled={!active} onClick={() => seekBy(-10)}>↶<small>10</small></button>
              <button type="button" aria-label="上一首" disabled={!active} onClick={goPrevious}>|◀</button>
              <button className="primary-play" type="button" aria-label={playing ? '暂停' : '播放'} disabled={!active} onClick={togglePlayback}>{playing ? 'Ⅱ' : '▶'}</button>
              <button type="button" aria-label="下一首" disabled={!active} onClick={() => void goNext(false)}>▶|</button>
              <button type="button" aria-label="前进十秒" disabled={!active} onClick={() => seekBy(10)}>↷<small>10</small></button>
            </div>

            <div className="player-actions">
              <button className={kind === 'audio' && !videoOpen ? 'active' : ''} disabled={!active?.hasAudio} onClick={() => switchKind('audio')} type="button">♫<span>听</span></button>
              <button className={kind === 'video' && videoOpen ? 'active video' : ''} disabled={!active?.hasVideo} onClick={() => switchKind('video')} type="button">▶<span>看</span></button>
              <button className={lyricsOpen ? 'active lyrics' : ''} disabled={!active?.hasLyrics} onClick={() => { if (videoOpen) closeVideo(); setLyricsOpen((open) => !open); }} type="button">▤<span>歌词</span></button>
              <button className={mode === 'single' ? 'active repeat-one' : ''} disabled={!active} onClick={toggleSingleRepeat} type="button" aria-pressed={mode === 'single'} title="单曲循环">↻<sup>1</sup><span>单曲</span></button>
              <ModePicker mode={selectedMode} onChange={setListMode} />
            </div>

            <div className="progress-area"><span>{formatTime(currentTime)}</span><input aria-label="播放进度" type="range" min="0" max={Math.max(duration, 0)} step="0.1" disabled={!active} value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (mediaRef.current) mediaRef.current.currentTime = value; setCurrentTime(value); }} style={{ '--progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties} /><span>{formatTime(duration || (active?.audioDurationMs ?? active?.videoDurationMs ?? 0) / 1000)}</span></div>
            <label className="volume-control"><span>🔊</span><input aria-label="音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (mediaRef.current) mediaRef.current.volume = value; }} /></label>
          </div>
        </section>
      </div>

      {videoOpen && kind === 'video' && active?.videoUrl && <div className="video-overlay" role="presentation" onClick={closeVideo}>
        <section className="video-player" role="dialog" aria-modal="true" aria-label={`${active.titleZh} 视频`} onClick={(event) => event.stopPropagation()}>
          <button className="back-to-library" type="button" onClick={closeVideo}>← 返回儿歌架</button>
          <video key={`video-${active.id}`} ref={(node) => { videoRef.current = node; mediaRef.current = node; if (node) node.volume = volume; }} src={active.videoUrl} poster={active.posterUrl} preload="metadata" playsInline controls onLoadedMetadata={(event) => void handleMediaReady(event.currentTarget)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onEnded={handleEnded} />
          {!playing && videoCountdown === null && <button className="video-big-play" type="button" onClick={togglePlayback} aria-label="播放视频">▶</button>}
          {videoCountdown !== null && <div className="next-video-countdown"><strong>{videoCountdown} 秒后播放下一首</strong><button type="button" onClick={() => setVideoCountdown(null)}>留在这里</button></div>}
        </section>
      </div>}
    </main>
  );
}

function ModePicker({ mode, onChange }: { mode: Exclude<PlayMode, 'single'>; onChange: (mode: Exclude<PlayMode, 'single'>) => void }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selected = playModes.find((item) => item.value === mode) ?? playModes[0];
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!pickerRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside); document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [open]);
  return <div className="mode-picker" ref={pickerRef}>
    <button className="mode-button" type="button" aria-haspopup="listbox" aria-expanded={open} title={selected.label} onClick={() => setOpen((value) => !value)}><span>{selected.icon}</span><b>{selected.short}</b><i>⌃</i></button>
    {open && <div className="mode-menu" role="listbox">{playModes.map((item) => <button className={item.value === mode ? 'active' : ''} type="button" role="option" aria-selected={item.value === mode} key={item.value} onClick={() => { onChange(item.value); setOpen(false); }}><span>{item.icon}</span><span><strong>{item.short}</strong><small>{item.label}</small></span>{item.value === mode && <b>✓</b>}</button>)}</div>}
  </div>;
}

function FilterButton({ active, icon, label, count, onClick }: { active: boolean; icon: string; label: string; count?: number; onClick: () => void }) {
  return <button className={`category ${active ? 'active' : ''}`} type="button" onClick={onClick}><span className="category-icon">{icon}</span><strong>{label}</strong>{typeof count === 'number' && <small>{count}</small>}</button>;
}

function filterLabel(filter: Filter, tags: Tag[]) {
  if (filter === 'all') return '全部儿歌';
  if (filter === 'favorites') return '我的收藏';
  return tags.find((tag) => tag.slug === filter)?.name ?? '主题儿歌';
}

function parseLyrics(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const matches = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const content = raw.replace(/\[[^\]]+\]/g, '').trim();
    if (!content || matches.length === 0) continue;
    for (const match of matches) {
      const fraction = match[3] ? Number(`0.${match[3].padEnd(3, '0').slice(0, 3)}`) : 0;
      lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, text: content });
    }
  }
  if (lines.length > 0) return lines.sort((left, right) => left.time - right.time);
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => ({ time: index * 5, text: line }));
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function coverToneFor(title: string) {
  const value = Array.from(title).reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
  return coverTones[value % coverTones.length];
}

function coverIconFor(title: string) {
  const value = title.toLowerCase();
  const rules: Array<[string[], string]> = [
    [['shark'], '🦈'], [['fish', 'ocean', 'sea', 'sailor', 'jellyfish'], '🐠'], [['duck', 'chick', 'bird'], '🐥'], [['frog'], '🐸'], [['spider'], '🕷️'], [['dinosaur'], '🦕'], [['bear', 'teddy'], '🧸'], [['monkey'], '🐒'], [['pet', 'farm', 'macdonald'], '🐮'],
    [['bus'], '🚌'], [['car'], '🚗'], [['truck', 'tractor'], '🚚'], [['airplane', 'rocket', 'planet'], '🚀'], [['boat', 'bay'], '⛵'], [['bicycle'], '🚲'], [['christmas', 'santa', 'reindeer', 'jingle', 'snow', 'elf'], '🎄'], [['halloween', 'ghost', 'monster', 'pumpkin', 'spooky'], '🎃'],
    [['star', 'night', 'dream', 'sleep', 'bed', 'nap'], '🌙'], [['sun', 'weather', 'rain'], '🌤️'], [['rainbow', 'color', 'blue', 'pink', 'yellow', 'purple'], '🌈'], [['alphabet', 'abc'], '🔤'], [['count', 'number', 'ten', 'seven', 'six', 'five'], '🔢'], [['ice cream'], '🍦'], [['pizza'], '🍕'], [['apple'], '🍎'], [['banana'], '🍌'], [['cookie'], '🍪'], [['happy', 'friend', 'love', 'hello'], '💛'], [['dance', 'move', 'walking', 'follow'], '💃'],
  ];
  return rules.find(([keywords]) => keywords.some((keyword) => value.includes(keyword)))?.[1] ?? '🎵';
}
