import { Graphics } from 'pixi.js';
import { tableLayout } from './table-layout';

/** Static, resolution-independent joinery; rebuilt on resize, never in the animation loop. */
export function drawTableOrnament(g: Graphics, layout: ReturnType<typeof tableLayout>, portrait: boolean, bounds: { right: number; top: number }) {
  g.clear();
  const { portraitX: x, portraitY: y, portraitSize: size, width } = layout;
  const left = x - size * .57, bottom = y + size * .55;
  const bend = y + size * .03, end = x + size * .1;
  const right = Math.max(width + 30, x + size, bounds.right + 30);
  const ceiling = Math.min(-80, bounds.top - 30);
  const rim = portrait ? 12 : 20;
  const path = () => g.moveTo(left, ceiling).lineTo(left, bend)
    .bezierCurveTo(left, bottom, x - size * .34, bottom, end, bottom).lineTo(right, bottom);

  // Recessed dealer bay: dark upholstery, a rounded leather rail and two brass seams.
  path().lineTo(right, ceiling).closePath().fill(0x07130e);
  path().stroke({ color: 0x000904, width: rim + 13, alpha: .55 });
  path().stroke({ color: 0x8f8958, width: rim + 3 });
  path().stroke({ color: 0x183326, width: rim });
  path().stroke({ color: 0x203e2d, width: rim - 3 });
  path().stroke({ color: 0x091e15, width: rim - 6 });
  // A fine centre seam and small inset brass studs suggest hand-finished panels.
  path().stroke({ color: 0x72805a, width: .65, alpha: .65 });
  const stud = (px: number, py: number, angle: number) => {
    g.circle(px, py + 1, portrait ? 2.2 : 3.3).fill(0x020d08);
    g.circle(px, py - .35, portrait ? 1.45 : 2.3).fill(0xaaa574);
    const dx = Math.cos(angle) * rim * .38, dy = Math.sin(angle) * rim * .38;
    g.moveTo(px - dx, py - dy).lineTo(px + dx, py + dy).stroke({color: 0x626e4b, width: .6});
  };
  stud(left, bend - size * .35, 0);
  // Sample the same cubic as the rail, so fittings remain aligned at every size.
  for (const t of [.3, .64, .9]) {
    const q = 1 - t;
    const px = q*q*q*left + 3*q*q*t*left + 3*q*t*t*(x-size*.34) + t*t*t*end;
    const py = q*q*q*bend + (1-q*q*q)*bottom;
    const dx = 6*q*t*(x-size*.34-left) + 3*t*t*(end-x+size*.34);
    const dy = 3*q*q*(bottom-bend);
    stud(px, py, Math.atan2(dy, dx) + Math.PI / 2);
  }
  for (let px = end + size * .24; px < right; px += size * .4) stud(px, bottom, Math.PI / 2);

  // Restrained foil printing stays at the edge of the playing area.
  const inset = portrait ? 14 : 46, top = portrait ? bottom + 35 : 380;
  const foot = portrait ? Math.min(layout.height - 115, 650) : layout.height - 110;
  for (const edge of [inset, width - inset]) {
    g.moveTo(edge, top + 22).lineTo(edge, foot - 22).stroke({color: 0xa5aa70, width: .65, alpha: .2});
    for (const cy of [top, foot]) {
      g.poly([edge,cy-6,edge+3,cy,edge,cy+6,edge-3,cy]).fill({color:0xb6b77d,alpha:.37});
      g.circle(edge,cy,1).fill({color:0xf0df9f,alpha:.6});
    }
  }
}
