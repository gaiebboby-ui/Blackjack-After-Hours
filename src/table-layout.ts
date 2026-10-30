import {pileReserve} from './chip-pile';
/** Portrait hands remain full-sized and stack vertically, including split hands. */
export function tableLayout(portrait: boolean, groups = 1, cardScale = 1, bankroll = 0, compact = false, desktopWeb = false) {
  const width = portrait ? 360 : 1200;
  const web = desktopWeb && !portrait;
  const cardWidth = (portrait ? compact ? 70 : 88 : web ? groups > 1 ? 176 : 196 : groups > 1 ? 134 : 148) * cardScale;
  const cardHeight = cardWidth * 716 / 512;
  const dealerY = (portrait ? compact ? 230 : 296 : 366) + cardHeight / 2;
  const rowStep = cardHeight + (portrait ? compact ? 62 : 72 : web ? 88 : 100);
  const playerY = (index: number) => dealerY + rowStep * (portrait ? index + 1 : 1);
  const height = Math.max(portrait ? compact ? 590 : 705 : 960, playerY(Math.max(0, groups - 1)) + cardHeight / 2 + pileReserve(bankroll) + (web ? 16 : 0));
  return {width, height, cardWidth, cardHeight, dealerY, playerY,
    playerX: (index: number) => portrait ? 144 : width * (index + .5) / groups,
    portraitX: portrait ? 250 : 970,
    handWidth: portrait ? compact ? 145 : 164 : 0,
    portraitY: portrait ? compact ? 84 : 120 : 160, portraitSize: portrait ? compact ? 172 : 220 : 300,
    scoreOffset: portrait ? compact ? 28 : 34 : 44,
  };
}

/** Keep the speech beside the avatar, within the board, even on narrower desktops. */
export function dealerSpeechLayout(boardWidth: number, worldX: number, scale: number, layout: ReturnType<typeof tableLayout>) {
  const margin = 24, gap = 18;
  const preferredWidth = Math.min(280, boardWidth * .21);
  const portraitX = Math.max(830, Math.min(layout.portraitX,
    (boardWidth - worldX - margin - preferredWidth - gap) / scale - layout.portraitSize / 2));
  const left = worldX + (portraitX + layout.portraitSize / 2) * scale + gap;
  return {portraitX, left, width: Math.min(280, boardWidth - left - margin)};
}

/** Split hands leave a clear lane for the fixed action panel on narrow desktops. */
export function webHandRegion(boardWidth: number, worldX: number, scale: number, tableWidth: number) {
  const left = Math.max(0, (32 - worldX) / scale);
  return {left, width: Math.min(tableWidth, (boardWidth - 238 - worldX) / scale) - left};
}
