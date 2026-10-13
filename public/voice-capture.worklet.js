// Native microphone samples -> 20ms frames of mono 16kHz PCM16.
// The fractional accumulator handles browsers that keep a 44.1/48kHz context.
class FlairifyCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Int16Array(320);
    this.offset = 0;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.sum += sample;
      this.count++;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        const value = Math.max(-1, Math.min(1, this.sum / this.count));
        this.frame[this.offset++] = value < 0 ? value * 32768 : value * 32767;
        this.phase -= sampleRate;
        this.sum = 0;
        this.count = 0;
        if (this.offset === this.frame.length) {
          this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
          this.frame = new Int16Array(320);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("flairify-capture", FlairifyCapture);
