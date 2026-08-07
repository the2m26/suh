import { describe, it, expect } from 'vitest';
import {
  spotFullLabel, labelsMatch, parseAffixRange, parseZoneRange, parseNumberRange,
  getSpotOwner, validateSpotAssignment,
} from '../parkingStorageHelpers';

describe('labelsMatch() — падding ялгаатай ч тоон хэсэг тэнцүү бол ижил', () => {
  it('яг ижил бол үнэн', () => {
    expect(labelsMatch('B2-012', 'B2-012')).toBe(true);
  });
  it('падding ялгаатай тоон хэсэг ижил бол үнэн', () => {
    expect(labelsMatch('B2-012', 'B2-12')).toBe(true);
  });
  it('угтвар (давхар/бүс) ялгаатай бол худал', () => {
    expect(labelsMatch('B2-012', 'B3-012')).toBe(false);
  });
  it('хэсгийн тоо ялгаатай бол худал', () => {
    expect(labelsMatch('B2-A-012', 'B2-012')).toBe(false);
  });
});

describe('parseAffixRange() — үсэг+тоо угтвартай муж', () => {
  it('"B1-B6" -> B1..B6', () => {
    expect(parseAffixRange('B1-B6')).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
  });
  it('падding хадгална: "B01-B03"', () => {
    expect(parseAffixRange('B01-B03')).toEqual(['B01', 'B02', 'B03']);
  });
  it('дан утга (муж биш)', () => {
    expect(parseAffixRange('B5')).toEqual(['B5']);
  });
});

describe('parseZoneRange() — цэвэр үсгийн муж', () => {
  it('"A-G" -> A..G', () => {
    expect(parseZoneRange('A-G')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
  it('жижиг үсгийг том болгоно', () => {
    expect(parseZoneRange('a-c')).toEqual(['A', 'B', 'C']);
  });
});

describe('parseNumberRange() — цэвэр тооны муж', () => {
  it('"001-121" падding хадгална', () => {
    const result = parseNumberRange('001-121');
    expect(result[0]).toBe('001');
    expect(result[result.length - 1]).toBe('121');
    expect(result).toHaveLength(121);
  });
  it('"1-5" падding үгүй', () => {
    expect(parseNumberRange('1-5')).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('getSpotOwner() — resident/business хоёулаас хайна', () => {
  const residents = [{ id: 1, parkings: ['B1-005'], storages: [] }];
  const businesses = [{ id: 2, parkings: ['B1-006'], storages: [] }];

  it('resident эзэмшигчийг олно', () => {
    const owner = getSpotOwner('parking', 'B1-5', residents, businesses);
    expect(owner).toEqual({ type: 'resident', obj: residents[0] });
  });
  it('business эзэмшигчийг олно', () => {
    const owner = getSpotOwner('parking', 'B1-006', residents, businesses);
    expect(owner.type).toBe('business');
  });
  it('excludeType/excludeId-аар өөрийгөө алгасна', () => {
    const owner = getSpotOwner('parking', 'B1-005', residents, businesses, 'resident', 1);
    expect(owner).toBeNull();
  });
  it('хоосон бол null', () => {
    expect(getSpotOwner('parking', 'Z9-999', residents, businesses)).toBeNull();
  });
});

describe('validateSpotAssignment() — 3 төрлийн шалгалт', () => {
  const parkingTypes = [{ floor_label: 'B1', zone_label: '', spot_numbers: ['005', '006', '007'] }];
  const storageTypes = [];
  const residents = [{ id: 1, parkings: ['B1-006'], storages: [] }];
  const businesses = [];

  it('давхардал байхгүй бол null (амжилттай)', () => {
    const err = validateSpotAssignment('parking', ['B1-005'], parkingTypes, storageTypes, residents, businesses, null, null);
    expect(err).toBeNull();
  });
  it('дотоод давхардал (ижил мөр 2 удаа) алдаа өгнө', () => {
    const err = validateSpotAssignment('parking', ['B1-005', 'B1-5'], parkingTypes, storageTypes, residents, businesses, null, null);
    expect(err).toMatch(/олон удаа сонгосон/);
  });
  it('бүртгэлд байхгүй утга алдаа өгнө', () => {
    const err = validateSpotAssignment('parking', ['Z9-999'], parkingTypes, storageTypes, residents, businesses, null, null);
    expect(err).toMatch(/олдсонгүй/);
  });
  it('бусад эзэмшигчтэй давхцвал алдаа өгнө', () => {
    const err = validateSpotAssignment('parking', ['B1-006'], parkingTypes, storageTypes, residents, businesses, null, null);
    expect(err).toMatch(/эзэнтэй байна/);
  });
  it('өөрийгөө (excludeId) шалгалтаас хасвал зөв (засах горимд өөрийн spot дахин зөвшөөрнө)', () => {
    const err = validateSpotAssignment('parking', ['B1-006'], parkingTypes, storageTypes, residents, businesses, 'resident', 1);
    expect(err).toBeNull();
  });
});

describe('spotFullLabel()', () => {
  it('хоосон хэсгүүдийг алгасна', () => {
    expect(spotFullLabel('B1', '', '005')).toBe('B1-005');
    expect(spotFullLabel('', '', '005')).toBe('005');
  });
});
