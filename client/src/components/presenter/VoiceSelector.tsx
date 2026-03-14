import { useState, useRef } from "react";
import type { ElevenLabsVoice } from "@/api/types";
import { useElevenLabsVoices } from "@/api/hooks";
import { Loader2, Volume2 } from "lucide-react";

interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
  className?: string;
}

export function VoiceSelector({ value, onChange, className = "" }: VoiceSelectorProps) {
  const { data, isLoading } = useElevenLabsVoices();
  const [search, setSearch] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fall back to plain text input if not configured
  if (!isLoading && (!data?.configured || data.voices.length === 0)) {
    return (
      <input
        type="text"
        placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`px-2 py-1.5 bg-surface border border-border rounded text-sm text-text-primary font-mono focus:outline-none focus:border-accent ${className}`}
      />
    );
  }

  const voices = data?.voices ?? [];

  // Group by category
  const byCategory = voices.reduce<Record<string, ElevenLabsVoice[]>>((acc, v) => {
    (acc[v.category] ??= []).push(v);
    return acc;
  }, {});

  // Filter by search across all categories
  const filteredByCategory = Object.entries(byCategory).reduce<Record<string, ElevenLabsVoice[]>>(
    (acc, [cat, list]) => {
      const filtered = list.filter(
        (v) =>
          !search ||
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          (v.description ?? "").toLowerCase().includes(search.toLowerCase())
      );
      if (filtered.length > 0) acc[cat] = filtered;
      return acc;
    },
    {}
  );

  const selectedVoice = voices.find((v) => v.id === value);

  function playPreview(previewUrl: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 bg-surface border border-border rounded text-sm text-text-muted ${className}`}>
        <Loader2 size={12} className="animate-spin" />
        Loading voices…
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Search filter */}
      <input
        type="text"
        placeholder="Filter voices…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-2 py-1 bg-surface border border-border rounded text-xs text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
      />

      {/* Voice select */}
      <div className="flex items-center gap-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">— None —</option>
          {Object.entries(filteredByCategory).map(([category, list]) => (
            <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
              {list.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Preview button — only when a voice with a preview URL is selected */}
        {selectedVoice?.previewUrl && (
          <button
            type="button"
            onClick={(e) => playPreview(selectedVoice.previewUrl, e)}
            title="Preview voice"
            className="shrink-0 p-1.5 rounded border border-border bg-surface hover:bg-accent/10 hover:text-accent hover:border-accent/30 text-text-muted transition-colors"
          >
            <Volume2 size={13} />
          </button>
        )}
      </div>

      {/* Show the raw ID under the select for copy-paste convenience */}
      {value && (
        <p className="text-[10px] text-text-muted font-mono truncate">{value}</p>
      )}
    </div>
  );
}
