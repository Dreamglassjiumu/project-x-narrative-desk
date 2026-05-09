import type { SavedPitch } from '../../utils/pitch';

export function PitchLoader({ pitches, currentId, onLoad }: { pitches: SavedPitch[]; currentId?: string; onLoad: (pitch: SavedPitch) => void }) {
  return (
    <label className="block"><span className="field-label">Load Pitch</span><select className="paper-input" value={currentId ?? ''} onChange={(event) => { const pitch = pitches.find((item) => item.id === event.target.value); if (pitch) onLoad(pitch); }}><option value="">Select saved case pitch…</option>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.title} · {pitch.status}</option>)}</select></label>
  );
}
