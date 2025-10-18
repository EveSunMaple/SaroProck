// src/components/AudioPlayer.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// 定义 props 类型
interface AudioPlayerProps {
  src: string; // 音频文件的路径 (例如: /music/song.mp3)
}

// 歌词行数据结构
interface LyricLine {
  time: number; // 歌词开始时间 (秒)
  text: string; // 歌词文本
}

// 格式化时间的辅助函数
const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

/**
 * 歌词解析函数：将原始歌词字符串解析为 LyricLine 数组
 */
const parseLyrics = (rawLyrics: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  const lrcPattern = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  const rawLines = rawLyrics.split("\n");

  rawLines.forEach((line) => {
    if (!line || line.startsWith("{"))
      return;
    const match = line.match(lrcPattern);

    if (match) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const milliseconds = Number.parseInt(match[3].padEnd(3, "0"), 10);

      const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();

      if (text) {
        lines.push({ time: timeInSeconds, text });
      }
    }
  });

  return lines.sort((a, b) => a.time - b.time);
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  // --- 状态和引用 ---
  const [rawLyrics, setRawLyrics] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricScrollRef = useRef<HTMLDivElement>(null);

  // --- 歌词计算 ---
  const parsedLyrics = useMemo(() => {
    return rawLyrics ? parseLyrics(rawLyrics) : [];
  }, [rawLyrics]);

  const currentLyricLine = currentLineIndex >= 0 && parsedLyrics[currentLineIndex]
    ? parsedLyrics[currentLineIndex].text
    : "（歌词加载中...）";

  // --- 歌词同步逻辑 ---
  const findCurrentLyric = useCallback((time: number, lyrics: LyricLine[]) => {
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (time >= lyrics[i].time) {
        return i;
      }
    }
    return -1;
  }, []);

  // --- 歌词滚动逻辑 ---
  useEffect(() => {
    if (lyricScrollRef.current && currentLineIndex >= 0) {
      const targetElement = lyricScrollRef.current.children[currentLineIndex + 1] as HTMLElement; // +1 因为第一个子元素是填充 div
      if (targetElement) {
        // 滚动到目标元素，使其在容器中居中
        const offset = targetElement.offsetTop - (lyricScrollRef.current.offsetHeight / 2) + (targetElement.offsetHeight / 2);

        lyricScrollRef.current.scrollTo({
          top: offset,
          behavior: "smooth",
        });
      }
    }
  }, [currentLineIndex]);

  // --- 效果钩子：用于加载和解析元数据 ---
  useEffect(() => {
    if (!src)
      return;
    setRawLyrics(null);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.src = src;
    }

    const loadMetadata = async () => {
      try {
        const mm = await import("music-metadata");
        const response = await fetch(src);
        if (!response.ok)
          throw new Error(`无法加载音频文件: ${response.statusText}`);
        const blob = await response.blob();
        const metadata = await mm.parseBlob(blob);

        let extractedLyrics = "（无歌词）";
        if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
          extractedLyrics = metadata.common.lyrics[0].text;
          setRawLyrics(extractedLyrics);
        }
        else {
          setError("未在此文件中找到内嵌歌词。");
          setRawLyrics(extractedLyrics);
        }
      }
      catch (e) {
        console.error("Error in loading or parsing metadata:", e);
        const errorMessage = e instanceof Error ? e.message : "发生未知错误。";
        setError(`加载或解析标签失败: ${errorMessage}`);
        setRawLyrics("（无歌词）");
      }
    };
    loadMetadata();
  }, [src]);

  // --- 音频事件处理 ---
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      }
      else {
        audioRef.current.play().catch((e) => {
          console.error("Audio playback failed:", e);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);

      const newIndex = findCurrentLyric(time, parsedLyrics);
      if (newIndex !== currentLineIndex) {
        setCurrentLineIndex(newIndex);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentLineIndex(-1);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLProgressElement>) => {
    if (audioRef.current && duration > 0) {
      const progressElement = e.currentTarget;
      const rect = progressElement.getBoundingClientRect();
      const clickPosition = e.clientX - rect.left;
      const width = rect.width;
      const newTime = (clickPosition / width) * duration;

      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);

      setCurrentLineIndex(findCurrentLyric(newTime, parsedLyrics));
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto my-4">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
      <div className="relative mt-4">
        {error && <p className="text-error text-sm text-center mb-2">{error}</p>}
        <div
          ref={lyricScrollRef}
          className="max-h-64 h-64 overflow-y-scroll scrollbar-none transition-all duration-300 px-4"
        >
          <div className="h-1/2 min-h-1/2 pt-4"></div>

          {parsedLyrics.length > 0
            ? (
                parsedLyrics.map((line, index) => (
                  <p
                    key={index}
                    className={`py-1 text-base transition-all duration-300 text-center 
                    ${index === currentLineIndex
                    ? "text-primary font-bold scale-110"
                    : "text-base-content/80 hover:text-base-content/100"
                  }`}
                  >
                    {line.text}
                  </p>
                ))
              )
            : (
                !error && <div className="flex justify-center p-4 text-sm text-base-content/80">正在加载歌词...</div>
              )}

          <div className="h-1/2 min-h-1/2 pb-4"></div>
        </div>

        <div className="absolute top-0 left-0 w-full h-1/4 bg-gradient-to-b from-base-100 to-transparent pointer-events-none"></div>

        <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gradient-to-t from-base-100 to-transparent pointer-events-none"></div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 bg-base-200 rounded-full shadow-xl">
        <button
          className="btn btn-primary btn-circle flex-shrink-0 w-10 h-10 min-h-10"
          onClick={togglePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          disabled={!duration}
        >
          <i className={`text-xl ${isPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="h-4 leading-4 overflow-hidden mb-0.5">
            <span className="text-xs font-medium text-base-content/90 block truncate">
              {currentLyricLine}
            </span>
          </div>

          <progress
            className="progress progress-primary w-full h-2 cursor-pointer"
            value={currentTime}
            max={duration || 1}
            onClick={handleProgressClick}
          />
          <div className="flex justify-between text-[10px] text-base-content/70 px-1 mt-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
