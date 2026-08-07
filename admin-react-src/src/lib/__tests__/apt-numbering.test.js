import { describe, it, expect } from 'vitest';
import { getAptLabel, makeAptId } from '../buildingHelpers';

describe('getAptLabel() — 4 дугаарлалтын схем', () => {
  it('floor_door: давхар+хаалга (padStart 2)', () => {
    expect(getAptLabel('floor_door', 1, 1, 2, 4, 101, 5)).toBe('102');
    expect(getAptLabel('floor_door', 1, 3, 12, 20, 101, 5)).toBe('312');
  });

  it('sequential: орц дамжин үргэлжилдэг дараалал', () => {
    // 1-р орц, 1-р давхар, 1-р хаалга → seqStart (101)
    expect(getAptLabel('sequential', 1, 1, 1, 4, 101, 5)).toBe('101');
    // 1-р орц, 2-р давхар, 1-р хаалга → 101 + (2-1)*4 = 105
    expect(getAptLabel('sequential', 1, 2, 1, 4, 101, 5)).toBe('105');
    // 2-р орц, 1-р давхар, 1-р хаалга → 101 + (2-1)*5*4 = 121
    expect(getAptLabel('sequential', 2, 1, 1, 4, 101, 5)).toBe('121');
  });

  it('entrance_floor: орц+давхар+хаалга', () => {
    expect(getAptLabel('entrance_floor', 1, 3, 2, 4, 101, 5)).toBe('1302');
  });

  it('floor_only: давхар+хаалга (padStart үгүй)', () => {
    expect(getAptLabel('floor_only', 1, 1, 2, 4, 101, 5)).toBe('12');
  });

  it('үл мэдэгдэх scheme бол floor_door-той адил fallback', () => {
    expect(getAptLabel('unknown', 1, 1, 2, 4, 101, 5)).toBe('102');
  });
});

describe('makeAptId() — резидентийн apt утга бүрдэл', () => {
  it('entrance үгүй үед buildingId*10000 + floor*100 + door', () => {
    expect(makeAptId(105, 3, 2)).toBe(1050302);
  });
  it('entrance байгаа үед buildingId*100000 + entrance*10000 + floor*100 + door', () => {
    expect(makeAptId(105, 3, 2, 1)).toBe(10510302);
  });
  it('apt=0 (Cosmo виртуал резидент) хэзээ ч үүсэхгүй — building 0, floor/door хамгийн бага атал ч 0 гарахгүй', () => {
    expect(makeAptId(0, 1, 1)).not.toBe(0);
  });
});
