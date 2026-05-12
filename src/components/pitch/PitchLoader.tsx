import type { SavedPitch } from '../../utils/pitch';

export function PitchLoader({ pitches, currentId, onLoad }: { pitches: SavedPitch[]; currentId?: string; onLoad: (pitch: SavedPitch) => void }) {
  return (
    <label className="block"><span className="field-label">读取</span><select className="paper-input" value={currentId ?? ''} onChange={(event) => { const pitch = pitches.find((item) => item.id === event.target.value); if (pitch) onLoad(pitch); }}><option value="">选择已保存 Pitch…</option>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.title} · {pitch.status}</option>)}</select></label>
  );
}
