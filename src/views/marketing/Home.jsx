import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';

// ─── Aesthetic: "Signal Verified" ─────────────────────────────────────────────
// Broadcast command centre meets editorial precision.
// Deep charcoal (#0c0c0c) · warm cream (#ede8dc) · indigo (#4f46e5)
// Syne 800 headlines · DM Sans body · DM Mono for every number

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');

:root {
  --bg:    #0c0c0c;
  --bg2:   #131313;
  --bg3:   #1a1a1a;
  --cream: #ede8dc;
  --muted: #6b6358;
  --dim:   rgba(237,232,220,0.42);
  --indigo: #4f46e5;
  --aglow: rgba(79,70,229,0.28);
  --red:   #e63946;
  --green: #22c55e;
  --border: rgba(237,232,220,0.07);
  --border2: rgba(237,232,220,0.13);
  --syne: 'Syne', sans-serif;
  --dm:   'DM Sans', sans-serif;
  --mono: 'DM Mono', monospace;
}

/* ── Reveal ── */
.rv { opacity:0; transform:translateY(28px); transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1); }
.rv.on { opacity:1; transform:translateY(0); }
.d1{transition-delay:.08s} .d2{transition-delay:.16s} .d3{transition-delay:.24s}
.d4{transition-delay:.32s} .d5{transition-delay:.40s} .d6{transition-delay:.48s}

/* ── Buttons ── */
.btn-a {
  display:inline-flex; align-items:center; gap:8px;
  background:var(--indigo); color:#fff;
  padding:13px 28px; border-radius:3px;
  font-family:var(--dm); font-weight:700; font-size:14px;
  border:none; cursor:pointer; position:relative; overflow:hidden;
  transition:transform .15s ease,box-shadow .2s ease;
  letter-spacing:.3px;
}
.btn-a::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);
  transform:translateX(-110%); transition:transform .5s ease;
}
.btn-a:hover::after{transform:translateX(110%)}
.btn-a:hover{transform:translateY(-2px);box-shadow:0 6px 28px var(--aglow)}
.btn-a:active{transform:translateY(0)}

.btn-g {
  display:inline-flex; align-items:center; gap:8px;
  background:transparent; color:var(--cream);
  padding:12px 28px; border-radius:3px;
  font-family:var(--dm); font-weight:600; font-size:14px;
  border:1px solid var(--border2); cursor:pointer;
  transition:all .15s ease; letter-spacing:.3px;
}
.btn-g:hover{border-color:rgba(237,232,220,.5);background:rgba(237,232,220,.05);transform:translateY(-2px)}

/* ── Cards ── */
.step-card {
  background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:28px 24px;
  transition:border-color .25s,transform .25s,box-shadow .25s;
}
.step-card:hover{border-color:var(--indigo);transform:translateY(-5px);box-shadow:0 16px 48px rgba(79,70,229,.12)}

.feat-card {
  border:1px solid var(--border); border-radius:8px; padding:22px;
  transition:border-color .2s,background .2s;
}
.feat-card:hover{border-color:var(--border2);background:rgba(237,232,220,.02)}

/* ── Terminal ── */
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.cur{display:inline-block;width:7px;height:13px;background:var(--indigo);vertical-align:middle;animation:blink 1.1s step-end infinite;margin-left:3px}

@keyframes slide-l{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
.t-row{animation:slide-l .3s ease forwards}

@keyframes pulse-out{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.8);opacity:0}}
.pulse-ring{position:absolute;inset:0;border-radius:50%;background:var(--red);animation:pulse-out 1.6s ease-out infinite}

/* ── Grid bg ── */
.grid-bg{
  background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);
  background-size:64px 64px;
}

/* ── Diagonal cuts ── */
.clip-dn{clip-path:polygon(0 0,100% 0,100% 90%,0 100%)}
.clip-up{clip-path:polygon(0 8%,100% 0,100% 100%,0 100%);margin-top:-64px;padding-top:96px!important}

/* ── Asymmetric steps ── */
@media(min-width:900px){
  .steps-grid .step-card:nth-child(even){margin-top:40px}
}

/* ── Map overrides ── */
.leaflet-container{background:var(--bg)!important}
.leaflet-control-attribution{display:none!important}
.leaflet-control-zoom{border:1px solid var(--border2)!important;border-radius:3px!important;overflow:hidden!important}
.leaflet-control-zoom a{background:var(--bg2)!important;color:var(--muted)!important;border-bottom:1px solid var(--border)!important;width:28px!important;height:28px!important;line-height:28px!important}
.leaflet-control-zoom a:hover{background:var(--bg3)!important;color:var(--indigo)!important}
.leaflet-tooltip{background:var(--bg2)!important;border:1px solid var(--border2)!important;color:var(--cream)!important;font-family:var(--mono)!important;font-size:11px!important;border-radius:3px!important;padding:6px 10px!important;box-shadow:0 4px 16px rgba(0,0,0,.5)!important}
.leaflet-tooltip::before{display:none!important}

/* ── FAQ ── */
details.faq{border-bottom:1px solid var(--border)}
details.faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:20px 0;font-family:var(--dm);font-weight:600;font-size:15px;color:var(--cream);transition:color .2s}
details.faq summary::-webkit-details-marker{display:none}
details.faq[open] summary{color:var(--indigo)}
details.faq summary::after{content:'+';font-size:22px;font-weight:300;color:var(--muted);transition:transform .2s}
details.faq[open] summary::after{content:'−';color:var(--indigo)}

/* ── Inputs ── */
.wi{width:100%;background:rgba(237,232,220,.04);border:1px solid var(--border2);border-radius:3px;padding:11px 14px;font-family:var(--mono);font-size:12px;color:var(--cream);margin-bottom:10px;transition:border-color .2s;outline:none}
.wi:focus{border-color:var(--indigo);background:rgba(237,232,220,.06)}
.wi::placeholder{color:rgba(237,232,220,.2)}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:rgba(237,232,220,.12);border-radius:3px}

/* ── Responsive ── */
@media(max-width:768px){
  .hero-grid{grid-template-columns:1fr!important}
  .hero-terminal{display:none!important}
  .proof-grid{grid-template-columns:1fr!important}
  .adv-grid{grid-template-columns:1fr!important}
  .waitlist-grid{grid-template-columns:1fr!important}
  .steps-grid{grid-template-columns:1fr 1fr!important}
  .clip-up{clip-path:none!important;margin-top:0!important;padding-top:60px!important}
  .clip-dn{clip-path:none!important}
}
@media(max-width:480px){
  .steps-grid{grid-template-columns:1fr!important}
  .stat-grid{grid-template-columns:1fr!important}
}
`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const SCREENS = [
  { id:1,  lat:51.506, lng:-0.087, name:'Southwark',       city:'London',     imp:12847 },
  { id:2,  lat:51.521, lng:-0.128, name:'Soho',            city:'London',     imp:8432  },
  { id:3,  lat:51.524, lng:-0.071, name:'Shoreditch',      city:'London',     imp:15920 },
  { id:4,  lat:51.487, lng:-0.176, name:'Chelsea',         city:'London',     imp:6103  },
  { id:5,  lat:51.535, lng:-0.101, name:'Islington',       city:'London',     imp:9870  },
  { id:6,  lat:53.484, lng:-2.238, name:'Northern Quarter',city:'Manchester', imp:9211  },
  { id:7,  lat:53.471, lng:-2.225, name:'Ancoats',         city:'Manchester', imp:4820  },
  { id:8,  lat:52.479, lng:-1.890, name:'Digbeth',         city:'Birmingham', imp:7334  },
  { id:9,  lat:55.953, lng:-3.189, name:'Leith',           city:'Edinburgh',  imp:5102  },
  { id:10, lat:51.461, lng:-2.588, name:'Stokes Croft',    city:'Bristol',    imp:3890  },
  { id:11, lat:53.800, lng:-1.549, name:'City Centre',     city:'Leeds',      imp:6720  },
  { id:12, lat:53.774, lng:-1.567, name:'Headingley',      city:'Leeds',      imp:3210  },
];

const VENUES = [
  'Southwark, London','Soho, London','Shoreditch, London',
  'Northern Quarter, Manchester','Digbeth, Birmingham',
  'Leith, Edinburgh','Stokes Croft, Bristol',
];

function genEvent() {
  return {
    key: Math.random(),
    screen: VENUES[Math.floor(Math.random() * VENUES.length)],
    people: Math.floor(Math.random() * 16) + 2,
    dwell: (Math.random() * 5.5 + 1.8).toFixed(1),
    attention: Math.floor(Math.random() * 38) + 58,
    ts: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, on];
}

function useCounter(target, duration = 2200, started = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    let t0 = null;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setVal(Math.round(e * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);
  return val;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ onLogin, onOperator, onAdvertiser }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  const link = { padding:'7px 14px', background:'none', border:'none', color:'var(--muted)', fontSize:13, cursor:'pointer', fontFamily:'var(--dm)', fontWeight:500, transition:'color .15s' };
  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:200,
      background: scrolled ? 'rgba(12,12,12,0.94)' : 'transparent',
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      transition:'all .3s ease',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 clamp(24px,5vw,80px)', height:64,
    }}>
      <div style={{ fontFamily:'var(--syne)', fontSize:15, fontWeight:800, letterSpacing:'3px', color:'var(--cream)' }}>ADGRID</div>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <button style={link} onClick={onOperator}
          onMouseEnter={e=>e.target.style.color='var(--cream)'} onMouseLeave={e=>e.target.style.color='var(--muted)'}>For Operators</button>
        <button style={link} onClick={onAdvertiser}
          onMouseEnter={e=>e.target.style.color='var(--cream)'} onMouseLeave={e=>e.target.style.color='var(--muted)'}>For Advertisers</button>
        <button className="btn-a" onClick={onLogin} style={{ marginLeft:8, padding:'8px 18px', fontSize:13 }}>Sign In</button>
      </div>
    </nav>
  );
}

// ─── Live Terminal ─────────────────────────────────────────────────────────────

function LiveTerminal() {
  const [rows, setRows] = useState(() => [genEvent(), genEvent(), genEvent(), genEvent(), genEvent()]);
  useEffect(() => {
    const id = setInterval(() => setRows(prev => [genEvent(), ...prev.slice(0, 5)]), 2100);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8,
      padding:22, height:'100%', fontFamily:'var(--mono)', fontSize:11,
      display:'flex', flexDirection:'column',
      boxShadow:'0 0 0 1px rgba(79,70,229,.09), 0 32px 80px rgba(0,0,0,.7)',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:13, borderBottom:'1px solid var(--border)' }}>
        <div style={{ position:'relative', width:8, height:8, flexShrink:0 }}>
          <div className="pulse-ring" />
          <div style={{ width:8, height:8, background:'var(--red)', borderRadius:'50%', position:'relative', zIndex:1 }} />
        </div>
        <span style={{ color:'var(--indigo)', fontWeight:500, letterSpacing:'2px', fontSize:10 }}>LIVE — ADGRID NETWORK</span>
        <span style={{ marginLeft:'auto', color:'var(--muted)', fontSize:10 }}>
          {new Date().toLocaleTimeString('en-GB')}
        </span>
      </div>
      {/* Col headers */}
      <div style={{ display:'grid', gridTemplateColumns:'78px 1fr 46px 46px 66px', gap:8, marginBottom:10, color:'var(--muted)', fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase' }}>
        <span>TIME</span><span>SCREEN</span>
        <span style={{textAlign:'right'}}>PPL</span>
        <span style={{textAlign:'right'}}>DWELL</span>
        <span style={{textAlign:'right'}}>STATUS</span>
      </div>
      {/* Rows */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:3 }}>
        {rows.map((ev, i) => (
          <div key={ev.key} className="t-row" style={{
            display:'grid', gridTemplateColumns:'78px 1fr 46px 46px 66px', gap:8,
            padding:'7px 8px', borderRadius:3,
            background: i === 0 ? 'rgba(79,70,229,.06)' : 'transparent',
            border: i === 0 ? '1px solid rgba(79,70,229,.1)' : '1px solid transparent',
            opacity: Math.max(0.25, 1 - i * 0.16),
          }}>
            <span style={{ color:'var(--muted)' }}>{ev.ts}</span>
            <span style={{ color:'var(--cream)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.screen}</span>
            <span style={{ color:'var(--cream)', textAlign:'right', fontWeight:500 }}>{ev.people}</span>
            <span style={{ color:'var(--indigo)', textAlign:'right' }}>{ev.dwell}s</span>
            <span style={{ color:'var(--green)', textAlign:'right', fontSize:9, fontWeight:500 }}>VERIFIED ✓</span>
          </div>
        ))}
      </div>
      {/* Footer */}
      <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', color:'var(--muted)', fontSize:9, letterSpacing:'1px' }}>
        <span>12 SCREENS ACTIVE</span>
        <span>IMPRESSIONS VERIFIED<span className="cur" /></span>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onOperator, onAdvertiser }) {
  return (
    <section style={{ minHeight:'100svh', background:'var(--bg)', paddingTop:64, position:'relative', overflow:'hidden' }}
      className="grid-bg clip-dn">
      {/* Ambient glow */}
      <div style={{ position:'absolute', top:'35%', left:'22%', width:480, height:480,
        background:'radial-gradient(circle, rgba(79,70,229,.055) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'50%', right:'15%', width:320, height:320,
        background:'radial-gradient(circle, rgba(230,57,70,.04) 0%, transparent 70%)', pointerEvents:'none' }} />

      <div className="hero-grid" style={{
        display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:'calc(100svh - 64px)',
        maxWidth:1280, margin:'0 auto', padding:'0 clamp(24px,5vw,80px)',
      }}>
        {/* Left: Copy */}
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', paddingRight:'clamp(24px,4vw,60px)', paddingTop:48, paddingBottom:48 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'3px', color:'var(--indigo)', marginBottom:28, textTransform:'uppercase', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ display:'inline-block', width:24, height:1, background:'var(--indigo)', flexShrink:0 }} />
            Signal Verified · Digital Out-of-Home
          </div>
          <h1 style={{ fontFamily:'var(--syne)', fontSize:'clamp(40px,5.5vw,76px)', fontWeight:800, color:'var(--cream)', lineHeight:1.0, letterSpacing:'-1px', marginBottom:28 }}>
            The ad industry<br />
            sells <span style={{ color:'var(--indigo)' }}>estimates.</span><br />
            <span style={{ WebkitTextStroke:'1.5px var(--cream)', color:'transparent' }}>We sell proof.</span>
          </h1>
          <p style={{ fontFamily:'var(--dm)', fontSize:'clamp(14px,1.4vw,17px)', color:'var(--dim)', lineHeight:1.78, maxWidth:440, marginBottom:40 }}>
            Adgrid connects physical screens with advertisers using computer vision. Every impression counted by a camera — not a spreadsheet.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <button className="btn-g" onClick={onOperator}>I have screens →</button>
            <button className="btn-a" onClick={onAdvertiser}>I want to advertise</button>
          </div>
          {/* Stat pills */}
          <div style={{ display:'flex', gap:12, marginTop:48, flexWrap:'wrap' }}>
            {[['4.2s','avg dwell tracked'],['<30m','operator setup'],['100%','local processing']].map(([v,l]) => (
              <div key={l} style={{ display:'flex', flexDirection:'column', padding:'10px 16px', background:'rgba(237,232,220,.04)', border:'1px solid var(--border)', borderRadius:3 }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:15, fontWeight:500, color:'var(--indigo)' }}>{v}</span>
                <span style={{ fontFamily:'var(--dm)', fontSize:10, color:'var(--muted)', marginTop:2, letterSpacing:'.5px' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Right: Terminal */}
        <div className="hero-terminal" style={{ display:'flex', alignItems:'center', padding:'48px 0 48px clamp(16px,2vw,32px)' }}>
          <div style={{ width:'100%', maxWidth:520, height:380 }}>
            <LiveTerminal />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Privacy Strip ────────────────────────────────────────────────────────────

function PrivacyStrip() {
  const [ref, on] = useReveal();
  return (
    <div ref={ref} style={{ background:'#080808', padding:'clamp(32px,4vw,52px) clamp(24px,5vw,80px)', borderTop:'1px solid rgba(237,232,220,.04)', borderBottom:'1px solid rgba(237,232,220,.04)' }}>
      <div style={{ maxWidth:1080, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:40 }}>
        {[
          ['🔒','On-device only','All CV processing runs locally on your hardware. No images, no video, no biometrics leave the device. Ever.'],
          ['👤','Counts, not identities','Our system counts and classifies. It does not identify, track, or store individual faces.'],
          ['🇬🇧','GDPR-compliant by design','Built for UK and EU compliance from day one. No biometric data is collected or transmitted.'],
        ].map(([icon,title,body],i) => (
          <div key={title} className={`rv d${i+1} ${on?'on':''}`} style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <div>
              <div style={{ fontFamily:'var(--dm)', fontWeight:700, color:'var(--cream)', fontSize:13, marginBottom:5 }}>{title}</div>
              <div style={{ fontFamily:'var(--dm)', fontSize:12, color:'var(--muted)', lineHeight:1.65 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Proof Section ────────────────────────────────────────────────────────────

function ProofSection() {
  const [ref, on] = useReveal();
  return (
    <section ref={ref} style={{ background:'var(--bg)', padding:'clamp(80px,10vw,130px) clamp(24px,5vw,80px)', position:'relative', overflow:'visible' }}>
      <div className="proof-grid" style={{ maxWidth:1080, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'clamp(40px,5vw,80px)', alignItems:'center' }}>
        <div className={`rv ${on?'on':''}`}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'3px', color:'var(--indigo)', marginBottom:16, textTransform:'uppercase', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ display:'inline-block', width:20, height:1, background:'var(--indigo)' }} />
            What verified looks like
          </div>
          <h2 style={{ fontFamily:'var(--syne)', fontSize:'clamp(28px,3.5vw,48px)', fontWeight:800, color:'var(--cream)', lineHeight:1.1, marginBottom:20 }}>
            A camera counted this.<br />Not a survey.
          </h2>
          <p style={{ fontFamily:'var(--dm)', fontSize:15, color:'var(--muted)', lineHeight:1.78, marginBottom:28 }}>
            Traditional DOOH sells estimated CPM based on foot traffic studies. Adgrid's computer vision runs locally and delivers actual counts — updated every time an ad plays.
          </p>
          {[
            ['Verified impressions','Actual face counts, not estimates'],
            ['Dwell time tracking','How long people actually watched'],
            ['Live demographics','Age bracket + gender, processed locally'],
          ].map(([t,s]) => (
            <div key={t} style={{ display:'flex', gap:12, marginBottom:14, alignItems:'flex-start' }}>
              <div style={{ width:4, height:4, background:'var(--indigo)', borderRadius:'50%', marginTop:8, flexShrink:0 }} />
              <div>
                <div style={{ fontFamily:'var(--dm)', fontWeight:700, color:'var(--cream)', fontSize:13 }}>{t}</div>
                <div style={{ fontFamily:'var(--dm)', fontSize:12, color:'var(--muted)' }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Proof card — bleeds down */}
        <div className={`rv d2 ${on?'on':''}`} style={{ position:'relative', zIndex:10, marginBottom:-80 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:28, boxShadow:'0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(79,70,229,.07)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontFamily:'var(--mono)', fontSize:10, color:'var(--green)', letterSpacing:'2px', textTransform:'uppercase' }}>
              <div style={{ position:'relative', width:8, height:8, flexShrink:0 }}>
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'var(--green)', animation:'pulse-out 1.6s ease-out infinite' }} />
                <div style={{ width:8, height:8, background:'var(--green)', borderRadius:'50%', position:'relative', zIndex:1 }} />
              </div>
              Live Data — King St, London
            </div>
            {[
              ['People in view','12','var(--cream)'],
              ['Avg dwell time','4.2s','var(--indigo)'],
              ['Attention score','78%','var(--green)'],
              ['Age 25–34','41%','#818cf8'],
              ['Female','54%','#f472b6'],
            ].map(([label,val,col]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)' }}>{label}</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:15, fontWeight:500, color:col }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop:18, padding:'10px 14px', background:'rgba(79,70,229,.07)', border:'1px solid rgba(79,70,229,.2)', borderRadius:4, fontFamily:'var(--mono)', fontSize:11, color:'var(--indigo)', letterSpacing:'1px' }}>
              ✓ VERIFIED IMPRESSION CERTIFICATE GENERATED
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Map Section ──────────────────────────────────────────────────────────────

function MapSection() {
  const [ref, on] = useReveal(0.05);
  const screens    = useCounter(12, 1800, on);
  const imps       = useCounter(284940, 2800, on);
  const cities     = useCounter(6, 1400, on);

  return (
    <section ref={ref} style={{ background:'#080808', paddingTop:120, position:'relative' }}>
      {/* Stats */}
      <div className="stat-grid" style={{ maxWidth:1080, margin:'0 auto', padding:'0 clamp(24px,5vw,80px) 56px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0 }}>
        {[
          [screens,'Active screens'],
          [imps.toLocaleString('en-GB'),'Verified impressions'],
          [cities,'UK cities'],
        ].map(([val,label],i) => (
          <div key={label} className={`rv d${i+1} ${on?'on':''}`}
            style={{ textAlign:'center', padding:'0 24px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'clamp(32px,4.5vw,60px)', fontWeight:500, color:'var(--indigo)', lineHeight:1 }}>{val}</div>
            <div style={{ fontFamily:'var(--dm)', fontSize:12, color:'var(--muted)', marginTop:8, letterSpacing:'1px', textTransform:'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>
      {/* Map */}
      <div style={{ height:440, position:'relative' }}>
        {on && (
          <MapContainer center={[53.5, -2.2]} zoom={6}
            style={{ height:'100%', width:'100%' }}
            scrollWheelZoom={false} attributionControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {SCREENS.map(s => (
              <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={8}
                pathOptions={{ color:'#4f46e5', fillColor:'rgba(79,70,229,.85)', fillOpacity:.9, weight:1.5 }}>
                <Tooltip direction="top" offset={[0,-8]}>
                  <div>
                    <div style={{ color:'#4f46e5', fontWeight:500 }}>{s.name}, {s.city}</div>
                    <div style={{ color:'#ede8dc', marginTop:2 }}>{s.imp.toLocaleString('en-GB')} verified impressions</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:80, background:'linear-gradient(to top,#080808,transparent)', zIndex:500, pointerEvents:'none' }} />
      </div>
    </section>
  );
}

// ─── Operator Section ─────────────────────────────────────────────────────────

function OperatorSection({ onWaitlist }) {
  const [ref, on] = useReveal();
  const steps = [
    { n:'01', icon:'🖥', title:'Register your screen', body:'Add your display in minutes. Get a unique screen token and one-command setup. No IT department needed.' },
    { n:'02', icon:'📷', title:'Add a camera', body:'A USB camera + mini PC (under £80) runs our CV agent locally. Nothing leaves your venue.' },
    { n:'03', icon:'✓',  title:'You approve every campaign', body:'Advertisers submit. You review and accept. No campaign runs on your screen without your sign-off.' },
    { n:'04', icon:'💷', title:'Earn automatically', body:'Verified impressions command premium CPM. Stripe Connect deposits weekly. No invoicing.' },
  ];
  return (
    <section id="operators" ref={ref} style={{ background:'var(--bg)', padding:'clamp(80px,10vw,130px) clamp(24px,5vw,80px)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:2, background:'linear-gradient(to bottom,transparent,var(--indigo),transparent)' }} />
      <div style={{ maxWidth:1080, margin:'0 auto' }}>
        <div className={`rv ${on?'on':''}`} style={{ marginBottom:60 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'3px', color:'var(--indigo)', marginBottom:14, textTransform:'uppercase', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ display:'inline-block', width:20, height:1, background:'var(--indigo)' }} />
            For screen operators
          </div>
          <h2 style={{ fontFamily:'var(--syne)', fontSize:'clamp(28px,3.5vw,52px)', fontWeight:800, color:'var(--cream)', lineHeight:1.1, maxWidth:560 }}>
            You already have a screen.<br />Now make it earn.
          </h2>
          <p style={{ fontFamily:'var(--dm)', fontSize:15, color:'var(--muted)', lineHeight:1.78, maxWidth:520, marginTop:16 }}>
            Cafés, gyms, salons, co-working spaces, retail units — if you have a digital display, Adgrid turns it into a verified revenue stream. You stay in control of every campaign.
          </p>
        </div>
        {/* Asymmetric steps grid */}
        <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          {steps.map(({ n, icon, title, body }, i) => (
            <div key={n} className={`step-card rv d${i+1} ${on?'on':''}`} style={{ marginTop: i%2===1 ? 40 : 0 }}>
              <div style={{ fontSize:28, marginBottom:16 }}>{icon}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--indigo)', letterSpacing:'2px', marginBottom:10 }}>{n}</div>
              <div style={{ fontFamily:'var(--dm)', fontWeight:700, fontSize:15, color:'var(--cream)', marginBottom:8 }}>{title}</div>
              <div style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)', lineHeight:1.65 }}>{body}</div>
            </div>
          ))}
        </div>
        {/* Revenue cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:14, marginTop:48 }}>
          {[
            ['Premium CPM','Verified data commands higher rates. Advertisers pay more because they trust the numbers.'],
            ['Full approval control','You decide what runs. Reject anything. No override ever.'],
            ['Weekly Stripe payouts','Earnings deposited automatically. No invoicing, no chasing.'],
            ['No lock-in','Leave any time. We earn when you earn — not before.'],
          ].map(([t,b],i) => (
            <div key={t} className={`feat-card rv d${i+1} ${on?'on':''}`}>
              <div style={{ fontFamily:'var(--dm)', fontWeight:700, color:'var(--cream)', fontSize:14, marginBottom:8 }}>{t}</div>
              <div style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>{b}</div>
            </div>
          ))}
        </div>
        <div className={`rv d3 ${on?'on':''}`} style={{ marginTop:44 }}>
          <button className="btn-g" onClick={onWaitlist}>Join operator waitlist →</button>
        </div>
      </div>
    </section>
  );
}

// ─── Advertiser Section ───────────────────────────────────────────────────────

function AdvertiserSection({ onWaitlist }) {
  const [ref, on] = useReveal();
  const features = [
    ['📍','Location targeting','Choose screens by city, postcode, or venue type. Know exactly where your ad ran.'],
    ['🕐','Time of day scheduling','Precise scheduling down to the hour. No broad dayparts.'],
    ['👥','Demographic breakdown','Age bracket and gender split, processed locally. Real audience data.'],
    ['📋','Verified impression certificate','Every campaign closes with a tamper-evident verified count report.'],
  ];
  return (
    <section id="advertisers" ref={ref} className="clip-up"
      style={{ background:'var(--bg2)', padding:'clamp(80px,10vw,130px) clamp(24px,5vw,80px)' }}>
      <div style={{ maxWidth:1080, margin:'0 auto' }}>
        <div className="adv-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'clamp(40px,6vw,96px)', alignItems:'start' }}>
          <div className={`rv ${on?'on':''}`}>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'3px', color:'var(--indigo)', marginBottom:14, textTransform:'uppercase', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ display:'inline-block', width:20, height:1, background:'var(--indigo)' }} />
              For advertisers
            </div>
            <h2 style={{ fontFamily:'var(--syne)', fontSize:'clamp(28px,3.5vw,52px)', fontWeight:800, color:'var(--cream)', lineHeight:1.1 }}>
              Buy impressions you can actually verify.
            </h2>
            <p style={{ fontFamily:'var(--dm)', fontSize:15, color:'var(--muted)', lineHeight:1.78, marginTop:20, marginBottom:20 }}>
              Every impression Adgrid sells comes with a verified count — not modelled, not estimated. A camera counted it at the moment your ad played.
            </p>
            <p style={{ fontFamily:'var(--dm)', fontSize:15, color:'var(--muted)', lineHeight:1.78, marginBottom:36 }}>
              Target by location, time of day, and demographic breakdown. Run static or video creative. Every screen is operator-approved — no low-quality placements.
            </p>
            <button className="btn-a" onClick={onWaitlist}>Apply to advertise</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {features.map(([icon,title,body],i) => (
              <div key={title} className={`feat-card rv d${i+1} ${on?'on':''}`} style={{ display:'flex', gap:14 }}>
                <span style={{ fontSize:18, flexShrink:0, marginTop:2 }}>{icon}</span>
                <div>
                  <div style={{ fontFamily:'var(--dm)', fontWeight:700, color:'var(--cream)', fontSize:14, marginBottom:4 }}>{title}</div>
                  <div style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FaqSection() {
  const [ref, on] = useReveal();
  const [tab, setTab] = useState('op');
  const opFaqs = [
    ['What hardware do I need?','A digital display you already own, a USB camera (any standard webcam), and a small local PC — Raspberry Pi 5 or mini PC, available for under £80. We provide the software.'],
    ["What's the revenue split?",'Operators keep the majority of CPM revenue. Adgrid takes a platform fee per verified impression. Exact rates are being finalised with our early partner cohort — early operators influence the terms.'],
    ['Is this legal to run in my venue?','Yes. Our system is GDPR-compliant by design — it counts and classifies people but does not identify or store individual faces. We provide a visitor notice template consistent with standard CCTV practice.'],
    ['What if no advertisers target my area?','Your screen only displays campaigns when matched. If nothing matches, your screen continues as normal. Early operators are prioritised for incoming campaigns as the network grows.'],
    ['What if the camera goes offline?','Impression tracking pauses — no false data is reported. Advertisers are only charged for verified impressions. Verification resumes automatically when connectivity restores.'],
  ];
  const advFaqs = [
    ['How many screens are live and where?','We\'re in early access — actively onboarding screen operators across the UK. Coverage details are shared during the advertiser onboarding call before you commit.'],
    ['How is impression data verified?','Computer vision runs on hardware at each screen. When your ad plays, the system counts people in frame, records dwell time and attention, and generates a tamper-evident certificate. No modelling.'],
    ['What ad formats do you support?','Static images and video. Resolution requirements depend on the operator\'s screen — confirmed at campaign setup. We support standard DOOH formats.'],
    ['Is the audience data GDPR-compliant?','Yes. Demographic data is processed on-device. Advertisers receive aggregated counts only — no individual-level data, no retargeting IDs. Compliant with UK GDPR and ICO guidance.'],
    ["What's the minimum spend?",'Minimum spend is being finalised with our first advertiser cohort. Early advertisers influence pricing and get priority access to best-performing screens.'],
  ];
  const faqs = tab === 'op' ? opFaqs : advFaqs;
  return (
    <section ref={ref} style={{ background:'var(--bg)', padding:'clamp(80px,10vw,130px) clamp(24px,5vw,80px)' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div className={`rv ${on?'on':''}`} style={{ marginBottom:48 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'3px', color:'var(--indigo)', marginBottom:14, textTransform:'uppercase' }}>FAQ</div>
          <h2 style={{ fontFamily:'var(--syne)', fontSize:'clamp(28px,3vw,44px)', fontWeight:800, color:'var(--cream)', lineHeight:1.15 }}>Straight answers.</h2>
        </div>
        <div className={`rv d1 ${on?'on':''}`} style={{ display:'flex', gap:6, marginBottom:40, background:'var(--bg2)', padding:4, borderRadius:4, width:'fit-content', border:'1px solid var(--border)' }}>
          {[['op','Screen operators'],['adv','Advertisers']].map(([k,label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding:'8px 20px', borderRadius:3, border:'none', cursor:'pointer',
              fontFamily:'var(--dm)', fontWeight:600, fontSize:13,
              background: tab===k ? 'var(--indigo)' : 'transparent',
              color: tab===k ? '#fff' : 'var(--muted)',
              transition:'all .15s ease',
            }}>{label}</button>
          ))}
        </div>
        {faqs.map(([q,a],i) => (
          <details key={q} className={`faq rv d${i+1} ${on?'on':''}`}>
            <summary>{q}</summary>
            <div style={{ padding:'16px 0 24px', fontFamily:'var(--dm)', fontSize:14, color:'var(--muted)', lineHeight:1.78 }}>{a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

function WaitlistSection() {
  const [ref, on] = useReveal();
  const [opEmail,  setOpEmail]  = useState('');
  const [opVenue,  setOpVenue]  = useState('');
  const [opDone,   setOpDone]   = useState(false);
  const [advEmail, setAdvEmail] = useState('');
  const [advCo,    setAdvCo]    = useState('');
  const [advDone,  setAdvDone]  = useState(false);

  return (
    <section id="waitlist" ref={ref} style={{ background:'#080808', padding:'clamp(80px,10vw,130px) clamp(24px,5vw,80px)', borderTop:'1px solid var(--border)' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div className={`rv ${on?'on':''}`} style={{ textAlign:'center', marginBottom:56 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'3px', color:'var(--indigo)', marginBottom:14, textTransform:'uppercase' }}>Early Access</div>
          <h2 style={{ fontFamily:'var(--syne)', fontSize:'clamp(28px,3.5vw,52px)', fontWeight:800, color:'var(--cream)', lineHeight:1.1, marginBottom:16 }}>Join the waitlist.</h2>
          <p style={{ fontFamily:'var(--dm)', fontSize:15, color:'var(--muted)', lineHeight:1.75, maxWidth:460, margin:'0 auto' }}>
            We're onboarding our first cohort of screen operators and advertisers. Early partners shape the product and lock in founder terms.
          </p>
        </div>
        <div className="waitlist-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Operator */}
          <div className={`rv d1 ${on?'on':''}`} style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8, padding:28 }}>
            {opDone ? (
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:32, color:'var(--indigo)', marginBottom:12 }}>✓</div>
                <div style={{ fontFamily:'var(--dm)', fontWeight:700, color:'var(--cream)', marginBottom:8 }}>You're on the list</div>
                <div style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)' }}>We'll be in touch within 48 hours.</div>
              </div>
            ) : (<>
              <div style={{ fontFamily:'var(--dm)', fontWeight:800, fontSize:16, color:'var(--cream)', marginBottom:6 }}>🖥 I have screens</div>
              <div style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:22 }}>Register as a screen operator. We'll walk you through setup within 48 hours.</div>
              <input className="wi" type="email" placeholder="your@email.com" value={opEmail} onChange={e => setOpEmail(e.target.value)} />
              <input className="wi" type="text"  placeholder="Venue name (optional)" value={opVenue} onChange={e => setOpVenue(e.target.value)} />
              <button className="btn-g" onClick={() => opEmail && setOpDone(true)} style={{ width:'100%', justifyContent:'center', marginTop:4 }}>
                Join operator waitlist →
              </button>
            </>)}
          </div>
          {/* Advertiser */}
          <div className={`rv d2 ${on?'on':''}`} style={{ background:'rgba(79,70,229,.04)', border:'1px solid rgba(79,70,229,.18)', borderRadius:8, padding:28, boxShadow:'0 0 48px rgba(79,70,229,.06)' }}>
            {advDone ? (
              <div style={{ textAlign:'center', padding:'32px 0' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:32, color:'var(--indigo)', marginBottom:12 }}>✓</div>
                <div style={{ fontFamily:'var(--dm)', fontWeight:700, color:'var(--cream)', marginBottom:8 }}>Application received</div>
                <div style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)' }}>We'll share coverage and get on a call.</div>
              </div>
            ) : (<>
              <div style={{ fontFamily:'var(--dm)', fontWeight:800, fontSize:16, color:'var(--cream)', marginBottom:6 }}>📢 I want to advertise</div>
              <div style={{ fontFamily:'var(--dm)', fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:22 }}>Apply as an advertiser. We'll share current network coverage and discuss campaign options.</div>
              <input className="wi" type="email" placeholder="your@email.com" value={advEmail} onChange={e => setAdvEmail(e.target.value)} />
              <input className="wi" type="text"  placeholder="Company name (optional)" value={advCo} onChange={e => setAdvCo(e.target.value)} />
              <button className="btn-a" onClick={() => advEmail && setAdvDone(true)} style={{ width:'100%', justifyContent:'center' }}>
                Apply to advertise
              </button>
            </>)}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ onLogin }) {
  const lnk = { fontFamily:'var(--dm)', fontSize:12, color:'rgba(237,232,220,.22)', cursor:'pointer', transition:'color .15s' };
  return (
    <footer style={{ background:'#030608', padding:'clamp(28px,4vw,48px) clamp(24px,5vw,80px)', borderTop:'1px solid rgba(237,232,220,.04)' }}>
      <div style={{ maxWidth:1080, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
        <div style={{ fontFamily:'var(--syne)', fontSize:13, fontWeight:800, letterSpacing:'3px', color:'rgba(237,232,220,.22)' }}>ADGRID</div>
        <div style={{ display:'flex', gap:24 }}>
          {['Privacy','Terms','Contact'].map(l => (
            <span key={l} style={lnk}
              onMouseEnter={e=>e.target.style.color='rgba(237,232,220,.5)'}
              onMouseLeave={e=>e.target.style.color='rgba(237,232,220,.22)'}>{l}</span>
          ))}
          <span onClick={onLogin} style={lnk}
            onMouseEnter={e=>e.target.style.color='var(--indigo)'}
            onMouseLeave={e=>e.target.style.color='rgba(237,232,220,.22)'}>Sign In</span>
        </div>
        <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'rgba(237,232,220,.12)' }}>© 2026 Adgrid Ltd</div>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function MarketingHome({ onSignup, onLogin }) {
  useEffect(() => {
    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = Object.assign(document.createElement('link'), {
        id:'leaflet-css', rel:'stylesheet',
        href:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
      });
      document.head.appendChild(link);
    }
    // Global CSS
    const style = Object.assign(document.createElement('style'), { textContent: CSS });
    document.head.appendChild(style);
    return () => { try { document.head.removeChild(style); } catch {} };
  }, []);

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior:'smooth' });

  return (
    <div style={{ background:'#0c0c0c', minHeight:'100vh', overflowX:'hidden' }}>
      <Nav
        onLogin={onLogin}
        onOperator={() => scrollTo('operators')}
        onAdvertiser={() => scrollTo('advertisers')}
      />
      <Hero
        onOperator={() => scrollTo('operators')}
        onAdvertiser={() => scrollTo('advertisers')}
      />
      <PrivacyStrip />
      <ProofSection />
      <MapSection />
      <OperatorSection onWaitlist={() => scrollTo('waitlist')} />
      <AdvertiserSection onWaitlist={() => scrollTo('waitlist')} />
      <FaqSection />
      <WaitlistSection />
      <Footer onLogin={onLogin} />
    </div>
  );
}
