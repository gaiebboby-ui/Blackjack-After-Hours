import {Application,Graphics,Texture} from 'pixi.js';

/** Slightly foreshortened top faces with a thin visible edge, rather than side-on coins. */
export function makePileTextures(app:Application):Texture[] {
  return [0x52846b,0x456b85,0xa58b53,0x8b5353,0x424f52].map(colour=>{
    const g=new Graphics();
    g.ellipse(36,35,33,28).fill({color:0x03110c,alpha:.4});
    g.ellipse(36,32,32,27).fill(0x203b30);
    g.ellipse(36,29,32,27).fill(colour).stroke({color:0xc3cbb0,width:1});
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      const point=(r:number,t:number)=>[36+Math.cos(t)*r,29+Math.sin(t)*r*.844];
      g.poly([...point(25,a-.105),...point(32,a-.105),...point(32,a+.105),...point(25,a+.105)])
        .fill(0xe4e4ca);
    }
    g.ellipse(36,29,23,19.4).stroke({color:0x162e25,width:1.8});
    g.ellipse(36,28.5,21,17.7).stroke({color:0xe0e4bf,alpha:.52,width:.7});
    g.poly([36,22,42,28,36,34,30,28]).fill({color:0xe7e5bd,alpha:.8});
    const texture=app.renderer.generateTexture({target:g,resolution:2});
    g.destroy();return texture;
  });
}
