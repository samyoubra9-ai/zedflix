"use client";

import Hls, { type Level } from "hls.js";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  IconBack,
  IconCheck,
  IconFullscreen,
  IconFullscreenExit,
  IconMute,
  IconPause,
  IconPlay,
  IconSettings,
  IconSkipBack,
  IconSkipForward,
  IconVolume,
} from "./icons";
import {
  clearProgress,
  getProgress,
  saveProgress,
} from "@/lib/watch-progress";
import { useTvMode } from "@/hooks/use-tv-mode";
import { TvSpatialNav } from "@/components/tv/spatial-nav";
import { useRouter } from "next/navigation";

type QualityOption = { index: number; label: string };
type Menu = null | "root" | "speed" | "quality" | "server";
type ServerOption = { id: string; label: string; version: "vf" | "vo" | "vostfr" };

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RedLoader({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-[3px] border-white/10 border-t-[#e50914] ${className}`}
      role="status"
      aria-label="Chargement"
    />
  );
}

export function Player({
  id,
  episode,
  back,
  live = false,
  saver = false,
  playPath,
  onClose,
}: {
  id: string;
  episode?: number;
  back: string;
  live?: boolean;
  /** Prefer the lightest HLS rung (data saver / weak networks). */
  saver?: boolean;
  /** Same live player, with a different address for the stream. */
  playPath?: string;
  onClose?: () => void;
}) {
  const kind = live ? "movie" : episode ? "show" : "movie";
  const tv = useTvMode();
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<number | null>(null);
  const lastTap = useRef<{ t: number; x: number }>({ t: 0, x: 0 });
  const seekBarRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(episode ? `Épisode ${episode}` : "Lecture");
  const [poster, setPoster] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [quality, setQuality] = useState(-1);
  const [menu, setMenu] = useState<Menu>(null);
  const [skipFlash, setSkipFlash] = useState<null | -10 | 10>(null);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const liveRefreshCount = useRef(0);
  const liveRefreshTimer = useRef<number | null>(null);
  const liveHealthyTimer = useRef<number | null>(null);
  const suppressMediaError = useRef(false);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [activeServer, setActiveServer] = useState<string | null>(null);
  const [preferredServer, setPreferredServer] = useState<string | null>(null);
  const [allowEnglish, setAllowEnglish] = useState(false);
  const [englishPrompt, setEnglishPrompt] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const showControls = useCallback((sticky = false) => {
    setControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (sticky) return;
    // TV remote: give a bit longer, then clear chrome so the live picture is fullscreen.
    hideTimer.current = window.setTimeout(() => {
      setMenu(null);
      setControls(false);
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest?.("[data-controls], [data-dialog]")) {
        active.blur();
      }
    }, tv ? 4200 : 3200);
  }, [tv]);

  const scheduleLiveRefresh = useCallback(() => {
    if (!live) return false;
    if (liveRefreshTimer.current != null) return true;
    if (liveRefreshCount.current >= 4) return false;
    if (liveHealthyTimer.current) {
      window.clearTimeout(liveHealthyTimer.current);
      liveHealthyTimer.current = null;
    }
    liveRefreshCount.current += 1;
    const attempt = liveRefreshCount.current;
    const wait = attempt === 1 ? 600 : attempt === 2 ? 1200 : 2000;
    setLoading(true);
    setBuffering(true);
    setStatus("");
    liveRefreshTimer.current = window.setTimeout(() => {
      liveRefreshTimer.current = null;
      setReloadKey((key) => key + 1);
    }, wait);
    return true;
  }, [live]);

  useEffect(() => {
    liveRefreshCount.current = 0;
    if (liveRefreshTimer.current) {
      window.clearTimeout(liveRefreshTimer.current);
      liveRefreshTimer.current = null;
    }
    if (liveHealthyTimer.current) {
      window.clearTimeout(liveHealthyTimer.current);
      liveHealthyTimer.current = null;
    }
  }, [id]);

  useEffect(() => {
    setPreferredServer(null);
    setActiveServer(null);
    setServers([]);
    setAllowEnglish(false);
    setEnglishPrompt(false);
  }, [id, episode]);

  useEffect(() => {
    if (live) {
      setTitle("Direct");
      return;
    }
    const kindParam = episode ? "show" : "movie";
    fetch(`/api/watch/title?id=${encodeURIComponent(id)}&kind=${kindParam}`)
      .then(async (response) => {
        const data = (await response.json()) as { title?: string; poster?: string; backdrop?: string };
        if (response.ok && data.title) {
          setTitle(episode ? `${data.title} · Ép. ${episode}` : data.title);
          setPoster(data.backdrop || data.poster || "");
        }
      })
      .catch(() => undefined);
  }, [id, episode, live]);

  useEffect(() => {
    if (live) {
      setResumeAt(null);
      return;
    }
    const saved = getProgress(kind, id, episode);
    if (saved && saved.seconds > 30 && saved.duration > 0 && saved.seconds / saved.duration < 0.95) {
      setResumeAt(saved.seconds);
    } else {
      setResumeAt(null);
    }
  }, [kind, id, episode, reloadKey, live]);

  const switchServer = useCallback((next: string) => {
    if (!next || next === activeServer) {
      setMenu(null);
      return;
    }
    const option = servers.find((item) => item.id === next);
    setPreferredServer(next);
    setActiveServer(next);
    setAllowEnglish(option?.version !== "vf");
    setEnglishPrompt(false);
    setMenu(null);
    setStatus("");
    setLoading(true);
  }, [activeServer, servers]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setStatus("");
    setBuffering(false);
    setPlaying(false);
    setQualities([]);
    setQuality(-1);
    let hls: Hls | null = null;
    let stop = false;
    let mediaRecovered = false;
    setEnglishPrompt(false);
    const params = new URLSearchParams({ id });
    if (!live) {
      if (episode) params.set("episode", String(episode));
      if (preferredServer) params.set("server", preferredServer);
      if (allowEnglish) params.set("allowEnglish", "1");
    }
    const path = playPath
      ? playPath
      : live
        ? `/api/watch/live/play?${params.toString()}`
        : `/api/watch/play?${params.toString()}`;

    fetch(path)
      .then(async (response) => {
        const data = (await response.json()) as {
          src?: string;
          error?: string;
          server?: string;
          servers?: ServerOption[];
          needsEnglishChoice?: boolean;
          language?: string;
          title?: string;
          poster?: string;
        };
        if (stop) return;
        if (live && data.title) setTitle(data.title);
        if (live && data.poster) setPoster(data.poster);
        if (!live && Array.isArray(data.servers)) setServers(data.servers);
        if (!live && data.needsEnglishChoice) {
          setLoading(false);
          setEnglishPrompt(true);
          setStatus("");
          return;
        }
        if (!response.ok || !data.src) {
          if (!stop && scheduleLiveRefresh()) return;
          setLoading(false);
          setStatus(live ? "La chaîne ne répond plus." : data.error || "Lecture impossible");
          return;
        }
        if (data.server) setActiveServer(data.server);

        const onLevels = (levels: Level[]) => {
          const options = levels
            .map((level, index) => ({
              index,
              label: level.height ? `${level.height}p` : level.bitrate ? `${Math.round(level.bitrate / 1000)} kb/s` : `Flux ${index + 1}`,
            }))
            .reverse();
          setQualities(options);
        };

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = data.src;
          if (!live) {
            const pickNativeFrench = () => {
              const tracks = (video as HTMLVideoElement & {
                audioTracks?: {
                  length: number;
                  [index: number]: { language?: string; label?: string; enabled: boolean };
                };
              }).audioTracks;
              if (!tracks || !tracks.length) return;
              let frenchIndex = -1;
              for (let index = 0; index < tracks.length; index += 1) {
                const track = tracks[index];
                const hay = `${track.language || ""} ${track.label || ""}`.toLowerCase();
                const isFrench =
                  hay.startsWith("fr") ||
                  hay.includes("french") ||
                  hay.includes("fran") ||
                  hay.includes("vf");
                if (isFrench && frenchIndex < 0) frenchIndex = index;
              }
              if (frenchIndex >= 0) {
                for (let index = 0; index < tracks.length; index += 1) {
                  tracks[index].enabled = index === frenchIndex;
                }
              } else if (allowEnglish || tracks.length === 1) {
                tracks[0].enabled = true;
              }
              // If nothing matched, leave browser defaults — never mute all tracks.
            };
            video.addEventListener("loadedmetadata", pickNativeFrench, { once: true });
          }
        } else if (Hls.isSupported()) {
          hls = new Hls(
            live
              ? {
                  enableWorker: true,
                  lowLatencyMode: false,
                  startLevel: -1,
                  capLevelToPlayerSize: false,
                  maxBufferLength: 12,
                  maxMaxBufferLength: 24,
                  maxBufferSize: 12 * 1000 * 1000,
                  backBufferLength: 0,
                  liveSyncDurationCount: 2,
                  liveMaxLatencyDurationCount: 6,
                  liveDurationInfinity: true,
                  maxLiveSyncPlaybackRate: 1,
                  highBufferWatchdogPeriod: 2,
                  maxBufferHole: 0.5,
                  nudgeMaxRetry: 3,
                  forceKeyFrameOnDiscontinuity: true,
                  startFragPrefetch: true,
                  manifestLoadingTimeOut: 8000,
                  manifestLoadingMaxRetry: 2,
                  fragLoadingTimeOut: 20000,
                  fragLoadingMaxRetry: 2,
                }
              : {
                  enableWorker: true,
                  startLevel: -1,
                  capLevelToPlayerSize: true,
                  maxBufferLength: 30,
                  maxMaxBufferLength: 60,
                  liveSyncDurationCount: 3,
                  liveMaxLatencyDurationCount: 8,
                  liveDurationInfinity: false,
                  highBufferWatchdogPeriod: 2,
                  maxBufferHole: 0.5,
                  nudgeMaxRetry: 3,
                  forceKeyFrameOnDiscontinuity: true,
                },
          );
          hlsRef.current = hls;
          hls.loadSource(data.src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, (_event, info) => {
            onLevels(info.levels);
            if (live && hls && info.levels.length > 1) {
              if (saver) {
                let lightest = 0;
                for (let index = 1; index < info.levels.length; index += 1) {
                  const current = info.levels[index];
                  const best = info.levels[lightest];
                  const currentScore = current.height || current.bitrate || index;
                  const bestScore = best.height || best.bitrate || lightest;
                  if (currentScore < bestScore) lightest = index;
                }
                hls.startLevel = lightest;
                hls.currentLevel = lightest;
              } else {
                // Prefer AVC levels when available (HEVC often = son sans image).
                const avc = info.levels.findIndex((level) => {
                  const codec = `${level.videoCodec || ""}`.toLowerCase();
                  return codec.includes("avc") || codec.includes("h264");
                });
                if (avc >= 0) {
                  hls.startLevel = avc;
                  hls.currentLevel = avc;
                }
              }
            }
            // Live IPTV is usually muxed A/V — don't retarget audio tracks (cuts sound).
            if (!live) {
              const tracks = hls?.audioTracks || [];
              const french = tracks.findIndex((track) => {
                const hay = `${track.lang || ""} ${track.name || ""}`.toLowerCase();
                return (
                  hay.startsWith("fr") ||
                  hay.includes("french") ||
                  hay.includes("fran") ||
                  hay.includes("vf") ||
                  hay.includes("truefrench")
                );
              });
              if (french >= 0 && hls) hls.audioTrack = french;
            }
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (_event, info) => setQuality(info.level));
          hls.on(Hls.Events.ERROR, (_event, info) => {
            if (stop || !info.fatal || !hls) return;
            if (live) {
              if (info.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
                mediaRecovered = true;
                hls.recoverMediaError();
                return;
              }
              if (scheduleLiveRefresh()) return;
              setLoading(false);
              setBuffering(false);
              setStatus("La chaîne ne répond plus.");
              return;
            }
            if (info.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
              return;
            }
            if (info.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              return;
            }
            setLoading(false);
            setBuffering(false);
            setStatus("Le lecteur n’a pas pu lire la vidéo.");
          });
        } else {
          setLoading(false);
          setStatus("Ce navigateur ne lit pas ce format.");
          return;
        }

        video.muted = false;
        video.volume = 1;
        setMuted(false);
        setVolume(1);
        setNeedsUnmute(false);
        video.playbackRate = speed;
        try {
          await video.play();
        } catch {
          if (live) {
            video.muted = false;
            video.volume = 1;
            setMuted(false);
            setNeedsUnmute(false);
            await video.play().catch(() => undefined);
          } else {
            video.muted = true;
            setMuted(true);
            setNeedsUnmute(true);
            await video.play().catch(() => undefined);
          }
        }
      })
      .catch(() => {
        if (!stop && scheduleLiveRefresh()) return;
        if (!stop) {
          setLoading(false);
          setStatus(live ? "La chaîne ne répond plus." : "Lecture impossible");
        }
      });

    return () => {
      stop = true;
      suppressMediaError.current = true;
      hlsRef.current = null;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episode, reloadKey, preferredServer, allowEnglish, live, saver, playPath, scheduleLiveRefresh]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
      setBuffering(false);
      // Start the auto-hide timer so overlays don't stick forever (esp. TV live).
      showControls();
    };
    const onPause = () => {
      setPlaying(false);
      showControls(true);
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setLoading(false);
      setBuffering(false);
      suppressMediaError.current = false;
      if (!live) return;
      if (liveHealthyTimer.current) window.clearTimeout(liveHealthyTimer.current);
      liveHealthyTimer.current = window.setTimeout(() => {
        liveRefreshCount.current = 0;
      }, 12_000);
    };
    const onTime = () => {
      setCurrent(video.currentTime);
      if (video.buffered.length) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onMeta = () => setDuration(video.duration || 0);
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onError = () => {
      if (suppressMediaError.current) return;
      if (live && scheduleLiveRefresh()) return;
      setLoading(false);
      setBuffering(false);
      setStatus(live ? "La chaîne ne répond plus." : "Le lecteur n’a pas pu lire la vidéo.");
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("error", onError);
    };
  }, [showControls, live, scheduleLiveRefresh]);

  useEffect(() => {
    if (live) return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.duration) return;
      saveProgress({
        kind,
        id,
        episode,
        title,
        poster,
        seconds: video.currentTime,
        duration: video.duration,
        updatedAt: Date.now(),
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [kind, id, episode, title, poster, live]);

  useEffect(() => {
    function onFs() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const video = videoRef.current;
      if (!video) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Remote Back / Escape
      if (
        event.key === "Escape" ||
        event.key === "Backspace" ||
        event.key === "BrowserBack" ||
        event.key === "GoBack"
      ) {
        if (menu) {
          event.preventDefault();
          setMenu(null);
          showControls();
          return;
        }
        if (needsUnmute) {
          event.preventDefault();
          setNeedsUnmute(false);
          showControls();
          return;
        }
        // First Back hides the chrome while watching; next Back leaves.
        if (tv && controls) {
          event.preventDefault();
          setControls(false);
          setMenu(null);
          (document.activeElement as HTMLElement | null)?.blur?.();
          return;
        }
        event.preventDefault();
        if (onCloseRef.current) onCloseRef.current();
        else router.push(back);
        return;
      }

      // Any remote key while chrome is hidden → bring it back first.
      if (tv && !controls && !menu && !needsUnmute && !englishPrompt && !status) {
        if (
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "Enter" ||
          event.key === " " ||
          event.key === "MediaPlayPause"
        ) {
          event.preventDefault();
          showControls();
          window.setTimeout(() => {
            document
              .querySelector<HTMLElement>("[data-tv-zone='player'] [data-tv-focus]")
              ?.focus({ preventScroll: true });
          }, 30);
          return;
        }
      }

      // On TV, arrows move focus between controls — don't seek/volume-hijack.
      if (
        tv &&
        (event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight")
      ) {
        showControls();
        return;
      }

      showControls();
      if (
        event.key === " " ||
        event.key === "k" ||
        event.key === "MediaPlayPause" ||
        event.code === "MediaPlayPause"
      ) {
        // Space on a focused TV button activates the button via spatial-nav.
        if (tv && event.key === " " && target?.hasAttribute("data-tv-focus")) return;
        event.preventDefault();
        if (video.paused) video.play().catch(() => undefined);
        else video.pause();
      } else if (!live && event.key === "ArrowRight") {
        event.preventDefault();
        skipBy(10);
      } else if (!live && event.key === "ArrowLeft") {
        event.preventDefault();
        skipBy(-10);
      } else if (!tv && event.key === "ArrowUp") {
        event.preventDefault();
        video.volume = Math.min(1, video.volume + 0.05);
        video.muted = false;
      } else if (!tv && event.key === "ArrowDown") {
        event.preventDefault();
        video.volume = Math.max(0, video.volume - 0.05);
      } else if (event.key === "m") {
        video.muted = !video.muted;
      } else if (event.key === "f") {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls, tv, live, back, menu, router, controls, playing, needsUnmute, englishPrompt, status]);

  function skipBy(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
    setSkipFlash(delta < 0 ? -10 : 10);
    window.setTimeout(() => setSkipFlash(null), 700);
    showControls();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
    showControls();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted) {
      video.volume = video.volume || 1;
      setNeedsUnmute(false);
    }
    setMuted(video.muted);
    showControls();
  }

  function enableSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    setMuted(false);
    setVolume(1);
    setNeedsUnmute(false);
    video.play().catch(() => undefined);
    showControls();
  }

  function setVol(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    showControls(true);
  }

  function seekRatio(ratio: number) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = Math.max(0, Math.min(1, ratio)) * video.duration;
    showControls();
  }

  function onSeekPointer(event: PointerEvent<HTMLDivElement>) {
    const node = seekBarRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    seekRatio((event.clientX - rect.left) / rect.width);
  }

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await root.requestFullscreen().catch(() => undefined);
    showControls();
  }

  function applySpeed(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = value;
    setSpeed(value);
    setMenu(null);
    showControls();
  }

  function applyQuality(index: number) {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index;
    setQuality(index);
    setMenu(null);
    showControls();
  }

  function onStagePointer(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-controls], [data-dialog], button, a, input")) {
      return;
    }
    if (needsUnmute) {
      enableSound();
      return;
    }
    const now = Date.now();
    const x = event.clientX;
    const width = event.currentTarget.clientWidth;
    if (now - lastTap.current.t < 280) {
      if (!live) {
        if (x < width * 0.35) skipBy(-10);
        else if (x > width * 0.65) skipBy(10);
        else togglePlay();
      } else {
        togglePlay();
      }
      lastTap.current = { t: 0, x: 0 };
      return;
    }
    lastTap.current = { t: now, x };
    window.setTimeout(() => {
      if (Date.now() - lastTap.current.t >= 280 && lastTap.current.t) {
        if (controls) {
          setControls(false);
          setMenu(null);
        } else {
          showControls();
        }
        lastTap.current = { t: 0, x: 0 };
      }
    }, 290);
  }

  function resume(fromSaved: boolean) {
    const video = videoRef.current;
    if (!video) return;
    if (fromSaved && resumeAt) video.currentTime = resumeAt;
    else {
      video.currentTime = 0;
      clearProgress(kind, id, episode);
    }
    setResumeAt(null);
    video.play().catch(() => undefined);
    showControls();
  }

  function retry() {
    setStatus("");
    setReloadKey((value) => value + 1);
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const nextEpisode =
    episode && Number.isInteger(episode) ? `/watch/${encodeURIComponent(id)}/${episode + 1}` : null;

  return (
    <main
      ref={rootRef}
      data-tv-zone="player"
      className={`relative flex h-[100dvh] flex-col overflow-hidden bg-black text-white select-none ${
        tv ? "tv-player" : ""
      }`}
      onMouseMove={() => showControls()}
    >
      {tv ? <TvSpatialNav enabled /> : null}
      <div className="relative min-h-0 flex-1" onPointerUp={onStagePointer}>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className="h-full w-full bg-black object-contain"
          controls={false}
        />

        {(loading || buffering) && !status ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/20">
            <RedLoader />
          </div>
        ) : null}

        {skipFlash ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div
              className={`flex flex-col items-center gap-1 rounded-full bg-black/55 px-5 py-4 ${
                skipFlash < 0 ? "mr-auto ml-[12%]" : "ml-auto mr-[12%]"
              }`}
            >
              {skipFlash < 0 ? <IconSkipBack className="h-8 w-8" /> : <IconSkipForward className="h-8 w-8" />}
              <span className="text-sm font-semibold">{skipFlash < 0 ? "−10 s" : "+10 s"}</span>
            </div>
          </div>
        ) : null}

        {status ? (
          <div data-dialog className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
            <p className="max-w-md text-lg text-zinc-200">{status}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={retry}
                className="h-11 rounded-md bg-[#e50914] px-5 text-sm font-semibold"
              >
                Réessayer
              </button>
              <Link href={back} className="flex h-11 items-center rounded-md bg-white/10 px-5 text-sm font-medium">
                Retour
              </Link>
            </div>
          </div>
        ) : null}

        {englishPrompt && !loading ? (
          <div data-dialog className="absolute inset-0 z-30 flex items-end justify-center bg-gradient-to-t from-black via-black/40 to-transparent pb-28 sm:items-center sm:pb-0">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
              <p className="text-sm text-zinc-400">Version française</p>
              <p className="mt-1 text-lg font-semibold">Aucune VF détectée pour ce titre.</p>
              <p className="mt-2 text-sm text-zinc-400">
                Tu peux lancer la VO, ou ouvrir les réglages pour choisir VF / VO / VOSTFR.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const vo = servers.find((item) => item.version !== "vf");
                    setEnglishPrompt(false);
                    setAllowEnglish(true);
                    if (vo) setPreferredServer(vo.id);
                    setLoading(true);
                    setStatus("");
                  }}
                  className="h-11 flex-1 rounded-md bg-[#e50914] text-sm font-semibold"
                >
                  Lancer en VO
                </button>
                <Link
                  href={back}
                  className="flex h-11 flex-1 items-center justify-center rounded-md bg-white/10 text-sm font-medium"
                >
                  Annuler
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {needsUnmute && !live && !loading && !status && !englishPrompt ? (
          <div data-dialog className="absolute inset-0 z-30 flex items-end justify-center bg-gradient-to-t from-black via-black/50 to-transparent pb-28 sm:items-center sm:pb-0">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
              <p className="text-sm text-zinc-400">Son coupé</p>
              <p className="mt-1 text-lg font-semibold">Activer le son de la chaîne ?</p>
              <p className="mt-2 text-sm text-zinc-400">
                Le navigateur bloque le son au démarrage — appuie sur OK.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  data-tv-focus
                  data-tv-autofocus
                  onClick={enableSound}
                  className="tv-focus h-12 flex-1 rounded-md bg-[#e50914] text-sm font-semibold outline-none"
                >
                  Activer le son
                </button>
                <button
                  type="button"
                  data-tv-focus
                  onClick={() => setNeedsUnmute(false)}
                  className="tv-focus h-12 flex-1 rounded-md bg-white/10 text-sm font-medium outline-none"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {resumeAt && !loading && !status && !englishPrompt ? (
          <div data-dialog className="absolute inset-0 z-30 flex items-end justify-center bg-gradient-to-t from-black via-black/40 to-transparent pb-28 sm:items-center sm:pb-0">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
              <p className="text-sm text-zinc-400">Reprendre la lecture ?</p>
              <p className="mt-1 text-lg font-semibold">{formatTime(resumeAt)}</p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => resume(true)}
                  className="h-11 flex-1 rounded-md bg-[#e50914] text-sm font-semibold"
                >
                  Reprendre
                </button>
                <button
                  type="button"
                  onClick={() => resume(false)}
                  className="h-11 flex-1 rounded-md bg-white/10 text-sm font-medium"
                >
                  Depuis le début
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div
          data-controls
          className={`absolute inset-0 z-20 transition-opacity duration-300 ${
            controls || !playing || menu || resumeAt || status || englishPrompt || needsUnmute
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />

          <div
            data-controls
            className={`absolute inset-x-0 top-0 flex items-center gap-3 px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 ${
              tv ? "px-8 pt-8" : ""
            }`}
          >
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                {...(tv ? { "data-tv-focus": true, "data-tv-autofocus": true } : {})}
                className={`tv-focus tv-player-btn flex items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/10 backdrop-blur outline-none ${
                  tv ? "h-14 w-14" : "h-10 w-10"
                }`}
                aria-label="Retour"
              >
                <IconBack className={tv ? "h-6 w-6" : "h-5 w-5"} />
              </button>
            ) : (
              <Link
                href={back}
                {...(tv ? { "data-tv-focus": true, "data-tv-autofocus": true } : {})}
                className={`tv-focus tv-player-btn flex items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/10 backdrop-blur outline-none ${
                  tv ? "h-14 w-14" : "h-10 w-10"
                }`}
                aria-label="Retour"
              >
                <IconBack className={tv ? "h-6 w-6" : "h-5 w-5"} />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <p className={`truncate font-semibold ${tv ? "text-xl" : "text-sm sm:text-base"}`}>{title}</p>
              <p className="inline-flex items-center gap-2 text-[11px] tracking-[0.18em] text-[#e50914]">
                {live ? (
                  <>
                    <span className="tv-live-dot h-1.5 w-1.5 rounded-full bg-[#e50914]" />
                    DIRECT
                  </>
                ) : (
                  "MINUIT"
                )}
              </p>
            </div>
          </div>

          <div
            data-controls
            className={`absolute inset-x-0 bottom-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 sm:px-5 ${
              tv ? "px-8 pb-10" : ""
            }`}
          >
            {!live ? (
              <div
                ref={seekBarRef}
                className="group relative h-1.5 cursor-pointer rounded-full bg-white/20"
                onPointerDown={onSeekPointer}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/35"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#e50914]"
                  style={{ width: `${progress}%` }}
                />
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e50914] opacity-0 shadow transition group-hover:opacity-100"
                  style={{ left: `${progress}%` }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e50914]/20 px-3 py-1 text-xs font-semibold tracking-wide text-[#ff6b73] ring-1 ring-[#e50914]/40">
                  <span className="tv-live-dot h-2 w-2 rounded-full bg-[#e50914]" />
                  EN DIRECT
                </span>
                <span className="text-xs text-zinc-400">Flux live · pas de timeline</span>
              </div>
            )}

            <div className={`mt-3 flex items-center gap-2 sm:gap-3 ${tv ? "mt-5 gap-4" : ""}`}>
              <button
                type="button"
                {...(tv ? { "data-tv-focus": true } : {})}
                onClick={togglePlay}
                className={`tv-focus tv-player-btn rounded-full outline-none hover:bg-white/10 ${
                  tv ? "bg-white/10 p-4" : "p-2"
                }`}
                aria-label="Lecture"
              >
                {playing ? <IconPause className={tv ? "h-8 w-8" : "h-6 w-6"} /> : <IconPlay className={tv ? "h-8 w-8" : "h-6 w-6"} />}
              </button>
              {!live ? (
                <>
                  <button
                    type="button"
                    {...(tv ? { "data-tv-focus": true } : {})}
                    onClick={() => skipBy(-10)}
                    className={`tv-focus tv-player-btn rounded-full outline-none hover:bg-white/10 ${tv ? "p-3" : "p-2"}`}
                    aria-label="-10s"
                  >
                    <IconSkipBack className={tv ? "h-6 w-6" : "h-5 w-5"} />
                  </button>
                  <button
                    type="button"
                    {...(tv ? { "data-tv-focus": true } : {})}
                    onClick={() => skipBy(10)}
                    className={`tv-focus tv-player-btn rounded-full outline-none hover:bg-white/10 ${tv ? "p-3" : "p-2"}`}
                    aria-label="+10s"
                  >
                    <IconSkipForward className={tv ? "h-6 w-6" : "h-5 w-5"} />
                  </button>
                </>
              ) : null}

              <div className={`items-center gap-2 ${tv ? "flex" : "hidden sm:flex"}`}>
                <button
                  type="button"
                  {...(tv ? { "data-tv-focus": true } : {})}
                  onClick={toggleMute}
                  className={`tv-focus tv-player-btn rounded-full outline-none hover:bg-white/10 ${tv ? "p-3" : "p-2"}`}
                >
                  {muted || volume === 0 ? <IconMute className={tv ? "h-6 w-6" : "h-5 w-5"} /> : <IconVolume className={tv ? "h-6 w-6" : "h-5 w-5"} />}
                </button>
                {!tv ? (
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(event) => setVol(Number(event.target.value))}
                    className="h-1 w-24 cursor-pointer accent-[#e50914]"
                  />
                ) : null}
              </div>

              {!live ? (
                <p className="ml-1 text-xs tabular-nums text-zinc-300 sm:text-sm">
                  {formatTime(current)} <span className="text-zinc-500">/</span> {formatTime(duration)}
                </p>
              ) : (
                <p className={`ml-1 font-medium text-zinc-300 ${tv ? "text-base" : "text-sm"}`}>{title}</p>
              )}

              <div className="ml-auto flex items-center gap-1">
                {nextEpisode ? (
                  <Link
                    href={nextEpisode}
                    {...(tv ? { "data-tv-focus": true } : {})}
                    className={`tv-focus hidden rounded-md bg-white/10 px-3 py-2 text-xs font-semibold outline-none hover:bg-white/15 sm:inline ${
                      tv ? "!inline px-5 py-3 text-sm" : ""
                    }`}
                  >
                    Épisode suivant
                  </Link>
                ) : null}

                <div className="relative">
                  <button
                    type="button"
                    {...(tv ? { "data-tv-focus": true } : {})}
                    onClick={() => {
                      setMenu((value) => (value ? null : "root"));
                      showControls(true);
                    }}
                    className={`tv-focus tv-player-btn rounded-full outline-none hover:bg-white/10 ${tv ? "p-3" : "p-2"}`}
                    aria-label="Réglages"
                  >
                    <IconSettings className={tv ? "h-6 w-6" : "h-5 w-5"} />
                  </button>
                  {menu ? (
                    <div data-tv-zone="player" className="absolute bottom-12 right-0 w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 py-1 shadow-2xl backdrop-blur">
                      {menu === "root" ? (
                        <>
                          <button
                            type="button"
                            {...(tv ? { "data-tv-focus": true, "data-tv-autofocus": true } : {})}
                            onClick={() => setMenu("speed")}
                            className="tv-focus flex w-full items-center justify-between px-3 py-2.5 text-left text-sm outline-none hover:bg-white/5"
                          >
                            <span>Vitesse</span>
                            <span className="text-zinc-400">{speed}×</span>
                          </button>
                          {qualities.length > 1 ? (
                            <button
                              type="button"
                              {...(tv ? { "data-tv-focus": true } : {})}
                              onClick={() => setMenu("quality")}
                              className="tv-focus flex w-full items-center justify-between px-3 py-2.5 text-left text-sm outline-none hover:bg-white/5"
                            >
                              <span>Qualité</span>
                              <span className="text-zinc-400">
                                {quality < 0
                                  ? "Automatique"
                                  : qualities.find((item) => item.index === quality)?.label || "—"}
                              </span>
                            </button>
                          ) : null}
                          {!live && servers.length > 1 ? (
                            <button
                              type="button"
                              {...(tv ? { "data-tv-focus": true } : {})}
                              onClick={() => setMenu("server")}
                              className="tv-focus flex w-full items-center justify-between px-3 py-2.5 text-left text-sm outline-none hover:bg-white/5"
                            >
                              <span>Version</span>
                              <span className="max-w-[7rem] truncate text-zinc-400">
                                {servers.find((item) => item.id === activeServer)?.label || "—"}
                              </span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={toggleMute}
                            className="flex w-full px-3 py-2.5 text-left text-sm hover:bg-white/5 sm:hidden"
                          >
                            {muted ? "Activer le son" : "Couper le son"}
                          </button>
                        </>
                      ) : null}
                      {menu === "speed" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setMenu("root")}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-500"
                          >
                            ← Vitesse
                          </button>
                          {SPEEDS.map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => applySpeed(value)}
                              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-white/5"
                            >
                              <span>{value}×</span>
                              {speed === value ? <IconCheck className="h-4 w-4 text-[#e50914]" /> : null}
                            </button>
                          ))}
                        </>
                      ) : null}
                      {menu === "quality" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setMenu("root")}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-500"
                          >
                            ← Qualité
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuality(-1)}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-white/5"
                          >
                            <span>Automatique</span>
                            {quality < 0 ? <IconCheck className="h-4 w-4 text-[#e50914]" /> : null}
                          </button>
                          {qualities.map((item) => (
                            <button
                              key={item.index}
                              type="button"
                              onClick={() => applyQuality(item.index)}
                              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-white/5"
                            >
                              <span>{item.label}</span>
                              {quality === item.index ? (
                                <IconCheck className="h-4 w-4 text-[#e50914]" />
                              ) : null}
                            </button>
                          ))}
                        </>
                      ) : null}
                      {menu === "server" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setMenu("root")}
                            className="w-full px-3 py-2 text-left text-xs text-zinc-500"
                          >
                            ← Version
                          </button>
                          {servers.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => switchServer(item.id)}
                              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-white/5"
                            >
                              <span className="truncate pr-2">{item.label}</span>
                              {item.id === activeServer ? (
                                <IconCheck className="h-4 w-4 shrink-0 text-[#e50914]" />
                              ) : null}
                            </button>
                          ))}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-full p-2 hover:bg-white/10"
                  aria-label="Plein écran"
                >
                  {fullscreen ? (
                    <IconFullscreenExit className="h-5 w-5" />
                  ) : (
                    <IconFullscreen className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
