export function pcm16ToFloat32(raw: ArrayBuffer): Float32Array {
  if (!raw.byteLength || raw.byteLength % 2)
    throw new Error("Invalid voice audio frame");
  const view = new DataView(raw);
  const samples = new Float32Array(raw.byteLength / 2);
  for (let i = 0; i < samples.length; i++)
    samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

export class VoicePlayer {
  private sources = new Set<AudioBufferSourceNode>();
  private next = 0;
  constructor(private context: AudioContext) {}
  play(raw: ArrayBuffer) {
    const samples = pcm16ToFloat32(raw);
    // Bound queued speech if playback is suspended by the browser.
    if (this.next - this.context.currentTime > 45)
      throw new Error(
        "Audio playback paused. End voice and reconnect to continue.",
      );
    const buffer = this.context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
    };
    const start = Math.max(this.context.currentTime + 0.025, this.next);
    source.start(start);
    this.next = start + buffer.duration;
  }
  get speaking() {
    return this.sources.size > 0;
  }
  stop() {
    for (const source of this.sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.sources.clear();
    this.next = 0;
  }
}
