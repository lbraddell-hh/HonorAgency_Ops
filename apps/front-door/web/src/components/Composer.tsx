import { useEffect, useRef, useState } from "react";
import { createRecognition, speechInputSupported } from "../lib/speech";

export function Composer({
  disabled,
  voiceMode,
  onToggleVoice,
  onSend,
  onAttach,
}: {
  disabled: boolean;
  voiceMode: boolean;
  onToggleVoice: () => void;
  onSend: (text: string) => void;
  onAttach?: (file: File) => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createRecognition>>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canListen = speechInputSupported();

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    onSend(trimmed);
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = createRecognition(
      (transcript) => onSend(transcript),
      () => setListening(false),
    );
    if (!recognition) return;
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="flex items-end gap-2">
      <button
        type="button"
        onClick={onToggleVoice}
        title={voiceMode ? "Voice replies on" : "Voice replies off"}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
          voiceMode ? "border-gold bg-gold-soft text-[#7a5500]" : "border-ink/15 bg-white text-ink-soft hover:border-plum/40"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 10v4M7.5 6v12M12 3v18M16.5 7v10M21 10v4" />
        </svg>
      </button>

      {onAttach && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAttach(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Share a file or image"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink-soft transition-colors hover:border-plum/40 disabled:opacity-40"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        </>
      )}

      <div className="flex min-h-11 flex-1 items-end rounded-[22px] border border-ink/15 bg-white px-4 py-2 shadow-card focus-within:border-plum/50">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={listening ? "Listening…" : "Tell the agency what you need…"}
          className="max-h-36 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-ink-soft/70"
        />
      </div>

      {canListen && (
        <button
          type="button"
          onClick={toggleMic}
          disabled={disabled}
          title="Push to talk"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
            listening ? "speaking-ring bg-coral text-white" : "border border-ink/15 bg-white text-ink-soft hover:border-plum/40"
          } disabled:opacity-40`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
            <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2Z" />
          </svg>
        </button>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-white transition-colors hover:bg-plum-deep disabled:opacity-40"
        title="Send"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.4 20.4 22 12 3.4 3.6 3.4 10l13 2-13 2z" />
        </svg>
      </button>
    </div>
  );
}
