/** Decorative bankroll volume, independent of exact currency accounting. */
export const MAX_PILE_CHIPS = 400 + 9 * 64;
export const heapCount = (bank:number) => Math.max(0, Math.min(9, Math.floor((Number.isFinite(bank)?bank:0) / 100_000) - 1));
export const pileReserve = (bank:number) => {
  const value=Math.max(0,Number.isFinite(bank)?bank:0);
  return 100 + 80*Math.min(1,value/100_000) + 80*Math.min(1,Math.max(0,value-100_000)/900_000);
};
export type PileChip = {x:number;y:number;layer:number;fill:number;rotation:number;tone:number;heap:number};
const noise=(seed:number)=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);};

export function chipPile(bank:number):PileChip[] {
  const value=Math.max(0,Number.isFinite(bank)?bank:0);
  const units=Math.min(400,value/250);
  const chips:PileChip[]=[];
  // Fill stable columns from the centre outward, then a second row behind them.
  const columns=[-.5,.5,-1.5,1.5,-2.5,2.5,-3.5,3.5];
  const capacities=[12,18,23,15,20,12]; // 100 chips per six stacks; varied heights.
  let column=0, start=0;
  for(let i=0;i<Math.ceil(units);i++) {
    if(i-start>=capacities[column%6]){start=i;column++;}
    chips.push({x:columns[column%8]*.084,y:-Math.floor(column/8)*.21,layer:i-start,
      fill:Math.min(1,units-i),rotation:-.12+(column%7)*.04,tone:column%5,heap:0});
  }
  // Nine distinct mounds, at 200k, 300k, ... 1m. Stable seeds prevent jitter.
  const centres=[[-.32,-.1],[.32,-.1],[0,-.26],[-.32,-.48],[.32,-.48],
    [0,-.62],[-.32,-.84],[.32,-.84],[0,-.98]];
  for(let h=0;h<heapCount(value);h++) {
    const [cx,cy]=centres[h];
    for(let i=0;i<64;i++) {
      const seed=1000+h*100+i;
      const angle=noise(seed)*Math.PI*2, radius=Math.sqrt(noise(seed+71));
      const stacked=i<40, column=Math.floor(i/8);
      chips.push({x:cx+(stacked?(column-2)*.035:Math.cos(angle)*radius*.14),
        y:cy+(stacked?(column%2)*.085:Math.sin(angle)*radius*.17),
        layer:stacked?i%8:noise(seed+27)*3,fill:1,
        rotation:(noise(seed+19)-.5)*.6,tone:Math.floor(noise(seed+33)*5),heap:h+1});
    }
  }
  return chips;
}
