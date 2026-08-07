import { useMemo } from 'react';
import { spotFullLabel, labelsMatch, getSpotOwner } from '../lib/parkingStorageHelpers';

// parking-storage.js-ийн renderSpotPickerRow()/populateSpotZoneOptions()/
// populateSpotNumOptions() гинжин cascading select-үүдийг React болгов.
// value: {floor, zone, num} нэг мөрийн state. onChange(next) дуудагдана.
export default function SpotPickerRow({
  kind, value, onChange, onRemove,
  parkingTypes, storageTypes, residents, businesses,
  excludeType, excludeId, siblingLabels,
}) {
  const typesArr = kind === 'storage' ? storageTypes : parkingTypes;
  const numField = kind === 'storage' ? 'unit_numbers' : 'spot_numbers';

  const floors = useMemo(() => [...new Set(typesArr.map((t) => t.floor_label).filter(Boolean))], [typesArr]);
  const zones = useMemo(
    () => [...new Set(typesArr.filter((t) => (t.floor_label || '') === (value.floor || '')).map((t) => t.zone_label).filter(Boolean))],
    [typesArr, value.floor]
  );
  const matchingType = typesArr.find((t) => (t.floor_label || '') === (value.floor || '') && (t.zone_label || '') === (value.zone || ''));

  const availableNums = useMemo(() => {
    if (!matchingType) return [];
    return (matchingType[numField] || []).filter((n) => {
      if (n === value.num) return true;
      const full = spotFullLabel(value.floor, value.zone, n);
      if ((siblingLabels || []).some((sl) => labelsMatch(sl, full))) return false;
      return !getSpotOwner(kind, full, residents, businesses, excludeType, excludeId);
    });
  }, [matchingType, numField, value.floor, value.zone, value.num, siblingLabels, kind, residents, businesses, excludeType, excludeId]);

  return (
    <div className="wizard-row">
      {floors.length > 0 && (
        <select value={value.floor || ''} onChange={(e) => onChange({ floor: e.target.value, zone: '', num: '' })}>
          <option value="">Давхар</option>
          {floors.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      )}
      {zones.length > 0 && (
        <select value={value.zone || ''} onChange={(e) => onChange({ ...value, zone: e.target.value, num: '' })}>
          <option value="">Бүс</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      )}
      <input
        list={`spot-nums-${kind}-${value.floor}-${value.zone}`}
        value={value.num || ''}
        onChange={(e) => onChange({ ...value, num: e.target.value })}
        placeholder="Дугаар"
        style={{ width: 90 }}
      />
      <datalist id={`spot-nums-${kind}-${value.floor}-${value.zone}`}>
        {availableNums.map((n) => <option key={n} value={n} />)}
      </datalist>
      <button type="button" className="btn-ghost-sm danger" onClick={onRemove}>✕</button>
    </div>
  );
}
