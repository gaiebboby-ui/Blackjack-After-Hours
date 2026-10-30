export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Card = { rank: number; suit: Suit; id: number };
export type Outcome = 'win' | 'lose' | 'push' | 'blackjack';
export type Hand = { cards: Card[]; bet: number; done: boolean; split: boolean; outcome?: Outcome };
export type Phase = 'betting' | 'dealing' | 'player' | 'dealer' | 'result';
export type GameState = {
  bank: number; wager: number; phase: Phase; hands: Hand[]; dealer: Card[];
  active: number; reveal: boolean; busy: boolean; round: number; delta: number;
};
export function total(cards: Card[]) {
  let value = 0, aces = 0;
  for (const c of cards) { value += Math.min(c.rank, 10); if (c.rank === 1) aces++; }
  const soft = aces > 0 && value + 10 <= 21;
  return { value: value + (soft ? 10 : 0), soft };
}
export const natural = (cards: Card[]) => cards.length === 2 && total(cards).value === 21;
export function settlement(hand: Hand, dealer: Card[]): { outcome: Outcome; returned: number } {
  const p = total(hand.cards).value, d = total(dealer).value;
  const pbj = !hand.split && natural(hand.cards), dbj = natural(dealer);
  if (p > 21) return { outcome: 'lose', returned: 0 };
  if (pbj && !dbj) return { outcome: 'blackjack', returned: hand.bet * 5 / 2 };
  if (dbj && !pbj) return { outcome: 'lose', returned: 0 };
  if (p === d) return { outcome: 'push', returned: hand.bet };
  if (d > 21 || p > d) return { outcome: 'win', returned: hand.bet * 2 };
  return { outcome: 'lose', returned: 0 };
}
function randomIndex(limit: number): number {
  const buffer = new Uint32Array(1);
  const ceiling = Math.floor(4294967296 / limit) * limit;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return buffer[0] % limit;
}
export function createShoe(): Card[] {
  const cards: Card[] = []; let id = 0;
  for (let deck = 0; deck < 6; deck++) for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]) {
    for (let rank = 1; rank <= 13; rank++) cards.push({ rank, suit, id: id++ });
  }
  for (let i = cards.length - 1; i > 0; i--) { const j = randomIndex(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}
export class Blackjack {
  state: GameState;
  private shoe: Card[];
  private startingBank = 0;
  onChange: (state: GameState, sound?: 'card' | 'flip' | 'chip' | 'win') => void = () => {};
  constructor(bank = 2000, private wait: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)), shoe?: Card[]) {
    this.shoe = shoe ?? createShoe();
    this.state = { bank, wager: 100, phase: 'betting', hands: [], dealer: [], active: 0, reveal: false, busy: false, round: 0, delta: 0 };
  }
  emit(sound?: 'card' | 'flip' | 'chip' | 'win') { this.onChange(this.state, sound); }
  private draw(): Card { const card = this.shoe.pop(); if (!card) throw new Error('Shoe exhausted'); return card; }
  get canAct() { return this.state.phase === 'player' && !this.state.busy; }
  get canDouble() { const s = this.state, h = s.hands[s.active]; return this.canAct && h.cards.length === 2 && s.bank >= h.bet; }
  get canSplit() {
    const s = this.state, h = s.hands[s.active];
    return this.canAct && s.hands.length < 3 && h.cards.length === 2 && h.cards[0].rank === h.cards[1].rank && s.bank >= h.bet;
  }
  bet(amount: number) {
    const s = this.state;
    if (s.phase !== 'betting' && s.phase !== 'result') return;
    s.wager = Math.max(10, Math.min(500, Math.floor(s.bank / 10) * 10, Math.round(amount / 10) * 10));
    this.emit('chip');
  }
  async deal() {
    const s = this.state;
    if (s.busy || !['betting', 'result'].includes(s.phase) || s.bank < s.wager) return;
    if (this.shoe.length < 78) this.shoe = createShoe();
    this.startingBank = s.bank;
    s.bank -= s.wager; s.hands = [{ cards: [], bet: s.wager, done: false, split: false }];
    s.dealer = []; s.active = 0; s.reveal = false; s.phase = 'dealing'; s.busy = true; s.delta = 0; s.round++;
    this.emit(); await this.wait(200);
    for (let i = 0; i < 2; i++) {
      s.hands[0].cards.push(this.draw()); this.emit('card'); await this.wait(390);
      s.dealer.push(this.draw()); this.emit('card'); await this.wait(390);
    }
    // Peek before enabling actions: additional split/double stakes cannot be lost to a dealer natural.
    if (natural(s.dealer) || natural(s.hands[0].cards)) {
      s.reveal = true; s.phase = 'dealer'; this.emit('flip'); await this.wait(650); this.finish();
    } else { s.phase = 'player'; s.busy = false; this.emit(); }
  }
  async hit() {
    if (!this.canAct) return;
    const s = this.state, h = s.hands[s.active]; s.busy = true;
    h.cards.push(this.draw()); this.emit('card'); await this.wait(420);
    if (total(h.cards).value >= 21) { h.done = true; await this.advance(); }
    else { s.busy = false; this.emit(); }
  }
  async stand() { if (!this.canAct) return; this.state.busy = true; this.state.hands[this.state.active].done = true; await this.advance(); }
  async double() {
    if (!this.canDouble) return;
    const s = this.state, h = s.hands[s.active]; s.busy = true; s.bank -= h.bet; h.bet *= 2;
    h.cards.push(this.draw()); this.emit('card'); await this.wait(450); h.done = true; await this.advance();
  }
  async split() {
    if (!this.canSplit) return;
    const s = this.state, h = s.hands[s.active]; s.busy = true; s.bank -= h.bet;
    const card = h.cards.pop()!; h.split = true;
    const other: Hand = { cards: [card], bet: h.bet, done: false, split: true };
    s.hands.splice(s.active + 1, 0, other); this.emit('chip'); await this.wait(300);
    h.cards.push(this.draw()); this.emit('card'); await this.wait(390);
    other.cards.push(this.draw()); this.emit('card'); await this.wait(390);
    if (h.cards[0].rank === 1) { h.done = true; other.done = true; }
    if (total(h.cards).value === 21) h.done = true;
    if (total(other.cards).value === 21) other.done = true;
    if (h.done) await this.advance(); else { s.busy = false; this.emit(); }
  }
  private async advance() {
    const s = this.state;
    const next = s.hands.findIndex((h, i) => i >= s.active && !h.done);
    if (next >= 0) { s.active = next; s.busy = false; this.emit(); return; }
    s.phase = 'dealer'; s.reveal = true; this.emit('flip'); await this.wait(650);
    if (s.hands.some(h => total(h.cards).value <= 21)) {
      while (total(s.dealer).value < 17) { s.dealer.push(this.draw()); this.emit('card'); await this.wait(650); }
    }
    this.finish();
  }
  private finish() {
    const s = this.state;
    for (const h of s.hands) { const result = settlement(h, s.dealer); h.outcome = result.outcome; h.done = true; s.bank += result.returned; }
    s.delta = s.bank - this.startingBank; s.phase = 'result'; s.busy = false; s.reveal = true;
    if (s.bank >= 10) s.wager = Math.min(s.wager, Math.floor(s.bank / 10) * 10);
    this.emit(s.delta > 0 ? 'win' : undefined);
  }
  reset() {
    if (this.state.busy || this.state.phase === 'player') return;
    this.state.bank = 2000; this.state.wager = 100; this.state.phase = 'betting';
    this.state.hands = []; this.state.dealer = []; this.state.delta = 0; this.state.round = 0; this.emit();
  }
}
