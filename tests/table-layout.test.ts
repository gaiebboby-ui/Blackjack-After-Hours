import {describe,expect,it} from 'vitest';
import {tableLayout} from '../src/table-layout';

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
