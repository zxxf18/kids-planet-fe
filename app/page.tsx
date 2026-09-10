'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';

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
  videoSources?: Partial<Record<VideoQuality, string>>;
  lyricsSources?: Partial<Record<LyricLanguage, string>>;
  posterUrl?: string;
  tags: Tag[];
};
type MediaKind = 'audio' | 'video';
type VideoQuality = '480' | '720';
type LyricLanguage = 'en' | 'zh' | 'bilingual';
type PlayMode = 'order' | 'shuffle' | 'repeatShuffle' | 'repeatAll' | 'single';
type Filter = 'all' | 'favorites' | string;
type LyricLine = { time: number; text: string };

const PAGE_SIZE = 30;
const FAVORITES_KEY = 'kids-planet-favorites-v1';
const LYRIC_LANGUAGE_KEY = 'kids-planet-lyric-language-v1';
const playModes: { value: Exclude<PlayMode, 'single'>; label: string; short: string; icon: IconName }[] = [
  { value: 'order', label: '按顺序播完后停止', short: '顺序播放', icon: 'order' },
  { value: 'shuffle', label: '随机播放一轮', short: '随机播放', icon: 'shuffle' },
  { value: 'repeatShuffle', label: '每轮重新随机并持续播放', short: '重复随机', icon: 'repeatShuffle' },
  { value: 'repeatAll', label: '按列表顺序循环播放', short: '列表循环', icon: 'repeatAll' },
];
const tagIcons: Record<string, IconName> = {
  animals: 'animals', numbers: 'numbers', colors: 'colors', holidays: 'holidays',
  vehicles: 'vehicles', bedtime: 'bedtime', alphabet: 'alphabet', movement: 'movement',
  routines: 'routines', food: 'food', nature: 'nature', friends: 'friends',
};
const coverTones = ['sun', 'night', 'mint', 'coral', 'sky', 'grape'];
const videoFrames = [
  { id: 'space', label: '星空伙伴', src: '/video-frames/space-v2.webp' },
  { id: 'rainbow', label: '彩虹云朵', src: '/video-frames/rainbow-v2.webp' },
  { id: 'woodland', label: '森林动物', src: '/video-frames/woodland-v2.webp' },
  { id: 'ocean', label: '海底世界', src: '/video-frames/ocean-v2.webp' },
  { id: 'dinosaur', label: '恐龙乐园', src: '/video-frames/dinosaur-v2.webp' },
  { id: 'toys', label: '玩具火车', src: '/video-frames/toys-v2.webp' },
] as const;
const lyricLanguages: { value: LyricLanguage; label: string }[] = [
  { value: 'en', label: '英文' },
  { value: 'zh', label: '中文' },
  { value: 'bilingual', label: '中英' },
];

function randomVideoFrameIndex(current: number | null) {
  if (videoFrames.length < 2) return 0;
  const candidate = Math.floor(Math.random() * (current === null ? videoFrames.length : videoFrames.length - 1));
  return current !== null && candidate >= current ? candidate + 1 : candidate;
}

function preferredVideoQuality(): VideoQuality {
  if (typeof window === 'undefined') return '720';
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const constrainedNetwork = connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === '3g';
  return constrainedNetwork || window.matchMedia('(max-width: 820px)').matches ? '480' : '720';
}

function availableVideoQuality(item: MediaItem, preferred: VideoQuality): VideoQuality {
  if (item.videoSources?.[preferred]) return preferred;
  return preferred === '720' && item.videoSources?.['480'] ? '480' : '720';
}

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
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('720');
  const [mode, setMode] = useState<PlayMode>('order');
  const [lastNonSingleMode, setLastNonSingleMode] = useState<Exclude<PlayMode, 'single'>>('order');
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricLanguage, setLyricLanguage] = useState<LyricLanguage>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem(LYRIC_LANGUAGE_KEY);
    return stored === 'zh' || stored === 'bilingual' ? stored : 'en';
  });
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsStatus, setLyricsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoFrameIndex, setVideoFrameIndex] = useState<number | null>(null);
  const [videoSubtitlesEnabled, setVideoSubtitlesEnabled] = useState(false);
  const [videoLyrics, setVideoLyrics] = useState<LyricLine[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(true);
  const [videoCountdown, setVideoCountdown] = useState<number | null>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStageRef = useRef<HTMLDivElement | null>(null);
  const previousVolumeRef = useRef(0.85);
  const pendingPlayRef = useRef(false);
  const pendingTimeRef = useRef<number | null>(null);
  const shuffleQueueRef = useRef<number[]>([]);
  const shuffleHistoryRef = useRef<number[]>([]);
  const requestVersionRef = useRef(0);
  const libraryRef = useRef<HTMLDivElement | null>(null);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const lyricLineRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const fullscreenControlsTimerRef = useRef<number | null>(null);
  const fullscreenActive = isFullscreen || isPseudoFullscreen;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    fetch('/api/v1/tags')
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
    return `/api/v1/media?${params.toString()}`;
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
  const selectedLyricURL = active?.lyricsSources?.[lyricLanguage] ?? active?.lyricsSources?.en;
  const activeVideoURL = active?.videoSources?.[videoQuality];
  const currentLyricIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    for (let index = lyrics.length - 1; index >= 0; index -= 1) if (currentTime >= lyrics[index].time) return index;
    return 0;
  }, [currentTime, lyrics]);
  const currentVideoLyricIndex = useMemo(() => {
    if (videoLyrics.length === 0) return -1;
    for (let index = videoLyrics.length - 1; index >= 0; index -= 1) if (currentTime >= videoLyrics[index].time) return index;
    return -1;
  }, [currentTime, videoLyrics]);

  useEffect(() => {
    if (lyricsOpen && currentLyricIndex >= 0) {
      lyricLineRefs.current[currentLyricIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLyricIndex, lyricsOpen]);

  useEffect(() => {
    if (!lyricsOpen || !selectedLyricURL) return;
    const controller = new AbortController();
    void (async () => {
      setLyricsStatus('loading'); setLyrics([]);
      try {
        const response = await fetch(selectedLyricURL, { signal: controller.signal });
        if (!response.ok) throw new Error(`歌词服务返回 ${response.status}`);
        setLyrics(parseLyrics(await response.text())); setLyricsStatus('ready');
      } catch (reason) {
        if (reason instanceof Error && reason.name !== 'AbortError') setLyricsStatus('error');
      }
    })();
    return () => controller.abort();
  }, [active?.id, lyricsOpen, selectedLyricURL]);

  useEffect(() => {
    const url = active?.lyricsSources?.zh;
    if (!videoOpen || !videoSubtitlesEnabled || !url) {
      const timeout = window.setTimeout(() => setVideoLyrics([]), 0);
      return () => window.clearTimeout(timeout);
    }
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error('中文字幕加载失败')))
      .then((text) => setVideoLyrics(parseLyrics(text)))
      .catch((reason: unknown) => { if (!(reason instanceof Error && reason.name === 'AbortError')) setVideoLyrics([]); });
    return () => controller.abort();
  }, [active?.id, active?.lyricsSources?.zh, videoOpen, videoSubtitlesEnabled]);

  useEffect(() => {
    const preload = () => videoFrames.forEach((frame) => { const image = new Image(); image.decoding = 'async'; image.src = frame.src; });
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(preload, { timeout: 900 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const timeout = window.setTimeout(preload, 120);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === videoStageRef.current;
      setIsFullscreen(active);
      if (!active) {
        const orientation = screen.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined;
        try { orientation?.unlock?.(); } catch { /* The browser may not expose orientation unlock. */ }
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isPseudoFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPseudoFullscreen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPseudoFullscreen]);

  const revealFullscreenControls = useCallback(() => {
    if (fullscreenControlsTimerRef.current !== null) {
      window.clearTimeout(fullscreenControlsTimerRef.current);
      fullscreenControlsTimerRef.current = null;
    }
    setFullscreenControlsVisible(true);
    if (fullscreenActive && playing) {
      fullscreenControlsTimerRef.current = window.setTimeout(() => {
        setFullscreenControlsVisible(false);
        fullscreenControlsTimerRef.current = null;
      }, 5000);
    }
  }, [fullscreenActive, playing]);

  useEffect(() => {
    const initializeTimer = window.setTimeout(revealFullscreenControls, 0);
    return () => {
      window.clearTimeout(initializeTimer);
      if (fullscreenControlsTimerRef.current !== null) {
        window.clearTimeout(fullscreenControlsTimerRef.current);
        fullscreenControlsTimerRef.current = null;
      }
    };
  }, [revealFullscreenControls]);

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
    if (nextKind === 'video') {
      setLyricsOpen(false);
      setVideoQuality(availableVideoQuality(item, preferredVideoQuality()));
      setVideoFrameIndex((current) => randomVideoFrameIndex(current));
    }
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

  const applyVolume = (value: number) => {
    const normalized = Math.max(0, Math.min(1, value));
    if (normalized > 0) previousVolumeRef.current = normalized;
    setVolume(normalized);
    if (audioRef.current) audioRef.current.volume = normalized;
    if (videoRef.current) videoRef.current.volume = normalized;
  };

  const toggleMute = () => applyVolume(volume > 0 ? 0 : previousVolumeRef.current || 0.85);

  const changeLyricLanguage = (language: LyricLanguage) => {
    setLyricLanguage(language);
    localStorage.setItem(LYRIC_LANGUAGE_KEY, language);
  };

  const switchVideoQuality = (quality: VideoQuality) => {
    if (!active?.videoSources?.[quality] || quality === videoQuality) return;
    pendingPlayRef.current = playing;
    pendingTimeRef.current = currentTime;
    videoRef.current?.pause();
    setVideoQuality(quality);
  };

  const toggleFullscreen = async () => {
    const stage = videoStageRef.current;
    if (!stage) return;

    const orientation = screen.orientation as (ScreenOrientation & {
      lock?: (value: 'landscape') => Promise<void>;
      unlock?: () => void;
    }) | undefined;
    const mobileViewport = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;

    try {
      if (document.fullscreenElement === stage || isPseudoFullscreen) {
        if (document.fullscreenElement === stage) await document.exitFullscreen();
        setIsPseudoFullscreen(false);
        try { orientation?.unlock?.(); } catch { /* Unsupported on some mobile browsers. */ }
        return;
      }

      if (typeof stage.requestFullscreen !== 'function') {
        setIsPseudoFullscreen(true);
        return;
      }

      await stage.requestFullscreen();
      if (!mobileViewport) return;

      try {
        if (typeof orientation?.lock !== 'function') throw new Error('orientation lock unsupported');
        await orientation.lock('landscape');
      } catch {
        // iOS Safari and some embedded browsers do not allow page orientation locks.
        // Leave native fullscreen and use a rotated, viewport-filling stage so the
        // custom frame and controls remain available.
        if (window.matchMedia('(orientation: portrait)').matches) {
          if (document.fullscreenElement === stage) await document.exitFullscreen();
          setIsPseudoFullscreen(true);
        }
      }
    } catch {
      setIsFullscreen(false);
      setIsPseudoFullscreen(true);
    }
  };

  const switchKind = (nextKind: MediaKind) => {
    if (!active || (nextKind === 'audio' && !active.hasAudio) || (nextKind === 'video' && !active.hasVideo)) return;
    pendingPlayRef.current = playing;
    pendingTimeRef.current = currentTime;
    mediaRef.current?.pause();
    setKind(nextKind);
    setVideoOpen(nextKind === 'video');
    if (nextKind === 'video') {
      setLyricsOpen(false);
      setVideoQuality(availableVideoQuality(active, preferredVideoQuality()));
      setVideoFrameIndex((current) => randomVideoFrameIndex(current));
    }
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
    if (document.fullscreenElement === videoStageRef.current) void document.exitFullscreen();
    setIsPseudoFullscreen(false);
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
  const videoFrame = videoFrames[videoFrameIndex ?? 0];

  return (
    <main className={`app-shell${videoOpen ? ' video-mode' : ''}${lyricsOpen && !videoOpen ? ' lyrics-expanded' : ''}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => { setFilter('all'); setQuery(''); }} aria-label="返回全部儿歌">
          <span className="brand-mark"><Icon name="star" /></span><span>童声星球</span>
        </button>
        <label className="search-box"><Icon name="search" /><span className="sr-only">搜索儿歌</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名、英文名或编号" /></label>
        <button className={`favorite-orb ${filter === 'favorites' ? 'active' : ''}`} type="button" aria-label="查看收藏" onClick={() => setFilter('favorites')}><Icon name="favorites" /></button>
      </header>

      <div className="workspace">
        <nav className="category-panel" aria-label="儿歌主题">
          <FilterButton active={filter === 'all'} icon="grid" label="全部" count={filter === 'all' ? total : undefined} onClick={() => setFilter('all')} />
          <FilterButton active={filter === 'favorites'} icon="favorites" label="收藏" count={favoriteIds.length} onClick={() => setFilter('favorites')} />
          {tags.map((tag) => <FilterButton key={tag.slug} active={filter === tag.slug} icon={tagIcons[tag.slug] ?? 'music'} label={tag.name} count={tag.count} onClick={() => setFilter(tag.slug)} />)}
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
                      {item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" decoding="async" /> : <span className="cover-placeholder"><Icon name="music" size={52} /></span>}
                      <small>{item.sourceCode}</small>
                      <em>{formatTime((item.audioDurationMs ?? item.videoDurationMs ?? 0) / 1000)}</em>
                      {active?.id === item.id && playing && <b className="playing-bars" aria-label="正在播放"><i /><i /><i /></b>}
                    </button>
                    <button className={`card-favorite ${favorite ? 'active' : ''}`} type="button" aria-label={favorite ? '取消收藏' : '加入收藏'} onClick={() => toggleFavorite(item.id)}><Icon name="favorites" size={18} /></button>
                    {item.hasVideo && <button className="watch-action" type="button" onClick={() => selectTrack(item, true, 'video')}><Icon name="play" size={12} />看动画</button>}
                    <button className="card-copy" type="button" onClick={() => selectTrack(item, true, item.hasAudio ? 'audio' : 'video')} title={`${item.titleZh}\n${item.title}`}>
                      <strong>{item.titleZh || '快乐英文儿歌'}</strong><span>{item.title}</span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && !error && library.length === 0 && <div className="empty-state"><Icon name={filter === 'favorites' ? 'favorites' : 'search'} size={60} /><h2>{filter === 'favorites' ? '还没有收藏儿歌' : '没有找到这首歌'}</h2><p>{filter === 'favorites' ? '点卡片右上角的小爱心，就能放进这里。' : '试试中文名、英文名或三位编号。'}</p></div>}
          <div className="load-sentinel" ref={loadSentinelRef}>{loadingMore ? <><span className="spinner" />正在搬来更多儿歌…</> : hasMore ? '继续向下滑，还有更多' : library.length > 0 ? '已经看到这一组的全部儿歌啦' : ''}</div>
        </section>
      </div>

      <div className="player-zone">
        <section className={`player-dock ${lyricsOpen && !videoOpen ? 'with-lyrics' : ''}`} aria-label="当前播放器">
          {lyricsOpen && !videoOpen && <div className="lyrics-panel">
            <button className="drawer-handle" type="button" onClick={() => setLyricsOpen(false)} aria-label="收起歌词"><span /></button>
            <div className="lyrics-title"><span><Icon name="lyrics" size={17} />跟着一起唱</span><div className="lyrics-title-actions"><div className="lyric-language-switch" role="group" aria-label="歌词语言">{lyricLanguages.map((language) => <button className={lyricLanguage === language.value ? 'active' : ''} type="button" key={language.value} disabled={!active?.lyricsSources?.[language.value]} onClick={() => changeLyricLanguage(language.value)}>{language.label}</button>)}</div><button className="collapse-lyrics" type="button" onClick={() => setLyricsOpen(false)}>收起歌词<Icon name="chevronDown" size={15} /></button></div></div>
            <div className="lyrics-scroll">
              {lyricsStatus === 'loading' && <p className="lyric-message">歌词正在打开…</p>}
              {lyricsStatus === 'error' && <p className="lyric-message">这首歌词暂时没有准备好</p>}
              {lyricsStatus === 'ready' && lyrics.length === 0 && <p className="lyric-message">这首歌词还是空的</p>}
              {lyrics.map((line, index) => <p key={`${line.time}-${index}`} ref={(node) => { lyricLineRefs.current[index] = node; }} className={index === currentLyricIndex ? 'active' : index < currentLyricIndex ? 'passed' : ''} onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = line.time; }}>{line.text}</p>)}
            </div>
          </div>}

          <div className="player-main">
            <div className="track-info">
              <div className="mini-cover">{active?.posterUrl ? <img src={active.posterUrl} alt="" /> : <Icon name="music" size={32} />}</div>
              <div className="track-summary"><span className="now-label">{active ? playing ? '正在播放' : '已选中' : '欢迎来到童声星球'}</span><strong>{active?.titleZh ?? '选一首儿歌开始'}</strong><span>{active?.title ?? '听儿歌、看动画、跟唱歌词'}</span></div>
            </div>

            <div className="transport">
              <button type="button" aria-label="后退十秒" disabled={!active} onClick={() => seekBy(-10)}><Icon name="seekBack10" /></button>
              <button type="button" aria-label="上一首" disabled={!active} onClick={goPrevious}><Icon name="previous" /></button>
              <button className="primary-play" type="button" aria-label={playing ? '暂停' : '播放'} disabled={!active} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} size={27} /></button>
              <button type="button" aria-label="下一首" disabled={!active} onClick={() => void goNext(false)}><Icon name="next" /></button>
              <button type="button" aria-label="前进十秒" disabled={!active} onClick={() => seekBy(10)}><Icon name="seekForward10" /></button>
            </div>

            <div className="player-actions">
              <button className={kind === 'audio' && !videoOpen ? 'active' : ''} disabled={!active?.hasAudio} onClick={() => switchKind('audio')} type="button"><Icon name="music" /><span>听</span></button>
              <button className={kind === 'video' && videoOpen ? 'active video' : ''} disabled={!active?.hasVideo} onClick={() => switchKind('video')} type="button"><Icon name="video" /><span>看</span></button>
              <button className={lyricsOpen ? 'active lyrics' : ''} disabled={!active?.hasLyrics} onClick={() => setLyricsOpen((open) => !open)} type="button"><Icon name="lyrics" /><span>歌词</span></button>
              <button className={mode === 'single' ? 'active repeat-one' : ''} disabled={!active} onClick={toggleSingleRepeat} type="button" aria-pressed={mode === 'single'} title="单曲循环"><Icon name="repeatOne" /><span>单曲</span></button>
              <ModePicker mode={selectedMode} onChange={setListMode} />
            </div>

            <div className="progress-area"><span>{formatTime(currentTime)}</span><input aria-label="播放进度" type="range" min="0" max={Math.max(duration, 0)} step="0.1" disabled={!active} value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (mediaRef.current) mediaRef.current.currentTime = value; setCurrentTime(value); }} style={{ '--progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties} /><span>{formatTime(duration || (active?.audioDurationMs ?? active?.videoDurationMs ?? 0) / 1000)}</span></div>
            <div className="volume-control"><button className={volume === 0 ? 'muted' : ''} type="button" aria-label={volume === 0 ? '恢复音量' : '静音'} aria-pressed={volume === 0} onClick={toggleMute}><Icon name={volume === 0 ? 'volumeMute' : 'volume'} /></button><input aria-label="音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => applyVolume(Number(event.target.value))} /></div>
          </div>
        </section>
      </div>

      {videoOpen && kind === 'video' && active && activeVideoURL && <div className={`video-overlay${isPseudoFullscreen ? ' fullscreen-fallback' : ''}`} role="presentation" onClick={closeVideo}>
        <div className={`video-experience${lyricsOpen ? ' with-lyrics' : ''}`} role="dialog" aria-modal="true" aria-label={`${active.titleZh} 视频`} onClick={(event) => event.stopPropagation()}>
        <section className="video-player">
          <div className="video-toolbar">
            <button className="back-to-library" type="button" onClick={closeVideo}><Icon name="back" />返回儿歌架</button>
            <div>
              <button type="button" disabled={!active.videoSources?.[videoQuality === '720' ? '480' : '720']} onClick={() => switchVideoQuality(videoQuality === '720' ? '480' : '720')} title="切换视频清晰度"><Icon name="quality" />{videoQuality}P</button>
              <button className={videoSubtitlesEnabled ? 'active' : ''} type="button" disabled={!active.lyricsSources?.zh} aria-pressed={videoSubtitlesEnabled} onClick={() => setVideoSubtitlesEnabled((enabled) => !enabled)}><Icon name="subtitles" />中文</button>
              <button className="change-video-frame" type="button" onClick={() => setVideoFrameIndex((current) => ((current ?? -1) + 1) % videoFrames.length)} title={`当前边框：${videoFrame.label}`}><Icon name="frameSwitch" />边框</button>
              <button type="button" onClick={() => void toggleFullscreen()}><Icon name={fullscreenActive ? 'fullscreenExit' : 'fullscreen'} />{fullscreenActive ? '退出' : '全屏'}</button>
            </div>
          </div>
          <div className={`video-stage${isPseudoFullscreen ? ' pseudo-fullscreen' : ''}${fullscreenActive && !fullscreenControlsVisible ? ' fullscreen-controls-hidden' : ''}`} ref={videoStageRef} onPointerMove={revealFullscreenControls} onPointerDown={revealFullscreenControls}>
            <div className="video-canvas">
              <video key={`video-${active.id}-${videoQuality}`} ref={(node) => { videoRef.current = node; mediaRef.current = node; if (node) node.volume = volume; }} src={activeVideoURL} poster={active.posterUrl} preload="metadata" playsInline controls={false} controlsList="nofullscreen noremoteplayback" disablePictureInPicture onLoadedMetadata={(event) => void handleMediaReady(event.currentTarget)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onEnded={handleEnded} />
              <div className="video-frame-overlay" aria-hidden="true">
                <img className="video-frame-main" src={videoFrame.src} alt="" draggable={false} />
                <span className="video-frame-bottom"><img src={videoFrame.src} alt="" draggable={false} /></span>
              </div>
              {videoSubtitlesEnabled && currentVideoLyricIndex >= 0 && <p className="video-lyric-line">{videoLyrics[currentVideoLyricIndex].text}</p>}
              {!playing && videoCountdown === null && <button className="video-big-play" type="button" onClick={togglePlayback} aria-label="播放视频"><Icon name="play" size={38} /></button>}
              {videoCountdown !== null && <div className="next-video-countdown"><strong>{videoCountdown} 秒后播放下一首</strong><button type="button" onClick={() => setVideoCountdown(null)}>留在这里</button></div>}
            </div>
            <div className="video-controls" role="group" aria-label="视频播放控制">
              <button className="video-control-play" type="button" onClick={() => void togglePlayback()} aria-label={playing ? '暂停视频' : '播放视频'}><Icon name={playing ? 'pause' : 'play'} /></button>
              <span>{formatTime(currentTime)}</span>
              <input aria-label="视频播放进度" type="range" min="0" max={Math.max(duration, 0)} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { const value = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = value; setCurrentTime(value); }} style={{ '--video-progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties} />
              <span>{formatTime(duration || (active.videoDurationMs ?? 0) / 1000)}</span>
              <button className={volume === 0 ? 'muted' : ''} type="button" onClick={toggleMute} aria-label={volume === 0 ? '恢复视频音量' : '静音视频'} aria-pressed={volume === 0}><Icon name={volume === 0 ? 'volumeMute' : 'volume'} /></button>
              <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreenActive ? '退出全屏' : '进入全屏'}><Icon name={fullscreenActive ? 'fullscreenExit' : 'fullscreen'} /></button>
            </div>
          </div>
        </section>
        {lyricsOpen && !fullscreenActive && <aside className="video-lyrics-panel" aria-label="视频同步歌词">
          <div className="video-lyrics-title">
            <span><Icon name="lyrics" size={17} />同步歌词</span>
            <div className="lyric-language-switch" role="group" aria-label="视频歌词语言">{lyricLanguages.map((language) => <button className={lyricLanguage === language.value ? 'active' : ''} type="button" key={language.value} disabled={!active.lyricsSources?.[language.value]} onClick={() => changeLyricLanguage(language.value)}>{language.label}</button>)}</div>
          </div>
          <div className="video-lyrics-scroll">
            {lyricsStatus === 'loading' && <p className="lyric-message">歌词正在打开…</p>}
            {lyricsStatus === 'error' && <p className="lyric-message">这首歌词暂时没有准备好</p>}
            {lyricsStatus === 'ready' && lyrics.length === 0 && <p className="lyric-message">这首歌词还是空的</p>}
            {lyrics.map((line, index) => <p key={`${line.time}-${index}`} ref={(node) => { lyricLineRefs.current[index] = node; }} className={index === currentLyricIndex ? 'active' : index < currentLyricIndex ? 'passed' : ''} onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = line.time; }}>{line.text}</p>)}
          </div>
          <button className="close-video-lyrics" type="button" onClick={() => setLyricsOpen(false)}><Icon name="chevronDown" size={15} />收起歌词</button>
        </aside>}
        </div>
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
    <button className="mode-button" type="button" aria-haspopup="listbox" aria-expanded={open} title={selected.label} onClick={() => setOpen((value) => !value)}><Icon name={selected.icon} /><b>{selected.short}</b><Icon name="chevronUp" size={14} /></button>
    {open && <div className="mode-menu" role="listbox">{playModes.map((item) => <button className={item.value === mode ? 'active' : ''} type="button" role="option" aria-selected={item.value === mode} key={item.value} onClick={() => { onChange(item.value); setOpen(false); }}><span><Icon name={item.icon} /></span><span><strong>{item.short}</strong><small>{item.label}</small></span>{item.value === mode && <b><Icon name="favorites" size={16} /></b>}</button>)}</div>}
  </div>;
}

function FilterButton({ active, icon, label, count, onClick }: { active: boolean; icon: IconName; label: string; count?: number; onClick: () => void }) {
  return <button className={`category ${active ? 'active' : ''}`} type="button" onClick={onClick}><span className="category-icon"><Icon name={icon} /></span><strong>{label}</strong>{typeof count === 'number' && <small>{count}</small>}</button>;
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
