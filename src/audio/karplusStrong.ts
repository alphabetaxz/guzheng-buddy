/**
 * Computes root-mean-square (RMS) amplitude of an audio sample buffer.
 */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let sumSq = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i] ?? 0;
    sumSq += x * x;
  }
  return Math.sqrt(sumSq / samples.length);
}

/**
 * Generates a realistic plucked-string waveform via fractional-delay Karplus-Strong synthesis.
 * Uses linear interpolation to compensate for the 0.5-sample lowpass phase delay, keeping
 * high guzheng strings (up to D6 = 1174.66 Hz) accurately in tune.
 */
export function generateKarplusStrongSamples(
  frequency: number,
  sampleRate: number,
  durationSec: number = 1.4,
  damping: number = 0.996,
): Float32Array {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError(`Frequency must be a positive finite number, got ${frequency}`);
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`Sample rate must be a positive finite number, got ${sampleRate}`);
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new RangeError(`Duration must be a positive finite number, got ${durationSec}`);
  }

  const totalSamples = Math.max(1, Math.round(sampleRate * durationSec));
  const output = new Float32Array(totalSamples);

  // Compensate for the +0.5-sample delay introduced by averaging [n - D] and [n - D - 1]
  const exactDelay = Math.max(2, sampleRate / frequency - 0.5);
  const delayInt = Math.floor(exactDelay);
  const frac = exactDelay - delayInt;
  const ringLen = delayInt + 3;
  const ring = new Float32Array(ringLen);

  // Seed delay line with zero-mean white noise smoothed slightly for warm silk-string pluck
  let seed = Math.round(frequency * 100) ^ 0x9e3779b9;
  let mean = 0;
  for (let i = 0; i < ringLen; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = (seed / 0xffffffff) * 2 - 1;
    ring[i] = white;
    mean += white;
  }
  mean /= ringLen;
  for (let i = 0; i < ringLen; i += 1) {
    ring[i] = ((ring[i] ?? 0) - mean) * 0.85;
  }

  // Smooth the noise burst with a quick 1-pass pluck lowpass so high strings aren't harsh
  let prevSeed = ring[ringLen - 1] ?? 0;
  for (let i = 0; i < ringLen; i += 1) {
    const cur = ring[i] ?? 0;
    ring[i] = 0.65 * cur + 0.35 * prevSeed;
    prevSeed = cur;
  }

  let writeIdx = 0;
  const effectiveDamping = Math.min(0.9992, Math.max(0.985, damping));

  for (let n = 0; n < totalSamples; n += 1) {
    const idxA = (writeIdx - delayInt + ringLen) % ringLen;
    const idxB = (writeIdx - delayInt - 1 + ringLen) % ringLen;
    const idxC = (writeIdx - delayInt - 2 + ringLen) % ringLen;

    const sampleA = ring[idxA] ?? 0;
    const sampleB = ring[idxB] ?? 0;
    const sampleC = ring[idxC] ?? 0;

    // Linear fractional interpolation: delay = exactDelay and exactDelay + 1 -> avg delay = exactDelay + 0.5
    const delayed = sampleA * (1 - frac) + sampleB * frac;
    const delayedPrev = sampleB * (1 - frac) + sampleC * frac;
    const filtered = 0.5 * (delayed + delayedPrev) * effectiveDamping;

    output[n] = delayed;
    ring[writeIdx] = filtered;
    writeIdx = (writeIdx + 1) % ringLen;
  }

  return output;
}
