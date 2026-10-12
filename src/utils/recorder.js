// Records a supervision meeting in the browser and hands the audio over in
// short segments, so each one can be transcribed and discarded while the
// meeting is still running. Nothing is written to disk or uploaded from here.

const SEGMENT_MS = 8 * 60 * 1000;
const MIME_TYPE = 'audio/webm;codecs=opus';

/**
 * Ask for the computer's own sound (the other side of a Zoom call).
 * Chrome/Edge only offer it together with screen sharing, so the video track
 * is kept alive but never recorded. Returns null if the user declined or did
 * not tick "share system audio".
 */
async function getSystemAudioStream() {
  if (!navigator.mediaDevices.getDisplayMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      systemAudio: 'include',
    });
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach(t => t.stop());
      return null;
    }
    return stream;
  } catch {
    return null;
  }
}

/**
 * Start recording. `onSegment(blob)` is called every few minutes and once
 * more when the recording stops.
 * Returns { hasSystemAudio, stop(), cancel() }.
 */
export async function startRecording({ withSystemAudio, onSegment, onSystemAudioEnded }) {
  // Echo cancellation is off on purpose: when Zoom plays through the speakers
  // it would strip the other speaker's voice out of the microphone signal.
  const micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
  });
  const systemStream = withSystemAudio ? await getSystemAudioStream() : null;

  const audioCtx = new AudioContext();
  const mix = audioCtx.createMediaStreamDestination();
  audioCtx.createMediaStreamSource(micStream).connect(mix);
  if (systemStream) {
    audioCtx.createMediaStreamSource(new MediaStream(systemStream.getAudioTracks())).connect(mix);
    systemStream.getAudioTracks()[0].addEventListener('ended', () => onSystemAudioEnded?.());
  }

  let current = null;
  let timer = null;
  let stopped = false;
  const pending = [];

  function startSegment() {
    const rec = new MediaRecorder(mix.stream, { mimeType: MIME_TYPE, audioBitsPerSecond: 32000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    pending.push(new Promise(resolve => {
      rec.onstop = () => {
        if (!stopped || chunks.length) onSegment(new Blob(chunks, { type: MIME_TYPE }));
        resolve();
      };
    }));
    rec.start();
    current = rec;
    timer = setTimeout(rotate, SEGMENT_MS);
  }

  // The next segment starts before the previous one stops, so no speech is
  // lost at the seam.
  function rotate() {
    const previous = current;
    startSegment();
    previous.stop();
  }

  function release() {
    clearTimeout(timer);
    micStream.getTracks().forEach(t => t.stop());
    systemStream?.getTracks().forEach(t => t.stop());
    audioCtx.close().catch(() => {});
  }

  startSegment();

  return {
    hasSystemAudio: !!systemStream,
    async stop() {
      clearTimeout(timer);
      if (current.state !== 'inactive') current.stop();
      await Promise.all(pending);
      release();
    },
    // Stop without delivering the audio recorded so far.
    cancel() {
      stopped = true;
      if (current.state !== 'inactive') {
        current.ondataavailable = null;
        current.stop();
      }
      release();
    },
  };
}
