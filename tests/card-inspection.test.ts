import {describe,expect,it} from 'vitest';
import {pickInspectableCard,type InspectableCard} from '../src/card-inspection';
const card=(id:number,x:number,order:number,extra:Partial<InspectableCard>={}):InspectableCard=>({id,x,y:200,width:100,height:140,order,hidden:false,inspectable:true,...extra});
describe('card inspection hit testing',()=>{
  it('chooses the top resting card in overlaps and keeps the exposed strip selectable',()=>{
    const hand=[card(1,100,20),card(2,165,21)];
    expect(pickInspectableCard(hand,120,200)).toBe(2);
    expect(pickInspectableCard(hand,80,200)).toBe(1);
    expect(pickInspectableCard(hand,80,269)).toBe(1);
    expect(pickInspectableCard(hand,80,280)).toBeUndefined();
  });
  it('never inspects a hole card or the dealer hand',()=>{
    expect(pickInspectableCard([card(1,100,22,{hidden:true}),card(2,100,21,{inspectable:false})],100,200)).toBeUndefined();
  });
});
