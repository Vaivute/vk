// <loom-wallpaper> — vanilla web component, no dependencies.
// Usage:
//   <script src="loom-wallpaper.js"></script>
//   <loom-wallpaper></loom-wallpaper>
//
// Attributes (all optional, all live-updatable):
//   intensity      0..1.5      (default 0.95)   — depth of cursor dent
//   iridescence    0..1.5      (default 0.55)   — angle-shift shimmer
//   contrast       0..1.2      (default 0.7)
//   density        20..140     (default 60)     — thread frequency
//   speed          0..2        (default 0.5)    — global time scale
//   grain          0..0.05     (default 0.014)
//   color-a        hex         (default #1d1d20) — base
//   color-b        hex         (default #5a5a5e) — thread
//   color-c        hex         (default #c8b890) — accent / shimmer
//   pointer        "window"|"self" (default "self")
//                  if "window", reacts to mouse anywhere on the page
//                  (useful when used as a fixed background)
//   no-pointer     present     disable interaction entirely
//
// The element is display:block and fills its containing box. To use as a
// fullscreen background:
//   loom-wallpaper { position:fixed; inset:0; z-index:-1; }
//   loom-wallpaper[pointer="window"] { pointer-events:none; }

(function () {
  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uTime;
uniform float uPressing;
uniform float uIntensity;
uniform float uIridescence;
uniform float uGrain;
uniform float uDensity;
uniform float uContrast;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec4 uRipples[6];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float dentAt(vec2 p,vec2 c,float s,float k){vec2 d=p-c;return exp(-dot(d,d)*k)*s;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes.xy;
  float aspect=uRes.x/uRes.y;
  vec2 p=uv;p.x*=aspect;
  vec2 m=uMouse;m.x*=aspect;
  float baseDent=dentAt(p,m,(0.10+0.12*uPressing)*uIntensity,7.0);
  float h=baseDent;
  for(int i=0;i<6;i++){
    vec4 rp=uRipples[i];
    if(rp.w<0.001)continue;
    vec2 rc=rp.xy;rc.x*=aspect;
    float age=rp.z;float radius=age*0.55;
    vec2 rd=p-rc;float dist=length(rd);
    float ring=exp(-pow((dist-radius)*7.0,2.0));
    float decay=exp(-age*1.2);
    h+=ring*decay*0.10*uIntensity*rp.w;
    h+=exp(-dist*dist*40.0)*decay*0.04*rp.w*uIntensity;
  }
  vec2 d=p-m;float r=length(d);
  vec2 dir=d/max(r,0.001);
  vec2 q=p-dir*h*0.4;
  float gridFreq=uDensity;
  float gx=abs(fract(q.x*gridFreq)-0.5);
  float gy=abs(fract(q.y*gridFreq)-0.5);
  float lineW=clamp(0.045-h*0.7,0.005,0.06);
  float lx=smoothstep(lineW,0.0,gx);
  float ly=smoothstep(lineW,0.0,gy);
  float parity=mod(floor(q.x*gridFreq)+floor(q.y*gridFreq),2.0);
  float eps=0.004;
  float hxp=dentAt(p+vec2(eps,0),m,(0.10+0.12*uPressing)*uIntensity,7.0);
  float hxn=dentAt(p-vec2(eps,0),m,(0.10+0.12*uPressing)*uIntensity,7.0);
  float hyp=dentAt(p+vec2(0,eps),m,(0.10+0.12*uPressing)*uIntensity,7.0);
  float hyn=dentAt(p-vec2(0,eps),m,(0.10+0.12*uPressing)*uIntensity,7.0);
  for(int i=0;i<6;i++){
    vec4 rp=uRipples[i];
    if(rp.w<0.001)continue;
    vec2 rc=rp.xy;rc.x*=aspect;float age=rp.z;
    float radius=age*0.55;float decay=exp(-age*1.2);
    float dxp=length(p+vec2(eps,0)-rc);hxp+=exp(-pow((dxp-radius)*7.0,2.0))*decay*0.10*uIntensity*rp.w;
    float dxn=length(p-vec2(eps,0)-rc);hxn+=exp(-pow((dxn-radius)*7.0,2.0))*decay*0.10*uIntensity*rp.w;
    float dyp=length(p+vec2(0,eps)-rc);hyp+=exp(-pow((dyp-radius)*7.0,2.0))*decay*0.10*uIntensity*rp.w;
    float dyn=length(p-vec2(0,eps)-rc);hyn+=exp(-pow((dyn-radius)*7.0,2.0))*decay*0.10*uIntensity*rp.w;
  }
  vec3 normal=normalize(vec3((hxp-hxn)/(2.0*eps),(hyp-hyn)/(2.0*eps),1.0));
  float lt=uTime*0.06;
  vec3 lightDir=normalize(vec3(cos(lt)*0.4,0.5+sin(lt*0.7)*0.15,0.85));
  float diff=max(dot(normal,lightDir),0.0);
  vec3 viewDir=vec3(0.0,0.0,1.0);
  vec3 halfDir=normalize(lightDir+viewDir);
  float spec=pow(max(dot(normal,halfDir),0.0),36.0);
  vec3 base=mix(uA,mix(uA,uB,0.55),parity);
  vec3 threadCol=mix(uB,uC,smoothstep(0.0,0.06,h*4.0));
  vec3 col=mix(base,threadCol,max(lx,ly));
  float shade=mix(1.0,0.6+0.5*diff,uContrast);
  col*=shade;
  col+=spec*0.22*uC;
  col*=mix(1.0,0.78,clamp(h*5.0,0.0,1.0));
  float angle=(uMouse.x-0.5)*1.5+(uMouse.y-0.5)*0.8+p.y*1.2+uTime*0.05;
  float irid=0.5+0.5*sin(angle*3.14+p.x*4.0);
  col=mix(col,mix(col,uC,0.4),irid*uIridescence*0.18);
  col+=exp(-r*2.4)*0.05*uC*(0.4+uPressing*0.6);
  float vig=smoothstep(1.5,0.35,length(uv-0.5));
  col*=mix(0.86,1.06,vig);
  float g=hash(gl_FragCoord.xy+uTime);
  col+=(g-0.5)*uGrain;
  gl_FragColor=vec4(col,1.0);
}`;

  function hex2rgb(h) {
    if (!h) return [0, 0, 0];
    const s = String(h).trim().replace('#', '');
    const expand = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [
      parseInt(expand.slice(0, 2), 16) / 255,
      parseInt(expand.slice(2, 4), 16) / 255,
      parseInt(expand.slice(4, 6), 16) / 255,
    ];
  }

  const DEFAULTS = {
    intensity: 0.95,
    iridescence: 0.55,
    contrast: 0.7,
    density: 60,
    speed: 0.5,
    grain: 0.014,
    'color-a': '#1d1d20',
    'color-b': '#5a5a5e',
    'color-c': '#c8b890',
  };

  class LoomWallpaper extends HTMLElement {
    static get observedAttributes() {
      return Object.keys(DEFAULTS).concat(['pointer', 'no-pointer']);
    }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        :host { display:block; position:relative; width:100%; height:100%;
          background:#1d1d20; overflow:hidden; }
        canvas { display:block; width:100%; height:100%;
          touch-action:none; }
      `;
      const canvas = document.createElement('canvas');
      root.append(style, canvas);
      this._canvas = canvas;
      this._state = {
        mouse: [0.5, 0.5],
        smooth: [0.5, 0.5],
        pressing: 0,
        pressTarget: 0,
        ripples: [],
        accumTime: 0,
        lastFrame: performance.now(),
        running: false,
      };
    }

    _attr(name) {
      const v = this.getAttribute(name);
      if (v === null || v === undefined || v === '') return DEFAULTS[name];
      const def = DEFAULTS[name];
      if (typeof def === 'number') {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : def;
      }
      return v;
    }

    connectedCallback() {
      this._initGL();
      this._bindEvents();
      this._observeSize();
      this._start();
    }

    disconnectedCallback() {
      this._stop();
      this._unbindEvents();
      if (this._ro) this._ro.disconnect();
    }

    attributeChangedCallback(name) {
      if (name === 'pointer' || name === 'no-pointer') {
        this._unbindEvents();
        this._bindEvents();
      }
    }

    _initGL() {
      const gl = this._canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false });
      if (!gl) { console.warn('loom-wallpaper: WebGL not supported'); return; }
      this._gl = gl;
      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          console.error('loom-wallpaper:', gl.getShaderInfoLog(sh));
        }
        return sh;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this._prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const U = n => gl.getUniformLocation(prog, n);
      this._u = {
        Res: U('uRes'), Mouse: U('uMouse'), Time: U('uTime'),
        Pressing: U('uPressing'), Intensity: U('uIntensity'),
        Iridescence: U('uIridescence'), Grain: U('uGrain'),
        Density: U('uDensity'), Contrast: U('uContrast'),
        A: U('uA'), B: U('uB'), C: U('uC'),
        Ripples: U('uRipples'),
      };
    }

    _observeSize() {
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const r = this._canvas.getBoundingClientRect();
        this._canvas.width = Math.max(1, Math.floor(r.width * dpr));
        this._canvas.height = Math.max(1, Math.floor(r.height * dpr));
        if (this._gl) this._gl.viewport(0, 0, this._canvas.width, this._canvas.height);
      };
      resize();
      this._ro = new ResizeObserver(resize);
      this._ro.observe(this._canvas);
    }

    _bindEvents() {
      if (this.hasAttribute('no-pointer')) return;
      const mode = this.getAttribute('pointer') || 'self';
      const target = mode === 'window' ? window : this._canvas;
      this._evtTarget = target;

      this._onMove = e => {
        const r = this._canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = 1 - (e.clientY - r.top) / r.height;
        if (x >= -0.5 && x <= 1.5 && y >= -0.5 && y <= 1.5) {
          this._state.mouse[0] = Math.max(0, Math.min(1, x));
          this._state.mouse[1] = Math.max(0, Math.min(1, y));
        }
      };
      this._onDown = e => {
        const r = this._canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = 1 - (e.clientY - r.top) / r.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return; // only ripple on element
        this._state.ripples.push({ x, y, age: 0, strength: 1.0 });
        this._state.pressTarget = 1;
      };
      this._onUp = () => { this._state.pressTarget = 0; };

      target.addEventListener('pointermove', this._onMove);
      target.addEventListener('pointerdown', this._onDown);
      window.addEventListener('pointerup', this._onUp);
    }

    _unbindEvents() {
      if (!this._evtTarget) return;
      this._evtTarget.removeEventListener('pointermove', this._onMove);
      this._evtTarget.removeEventListener('pointerdown', this._onDown);
      window.removeEventListener('pointerup', this._onUp);
      this._evtTarget = null;
    }

    _start() {
      if (!this._gl || this._state.running) return;
      this._state.running = true;
      const loop = () => {
        if (!this._state.running) return;
        this._frame();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    _stop() {
      this._state.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
    }

    _frame() {
      const gl = this._gl;
      const s = this._state;
      const u = this._u;
      const c = this._canvas;
      const now = performance.now();
      const dt = Math.min(0.05, (now - s.lastFrame) / 1000);
      s.lastFrame = now;

      const speed = this._attr('speed');
      s.accumTime += dt * speed;
      s.smooth[0] += (s.mouse[0] - s.smooth[0]) * 0.10;
      s.smooth[1] += (s.mouse[1] - s.smooth[1]) * 0.10;
      s.pressing += (s.pressTarget - s.pressing) * 0.15;

      const live = [];
      for (const rp of s.ripples) {
        rp.age += dt;
        if (rp.age < 3.0) live.push(rp);
      }
      s.ripples = live;

      const packed = new Float32Array(24);
      for (let i = 0; i < 6; i++) {
        const rp = live[i];
        if (rp) { packed[i*4]=rp.x; packed[i*4+1]=rp.y; packed[i*4+2]=rp.age; packed[i*4+3]=rp.strength; }
      }

      gl.uniform2f(u.Res, c.width, c.height);
      gl.uniform2f(u.Mouse, s.smooth[0], s.smooth[1]);
      gl.uniform1f(u.Time, s.accumTime);
      gl.uniform1f(u.Pressing, s.pressing);
      gl.uniform1f(u.Intensity, this._attr('intensity'));
      gl.uniform1f(u.Iridescence, this._attr('iridescence'));
      gl.uniform1f(u.Grain, this._attr('grain'));
      gl.uniform1f(u.Density, this._attr('density'));
      gl.uniform1f(u.Contrast, this._attr('contrast'));
      gl.uniform3fv(u.A, hex2rgb(this._attr('color-a')));
      gl.uniform3fv(u.B, hex2rgb(this._attr('color-b')));
      gl.uniform3fv(u.C, hex2rgb(this._attr('color-c')));
      gl.uniform4fv(u.Ripples, packed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** Programmatic ripple. x, y in [0..1]; y=0 is bottom. */
    ripple(x, y, strength = 1) {
      this._state.ripples.push({ x, y, age: 0, strength });
    }
  }

  customElements.define('loom-wallpaper', LoomWallpaper);
})();
