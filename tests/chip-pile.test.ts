import {describe,expect,it} from 'vitest';
import {chipPile,heapCount,MAX_PILE_CHIPS,pileReserve} from '../src/chip-pile';
import {tableLayout} from '../src/table-layout';

describe('player chip piles',()=>{
  it('tracks low balances and fractional top chips without moving existing columns',()=>{
    const total=(bank:number)=>chipPile(bank).reduce((sum,chip)=>sum+chip.fill,0);
    expect(total(2000)).toBe(8);
    expect(total(1900)).toBeCloseTo(7.6);
    expect(total(2150)).toBeCloseTo(8.6);
    expect(chipPile(5000)[0]).toEqual(chipPile(25000)[0]);
    expect(chipPile(100000)).toHaveLength(400);
    expect(chipPile(100000).every(c=>c.heap===0)).toBe(true);
  });
  it('adds exactly nine mounds at 200k through one million, including the final boundary',()=>{
    expect(heapCount(100000)).toBe(0);
    for(let stage=1;stage<=9;stage++){
      const threshold=(stage+1)*100000;
      expect(heapCount(threshold-1)).toBe(stage-1);
      expect(heapCount(threshold)).toBe(stage);
      expect(chipPile(threshold).filter(c=>c.heap===stage)).toHaveLength(64);
    }
    expect(heapCount(999999)).toBe(8);
    expect(heapCount(1000000)).toBe(9);
    expect(chipPile(1e9)).toHaveLength(MAX_PILE_CHIPS);
  });
  it('keeps a stable deterministic arrangement and bounds invalid balances',()=>{
    expect(chipPile(600000)).toEqual(chipPile(600000));
    expect(chipPile(300000).slice(0,464)).toEqual(chipPile(200000));
    for(const balance of [0,-100,NaN,Infinity]) expect(chipPile(balance)).toEqual([]);
    expect(pileReserve(1e9)).toBe(pileReserve(1000000));
  });
  it.each([true,false])('reserves a clear rail below all hands, portrait=%s',portrait=>{
    for(const balance of [2000,100000,200000,900000,1000000]){
      const layout=tableLayout(portrait,3,1.2,balance);
      const depth=portrait?100:140,spacing=portrait?1.15:1.6,radius=portrait?17:27;
      const top=Math.min(...chipPile(balance).map(c=>layout.height-34+c.y*depth-c.layer*spacing-radius));
      expect(top).toBeGreaterThan(layout.playerY(2)+layout.cardHeight/2);
    }
  });
});
