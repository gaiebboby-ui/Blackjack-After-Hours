import {describe,expect,it} from 'vitest';
import {tableLayout,dealerSpeechLayout,webHandRegion} from '../src/table-layout';

describe('portrait card layout', () => {
  it.each([.85,1,1.2])('separates portrait, scores and all three split hands at scale %s', scale => {
    const layout = tableLayout(true,3,scale);
    const half = layout.cardHeight / 2;
    expect(layout.dealerY - half - layout.scoreOffset - 28).toBeGreaterThan(layout.portraitY + layout.portraitSize / 2);
    let previousBottom = layout.dealerY + half;
    for (let hand = 0; hand < 3; hand++) {
      const scoreY = layout.playerY(hand) - half - layout.scoreOffset;
      expect(scoreY - 28).toBeGreaterThan(previousBottom);
      expect(scoreY + 28).toBeLessThan(layout.playerY(hand) - half);
      expect(layout.playerX(hand)).toBe(144);
      previousBottom = layout.playerY(hand) + half;
    }
    expect(previousBottom).toBeLessThan(layout.height);
  });
  it('keeps portrait cards large when more hands are added', () => {
    expect(tableLayout(true,3).cardWidth).toBe(tableLayout(true,1).cardWidth);
    expect(tableLayout(true,3).height).toBeGreaterThan(tableLayout(true,1).height);
    expect(tableLayout(false,3).playerY(0)).toBe(tableLayout(false,3).playerY(2));
  });
  it('keeps the short-phone hand visible while separating face, scores and cards',()=>{
    const layout=tableLayout(true,1,1,2000,true), half=layout.cardHeight/2;
    expect(layout.portraitSize).toBe(172);
    expect(layout.dealerY-half-layout.scoreOffset-28).toBeGreaterThan(layout.portraitY+layout.portraitSize/2);
    expect(layout.playerY(0)-half-layout.scoreOffset-28).toBeGreaterThan(layout.dealerY+half);
    expect(layout.playerY(0)+half).toBeLessThan(530);
  });
});

describe('desktop web layout',()=>{
  it.each([1,2,3])('enlarges %i hands without crossing scores or the chip pile',groups=>{
    const web=tableLayout(false,groups,1,2000,false,true);
    const native=tableLayout(false,groups,1,2000);
    expect(web.cardWidth).toBeGreaterThan(native.cardWidth);
    expect(web.playerY(0)-web.cardHeight/2-web.scoreOffset-33).toBeGreaterThan(web.dealerY+web.cardHeight/2);
    expect(web.height-34-(web.playerY(0)+web.cardHeight/2)).toBeGreaterThan(80);
    expect(JSON.stringify(tableLayout(true,groups,1,2000,false,true))).toBe(JSON.stringify(tableLayout(true,groups,1,2000)));
  });
  it.each([[840,900],[1024,768],[1280,720],[1440,900],[1920,1080],[2560,1080]])('fits speech and split hands at %ix%i',(width,height)=>{
    const layout=tableLayout(false,3,1,2000,false,true);
    const scale=Math.min(width/layout.width,(height-80)/layout.height), x=(width-layout.width*scale)/2;
    const speech=dealerSpeechLayout(width,x,scale,layout);
    expect(speech.left).toBeGreaterThan(x+(speech.portraitX+layout.portraitSize/2)*scale);
    expect(speech.width).toBeGreaterThan(100);
    expect(speech.left+speech.width).toBeLessThanOrEqual(width-24);
    const region=webHandRegion(width,x,scale,layout.width);
    const end=x+(region.left+region.width-15)*scale;
    expect(end).toBeLessThan(width-220);
    expect(region.width/3-30-layout.cardWidth).toBeGreaterThan(40);
    expect(x+(region.left+15)*scale).toBeGreaterThanOrEqual(30);
  });
});
