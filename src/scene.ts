import { t } from './i18n';
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { total, type Card, type GameState } from './engine';
import { DealerAnimation, DealerPoseBlend, DEALER_FRAME_COUNT } from './dealer-animation';
import { tableLayout, dealerSpeechLayout, webHandRegion } from './table-layout';
import { pickInspectableCard } from './card-inspection';
import { chipPile, MAX_PILE_CHIPS } from './chip-pile';
import { makePileTextures } from './chip-art';
import { drawTableOrnament } from './table-ornament';

const asset = (file: string) => `${import.meta.env.BASE_URL}game/${file}${file.includes('?') ? '&' : '?'}release=${encodeURIComponent(__APP_VERSION__)}`;
const fileFor = (c: Card) => `${c.rank === 1 ? 'ace' : c.rank === 11 ? 'jack' : c.rank === 12 ? 'queen' : c.rank === 13 ? 'king' : c.rank}_of_${c.suit}.png?v=manual-psd-1`;
type CardNode = { sprite: Sprite; x: number; y: number; angle: number; size: number; born: number; hidden: boolean; flip: number; face: Texture; inspectable:boolean; order:number; inspection:number; card:Card; };
export class TableScene {
  app = new Application();
  private world = new Container();
  private tableOrnament = new Graphics();
  private dealerLayer = new Container();
  private shoeLayer = new Container();
  private cards = new Container();
  private inspectedCards = new Container();
  private inspectedCard?: number;
  private pinnedCard?: number;
  private inspectionAnnouncement!: HTMLParagraphElement;
  private labels = new Container();
  private decor = new Graphics();
  private dealer!: Sprite;
  private dealerBase!: Sprite;
  private dealerFaces: Sprite[] = [];
  private dealerAnimation = new DealerAnimation();
  private dealerBlend = new DealerPoseBlend();
  private token!: Sprite;
  private shoeSprite!: Sprite;
  private shoeLayers: Sprite[] = [];
  private playerPile = new Container();
  private pileShadow = new Graphics();
  private pileTextures: Texture[] = [];
  private pileChips: {sprite:Sprite;x:number;y:number;alpha:number}[] = [];
  private nodes = new Map<number, CardNode>();
  private retiring: { sprite: Sprite; born: number }[] = [];
  private chipEffects: { sprite: Sprite; born: number; x: number; y: number; tx: number; ty: number }[] = [];
  private frames: Texture[] = [];
  private state?: GameState;
  private background!: Sprite;
  private observer?: ResizeObserver;
  private elapsed = 0;
  private handFocus = '';
  private layoutHeight = 0;
  reduced = false;
  cardScale = 1;
  constructor(private host: HTMLElement) {}
  private inspectCard(id?: number) {
    if (this.inspectedCard === id) return;
    const previous = this.inspectedCard === undefined ? undefined : this.nodes.get(this.inspectedCard);
    if (previous) this.cards.addChild(previous.sprite);
    const next = id === undefined ? undefined : this.nodes.get(id);
    this.inspectedCard = next && next.inspectable && !next.hidden ? id : undefined;
    if (this.inspectedCard !== undefined && next) {
      this.inspectedCards.addChild(next.sprite);
      const ranks:Record<number,string> = {1:'Туз',11:'Валет',12:'Дама',13:'Король'};
      const suits = {hearts:'червей',diamonds:'бубен',clubs:'треф',spades:'пик'};
      this.inspectionAnnouncement.textContent = t(`${ranks[next.card.rank] ?? next.card.rank} ${suits[next.card.suit]}`);
    } else this.inspectionAnnouncement.textContent = '';
    this.host.classList.toggle('is-inspecting',this.inspectedCard !== undefined);
  }
  private initCardInspection() {
    const canvas = this.app.canvas;
    const viewport = this.host.parentElement!;
    this.inspectionAnnouncement = document.createElement('p');
    this.inspectionAnnouncement.className = 'sr-only';
    this.inspectionAnnouncement.setAttribute('role','status');
    this.host.append(this.inspectionAnnouncement);
    viewport.setAttribute('aria-label',t('Карты на столе. Наведите мышь или коснитесь карты для просмотра. Стрелки влево и вправо — выбрать карту, Escape — закрыть просмотр.'));
    const point = (event:PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return this.world.toLocal({x:(event.clientX-r.left)*this.app.screen.width/r.width,y:(event.clientY-r.top)*this.app.screen.height/r.height});
    };
    const pick = (event:PointerEvent) => {
      const p = point(event);
      return pickInspectableCard(Array.from(this.nodes,([id,n])=>({id,x:n.x,y:n.y,width:n.size,height:n.size*716/512,order:n.order,hidden:n.hidden,inspectable:n.inspectable})),p.x,p.y);
    };
    canvas.addEventListener('pointermove',event=>{
      if (event.pointerType === 'touch' || this.pinnedCard !== undefined) return;
      let id = pick(event);
      // Keep the lifted portion interactive without moving its resting hit region.
      const current = this.inspectedCard === undefined ? undefined : this.nodes.get(this.inspectedCard);
      if (id === undefined && current) {
        const p = point(event), r = current.sprite;
        if (Math.abs(p.x-r.x)<=r.width/2 && Math.abs(p.y-r.y)<=r.height/2) id = this.inspectedCard;
      }
      this.inspectCard(id);
    },{passive:true});
    canvas.addEventListener('pointerleave',()=>{if(this.pinnedCard === undefined)this.inspectCard();});
    let touchStart:{x:number;y:number;id:number}|undefined;
    canvas.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')touchStart={x:event.clientX,y:event.clientY,id:event.pointerId};},{passive:true});
    canvas.addEventListener('pointercancel',()=>{touchStart=undefined;},{passive:true});
    canvas.addEventListener('pointerup',event=>{
      if (!touchStart || touchStart.id!==event.pointerId) return;
      const tap = Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)<8;
      touchStart=undefined;
      if (!tap) return;
      const id = pick(event);
      this.pinnedCard = id === this.pinnedCard ? undefined : id;
      this.inspectCard(this.pinnedCard);
    },{passive:true});
    viewport.addEventListener('scroll',()=>{this.pinnedCard=undefined;this.inspectCard();},{passive:true});
    viewport.addEventListener('keydown',event=>{
      if(event.key==='Escape'){this.pinnedCard=undefined;this.inspectCard();return;}
      if(!['ArrowLeft','ArrowRight','Enter'].includes(event.key))return;
      const eligible=Array.from(this.nodes).filter(([,n])=>n.inspectable&&!n.hidden);
      if(!eligible.length)return;
      event.preventDefault();
      const index=eligible.findIndex(([id])=>id===this.inspectedCard);
      if(event.key==='Enter'&&index>=0){this.pinnedCard=undefined;this.inspectCard();return;}
      const next=index<0?(event.key==='ArrowLeft'?eligible.length-1:0):(index+(event.key==='ArrowLeft'?-1:1)+eligible.length)%eligible.length;
      this.pinnedCard=eligible[next][0];this.inspectCard(this.pinnedCard);
    });
  }
  cue(kind: 'card' | 'flip' | 'chip' | 'win') {
    if (this.reduced || (kind !== 'chip' && kind !== 'win')) return;
    const center = this.playerPile.x || (this.mobile ? 190 : 600);
    for (let i = 0; i < (kind === 'win' ? 5 : 2); i++) {
      const sprite = Sprite.from(asset('token.png')); sprite.anchor.set(.5); sprite.width = sprite.height = 31;
      // A payout travels from the dealer to the player's edge of the table.
      const x = center + (i - (kind === 'win' ? 2 : 1))*13;
      const y = kind === 'win' ? (this.mobile ? 180 : 300) : this.playerPile.y - 8;
      const tx = center + (i - (kind === 'win' ? 2 : 1))*(kind === 'win' ? 22 : 7);
      const ty = kind === 'win' ? this.playerPile.y - 8 : (this.mobile ? 345 : 855);
      sprite.position.set(x,y); this.world.addChild(sprite);
      this.chipEffects.push({sprite,born:performance.now()+i*55,x,y,tx,ty});
    }
  }
  async init(progress: (value: number) => void) {
    await this.app.init({ width: 1200, height: 900, backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true, preference: 'webgl' });
    // Avoid oversized sampler batches on Android/WebView GPU drivers.
    this.app.renderer.limits.maxBatchableTextures=Math.min(16,this.app.renderer.limits.maxBatchableTextures);
    this.host.append(this.app.canvas);
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.initCardInspection();
    const files = ['table.webp', 'back.png', 'token.png', 'dealer/v3/frame-0.png?v=red-design-1', ...Array.from({length: DEALER_FRAME_COUNT}, (_, i) => `dealer/v3/face-${i}.png?v=red-design-1`)];
    for (const suit of ['hearts', 'diamonds', 'clubs', 'spades']) {
      for (let rank = 1; rank <= 13; rank++) files.push('cards/' + fileFor({ suit: suit as Card['suit'], rank, id: 0 }));
    }
    await Assets.load(files.map(asset), p => progress(Math.round(p * 100)));
    this.background = Sprite.from(asset('table.webp'));
    this.app.stage.addChild(this.background, this.world);
    this.frames = Array.from({length: DEALER_FRAME_COUNT}, (_, i) => Assets.get(asset(`dealer/v3/face-${i}.png?v=red-design-1`)));
    this.dealerBase = new Sprite(Assets.get(asset('dealer/v3/frame-0.png?v=red-design-1'))); this.dealerBase.anchor.set(.5);
    this.dealerFaces = this.frames.map(texture => { const face = new Sprite(texture); face.anchor.set(.5); face.alpha = 0; return face; });
    this.dealer = this.dealerFaces[0];
    this.token = Sprite.from(asset('token.png')); this.token.anchor.set(.5);
    this.shoeSprite = Sprite.from(asset('back.png')); this.shoeSprite.anchor.set(.5); this.shoeSprite.rotation=-.16;
    this.shoeLayers = Array.from({length:4},()=>{const card=Sprite.from(asset('back.png'));card.anchor.set(.5);card.rotation=-.16;card.tint=0xa6b5a4;return card;});
    this.playerPile.addChild(this.pileShadow);
    this.playerPile.sortableChildren=true; this.pileShadow.zIndex=-10000;
    this.pileTextures=makePileTextures(this.app);
    this.pileChips = Array.from({length:MAX_PILE_CHIPS},()=>{
      const sprite=new Sprite(this.pileTextures[0]);sprite.anchor.set(.5);sprite.alpha=0;
      this.playerPile.addChild(sprite);return {sprite,x:0,y:0,alpha:0};
    });
    this.dealerLayer.addChild(this.dealerBase,...this.dealerFaces);
    this.shoeLayer.addChild(...this.shoeLayers,this.shoeSprite);
    this.world.addChild(this.tableOrnament,this.dealerLayer,this.decor,this.shoeLayer,this.cards,this.token,this.playerPile,this.labels,this.inspectedCards);
    this.cards.sortableChildren = true;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.host);
    this.resize();
    this.app.ticker.add(t => this.tick(t.deltaMS));
    document.addEventListener('visibilitychange', () => document.hidden ? this.app.stop() : this.app.start());
  }
  private get mobile() { return matchMedia('(width < 840px)').matches; }
  private get desktopWeb() { return !this.mobile && !document.documentElement.classList.contains('android-app'); }
  private get compact() { return this.mobile && matchMedia('(height < 740px) and (width < 600px)').matches; }
  private pileY() {
    const layout=this.layout; let y=layout.height-34;
    if(this.mobile){
      const scale=Math.min(this.host.clientWidth/layout.width,1.15);
      const rail=(this.host.parentElement!.clientHeight-76)/scale-12;
      y=Math.max(layout.playerY(Math.max(0,(this.state?.hands.length||1)-1))+layout.cardHeight/2+26,Math.min(y,rail));
    }
    return y;
  }
  private get layout() { return tableLayout(this.mobile, this.state?.hands.length || 1, this.cardScale, this.state?.bank || 0, this.compact, this.desktopWeb); }
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.app.renderer.resize(w, h); this.background.width = w; this.background.height = h;
    this.background.visible = false;
    const layout = this.layout;
    this.layoutHeight=layout.height;
    const vw = layout.width, vh = layout.height;
    const playHeight = this.mobile ? h : Math.max(300, h - 80);
    const scale = this.mobile ? Math.min(w / vw,1.15) : Math.min(w / vw, playHeight / vh);
    this.world.scale.set(scale); this.world.position.set((w - vw * scale) / 2, this.mobile ? 0 : (playHeight - vh * scale) / 2);
    if (this.desktopWeb) {
      const speech = dealerSpeechLayout(w, this.world.x, scale, layout);
      layout.portraitX = speech.portraitX;
      const board = this.host.closest<HTMLElement>('.board')!;
      board.style.setProperty('--dealer-speech-left', `${speech.left}px`);
      board.style.setProperty('--dealer-speech-top', `${this.world.y + (layout.portraitY - 90) * scale}px`);
      board.style.setProperty('--dealer-speech-width', `${speech.width}px`);
    }
    drawTableOrnament(this.tableOrnament, layout, this.mobile, {right:(w-this.world.x)/scale,top:-this.world.y/scale});
    this.dealer.position.set(layout.portraitX, layout.portraitY);
    for (const face of this.dealerFaces) { face.position.copyFrom(this.dealer.position); face.width = face.height = layout.portraitSize; }
    this.dealerBase.position.copyFrom(this.dealer.position); this.dealerBase.width = this.dealerBase.height = layout.portraitSize;
    this.token.position.set(this.mobile ? 144 : vw/2, this.mobile ? this.compact ? 435 : 555 : 863); this.token.width = this.token.height = this.mobile ? 40 : 64;
    this.shoeSprite.position.set(this.mobile ? this.compact ? 50 : 60 : 220, this.mobile ? this.compact ? 154 : 180 : 242);
    this.shoeSprite.width=this.mobile?this.compact?64:76:150;this.shoeSprite.height=this.shoeSprite.width*716/512;
    this.shoeLayers.forEach((card,i)=>{card.width=this.shoeSprite.width;card.height=this.shoeSprite.height;card.position.set(this.shoeSprite.x+(4-i)*1.2,this.shoeSprite.y+(4-i)*2.3);});
    this.playerPile.position.set(this.mobile ? 190 : vw/2,this.pileY());
    for(const chip of this.pileChips){chip.sprite.width=this.mobile?25:this.desktopWeb?56:40;chip.sprite.height=chip.sprite.width*.88;}
    if (this.state) this.render(this.state, true);
  }
  render(state: GameState, immediate = false) {
    this.host.parentElement!.setAttribute('aria-label', t('Карты на столе. Наведите мышь или коснитесь карты для просмотра. Стрелки влево и вправо — выбрать карту, Escape — закрыть просмотр.'));
    this.state = state;
    if(this.layoutHeight!==this.layout.height){this.resize();return;}
    const factor = String(this.layout.height / tableLayout(true,1,1,0,this.compact).height);
    if (this.host.style.getPropertyValue('--scene-factor') !== factor) this.host.style.setProperty('--scene-factor', factor);
    this.dealerAnimation.update(state, this.elapsed);
    const layout = this.layout;
    const vw = layout.width, mobile = this.mobile;
    this.labels.removeChildren().forEach(child => child.destroy()); this.decor.clear();
    const keep = new Set<number>();
    const groups = Math.max(1, state.hands.length);
    this.playerPile.position.set(mobile ? 190 : vw/2,this.pileY());
    const pile=chipPile(state.bank), breadth=mobile?300:Math.min(2000,this.host.clientWidth/this.world.scale.x-100), depth=mobile?100:140;
    this.pileShadow.clear();
    const shadows=new Set<string>();
    for(const layer of pile){
      const key=`${layer.heap}:${layer.x.toFixed(2)}:${layer.y.toFixed(2)}`;
      if(layer.layer===0&&!shadows.has(key)){
        shadows.add(key);
        this.pileShadow.ellipse(layer.x*(layer.heap===0&&!mobile?700:breadth),layer.y*depth+5,mobile?15:this.desktopWeb?32:24,mobile?11:this.desktopWeb?23:17)
          .fill({color:0x000c07,alpha:.25});
      }
    }
    this.pileChips.forEach((chip,i)=>{
      const layer=pile[i];
      chip.alpha=layer ? .3 + .7*layer.fill : 0;
      if(layer){
        chip.x=layer.x*(layer.heap===0&&!mobile?700:breadth);
        chip.y=layer.y*depth-(layer.layer+layer.fill-1)*(mobile?1.15:1.6);
        chip.sprite.texture=this.pileTextures[layer.tone];
        chip.sprite.rotation=layer.rotation;
        chip.sprite.zIndex=layer.y*depth*100+layer.layer;
      }
      if(this.reduced){chip.sprite.position.set(chip.x,chip.y);chip.sprite.alpha=chip.alpha;}
    });
    const focus = `${state.round}:${state.active}:${groups}:${state.phase === 'player' ? 'play' : ''}`;
    if (this.mobile && this.handFocus !== focus) {
      this.handFocus = focus;
      requestAnimationFrame(() => {
        const viewport = this.host.parentElement!;
        const scale = Math.min(this.host.clientWidth / layout.width, this.host.clientHeight / layout.height);
        const shouldFocus = state.phase === 'player' && (groups > 1 || this.cardScale > 1);
        const top = shouldFocus ? layout.playerY(state.active) * scale - viewport.clientHeight * .6 : 0;
        viewport.scrollTo({top: Math.max(0,top), behavior:this.reduced ? 'instant' : 'smooth'});
      });
    }
    const cw = layout.cardWidth, ch = layout.cardHeight;
    const addLabel = (text: string, x: number, y: number, color = 0xd4dbc0, size = 19) => {
      const label = new Text({ text: t(text), style: { fontFamily: 'Georgia, serif', fontSize: size, fill: color, letterSpacing: 1 } });
      label.anchor.set(.5); label.position.set(x, y); this.labels.addChild(label);
    };
    const addScore = (caption: string, value: string, x: number, y: number, color = 0xe7e8cf) => {
      this.decor.roundRect(x - (mobile ? 56 : 72), y - (mobile ? 28 : 33), mobile ? 112 : 144, mobile ? 56 : 66, 12).fill({ color: 0x0a2118, alpha: .96 })
        .stroke({color: 0xa69262, alpha: .72, width: 1.5});
      const fontScale = mobile ? Math.max(1, 1 / this.world.scale.x) : 1;
      addLabel(caption, x, y - 16, 0xd0ded3, 12 * fontScale);
      addLabel(value, x, y + 10, color, (mobile ? 30 : value.length > 3 ? 32 : 40) * fontScale);
    };
    const hand = (list: Card[], center: number, y: number, width: number, hideHole: boolean, active: boolean, inspectable = false) => {
      const step = Math.min(cw * (this.desktopWeb ? .72 : .65), (width - cw) / Math.max(1, list.length - 1));
      if (active && list.length) this.decor.roundRect(center - Math.max(cw, step * (list.length - 1) + cw) / 2 - 12, y + ch / 2 + 14, Math.max(cw, step * (list.length - 1) + cw) + 24, 3, 1).fill({ color: 0xbba572, alpha: .75 });
      list.forEach((card, i) => {
        keep.add(card.id);
        const x = center + (i - (list.length - 1) / 2) * step;
        const angle = 0;
        const hidden = hideHole && i === 1;
        let node = this.nodes.get(card.id);
        if (!node) {
          const face = Assets.get<Texture>(asset('cards/' + fileFor(card)));
          const sprite = new Sprite(hidden ? Assets.get(asset('back.png')) : face); sprite.anchor.set(.5);
          sprite.position.copyFrom(this.shoeSprite.position); sprite.rotation = -.28; sprite.alpha = 0;
          sprite.width = cw; sprite.height = ch;
          this.cards.addChild(sprite);
          node = { sprite, face, x, y, size: cw, angle, born: performance.now(), hidden, flip: 0, inspectable, order:i, inspection:0, card };
          this.nodes.set(card.id, node);
        } else if (node.hidden !== hidden) { node.hidden = hidden; node.flip = performance.now(); }
        node.x = x; node.y = y; node.angle = angle; node.size = cw; node.inspectable = inspectable; node.order = i + (inspectable ? 20 : 0); node.sprite.zIndex = node.order;
        if (immediate || this.reduced) { node.sprite.position.set(x, y - 12 * node.inspection); node.sprite.rotation = angle; node.sprite.alpha = 1; }
      });
    };
    const dealerY = layout.dealerY;
    hand(state.dealer, mobile ? 144 : vw / 2, dealerY, mobile ? layout.handWidth : vw * (this.desktopWeb ? .72 : .62), !state.reveal, false);
    if (state.dealer.length) {
      const visible = state.reveal ? state.dealer : state.dealer.slice(0, 1);
      addScore('ДИЛЕР', `${total(visible).value}${state.reveal ? '' : ' + ?'}`, mobile ? 144 : vw / 2, dealerY - ch / 2 - layout.scoreOffset);
    }
    state.hands.forEach((h, i) => {
      const region = this.desktopWeb && groups > 1 ? webHandRegion(this.host.clientWidth, this.world.x, this.world.scale.x, vw) : {left:0,width:vw};
      const center = this.desktopWeb ? region.left + region.width * (i + .5) / groups : layout.playerX(i), y = layout.playerY(i);
      hand(h.cards, center, y, mobile ? layout.handWidth : (this.desktopWeb ? region.width / groups - 30 : vw / groups - 70), false, state.phase === 'player' && state.active === i, true);
      const value = total(h.cards);
      let word = h.outcome ? ({win:'ПОБЕДА',lose:'ПРОИГРЫШ',push:'ВОЗВРАТ',blackjack:'БЛЭКДЖЕК'}[h.outcome]) : value.value > 21 ? 'ПЕРЕБОР' : value.soft ? 'МЯГКАЯ' : groups > 1 ? `РУКА ${i + 1}` : 'ВАША РУКА';
      if (mobile && groups > 1 && h.outcome) word += ` · ${i + 1}`;
      addScore(word, String(value.value), center, y - ch / 2 - layout.scoreOffset, value.value > 21 ? 0xf0a092 : h.outcome === 'win' || h.outcome === 'blackjack' ? 0xf0cc87 : 0xe7e8cf);
    });
    if (!state.hands.length) {
      addLabel(mobile ? 'Ваша ставка' : 'Сделайте ставку', mobile ? 144 : vw/2, mobile ? 400 : 650, 0xe0d9c4, mobile ? 20 : 31);
      if (!mobile) addLabel('Блекджек уже ждёт вас за столом', vw / 2, 692, 0xc6d6ca, 20);
    }
    if (!state.hands.length && !mobile) {
      addLabel('BLACKJACK PAYS 3:2', vw / 2, mobile ? 529 : 548, 0xbda575, mobile ? 20 : 24);
      addLabel('DEALER STANDS ON ALL 17', vw / 2, mobile ? 557 : 574, 0x94a28d, 13);
    }
    this.token.visible = state.hands.length === 0;
    for (const [id, node] of this.nodes) if (!keep.has(id)) {
      if (this.inspectedCard === id) { this.pinnedCard = undefined; this.inspectCard(); }
      if (this.reduced) node.sprite.destroy(); else this.retiring.push({sprite:node.sprite,born:performance.now()});
      this.nodes.delete(id);
    }
  }
  private tick(ms: number) {
    const now = performance.now(); this.elapsed += Math.min(ms, 50);
    const pileEase=this.reduced?1:1-Math.exp(-ms/220);
    for(const chip of this.pileChips){
      chip.sprite.x+=(chip.x-chip.sprite.x)*pileEase;
      chip.sprite.y+=(chip.y-chip.sprite.y)*pileEase;
      chip.sprite.alpha+=(chip.alpha-chip.sprite.alpha)*pileEase;
      chip.sprite.visible=chip.sprite.alpha>.005;
    }
    for (let i=this.retiring.length-1;i>=0;i--) {
      const item=this.retiring[i], p=Math.min(1,(now-item.born)/260);
      item.sprite.x += (this.shoeSprite.x-item.sprite.x)*.15;
      item.sprite.y += (this.shoeSprite.y-item.sprite.y)*.15; item.sprite.alpha=1-p;
      if(p===1){item.sprite.destroy();this.retiring.splice(i,1);}
    }
    for(let i=this.chipEffects.length-1;i>=0;i--){
      const e=this.chipEffects[i],p=Math.max(0,Math.min(1,(now-e.born)/620)),ease=1-Math.pow(1-p,3);
      e.sprite.position.set(e.x+(e.tx-e.x)*ease,e.y+(e.ty-e.y)*ease-Math.sin(p*Math.PI)*38);
      e.sprite.alpha=p<.75?1:(1-p)*4; e.sprite.rotation=p*1.8;
      if(p===1){e.sprite.destroy();this.chipEffects.splice(i,1);}
    }
    for (const node of this.nodes.values()) {
      const s = node.sprite;
      const factor = this.reduced ? 1 : 1 - Math.exp(-ms / 58);
      node.inspection += ((this.inspectedCard === node.card.id ? 1 : 0) - node.inspection) * factor;
      s.x += (node.x - s.x) * factor; s.y += (node.y - 12 * node.inspection - s.y) * factor;
      s.rotation += (node.angle - s.rotation) * factor; s.alpha = Math.min(1, s.alpha + ms / 160);
      let width = node.size * (1 + .02 * node.inspection);
      if (node.flip && !this.reduced) {
        const p = Math.min(1, (now - node.flip) / 420);
        width *= Math.max(.025, Math.abs(Math.cos(p * Math.PI)));
        if (p >= .5) s.texture = node.hidden ? Assets.get(asset('back.png')) : node.face;
        if (p === 1) node.flip = 0;
      } else s.texture = node.hidden ? Assets.get(asset('back.png')) : node.face;
      s.width = width; s.height = node.size * (1 + .02 * node.inspection) * 716 / 512;
    }
    const pose = this.dealerAnimation.sample(this.elapsed, this.reduced);
    const weights = this.dealerBlend.sample(pose.frame, this.elapsed, this.reduced, pose.blendMs);
    this.dealer.y = this.layout.portraitY + pose.breathe;
    this.dealerBase.position.copyFrom(this.dealer.position);
    // Convert normalized pose weights to source-over opacity, from top to bottom.
    // Every render frame gets a continuous in-between, even during interrupted speech.
    let covered = 0;
    for (let i = this.dealerFaces.length - 1; i >= 0; i--) {
      const face = this.dealerFaces[i];
      face.position.copyFrom(this.dealerBase.position);
      face.alpha = weights[i] / Math.max(.000001, 1 - covered);
      covered += weights[i];
      face.visible = weights[i] > .00001;
    }
  }
}
