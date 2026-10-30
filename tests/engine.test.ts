import { describe, expect, it } from 'vitest';
import { Blackjack, createShoe, natural, settlement, total, type Card, type Hand } from '../src/engine';
let serial = 1000;
const card = (rank: number): Card => ({ rank, suit: 'spades', id: serial++ });
const hand = (ranks: number[], bet = 100, split = false): Hand => ({ cards: ranks.map(card), bet, split, done: false });
const gameWith = (ranks: number[]) => new Blackjack(2000, async()=>{}, [...Array.from({length:100},()=>card(10)), ...ranks.map(card).reverse()]);
describe('blackjack totals and settlement',()=>{
  it('downgrades multiple aces and detects soft totals',()=>{
    expect(total([1,1,9].map(card))).toEqual({value:21,soft:true});
    expect(total([1,6,10].map(card))).toEqual({value:17,soft:false});
    expect(total([1,1,10,10].map(card)).value).toBe(22);
  });
  it('pays natural 3:2 but split 21 only 1:1',()=>{
    expect(settlement(hand([1,13]),[10,9].map(card))).toEqual({outcome:'blackjack',returned:250});
    expect(settlement(hand([1,13],100,true),[10,9].map(card))).toEqual({outcome:'win',returned:200});
    expect(settlement(hand([1,13]),[1,12].map(card))).toEqual({outcome:'push',returned:100});
    expect(natural([7,7,7].map(card))).toBe(false);
  });
  it('player bust loses even when dealer busts',()=>expect(settlement(hand([10,10,5]),[10,10,5].map(card))).toEqual({outcome:'lose',returned:0}));
  it('builds six complete decks with unique IDs',()=>{
    const shoe=createShoe();expect(shoe).toHaveLength(312);expect(new Set(shoe.map(c=>c.id)).size).toBe(312);
    expect(shoe.filter(c=>c.rank===1&&c.suit==='hearts')).toHaveLength(6);
  });
});
describe('round transitions',()=>{
  it('settles dealer natural before player can double',async()=>{
    const g=gameWith([9,1,9,10]); await g.deal();expect(g.state.phase).toBe('result');expect(g.state.bank).toBe(1900);expect(g.canDouble).toBe(false);
  });
  it('stands on soft 17',async()=>{
    const g=gameWith([10,1,8,6]);await g.deal();expect(g.state.reveal).toBe(false);await g.stand();
    expect(g.state.dealer).toHaveLength(2);expect(g.state.bank).toBe(2100);
  });
  it('double reserves exactly one extra stake and deals one card',async()=>{
    const g=gameWith([5,10,6,7,10]);await g.deal();await g.double();
    expect(g.state.hands[0].cards).toHaveLength(3);expect(g.state.hands[0].bet).toBe(200);expect(g.state.bank).toBe(2200);
  });
  it('split aces each receive one card and cannot earn natural premium',async()=>{
    const g=gameWith([1,10,1,7,13,9]);await g.deal();await g.split();
    expect(g.state.phase).toBe('result');expect(g.state.hands.map(h=>h.cards.length)).toEqual([2,2]);expect(g.state.bank).toBe(2200);
    expect(g.state.hands.some(h=>h.outcome==='blackjack')).toBe(false);
  });
  it('blocks repeated actions during animation',async()=>{
    const waits: (()=>void)[]=[];
    const g=new Blackjack(2000,()=>new Promise<void>(resolve=>waits.push(resolve)));
    const run=g.deal();void g.deal();void g.hit();expect(g.state.bank).toBe(1900);expect(g.state.round).toBe(1);
    for(let i=0;i<20&&g.state.busy;i++){waits.shift()?.();await new Promise(r=>setTimeout(r,0));}await run;
  });
  it('does not change wager mid-hand or overdraw bank',async()=>{
    const g=gameWith([10,10,8,7]);g.bet(5000);expect(g.state.wager).toBe(500);await g.deal();g.bet(10);expect(g.state.wager).toBe(500);await g.stand();
    expect(g.state.bank).toBe(2500);
  });
});
