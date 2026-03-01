declare module "soundtouchjs" {
  export class PitchShifter {
    constructor(
      context: AudioContext,
      buffer: AudioBuffer,
      bufferSize: number,
      onEnd?: () => void
    );
    timePlayed: number;
    sourcePosition: number;
    duration: number;
    sampleRate: number;
    get formattedDuration(): string;
    get formattedTimePlayed(): string;
    get percentagePlayed(): number;
    set percentagePlayed(perc: number);
    get node(): ScriptProcessorNode;
    set pitch(pitch: number);
    set pitchSemitones(semitone: number);
    set rate(rate: number);
    set tempo(tempo: number);
    connect(toNode: AudioNode): void;
    disconnect(): void;
    on(eventName: string, cb: (detail: unknown) => void): void;
    off(eventName?: string | null): void;
  }
}
