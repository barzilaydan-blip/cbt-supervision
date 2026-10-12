const TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export function isTranscriptionConfigured() {
  return !!API_KEY;
}

async function requestTranscription(blob, fields) {
  const form = new FormData();
  form.append('file', blob, 'segment.webm');
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  const res = await fetch(TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const err = new Error(`Transcription failed (${res.status}): ${await res.text().catch(() => '')}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Merge consecutive segments of the same speaker into "A: ..." lines.
function formatDiarized(segments) {
  const lines = [];
  for (const s of segments) {
    const text = (s.text || '').trim();
    if (!text) continue;
    const last = lines[lines.length - 1];
    if (last && last.speaker === s.speaker) last.text += ` ${text}`;
    else lines.push({ speaker: s.speaker, text });
  }
  return lines.map(l => `${l.speaker}: ${l.text}`).join('\n');
}

/**
 * Transcribe one recorded segment. Speakers are labelled (A, B, ...) when the
 * diarizing model accepts the audio; otherwise falls back to plain text.
 * The audio is sent for transcription only — it is not stored by this app.
 */
export async function transcribeSegment(blob) {
  try {
    const data = await requestTranscription(blob, {
      model: 'gpt-4o-transcribe-diarize',
      response_format: 'diarized_json',
      chunking_strategy: 'auto',
    });
    return formatDiarized(data.segments || []) || (data.text || '').trim();
  } catch (err) {
    if (err.status !== 400) throw err;
    console.warn('Diarized transcription rejected, retrying without speaker labels', err);
    const data = await requestTranscription(blob, { model: 'gpt-transcribe' });
    return (data.text || '').trim();
  }
}
