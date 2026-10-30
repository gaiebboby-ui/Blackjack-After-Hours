import {pileReserve} from './chip-pile';
/** Portrait hands remain full-sized and stack vertically, including split hands. */
export function tableLayout(portrait: boolean, groups = 1, cardScale = 1, bankroll = 0, compact = false) {
  const width = portrait ? 360 : 1200;
  const cardWidth = (portrait ? compact ? 70 : 88 : groups > 1 ? 134 : 148) * cardScale;
  const cardHeight = cardWidth * 716 / 512;
  const dealerY = (portrait ? compact ? 230 : 296 : 366) + cardHeight / 2;
  const rowStep = cardHeight + (portrait ? compact ? 62 : 72 : 100);
  const playerY = (index: number) => dealerY + rowStep * (portrait ? index + 1 : 1);
  const height = Math.max(portrait ? compact ? 590 : 705 : 960, playerY(Math.max(0, groups - 1)) + cardHeight / 2 + pileReserve(bankroll));
  return {width, height, cardWidth, cardHeight, dealerY, playerY,
    playerX: (index: number) => portrait ? 144 : width * (index + .5) / groups,
    portraitX: portrait ? 250 : 970,
    handWidth: portrait ? compact ? 145 : 164 : 0,
    portraitY: portrait ? compact ? 84 : 120 : 160, portraitSize: portrait ? compact ? 172 : 220 : 300,
    scoreOffset: portrait ? compact ? 28 : 34 : 44,
  };
}
