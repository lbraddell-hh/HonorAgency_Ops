/* Web Speech API helpers (demo voice mode): SpeechRecognition for push-to-talk
   input, speechSynthesis for per-agent spoken replies. */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
}

export function speechInputSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognition(onFinal: (transcript: string) => void, onEnd: () => void): RecognitionLike | null {
  const w = window as unknown as Record<string, new () => RecognitionLike>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript).join(" ");
    if (transcript.trim()) onFinal(transcript.trim());
  };
  recognition.onend = onEnd;
  recognition.onerror = onEnd;
  return recognition;
}

export function speak(text: string, voice: { rate: number; pitch: number; preferredVoiceName: string | null }): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = voice.rate;
  utterance.pitch = voice.pitch;
  if (voice.preferredVoiceName) {
    const match = speechSynthesis.getVoices().find((v) => v.name === voice.preferredVoiceName);
    if (match) utterance.voice = match;
  }
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  speechSynthesis.cancel();
}
