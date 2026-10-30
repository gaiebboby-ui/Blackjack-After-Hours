export type InspectableCard = {
  id: number; x: number; y: number; width: number; height: number;
  order: number; hidden: boolean; inspectable: boolean;
};

/** Hit-test resting positions so lifting a card cannot cause hover enter/leave loops. */
export function pickInspectableCard(cards: Iterable<InspectableCard>, x: number, y: number) {
  let picked: InspectableCard | undefined;
  for (const card of cards) {
    if (!card.inspectable || card.hidden) continue;
    if (Math.abs(x-card.x) > card.width/2 || Math.abs(y-card.y) > card.height/2) continue;
    if (!picked || card.order > picked.order) picked = card;
  }
  return picked?.id;
}
