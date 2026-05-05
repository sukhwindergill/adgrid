import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { supabase } from "./lib/supabase.js";
import { C, F, SUPABASE_FUNCTIONS_URL } from "./lib/constants.js";
import Placeholder from "./components/Placeholder.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// ADGRID PLATFORM — Clean marketing-platform UI
// Stripe / Linear / Google Ads aesthetic
// Light theme · Sidebar nav · Full campaign management
// ─────────────────────────────────────────────────────────────────────────────

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";


// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

const SCREENS = [
  { id:"SCR-001", name:"Corner Brew — Oxford St",    city:"London",     neighbourhood:"Oxford Street",      status:"live",    impressions:84200,  revenue:1240, owner:"Corner Brew Coffee",    campaigns:2, cpm:4.80, maxDuration:15 },
  { id:"SCR-002", name:"Canary Wharf Plaza",          city:"London",     neighbourhood:"Canary Wharf",       status:"live",    impressions:210000, revenue:3880, owner:"Greenfield Properties", campaigns:2, cpm:5.20, maxDuration:30 },
  { id:"SCR-003", name:"Shoreditch Stop",             city:"London",     neighbourhood:"Bethnal Green",      status:"pending", impressions:0,       revenue:0,   owner:"Urban Spaces Group",    campaigns:0, cpm:4.20, maxDuration:20 },
  { id:"SCR-004", name:"Piccadilly Gardens",          city:"Manchester", neighbourhood:"City Centre",        status:"live",    impressions:142000, revenue:2100, owner:"MCR Transit Auth.",     campaigns:2, cpm:4.20, maxDuration:20 },
  { id:"SCR-006", name:"New Street Station",          city:"Birmingham", neighbourhood:"City Centre",        status:"live",    impressions:188000, revenue:2900, owner:"Network Rail",          campaigns:1, cpm:4.50, maxDuration:25 },
  { id:"SCR-008", name:"King & Bay — TTC Shelter",   city:"Toronto",    neighbourhood:"Financial District", status:"live",    impressions:162000, revenue:2400, owner:"Slate Asset Mgmt",      campaigns:2, cpm:4.20, maxDuration:30 },
  { id:"SCR-009", name:"Queen West — Ossington",     city:"Toronto",    neighbourhood:"West Queen West",    status:"live",    impressions:58000,  revenue:980,  owner:"Ossington Hospitality", campaigns:1, cpm:3.80, maxDuration:15 },
];

const INIT_CAMPAIGNS = [
  { id:"BK-001", advertiser:"Pret A Manger", category:"Food & Beverage",  screenId:"SCR-001", screen:"Corner Brew — Oxford St",    city:"London",     budget:480,  spent:312,  impressions:12400, scans:42,  status:"active",    start:"2026-03-21", end:"2026-04-21", days:["Mon","Tue","Wed","Thu","Fri"], timeStart:"07:00", timeEnd:"11:00", slots:8,  duration:10, headline:"Start Your Morning Right", color:"#f59e0b", destination:"https://pret.com/order" },
  { id:"BK-002", advertiser:"Nike",           category:"Fashion & Retail", screenId:"SCR-002", screen:"Canary Wharf Plaza",          city:"London",     budget:2200, spent:1480, impressions:44200, scans:127, status:"active",    start:"2026-03-15", end:"2026-04-15", days:["Mon","Tue","Wed","Thu","Fri","Sat"], timeStart:"08:00", timeEnd:"20:00", slots:20, duration:30, headline:"Just Do It.",              color:"#ffffff",   destination:"https://nike.com/spring" },
  { id:"BK-003", advertiser:"Lloyds Bank",   category:"Finance & Banking", screenId:"SCR-002", screen:"Canary Wharf Plaza",          city:"London",     budget:1440, spent:0,    impressions:0,     scans:0,   status:"scheduled", start:"2026-04-01", end:"2026-04-30", days:["Mon","Tue","Wed","Thu","Fri"],       timeStart:"06:00", timeEnd:"09:00", slots:12, duration:20, headline:"Banking Built for You",     color:"#22c55e",   destination:"https://lloydsbank.com" },
  { id:"BK-005", advertiser:"Caffè Nero",    category:"Food & Beverage",  screenId:"SCR-004", screen:"Piccadilly Gardens",           city:"Manchester", budget:620,  spent:290,  impressions:18800, scans:28,  status:"active",    start:"2026-03-18", end:"2026-04-18", days:["Mon","Tue","Wed","Thu","Fri"],       timeStart:"07:00", timeEnd:"10:00", slots:10, duration:12, headline:"Your Perfect Morning Cup",  color:"#d97706",   destination:"https://caffenero.com" },
  { id:"BK-007", advertiser:"John Lewis",    category:"Fashion & Retail", screenId:"SCR-006", screen:"New Street Station",           city:"Birmingham", budget:1800, spent:1100, impressions:38400, scans:94,  status:"active",    start:"2026-03-20", end:"2026-04-20", days:["Mon","Tue","Wed","Thu","Fri","Sat"], timeStart:"09:00", timeEnd:"21:00", slots:18, duration:25, headline:"Never Knowingly Undersold", color:"#60a5fa",   destination:"https://johnlewis.com" },
  { id:"BK-008", advertiser:"Tim Hortons",   category:"Food & Beverage",  screenId:"SCR-008", screen:"King & Bay — TTC Shelter",    city:"Toronto",    budget:720,  spent:390,  impressions:21400, scans:38,  status:"active",    start:"2026-03-21", end:"2026-04-21", days:["Mon","Tue","Wed","Thu","Fri"],       timeStart:"06:00", timeEnd:"10:00", slots:12, duration:10, headline:"Always Fresh.",             color:"#c8102e",   destination:"https://timhortons.ca" },
  { id:"BK-009", advertiser:"MLSE",           category:"Entertainment",    screenId:"SCR-008", screen:"King & Bay — TTC Shelter",    city:"Toronto",    budget:1200, spent:620,  impressions:18200, scans:64,  status:"active",    start:"2026-03-21", end:"2026-04-30", days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], timeStart:"17:00", timeEnd:"23:00", slots:10, duration:20, headline:"Game Night.",              color:"#00205b",   destination:"https://scotiabankarena.com" },
  { id:"BK-010", advertiser:"Shopify",        category:"Technology",       screenId:"SCR-009", screen:"Queen West — Ossington",      city:"Toronto",    budget:960,  spent:0,    impressions:0,     scans:0,   status:"paused",    start:"2026-04-01", end:"2026-04-30", days:["Mon","Tue","Wed","Thu","Fri"],       timeStart:"08:00", timeEnd:"18:00", slots:8,  duration:15, headline:"Build Your Business.",     color:"#96bf48",   destination:"https://shopify.com" },
];

const CATEGORIES = ["Food & Beverage","Fashion & Retail","Finance & Banking","Health & Fitness","Entertainment","Technology","Travel & Tourism","Automotive","Real Estate"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS = Array.from({length:24},(_,i)=>`${String(i).padStart(2,"0")}:00`);

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Dot = ({status}) => {
  const c = {live:C.green,active:C.green,pending:C.amber,scheduled:C.blue,paused:C.amber,completed:C.textMuted,offline:C.red}[status]||C.textMuted;
  return <span style={{width:6,height:6,borderRadius:"50%",background:c,display:"inline-block",flexShrink:0}}/>;
};

const Badge = ({status,children}) => {
  const m = {active:{bg:C.greenSoft,c:C.green,b:C.greenBorder},live:{bg:C.greenSoft,c:C.green,b:C.greenBorder},scheduled:{bg:C.blueSoft,c:C.blue,b:C.blueBorder},pending:{bg:C.amberSoft,c:C.amber,b:C.amberBorder},paused:{bg:C.amberSoft,c:C.amber,b:C.amberBorder},completed:{bg:C.surfaceAlt,c:C.textSub,b:C.border},failed:{bg:C.redSoft,c:C.red,b:C.redBorder}};
  const s = m[status]||m.completed;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:500,fontFamily:F.sans,background:s.bg,color:s.c,border:`1px solid ${s.b}`}}>
    <Dot status={status}/>{children||status.charAt(0).toUpperCase()+status.slice(1)}
  </span>;
};

const Card = ({children,style={},onClick}) => (
  <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:24,...style,cursor:onClick?"pointer":undefined,transition:"box-shadow 0.15s"}}
    onMouseEnter={onClick?e=>e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.06)":undefined}
    onMouseLeave={onClick?e=>e.currentTarget.style.boxShadow="none":undefined}>
    {children}
  </div>
);

const KPI = ({label,value,sub,color=C.text,trend,icon}) => (
  <Card style={{padding:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
      <span style={{fontSize:12,fontWeight:500,color:C.textSub,fontFamily:F.sans}}>{label}</span>
      {icon&&<span style={{fontSize:18}}>{icon}</span>}
    </div>
    <div style={{fontSize:26,fontWeight:700,color,lineHeight:1,marginBottom:4,fontFamily:F.sans}}>{value}</div>
    {sub&&<div style={{fontSize:12,color:C.textMuted,fontFamily:F.sans}}>{sub}</div>}
    {trend!==undefined&&<div style={{fontSize:12,marginTop:6,color:trend>=0?C.green:C.red,fontFamily:F.sans,fontWeight:500}}>{trend>=0?"↑":"↓"} {Math.abs(trend)}% vs last month</div>}
  </Card>
);

const Btn = ({children,variant="primary",size="md",onClick,disabled,style={},icon}) => {
  const sz = {sm:{padding:"6px 12px",fontSize:12},md:{padding:"8px 16px",fontSize:13},lg:{padding:"11px 20px",fontSize:14}}[size];
  const vr = {
    primary: {background:C.blue,color:"#fff",border:"none",boxShadow:"0 1px 2px rgba(37,99,235,0.2)"},
    secondary:{background:C.surface,color:C.textMid,border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},
    ghost:   {background:"transparent",color:C.textSub,border:"none"},
    danger:  {background:C.redSoft,color:C.red,border:`1px solid ${C.redBorder}`},
    success: {background:C.greenSoft,color:C.green,border:`1px solid ${C.greenBorder}`},
    stripe:  {background:"#635bff",color:"#fff",border:"none"},
  }[variant]||{};
  return (
    <button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:F.sans,fontWeight:500,borderRadius:8,cursor:disabled?"not-allowed":"pointer",transition:"all 0.15s",whiteSpace:"nowrap",opacity:disabled?0.5:1,...sz,...vr,...style}}
      onMouseEnter={e=>{if(!disabled){if(variant==="primary")e.currentTarget.style.background=C.blueDark;if(variant==="secondary")e.currentTarget.style.background=C.surfaceAlt;}}}
      onMouseLeave={e=>{if(variant==="primary")e.currentTarget.style.background=C.blue;if(variant==="secondary")e.currentTarget.style.background=C.surface;}}>
      {icon&&<span style={{fontSize:14}}>{icon}</span>}{children}
    </button>
  );
};

const Inp = ({label,hint,error,style={},...p}) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label&&<label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans}}>{label}</label>}
    <input {...p} style={{padding:"9px 12px",border:`1px solid ${error?C.red:C.border}`,borderRadius:8,fontSize:13,fontFamily:F.sans,color:C.text,background:C.surface,outline:"none",width:"100%",...style}}
      onFocus={e=>e.target.style.borderColor=C.blue} onBlur={e=>e.target.style.borderColor=error?C.red:C.border}/>
    {hint&&<div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{hint}</div>}
    {error&&<div style={{fontSize:11,color:C.red,fontFamily:F.sans}}>{error}</div>}
  </div>
);

const SelInput = ({label,children,style={},...p}) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label&&<label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans}}>{label}</label>}
    <select {...p} style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:F.sans,color:C.text,background:C.surface,outline:"none",...style}}
      onFocus={e=>e.target.style.borderColor=C.blue} onBlur={e=>e.target.style.borderColor=C.border}>
      {children}
    </select>
  </div>
);

const ProgressBar = ({value,max,color=C.blue,height=6,showLabel=false}) => {
  const pct = Math.min(100,max>0?Math.round((value/max)*100):0);
  return (
    <div>
      {showLabel&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontFamily:F.sans}}>
        <span style={{fontSize:11,color:C.textSub}}>{pct}% used</span>
        <span style={{fontSize:11,color:C.textSub}}>£{value.toLocaleString()} / £{max.toLocaleString()}</span>
      </div>}
      <div style={{height,borderRadius:height/2,background:C.surfaceAlt,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:pct>90?C.red:pct>70?C.amber:color,borderRadius:height/2,transition:"width 0.5s"}}/>
      </div>
    </div>
  );
};

const Table = ({columns,rows,empty="No data",onRowClick}) => (
  <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontFamily:F.sans}}>
      <thead>
        <tr style={{background:C.surfaceAlt,borderBottom:`1px solid ${C.border}`}}>
          {columns.map((col,i)=><th key={i} style={{padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.4px",whiteSpace:"nowrap"}}>{col.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length===0
          ? <tr><td colSpan={columns.length} style={{padding:40,textAlign:"center",color:C.textMuted,fontSize:13}}>
              <div style={{fontSize:28,marginBottom:8}}>📭</div>{empty}
            </td></tr>
          : rows.map((row,i)=>(
            <tr key={i} style={{borderBottom:i<rows.length-1?`1px solid ${C.border}`:"none",cursor:onRowClick?"pointer":"default",transition:"background 0.1s"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.bg}
              onMouseLeave={e=>e.currentTarget.style.background=C.surface}
              onClick={()=>onRowClick&&onRowClick(row)}>
              {columns.map((col,j)=><td key={j} style={{padding:"13px 16px",fontSize:13,color:C.textMid,verticalAlign:"middle"}}>{col.render?col.render(row[col.key],row):row[col.key]}</td>)}
            </tr>
          ))
        }
      </tbody>
    </table>
  </div>
);

const PageHeader = ({title,subtitle,actions,back,onBack}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
    <div>
      {back&&<button onClick={onBack} style={{display:"flex",alignItems:"center",gap:4,background:"none",border:"none",color:C.textSub,cursor:"pointer",fontSize:13,fontFamily:F.sans,marginBottom:8,padding:0}}>← {back}</button>}
      <h1 style={{fontSize:22,fontWeight:700,color:C.text,margin:0,fontFamily:F.sans}}>{title}</h1>
      {subtitle&&<p style={{fontSize:13,color:C.textSub,margin:"4px 0 0",fontFamily:F.sans}}>{subtitle}</p>}
    </div>
    {actions&&<div style={{display:"flex",gap:8,alignItems:"center"}}>{actions}</div>}
  </div>
);

const Tabs = ({tabs,active,onChange}) => (
  <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:24}}>
    {tabs.map(t=>(
      <button key={t.id} onClick={()=>onChange(t.id)} style={{padding:"10px 16px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:active===t.id?600:400,color:active===t.id?C.text:C.textSub,borderBottom:active===t.id?`2px solid ${C.blue}`:"2px solid transparent",fontFamily:F.sans,transition:"all 0.15s",marginBottom:-1}}>
        {t.label}
      </button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode,setMode]   = useState("signin"); // "signin" | "signup"
  const [email,setEmail] = useState("");
  const [pass,setPass]   = useState("");
  const [name,setName]   = useState("");
  const [role,setRole]   = useState("operator");
  const [err,setErr]     = useState("");
  const [loading,setLoading] = useState(false);

  const handle = async () => {
    if(!email.includes("@")){setErr("Enter a valid email address.");return;}
    if(pass.length<6){setErr("Password must be at least 6 characters.");return;}
    setErr("");setLoading(true);
    if(mode==="signin"){
      const {error} = await signIn(email,pass);
      if(error) setErr(error.message);
    } else {
      const {error} = await signUp(email,pass,role,name);
      if(error) setErr(error.message);
      else setErr("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.sans}}>
      <style>{`@import url('${FONT}');*{box-sizing:border-box;margin:0;padding:0;}input,select{outline:none;}`}</style>
      <div style={{width:"100%",maxWidth:380,padding:"0 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32,justifyContent:"center"}}>
          <div style={{width:36,height:36,background:C.blue,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:"#fff"}}>A</div>
          <span style={{fontSize:20,fontWeight:700,color:C.text}}>ADGRID</span>
        </div>
        <Card style={{padding:28}}>
          <h1 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>{mode==="signin"?"Sign in to ADGRID":"Create your account"}</h1>
          <p style={{fontSize:13,color:C.textSub,marginBottom:20}}>Access your network dashboard</p>
          {mode==="signup"&&(
            <div style={{display:"flex",background:C.surfaceAlt,borderRadius:8,padding:3,marginBottom:14,border:`1px solid ${C.border}`}}>
              {[["operator","Operator"],["advertiser","Advertiser"]].map(([v,l])=>(
                <button key={v} onClick={()=>setRole(v)} style={{flex:1,padding:"7px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:F.sans,transition:"all 0.15s",background:role===v?C.surface:"transparent",color:role===v?C.text:C.textSub,boxShadow:role===v?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>{l}</button>
              ))}
            </div>
          )}
          {err&&<div style={{padding:"9px 12px",background:err.includes("Check")?C.greenSoft:C.redSoft,border:`1px solid ${err.includes("Check")?C.greenBorder:C.redBorder}`,borderRadius:8,fontSize:12,color:err.includes("Check")?C.green:C.red,marginBottom:14}}>{err}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
            {mode==="signup"&&<Inp label="Full Name" type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/>}
            <Inp label="Email" type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            <Inp label="Password" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
          </div>
          <Btn onClick={handle} style={{width:"100%",justifyContent:"center"}} size="lg" disabled={loading}>{loading?"Please wait…":mode==="signin"?"Sign in →":"Create account →"}</Btn>
          <div style={{marginTop:14,textAlign:"center",fontSize:12,color:C.textSub}}>
            {mode==="signin"?"Don't have an account? ":"Already have an account? "}
            <span onClick={()=>{setMode(mode==="signin"?"signup":"signin");setErr("");}} style={{color:C.blue,cursor:"pointer",fontWeight:500}}>{mode==="signin"?"Sign up":"Sign in"}</span>
          </div>
          <div style={{marginTop:8,textAlign:"center",fontSize:11,color:C.textMuted}}>Demo: operator@adgrid.io / demo1234</div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

const OP_NAV = [
  {items:[{id:"overview",icon:"▦",label:"Overview"}]},
  {section:"NETWORK",items:[{id:"screens",icon:"◻",label:"Screens"},{id:"campaigns",icon:"▷",label:"Campaigns"}]},
  {section:"PERFORMANCE",items:[{id:"analytics",icon:"↗",label:"Analytics"},{id:"audience",icon:"◎",label:"Audience & Scans"}]},
  {section:"BUSINESS",items:[{id:"revenue",icon:"$",label:"Revenue"},{id:"billing",icon:"◈",label:"Billing & Payouts"},{id:"advertisers",icon:"◉",label:"Advertisers"}]},
  {section:"TOOLS",items:[{id:"signals",icon:"⟡",label:"Live Signals"},{id:"integrations",icon:"⇌",label:"Integrations"},{id:"display",icon:"▣",label:"Display"}]},
];

const ADV_NAV = [
  {items:[{id:"adv-overview",icon:"▦",label:"Overview"}]},
  {section:"CAMPAIGNS",items:[{id:"adv-create",icon:"+",label:"New Campaign"},{id:"adv-campaigns",icon:"▷",label:"My Campaigns"}]},
  {section:"PERFORMANCE",items:[{id:"adv-analytics",icon:"↗",label:"Analytics"},{id:"adv-audience",icon:"◎",label:"Scans & Data"}]},
  {section:"ACCOUNT",items:[{id:"adv-billing",icon:"$",label:"Billing"},{id:"adv-integrations",icon:"⇌",label:"Integrations"},{id:"adv-settings",icon:"⚙",label:"Settings"}]},
];

function Sidebar({nav,active,setActive,user,onSignOut}) {
  return (
    <div style={{width:216,background:C.sidebar,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,flexShrink:0}}>
      <div style={{padding:"18px 16px",borderBottom:`1px solid ${C.sidebarBorder}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,background:C.blue,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:"#fff"}}>A</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:F.sans}}>ADGRID</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:F.sans,letterSpacing:"0.5px"}}>{user?.role?.toUpperCase()}</div>
          </div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
        {nav.map((group,gi)=>(
          <div key={gi} style={{marginBottom:2}}>
            {group.section&&<div style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.25)",letterSpacing:"1px",padding:"12px 8px 4px",fontFamily:F.sans}}>{group.section}</div>}
            {group.items.map(item=>{
              const on = active===item.id;
              return (
                <button key={item.id} onClick={()=>setActive(item.id)}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:F.sans,fontSize:13,fontWeight:on?500:400,color:on?"#fff":"rgba(255,255,255,0.5)",background:on?"rgba(255,255,255,0.09)":"transparent",transition:"all 0.12s",textAlign:"left",marginBottom:1}}
                  onMouseEnter={e=>{if(!on){e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}}
                  onMouseLeave={e=>{if(!on){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}}
                >
                  <span style={{fontSize:13,width:16,textAlign:"center",flexShrink:0,opacity:on?1:0.7}}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{padding:"10px 8px",borderTop:`1px solid ${C.sidebarBorder}`}}>
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px"}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>
            {(user?.name||"U")[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.75)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:F.sans}}>{user?.name}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:F.sans}}>{user?.email}</div>
          </div>
          <button onClick={onSignOut} style={{background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:14,padding:2,lineHeight:1}} title="Sign out">⏻</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR VIEWS
// ─────────────────────────────────────────────────────────────────────────────

function OperatorOverview({campaigns,setNav}) {
  const totalRev   = SCREENS.reduce((a,s)=>a+s.revenue,0);
  const totalImpr  = SCREENS.reduce((a,s)=>a+s.impressions,0);
  const active     = campaigns.filter(c=>c.status==="active");
  const totalScans = campaigns.reduce((a,c)=>a+c.scans,0);
  const totalSpend = campaigns.reduce((a,c)=>a+c.budget,0);
  const totalSpent = campaigns.reduce((a,c)=>a+c.spent,0);

  return (
    <div>
      <PageHeader title="Overview"
        subtitle={new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        actions={<Btn icon="+" onClick={()=>setNav("campaigns")}>New Campaign</Btn>}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:28}}>
        <KPI label="Network Revenue"   value={`£${totalRev.toLocaleString()}`}    sub="this month"           trend={12}  icon="💰"/>
        <KPI label="Live Screens"      value={SCREENS.filter(s=>s.status==="live").length} sub={`of ${SCREENS.length} registered`}  icon="📺"/>
        <KPI label="Active Campaigns"  value={active.length}                       sub="running now"          icon="▶"/>
        <KPI label="Impressions"       value={`${(totalImpr/1000).toFixed(0)}K`}  sub="this month" trend={8} color={C.blue} icon="👁"/>
        <KPI label="QR Scans"          value={totalScans}                          sub="consented leads"      color={C.green} icon="📲"/>
      </div>

      {/* Budget overview strip */}
      <Card style={{marginBottom:20,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans}}>Network Budget Utilisation</div>
          <div style={{fontSize:13,color:C.textSub,fontFamily:F.sans}}>£{totalSpent.toLocaleString()} spent of £{totalSpend.toLocaleString()} booked</div>
        </div>
        <ProgressBar value={totalSpent} max={totalSpend} showLabel={false} height={8}/>
        <div style={{display:"flex",gap:24,marginTop:12}}>
          {[["Total Booked",`£${totalSpend.toLocaleString()}`],["Spent to Date",`£${totalSpent.toLocaleString()}`],["Remaining",`£${(totalSpend-totalSpent).toLocaleString()}`],["Avg CPM","£4.42"]].map(([l,v])=>(
            <div key={l}><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans,marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans}}>{v}</div></div>
          ))}
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20}}>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h2 style={{fontSize:15,fontWeight:600,color:C.text,fontFamily:F.sans}}>Active Campaigns</h2>
            <Btn variant="ghost" size="sm" onClick={()=>setNav("campaigns")}>View all →</Btn>
          </div>
          <Table
            columns={[
              {key:"advertiser",label:"Advertiser",render:(v,r)=><div><div style={{fontWeight:500,color:C.text,fontFamily:F.sans}}>{v}</div><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{r.screen} · {r.city}</div></div>},
              {key:"spent",label:"Budget",render:(v,r)=><div><div style={{fontFamily:F.sans,fontSize:13,fontWeight:500}}>£{v.toLocaleString()} <span style={{color:C.textMuted,fontWeight:400}}>/ £{r.budget.toLocaleString()}</span></div><ProgressBar value={v} max={r.budget} height={3} style={{marginTop:4}}/></div>},
              {key:"impressions",label:"Impressions",render:v=><span style={{fontFamily:F.sans}}>{(v/1000).toFixed(1)}K</span>},
              {key:"scans",label:"Scans",render:v=><span style={{color:C.blue,fontWeight:600,fontFamily:F.sans}}>{v}</span>},
              {key:"end",label:"Ends",render:v=><span style={{fontFamily:F.mono,fontSize:11,color:C.textSub}}>{v}</span>},
              {key:"status",label:"",render:v=><Badge status={v}/>},
            ]}
            rows={active}/>
        </div>
        <div>
          <h2 style={{fontSize:15,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Screen Health</h2>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {SCREENS.filter(s=>s.status==="live").slice(0,5).map(s=>(
              <Card key={s.id} style={{padding:"13px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:C.text,fontFamily:F.sans}}>{s.name}</div>
                    <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{s.city}</div>
                  </div>
                  <Badge status={s.status}/>
                </div>
                <div style={{display:"flex",gap:16}}>
                  {[["Revenue",`£${s.revenue.toLocaleString()}`],["Impr.",`${(s.impressions/1000).toFixed(0)}K`],["Campaigns",s.campaigns]].map(([l,v])=>(
                    <div key={l}><div style={{fontSize:10,color:C.textMuted,fontFamily:F.sans}}>{l}</div><div style={{fontSize:12,fontWeight:600,color:C.text,fontFamily:F.sans}}>{v}</div></div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignRow({c,onClick}) {
  const pct = c.budget>0?Math.round((c.spent/c.budget)*100):0;
  return (
    <tr style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer",transition:"background 0.1s"}}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
      onMouseLeave={e=>e.currentTarget.style.background=C.surface}
      onClick={onClick}>
      <td style={{padding:"13px 16px",verticalAlign:"middle"}}>
        <div style={{fontWeight:500,color:C.text,fontFamily:F.sans}}>{c.advertiser}</div>
        <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{c.category}</div>
      </td>
      <td style={{padding:"13px 16px",verticalAlign:"middle"}}>
        <div style={{fontSize:13,color:C.textMid,fontFamily:F.sans}}>{c.screen}</div>
        <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{c.city}</div>
      </td>
      <td style={{padding:"13px 16px",verticalAlign:"middle",minWidth:160}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:12,fontWeight:600,color:C.text,fontFamily:F.sans}}>£{c.spent.toLocaleString()}</span>
          <span style={{fontSize:12,color:C.textMuted,fontFamily:F.sans}}>£{c.budget.toLocaleString()}</span>
        </div>
        <ProgressBar value={c.spent} max={c.budget} height={4}/>
        <div style={{fontSize:10,color:pct>90?C.red:pct>70?C.amber:C.textMuted,fontFamily:F.sans,marginTop:3}}>{pct}% used</div>
      </td>
      <td style={{padding:"13px 16px",verticalAlign:"middle",fontFamily:F.sans,fontSize:13}}>{(c.impressions/1000).toFixed(1)}K</td>
      <td style={{padding:"13px 16px",verticalAlign:"middle"}}><span style={{color:C.blue,fontWeight:600,fontFamily:F.sans}}>{c.scans}</span></td>
      <td style={{padding:"13px 16px",verticalAlign:"middle",fontFamily:F.mono,fontSize:11,color:C.textSub}}>{c.start} → {c.end}</td>
      <td style={{padding:"13px 16px",verticalAlign:"middle"}}><Badge status={c.status}/></td>
    </tr>
  );
}

function OperatorCampaigns({campaigns,setCampaigns,setDetail}) {
  const [filter,setFilter] = useState("all");
  const [city,  setCity]   = useState("All");
  const [showNew,setShowNew] = useState(false);

  const cities = ["All",...new Set(campaigns.map(c=>c.city))];
  const shown  = campaigns
    .filter(c=>filter==="all"||c.status===filter)
    .filter(c=>city==="All"||c.city===city);

  return (
    <div>
      {showNew && <NewCampaignModal onClose={()=>setShowNew(false)} onSave={c=>{setCampaigns(prev=>[...prev,c]);setShowNew(false);}}/>}
      <PageHeader title="Campaigns"
        subtitle={`${campaigns.filter(c=>c.status==="active").length} active · ${campaigns.filter(c=>c.status==="scheduled").length} scheduled · ${campaigns.filter(c=>c.status==="paused").length} paused`}
        actions={<><Btn variant="secondary" icon="↓" size="sm">Export CSV</Btn><Btn icon="+" onClick={()=>setShowNew(true)}>New Campaign</Btn></>}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Total Campaigns"  value={campaigns.length}/>
        <KPI label="Active Now"       value={campaigns.filter(c=>c.status==="active").length}  color={C.green}/>
        <KPI label="Total Booked"     value={`£${campaigns.reduce((a,c)=>a+c.budget,0).toLocaleString()}`}/>
        <KPI label="Total Scans"      value={campaigns.reduce((a,c)=>a+c.scans,0)} color={C.blue}/>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:4}}>
          {[["all","All"],["active","Active"],["scheduled","Scheduled"],["paused","Paused"],["completed","Completed"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${filter===v?C.blue:C.border}`,background:filter===v?C.blueSoft:C.surface,color:filter===v?C.blue:C.textSub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:F.sans,transition:"all 0.15s"}}>{l}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto"}}>
          <select value={city} onChange={e=>setCity(e.target.value)} style={{padding:"6px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:F.sans,color:C.textMid,background:C.surface,outline:"none"}}>
            {cities.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:F.sans}}>
          <thead>
            <tr style={{background:C.surfaceAlt,borderBottom:`1px solid ${C.border}`}}>
              {["Advertiser","Screen","Budget & Spend","Impressions","Scans","Dates","Status"].map(h=>(
                <th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.4px",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length===0
              ? <tr><td colSpan={7} style={{padding:40,textAlign:"center",color:C.textMuted,fontSize:13}}><div style={{fontSize:28,marginBottom:8}}>📭</div>No campaigns match this filter</td></tr>
              : shown.map((c,i)=><CampaignRow key={c.id} c={c} onClick={()=>setDetail(c)}/>)
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignDetail({campaign,onBack,onUpdate}) {
  const [tab,setTab] = useState("overview");
  const c = campaign;
  const pct = c.budget>0?Math.round((c.spent/c.budget)*100):0;
  const daysLeft = Math.max(0,Math.round((new Date(c.end)-new Date())/(1000*60*60*24)));
  const cpm = c.impressions>0?((c.spent/c.impressions)*1000).toFixed(2):c.cpm?.toFixed(2)||"4.20";
  const scanRate = c.impressions>0?((c.scans/c.impressions)*100).toFixed(2):"0.00";

  const hourly = Array.from({length:24},(_,h)=>{
    const p={7:78,8:92,9:80,12:84,13:82,17:86,18:90,19:72};
    return {h,v:(p[h]??Math.max(8,45-Math.abs(h-13)*4))*(c.impressions/2400)||0};
  });
  const maxH = Math.max(...hourly.map(d=>d.v),1);

  const statusAction = (s) => {
    if(s==="active") return <Btn variant="danger" size="sm" onClick={()=>onUpdate({...c,status:"paused"})}>⏸ Pause</Btn>;
    if(s==="paused") return <Btn variant="success" size="sm" onClick={()=>onUpdate({...c,status:"active"})}>▶ Resume</Btn>;
    return null;
  };

  return (
    <div>
      <PageHeader
        title={c.advertiser}
        subtitle={`${c.screen} · ${c.city} · ${c.category}`}
        back="All Campaigns" onBack={onBack}
        actions={<>{statusAction(c.status)}<Btn variant="secondary" size="sm">✏ Edit</Btn></>}/>

      {/* Status + key metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Budget Spent"    value={`£${c.spent.toLocaleString()}`}       sub={`of £${c.budget.toLocaleString()} (${pct}%)`} color={pct>90?C.red:pct>70?C.amber:C.text}/>
        <KPI label="Impressions"     value={`${(c.impressions/1000).toFixed(1)}K`} sub="verified plays"/>
        <KPI label="QR Scans"        value={c.scans}                               sub="total scans" color={C.blue}/>
        <KPI label="Scan Rate"       value={`${scanRate}%`}                        sub="scans per impression"/>
        <KPI label="Days Remaining"  value={daysLeft}                              sub={`ends ${c.end}`} color={daysLeft<7?C.amber:C.text}/>
      </div>

      {/* Budget progress */}
      <Card style={{marginBottom:20,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans}}>Budget Utilisation</div>
          <Badge status={c.status}/>
        </div>
        <ProgressBar value={c.spent} max={c.budget} showLabel height={10}/>
        <div style={{display:"flex",gap:28,marginTop:14}}>
          {[["CPM",`£${cpm}`],["Slot Share",c.slots+"%"],["Ad Duration",c.duration+"s"],["Schedule",`${c.timeStart}–${c.timeEnd}`],["Days",(c.days||[]).join(", ")]].map(([l,v])=>(
            <div key={l}><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans,marginBottom:2}}>{l}</div><div style={{fontSize:13,fontWeight:500,color:C.text,fontFamily:F.sans}}>{v}</div></div>
          ))}
        </div>
      </Card>

      <Tabs tabs={[{id:"overview",label:"Performance"},{id:"creative",label:"Creative"},{id:"settings",label:"Settings"}]} active={tab} onChange={setTab}/>

      {tab==="overview" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Impressions by Hour</div>
            <div style={{display:"flex",gap:2,alignItems:"flex-end",height:80,marginBottom:8}}>
              {hourly.map(({h,v})=>(
                <div key={h} title={`${String(h).padStart(2,"0")}:00`} style={{flex:1,borderRadius:"3px 3px 0 0",background:h===new Date().getHours()?C.blue:v/maxH>0.7?"#bfdbfe":"#e5e7eb",height:`${Math.max(3,(v/maxH)*80)}px`,transition:"height 0.3s"}}/>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.textMuted,fontFamily:F.mono}}>
              {["00:00","06:00","12:00","18:00","23:00"].map(t=><span key={t}>{t}</span>)}
            </div>
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Campaign Summary</div>
            {[["Advertiser",c.advertiser],["Screen",c.screen],["City",c.city],["Category",c.category],["Campaign ID",c.id],["Start Date",c.start],["End Date",c.end],["Destination",c.destination||"—"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontFamily:F.sans}}>
                <span style={{fontSize:12,color:C.textSub}}>{l}</span>
                <span style={{fontSize:12,fontWeight:500,color:C.text,maxWidth:200,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab==="creative" && (
        <Card>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Ad Creative</div>
          <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:24,alignItems:"start"}}>
            {/* Mini preview */}
            <div style={{borderRadius:10,overflow:"hidden",aspectRatio:"16/9",position:"relative",background:"linear-gradient(145deg,#1a0800,#3d1800,#7a3200)"}}>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.85),rgba(0,0,0,0.1))"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"12px 14px"}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:"#fff",lineHeight:1.1,marginBottom:4}}>{c.headline}</div>
                <div style={{display:"inline-block",padding:"3px 10px",border:`1px solid ${c.color||"#fff"}`,color:c.color||"#fff",fontSize:8,borderRadius:2}}>{c.cta||"Learn More →"}</div>
              </div>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`${c.color||"#f59e0b"}`}}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[["Headline",c.headline],["Category",c.category],["Accent Colour",c.color||"—"],["QR Destination",c.destination||"—"]].map(([l,v])=>(
                <div key={l}>
                  <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:13,color:C.text,fontFamily:l==="Accent Colour"?F.mono:F.sans,fontWeight:500,display:"flex",alignItems:"center",gap:8}}>
                    {l==="Accent Colour"&&<div style={{width:16,height:16,borderRadius:4,background:v,border:`1px solid ${C.border}`,flexShrink:0}}/>}
                    {v}
                  </div>
                </div>
              ))}
              <Btn variant="secondary" size="sm" style={{alignSelf:"flex-start"}}>✏ Edit Creative</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab==="settings" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Schedule</div>
            {[["Days",(c.days||[]).join(", ")],["Time Window",`${c.timeStart} – ${c.timeEnd}`],["Ad Duration",c.duration+"s per play"],["Slot Share",c.slots+"% of airtime"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`,fontFamily:F.sans}}>
                <span style={{fontSize:13,color:C.textSub}}>{l}</span>
                <span style={{fontSize:13,fontWeight:500,color:C.text}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Danger Zone</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Btn variant="danger" onClick={()=>onUpdate({...c,status:c.status==="paused"?"active":"paused"})}>
                {c.status==="paused"?"▶ Resume Campaign":"⏸ Pause Campaign"}
              </Btn>
              <Btn variant="danger" onClick={()=>onUpdate({...c,status:"completed"})}>✕ Cancel Campaign</Btn>
            </div>
            <div style={{marginTop:12,fontSize:11,color:C.textMuted,fontFamily:F.sans,lineHeight:1.6}}>Cancelling a campaign stops it immediately. Unused budget will be reviewed for refund per your agreement.</div>
          </Card>
        </div>
      )}
    </div>
  );
}

function OperatorAnalytics({campaigns}) {
  const totalImpr  = campaigns.reduce((a,c)=>a+c.impressions,0);
  const totalScans = campaigns.reduce((a,c)=>a+c.scans,0);
  const totalSpend = campaigns.filter(c=>c.status==="active").reduce((a,c)=>a+c.budget,0);
  const avgCPM     = totalImpr>0?((totalSpend/totalImpr)*1000).toFixed(2):"4.20";
  const hourly     = Array.from({length:24},(_,h)=>{const p={7:78,8:92,9:80,12:84,13:82,17:86,18:90,19:72};return {h,pct:p[h]??Math.max(8,45-Math.abs(h-13)*4)};});

  const byCity = [...new Set(campaigns.map(c=>c.city))].map(city=>{
    const cc = campaigns.filter(c=>c.city===city);
    return {city,impr:cc.reduce((a,c)=>a+c.impressions,0),scans:cc.reduce((a,c)=>a+c.scans,0),spend:cc.reduce((a,c)=>a+c.budget,0),count:cc.length};
  });
  const maxImpr = Math.max(...byCity.map(c=>c.impr),1);

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Impression tracking, scan rates, and campaign performance"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        <KPI label="Total Impressions" value={`${(totalImpr/1000).toFixed(1)}K`} sub="verified"       trend={8} icon="👁"/>
        <KPI label="Avg CPM"           value={`£${avgCPM}`}                       sub="cost per 1,000" color={C.blue} icon="💲"/>
        <KPI label="QR Scans"          value={totalScans}                          sub="total scans"    color={C.green} icon="📲"/>
        <KPI label="Scan Rate"         value={`${totalImpr>0?((totalScans/totalImpr)*100).toFixed(2):"0.00"}%`} sub="scans / impressions" icon="📊"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <Card>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Impression Volume — 24h Pattern</div>
          <div style={{display:"flex",gap:3,alignItems:"flex-end",height:80,marginBottom:8}}>
            {hourly.map(({h,pct})=>(
              <div key={h} style={{flex:1,borderRadius:"3px 3px 0 0",background:h===new Date().getHours()?C.blue:pct>70?"#bfdbfe":"#e5e7eb",height:`${Math.max(4,(pct/92)*80)}px`,transition:"height 0.3s"}}
                title={`${String(h).padStart(2,"0")}:00 — ${pct}% footfall`}/>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.textMuted,fontFamily:F.mono}}>
            {["00:00","06:00","12:00","18:00","23:00"].map(t=><span key={t}>{t}</span>)}
          </div>
          <div style={{marginTop:12,fontSize:11,color:C.textMuted,fontFamily:F.sans}}>Blue bar = current hour · Ads only play when people are present</div>
        </Card>

        <Card>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Impressions by City</div>
          {byCity.map(({city,impr,scans,spend})=>(
            <div key={city} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,fontWeight:500,color:C.text,fontFamily:F.sans}}>{city}</span>
                <span style={{fontSize:12,color:C.textSub,fontFamily:F.sans}}>{(impr/1000).toFixed(0)}K impr · {scans} scans</span>
              </div>
              <ProgressBar value={impr} max={maxImpr} height={5}/>
            </div>
          ))}
        </Card>
      </div>

      <Table
        columns={[
          {key:"advertiser",label:"Campaign",render:(v,r)=><div><div style={{fontWeight:500,color:C.text,fontFamily:F.sans}}>{v}</div><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{r.category} · {r.city}</div></div>},
          {key:"screen",    label:"Screen"},
          {key:"impressions",label:"Impressions",render:v=><span style={{fontWeight:600,fontFamily:F.sans}}>{(v/1000).toFixed(1)}K</span>},
          {key:"scans",     label:"Scans",render:v=><span style={{color:C.blue,fontWeight:600,fontFamily:F.sans}}>{v}</span>},
          {key:"scans",     label:"Scan Rate",render:(v,r)=><span style={{fontFamily:F.sans}}>{r.impressions>0?((v/r.impressions)*100).toFixed(2):"0.00"}%</span>},
          {key:"spent",     label:"Spend",render:v=><span style={{fontFamily:F.sans}}>£{v.toLocaleString()}</span>},
          {key:"budget",    label:"CPM",render:(v,r)=><span style={{fontFamily:F.sans}}>£{r.impressions>0?(r.spent/r.impressions*1000).toFixed(2):"4.20"}</span>},
          {key:"status",    label:"Status",render:v=><Badge status={v}/>},
        ]}
        rows={campaigns}/>
    </div>
  );
}

function OperatorRevenue({campaigns}) {
  const total    = campaigns.reduce((a,c)=>a+c.budget,0);
  const platform = Math.round(total*0.12);
  const owners   = Math.round(total*0.88*0.40);
  const network  = total-platform-owners;
  const cities   = [...new Set(campaigns.map(c=>c.city))];
  const maxRev   = Math.max(...cities.map(city=>campaigns.filter(c=>c.city===city).reduce((a,c)=>a+c.budget,0)),1);

  return (
    <div>
      <PageHeader title="Revenue" subtitle="Platform earnings, owner payouts, and network splits"
        actions={<Btn variant="secondary" icon="↓">Export Report</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        <KPI label="Total Ad Spend"   value={`£${total.toLocaleString()}`}    sub="from advertisers"  trend={14} icon="💰"/>
        <KPI label="Platform Revenue" value={`£${platform.toLocaleString()}`} sub="12% fee"            color={C.blue} icon="$"/>
        <KPI label="Owner Payouts"    value={`£${owners.toLocaleString()}`}   sub="40% of net"         color={C.green} icon="🏦"/>
        <KPI label="Network Pool"     value={`£${network.toLocaleString()}`}  sub="reinvestment"       icon="♻"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <Card>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Revenue Split</div>
          <div style={{height:8,borderRadius:4,overflow:"hidden",display:"flex",marginBottom:16}}>
            <div style={{width:"12%",background:C.blue}}/><div style={{width:"35%",background:C.green}}/><div style={{flex:1,background:C.surfaceAlt}}/>
          </div>
          {[["Platform Fee (12%)",`£${platform.toLocaleString()}`,C.blue],["Screen Owners (40%)",`£${owners.toLocaleString()}`,C.green],["Network Pool (48%)",`£${network.toLocaleString()}`,C.textSub]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${C.border}`,fontFamily:F.sans}}>
              <span style={{fontSize:13,color:C.textMid}}>{l}</span>
              <span style={{fontSize:14,fontWeight:700,color:c}}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>By City</div>
          {cities.map(city=>{
            const rev = campaigns.filter(c=>c.city===city).reduce((a,c)=>a+c.budget,0);
            return (
              <div key={city} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontFamily:F.sans}}>
                  <span style={{fontSize:13,fontWeight:500,color:C.text}}>{city}</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.text}}>£{rev.toLocaleString()}</span>
                </div>
                <ProgressBar value={rev} max={maxRev} height={5}/>
              </div>
            );
          })}
        </Card>
      </div>
      <Table
        columns={[
          {key:"advertiser",label:"Campaign",render:(v,r)=><div><div style={{fontWeight:500,color:C.text,fontFamily:F.sans}}>{v}</div><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{r.city}</div></div>},
          {key:"screen",    label:"Screen"},
          {key:"budget",    label:"Gross",  render:v=><span style={{fontWeight:600,fontFamily:F.sans}}>£{v.toLocaleString()}</span>},
          {key:"budget",    label:"Platform (12%)", render:v=><span style={{color:C.blue,fontFamily:F.sans}}>£{Math.round(v*0.12).toLocaleString()}</span>},
          {key:"budget",    label:"Owner (40%)",    render:v=><span style={{color:C.green,fontFamily:F.sans}}>£{Math.round(v*0.88*0.40).toLocaleString()}</span>},
          {key:"budget",    label:"Network",        render:v=><span style={{fontFamily:F.sans}}>£{Math.round(v*0.88*0.60).toLocaleString()}</span>},
          {key:"status",    label:"Status", render:v=><Badge status={v}/>},
        ]}
        rows={campaigns}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW CAMPAIGN MODAL
// ─────────────────────────────────────────────────────────────────────────────

function NewCampaignModal({onClose,onSave}) {
  const [step,setStep]         = useState(1);
  const [form,setForm]         = useState({
    advertiser:"", category:"Food & Beverage", screenId:"SCR-008",
    start:"", end:"", days:["Mon","Tue","Wed","Thu","Fri"],
    timeStart:"07:00", timeEnd:"20:00", slots:10, duration:10,
    budget:500, headline:"", cta:"Learn More →", color:"#f59e0b", destination:""
  });
  const [errors,setErrors]     = useState({});

  const screen = SCREENS.find(s=>s.id===form.screenId);
  const days   = form.start&&form.end?Math.max(1,Math.round((new Date(form.end)-new Date(form.start))/(1000*60*60*24))):30;
  const estImpr = screen?Math.round((screen.impressions*(form.slots/100)/30)*days):0;

  const validate = () => {
    const e = {};
    if(!form.advertiser.trim()) e.advertiser="Required";
    if(!form.start) e.start="Required";
    if(!form.end)   e.end="Required";
    if(!form.destination.includes(".")) e.destination="Enter a valid URL";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSave = () => {
    if(!validate()) return;
    onSave({
      id:`BK-${String(Date.now()).slice(-4)}`,
      ...form,
      screen: screen?.name||"",
      city: screen?.city||"",
      spent: 0, impressions: 0, scans: 0,
      status: "scheduled",
    });
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(2px)"}}>
      <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:620,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,0.15)"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:C.text,fontFamily:F.sans}}>New Campaign</div>
            <div style={{fontSize:12,color:C.textSub,fontFamily:F.sans,marginTop:2}}>Step {step} of 3 — {["Campaign Details","Schedule & Budget","Creative"][step-1]}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:C.textMuted,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        {/* Step indicators */}
        <div style={{display:"flex",padding:"14px 24px",gap:0,borderBottom:`1px solid ${C.border}`}}>
          {["Details","Schedule","Creative"].map((l,i)=>{
            const n=i+1,done=n<step,active=n===step;
            return (
              <div key={l} style={{display:"flex",alignItems:"center",flex:i<2?1:"auto"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,fontFamily:F.sans,background:done?C.green:active?C.blue:C.surfaceAlt,color:done||active?"#fff":C.textMuted,border:`2px solid ${done?C.green:active?C.blue:C.border}`}}>
                    {done?"✓":n}
                  </div>
                  <span style={{fontSize:12,fontWeight:active?600:400,color:active?C.text:C.textMuted,fontFamily:F.sans}}>{l}</span>
                </div>
                {i<2&&<div style={{flex:1,height:1,background:done?C.green:C.border,margin:"0 12px"}}/>}
              </div>
            );
          })}
        </div>

        <div style={{padding:24}}>
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Inp label="Advertiser / Brand Name" placeholder="e.g. Tim Hortons" value={form.advertiser} onChange={e=>setForm(f=>({...f,advertiser:e.target.value}))} error={errors.advertiser}/>
              <SelInput label="Ad Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </SelInput>
              <SelInput label="Screen" value={form.screenId} onChange={e=>setForm(f=>({...f,screenId:e.target.value}))}>
                {SCREENS.filter(s=>s.status==="live").map(s=><option key={s.id} value={s.id}>{s.name} — {s.city} (£{s.cpm} CPM · {(s.impressions/1000).toFixed(0)}K impr/mo)</option>)}
              </SelInput>
              {screen&&(
                <div style={{padding:"12px 14px",background:C.blueSoft,borderRadius:8,border:`1px solid ${C.blueBorder}`,fontFamily:F.sans}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.blue,marginBottom:4}}>{screen.name}</div>
                  <div style={{fontSize:12,color:C.textSub}}>{screen.neighbourhood} · {screen.city} · £{screen.cpm.toFixed(2)} CPM · {(screen.impressions/1000).toFixed(0)}K impressions/month</div>
                </div>
              )}
            </div>
          )}

          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Inp label="Start Date" type="date" value={form.start} onChange={e=>setForm(f=>({...f,start:e.target.value}))} error={errors.start} style={{colorScheme:"light"}} min={new Date().toISOString().split("T")[0]}/>
                <Inp label="End Date" type="date" value={form.end} onChange={e=>setForm(f=>({...f,end:e.target.value}))} error={errors.end} style={{colorScheme:"light"}} min={form.start||new Date().toISOString().split("T")[0]}/>
              </div>
              <div>
                <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Days of Week</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {DAYS.map(d=>{const on=(form.days||[]).includes(d);return(
                    <button key={d} onClick={()=>setForm(f=>({...f,days:on?f.days.filter(x=>x!==d):[...f.days,d]}))}
                      style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${on?C.blue:C.border}`,background:on?C.blueSoft:C.surface,color:on?C.blue:C.textSub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:F.sans}}>
                      {d}
                    </button>
                  );})}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <SelInput label="Start Time" value={form.timeStart} onChange={e=>setForm(f=>({...f,timeStart:e.target.value}))}>
                  {HOURS.map(h=><option key={h}>{h}</option>)}
                </SelInput>
                <SelInput label="End Time" value={form.timeEnd} onChange={e=>setForm(f=>({...f,timeEnd:e.target.value}))}>
                  {HOURS.map(h=><option key={h}>{h}</option>)}
                </SelInput>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Slot Share — {form.slots}%</label>
                  <input type="range" min={1} max={screen?100-screen.ownSlots:80} value={form.slots} onChange={e=>setForm(f=>({...f,slots:parseInt(e.target.value)}))} style={{width:"100%",accentColor:C.blue}}/>
                  <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans,marginTop:2}}>Max {screen?100-screen.ownSlots:80}% available</div>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Ad Duration — {form.duration}s</label>
                  <input type="range" min={5} max={screen?.maxDuration||30} value={form.duration} onChange={e=>setForm(f=>({...f,duration:parseInt(e.target.value)}))} style={{width:"100%",accentColor:C.blue}}/>
                  <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans,marginTop:2}}>Max {screen?.maxDuration||30}s on this screen</div>
                </div>
              </div>
              <Inp label="Campaign Budget (£)" type="number" min={100} value={form.budget} onChange={e=>setForm(f=>({...f,budget:parseInt(e.target.value)||0}))} hint={`Est. ${estImpr.toLocaleString()} impressions over ${days} days at £${screen?.cpm||4.20} CPM`}/>
              {/* Budget breakdown */}
              <div style={{padding:"12px 14px",background:C.surfaceAlt,borderRadius:8,border:`1px solid ${C.border}`,fontFamily:F.sans}}>
                <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Cost Breakdown</div>
                {[["Platform fee (12%)",`£${Math.round(form.budget*0.12).toLocaleString()}`],["Screen owner (40%)",`£${Math.round(form.budget*0.88*0.40).toLocaleString()}`],["Network pool (48%)",`£${Math.round(form.budget*0.88*0.60).toLocaleString()}`]].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.textSub,marginBottom:4}}>
                    <span>{l}</span><span style={{fontWeight:500,color:C.textMid}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Inp label="Headline" placeholder="e.g. Start Your Morning Right" value={form.headline} onChange={e=>setForm(f=>({...f,headline:e.target.value}))}/>
              <Inp label="Call to Action" placeholder="e.g. Order Now →" value={form.cta} onChange={e=>setForm(f=>({...f,cta:e.target.value}))}/>
              <Inp label="QR Code Destination URL" placeholder="https://yoursite.com/offer" value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))} error={errors.destination} hint="Where people land after scanning the QR code on your ad"/>
              <div>
                <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Accent Colour</label>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {["#f59e0b","#2563eb","#16a34a","#dc2626","#7c3aed","#0891b2","#ffffff","#111827"].map(col=>(
                    <div key={col} onClick={()=>setForm(f=>({...f,color:col}))}
                      style={{width:28,height:28,borderRadius:"50%",background:col,cursor:"pointer",border:`3px solid ${form.color===col?C.blue:"transparent"}`,outline:`1px solid ${C.border}`,transition:"border 0.15s"}}/>
                  ))}
                  <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,cursor:"pointer",padding:2}}/>
                </div>
              </div>
              {/* Mini preview */}
              <div>
                <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Ad Preview</label>
                <div style={{borderRadius:10,overflow:"hidden",aspectRatio:"16/9",position:"relative",background:"linear-gradient(145deg,#050a10,#0a1520,#101a28)"}}>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.88),rgba(0,0,0,0.1))"}}/>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"14px 18px"}}>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",letterSpacing:"2px",textTransform:"uppercase",marginBottom:5,fontFamily:F.sans}}>{form.category}</div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:"#fff",lineHeight:1.1,marginBottom:8}}>{form.headline||"Your Headline"}</div>
                    <div style={{display:"inline-block",padding:"4px 12px",border:`1.5px solid ${form.color}`,color:form.color,fontSize:9,borderRadius:2,fontFamily:F.sans}}>{form.cta}</div>
                  </div>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:form.color}}/>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"16px 24px",borderTop:`1px solid ${C.border}`,background:C.surfaceAlt}}>
          <Btn variant="secondary" onClick={step===1?onClose:()=>setStep(s=>s-1)}>{step===1?"Cancel":"← Back"}</Btn>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {step<3
              ? <Btn onClick={()=>setStep(s=>s+1)} disabled={step===1&&!form.advertiser}>Next →</Btn>
              : <Btn onClick={handleSave} variant="stripe">🚀 Launch Campaign</Btn>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVERTISER VIEWS
// ─────────────────────────────────────────────────────────────────────────────

function AdvOverview({user,campaigns,setAdvNav}) {
  const myCampaigns = campaigns.filter(c=>c.advertiser.toLowerCase().includes((user?.name||"").toLowerCase())).slice(0,3);
  const totalSpend  = myCampaigns.reduce((a,c)=>a+c.budget,0);
  const totalSpent  = myCampaigns.reduce((a,c)=>a+c.spent,0);
  const totalImpr   = myCampaigns.reduce((a,c)=>a+c.impressions,0);
  const totalScans  = myCampaigns.reduce((a,c)=>a+c.scans,0);

  return (
    <div>
      <PageHeader title={`Welcome back${user?.name?", "+user.name:""}`}
        subtitle="Your campaign performance at a glance"
        actions={<Btn icon="+" onClick={()=>setAdvNav("adv-create")}>New Campaign</Btn>}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        <KPI label="Total Budget"    value={`£${totalSpend.toLocaleString()}`}         sub="across all campaigns"/>
        <KPI label="Spent to Date"   value={`£${totalSpent.toLocaleString()}`}          sub={`${totalSpend>0?Math.round((totalSpent/totalSpend)*100):0}% of budget`} color={C.blue}/>
        <KPI label="Impressions"     value={`${(totalImpr/1000).toFixed(1)}K`}          sub="verified plays" color={C.blue}/>
        <KPI label="QR Scans"        value={totalScans}                                  sub="leads captured" color={C.green}/>
      </div>

      {myCampaigns.length>0?(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h2 style={{fontSize:15,fontWeight:600,color:C.text,fontFamily:F.sans}}>Your Campaigns</h2>
            <Btn variant="ghost" size="sm" onClick={()=>setAdvNav("adv-campaigns")}>View all →</Btn>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {myCampaigns.map(c=>(
              <Card key={c.id} style={{padding:"16px 20px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 200px 120px 100px auto",gap:16,alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:2}}>{c.screen}</div>
                    <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{c.city} · {c.category} · {c.start} → {c.end}</div>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,color:C.textSub,fontFamily:F.sans}}>Spend</span>
                      <span style={{fontSize:11,fontWeight:500,color:C.text,fontFamily:F.sans}}>£{c.spent.toLocaleString()} / £{c.budget.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={c.spent} max={c.budget} height={4}/>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:F.sans}}>{(c.impressions/1000).toFixed(1)}K</div>
                    <div style={{fontSize:10,color:C.textMuted,fontFamily:F.sans}}>impressions</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:C.blue,fontFamily:F.sans}}>{c.scans}</div>
                    <div style={{fontSize:10,color:C.textMuted,fontFamily:F.sans}}>scans</div>
                  </div>
                  <Badge status={c.status}/>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ):(
        <Card style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:32,marginBottom:12}}>📺</div>
          <div style={{fontSize:16,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:6}}>No campaigns yet</div>
          <div style={{fontSize:13,color:C.textSub,fontFamily:F.sans,marginBottom:20}}>Launch your first campaign on the ADGRID network in under 10 minutes.</div>
          <Btn onClick={()=>setAdvNav("adv-create")}>Create your first campaign →</Btn>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREENS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function ScreensView() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newScreen, setNewScreen] = useState({name:"",owner:"",type:"Business",city:"Toronto",location:"",status:"pending"});

  const cities = ["All",...new Set(SCREENS.map(s=>s.city))];
  const shown  = filter==="All" ? SCREENS : SCREENS.filter(s=>s.city===filter);

  const BLOCKED_OPTS = ["Alcohol","Gambling","Political","Adult Content","Competitors"];

  if (selected) return (
    <div>
      <PageHeader title={selected.name} subtitle={`${selected.neighbourhood} · ${selected.city} · ${selected.owner}`}
        back="All Screens" onBack={()=>setSelected(null)}
        actions={<><Badge status={selected.status}/><Btn variant="secondary" size="sm">✏ Edit</Btn></>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Monthly Revenue"  value={`£${selected.revenue.toLocaleString()}`} sub="owner earns 40%" color={C.green}/>
        <KPI label="Impressions/mo"   value={`${(selected.impressions/1000).toFixed(0)}K`} sub="estimated"/>
        <KPI label="Live Campaigns"   value={selected.campaigns} sub="currently running"/>
        <KPI label="CPM"              value={`£${selected.cpm?.toFixed(2)||"4.20"}`} sub="cost per 1,000"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Screen Details</div>
          {[["Screen ID",selected.id],["Owner",selected.owner],["Owner Type",selected.type],["City",selected.city],["Neighbourhood",selected.neighbourhood],["Location",selected.location||selected.city],["Max Ad Duration",selected.maxDuration+"s"],["Own Slots Reserved",selected.ownSlots+"%"]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontFamily:F.sans}}>
              <span style={{fontSize:12,color:C.textSub}}>{l}</span>
              <span style={{fontSize:12,fontWeight:500,color:C.text}}>{v}</span>
            </div>
          ))}
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:12}}>Revenue Split</div>
            <div style={{height:6,borderRadius:3,overflow:"hidden",display:"flex",marginBottom:12}}>
              <div style={{width:"12%",background:C.blue}}/><div style={{width:"35%",background:C.green}}/><div style={{flex:1,background:C.surfaceAlt}}/>
            </div>
            {[["Platform (12%)",`£${Math.round(selected.revenue*0.12).toLocaleString()}`,C.blue],["Owner (40%)",`£${Math.round(selected.revenue*0.88*0.40).toLocaleString()}`,C.green],["Network pool",`£${Math.round(selected.revenue*0.88*0.60).toLocaleString()}`,C.textSub]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontFamily:F.sans}}>
                <span style={{fontSize:12,color:C.textSub}}>{l}</span><span style={{fontSize:13,fontWeight:600,color:c}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:12}}>Ad Rules</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:12,color:C.textSub,fontFamily:F.sans}}>Competitors allowed</span>
                <span style={{fontSize:12,fontWeight:500,color:selected.allowCompetitors!==false?C.green:C.red,fontFamily:F.sans}}>{selected.allowCompetitors!==false?"Yes":"No"}</span>
              </div>
              <div style={{fontSize:12,color:C.textSub,fontFamily:F.sans,marginBottom:4}}>Blocked categories</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(selected.blockedCategories||[]).length>0
                  ? (selected.blockedCategories||[]).map(c=><span key={c} style={{padding:"3px 9px",borderRadius:20,fontSize:11,background:C.redSoft,color:C.red,border:`1px solid ${C.redBorder}`,fontFamily:F.sans}}>✕ {c}</span>)
                  : <span style={{fontSize:12,color:C.textMuted,fontFamily:F.sans}}>None — all categories allowed</span>
                }
              </div>
            </div>
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:12}}>Payout Setup</div>
            <div style={{padding:"10px 12px",background:C.greenSoft,border:`1px solid ${C.greenBorder}`,borderRadius:8,fontSize:12,color:C.green,fontFamily:F.sans,marginBottom:10}}>✓ Stripe Connect active — payouts enabled</div>
            <Btn variant="success" size="sm">Trigger Payout £{Math.round(selected.revenue*0.88*0.40).toLocaleString()}</Btn>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {showAdd && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:480,padding:28,boxShadow:"0 24px 60px rgba(0,0,0,0.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:F.sans}}>Register New Screen</div>
              <button onClick={()=>setShowAdd(false)} style={{background:"none",border:"none",fontSize:20,color:C.textMuted,cursor:"pointer"}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              <Inp label="Screen Name" placeholder="e.g. Corner Brew — King St" value={newScreen.name} onChange={e=>setNewScreen(s=>({...s,name:e.target.value}))}/>
              <Inp label="Owner / Business Name" placeholder="e.g. Corner Brew Coffee" value={newScreen.owner} onChange={e=>setNewScreen(s=>({...s,owner:e.target.value}))}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <SelInput label="Owner Type" value={newScreen.type} onChange={e=>setNewScreen(s=>({...s,type:e.target.value}))}>
                  <option>Business</option><option>Landlord</option>
                </SelInput>
                <SelInput label="City" value={newScreen.city} onChange={e=>setNewScreen(s=>({...s,city:e.target.value}))}>
                  {["Toronto","London","Manchester","Birmingham"].map(c=><option key={c}>{c}</option>)}
                </SelInput>
              </div>
              <Inp label="Location / Address" placeholder="e.g. King St W & Bay St, Toronto" value={newScreen.location} onChange={e=>setNewScreen(s=>({...s,location:e.target.value}))}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn variant="secondary" onClick={()=>setShowAdd(false)}>Cancel</Btn>
              <Btn onClick={()=>setShowAdd(false)} disabled={!newScreen.name||!newScreen.owner}>Register Screen</Btn>
            </div>
          </div>
        </div>
      )}
      <PageHeader title="Screens" subtitle={`${SCREENS.length} registered · ${SCREENS.filter(s=>s.status==="live").length} live · ${SCREENS.filter(s=>s.status==="pending").length} pending`}
        actions={<><Btn variant="secondary" icon="↓" size="sm">Export</Btn><Btn icon="+" onClick={()=>setShowAdd(true)}>Register Screen</Btn></>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Total Screens"     value={SCREENS.length}/>
        <KPI label="Live"              value={SCREENS.filter(s=>s.status==="live").length} color={C.green}/>
        <KPI label="Network Revenue"   value={`£${SCREENS.reduce((a,s)=>a+s.revenue,0).toLocaleString()}`} sub="/month" color={C.blue}/>
        <KPI label="Total Impressions" value={`${(SCREENS.reduce((a,s)=>a+s.impressions,0)/1000).toFixed(0)}K`} sub="/month"/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {cities.map(c=><button key={c} onClick={()=>setFilter(c)} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${filter===c?C.blue:C.border}`,background:filter===c?C.blueSoft:C.surface,color:filter===c?C.blue:C.textSub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:F.sans,transition:"all 0.15s"}}>{c}</button>)}
      </div>
      <Table
        columns={[
          {key:"id",       label:"ID",      render:v=><span style={{fontFamily:F.mono,fontSize:11,color:C.textSub}}>{v}</span>},
          {key:"name",     label:"Screen",  render:(v,r)=><div><div style={{fontWeight:500,color:C.text,fontFamily:F.sans}}>{v}</div><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{r.neighbourhood} · {r.city}</div></div>},
          {key:"owner",    label:"Owner",   render:(v,r)=><div><div style={{fontFamily:F.sans}}>{v}</div><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{r.type}</div></div>},
          {key:"impressions",label:"Impr/mo",render:v=>v>0?`${(v/1000).toFixed(0)}K`:"—"},
          {key:"revenue",  label:"Rev/mo",  render:v=>v>0?<span style={{fontWeight:600,color:C.green}}>£{v.toLocaleString()}</span>:"—"},
          {key:"campaigns",label:"Live Campaigns",render:v=><span style={{fontWeight:600}}>{v}</span>},
          {key:"status",   label:"Status",  render:v=><Badge status={v}/>},
          {key:"id",       label:"",        render:(_,r)=><Btn variant="ghost" size="sm" onClick={e=>{e.stopPropagation();setSelected(r);}}>View →</Btn>},
        ]}
        rows={shown} onRowClick={setSelected}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIENCE & SCANS VIEW
// ─────────────────────────────────────────────────────────────────────────────

const SCAN_DATA = [
  {id:"SCN-001",ts:"2026-03-29T08:14:22Z",advertiser:"Pret A Manger", screen:"Corner Brew — Oxford St",    city:"London",   device:"iPhone 15",   age:"25-34",gender:"Female",consent:true, email:"alice@example.com"},
  {id:"SCN-002",ts:"2026-03-29T08:22:05Z",advertiser:"Nike",           screen:"Canary Wharf Plaza",         city:"London",   device:"Samsung S24", age:"18-24",gender:"Male",  consent:true, email:"ben@example.com"},
  {id:"SCN-003",ts:"2026-03-29T09:01:44Z",advertiser:"Tim Hortons",    screen:"King & Bay — TTC Shelter",   city:"Toronto",  device:"iPhone 14",   age:null,   gender:null,   consent:false,email:null},
  {id:"SCN-004",ts:"2026-03-29T09:33:18Z",advertiser:"John Lewis",     screen:"New Street Station",         city:"Birmingham",device:"Pixel 8",    age:"35-44",gender:"Female",consent:true, email:"carol@example.com"},
  {id:"SCN-005",ts:"2026-03-29T10:04:51Z",advertiser:"Pret A Manger", screen:"Corner Brew — Oxford St",    city:"London",   device:"iPhone 13",   age:"25-34",gender:"Male",  consent:true, email:"dan@example.com"},
  {id:"SCN-006",ts:"2026-03-29T11:22:33Z",advertiser:"Caffè Nero",    screen:"Piccadilly Gardens",         city:"Manchester",device:"Samsung S24",age:null,   gender:"Female",consent:false,email:null},
  {id:"SCN-007",ts:"2026-03-29T12:45:09Z",advertiser:"MLSE",           screen:"King & Bay — TTC Shelter",   city:"Toronto",  device:"iPhone 15",   age:"18-24",gender:"Female",consent:true, email:"emily@example.com"},
  {id:"SCN-008",ts:"2026-03-29T13:11:27Z",advertiser:"Nike",           screen:"Canary Wharf Plaza",         city:"London",   device:"iPhone 14",   age:"25-34",gender:"Male",  consent:true, email:"frank@example.com"},
];

function AudienceView() {
  const [tab,setTab] = useState("scans");
  const [exportDone,setExportDone] = useState(false);
  const consented = SCAN_DATA.filter(s=>s.consent);
  const scanRate  = "0.18";
  const consentRate = Math.round((consented.length/SCAN_DATA.length)*100);

  const doExport = () => {
    const csv = ["email,advertiser,screen,city,age,gender,scanned_at",...consented.filter(s=>s.email).map(s=>`${s.email},${s.advertiser},"${s.screen}",${s.city},${s.age||""},${s.gender||""},${s.ts}`)].join("\n");
    const a = document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="adgrid-remarketing.csv"; a.click();
    setExportDone(true); setTimeout(()=>setExportDone(false),2500);
  };

  return (
    <div>
      <PageHeader title="Audience & Scans" subtitle="QR scan events, consent data, and remarketing export"
        actions={<Btn onClick={doExport} variant={exportDone?"success":"primary"} icon="↓">{exportDone?"Exported!":"Export Remarketing CSV"}</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Total Scans"    value={SCAN_DATA.length}              sub="QR code scans" icon="📲"/>
        <KPI label="Scan Rate"      value={scanRate+"%"}                   sub="per 1,000 impressions" icon="📊"/>
        <KPI label="Consent Rate"   value={consentRate+"%"}               sub="opted in" color={C.green} icon="✓"/>
        <KPI label="Remarketing List" value={consented.filter(s=>s.email).length+" emails"} sub="ready to export" color={C.blue} icon="📧"/>
      </div>

      <Card style={{marginBottom:16,padding:"12px 20px"}}>
        <div style={{fontSize:12,color:C.textSub,fontFamily:F.sans,lineHeight:1.7}}>
          <strong style={{color:C.text}}>How it works:</strong> Every QR code scan is logged anonymously (device, screen, ad, time). If the user consents on the landing page, their email and demographics are captured. Consented emails can be exported as a Custom Audience for Meta or Google Ads to retarget people who physically saw your ad.
        </div>
      </Card>

      <Tabs tabs={[{id:"scans",label:"Scan Feed"},{id:"remarketing",label:"Remarketing Export"},{id:"demographics",label:"Demographics"}]} active={tab} onChange={setTab}/>

      {tab==="scans" && (
        <Table
          columns={[
            {key:"ts",         label:"Time",       render:v=><span style={{fontFamily:F.mono,fontSize:11,color:C.textSub}}>{new Date(v).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>},
            {key:"advertiser", label:"Ad",         render:(v,r)=><div><div style={{fontWeight:500,color:C.text,fontFamily:F.sans}}>{v}</div><div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{r.screen}</div></div>},
            {key:"city",       label:"City"},
            {key:"device",     label:"Device"},
            {key:"age",        label:"Age",        render:v=>v||<span style={{color:C.textMuted}}>—</span>},
            {key:"gender",     label:"Gender",     render:v=>v||<span style={{color:C.textMuted}}>—</span>},
            {key:"consent",    label:"Consent",    render:v=><Badge status={v?"active":"paused"}>{v?"✓ Given":"✕ Declined"}</Badge>},
            {key:"email",      label:"Email",      render:v=>v?<span style={{fontFamily:F.mono,fontSize:11,color:C.blue}}>{v}</span>:<span style={{color:C.textMuted,fontSize:11}}>Anonymous</span>},
          ]}
          rows={[...SCAN_DATA].reverse()}/>
      )}

      {tab==="remarketing" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <Card style={{padding:"14px 18px",background:C.blueSoft,border:`1px solid ${C.blueBorder}`}}>
              <div style={{fontSize:13,fontWeight:600,color:C.blue,fontFamily:F.sans,marginBottom:4}}>Google Ads Customer Match</div>
              <div style={{fontSize:12,color:C.textSub,fontFamily:F.sans,lineHeight:1.6}}>Upload the CSV to Google Ads → Audience Manager → Customer Match. Retarget across Search, YouTube, and Display.</div>
            </Card>
            <Card style={{padding:"14px 18px",background:C.purpleSoft,border:`1px solid ${C.purpleBorder}`}}>
              <div style={{fontSize:13,fontWeight:600,color:C.purple,fontFamily:F.sans,marginBottom:4}}>Meta Custom Audiences</div>
              <div style={{fontSize:12,color:C.textSub,fontFamily:F.sans,lineHeight:1.6}}>Upload to Meta Business Manager → Custom Audience → Customer List. Retarget on Facebook and Instagram.</div>
            </Card>
          </div>
          <Table
            columns={[
              {key:"email",      label:"Email",      render:v=><span style={{fontFamily:F.mono,fontSize:12,color:C.blue}}>{v}</span>},
              {key:"advertiser", label:"Ad Seen"},
              {key:"screen",     label:"Screen"},
              {key:"city",       label:"City"},
              {key:"age",        label:"Age"},
              {key:"gender",     label:"Gender"},
              {key:"ts",         label:"Scanned",    render:v=><span style={{fontFamily:F.mono,fontSize:11,color:C.textSub}}>{new Date(v).toLocaleDateString("en-GB")}</span>},
            ]}
            rows={consented.filter(s=>s.email)} empty="No consented scan data yet"/>
        </div>
      )}

      {tab==="demographics" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Age Breakdown</div>
            {["18-24","25-34","35-44","45-54"].map(age=>{
              const count = consented.filter(s=>s.age===age).length;
              return (
                <div key={age} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontFamily:F.sans}}>
                    <span style={{fontSize:13,color:C.textMid}}>{age}</span>
                    <span style={{fontSize:12,color:C.textSub}}>{count} scans</span>
                  </div>
                  <ProgressBar value={count} max={consented.length||1} height={5}/>
                </div>
              );
            })}
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:16}}>Top Devices</div>
            {["iPhone 15","iPhone 14","Samsung S24","Pixel 8","iPhone 13"].map(device=>{
              const count = SCAN_DATA.filter(s=>s.device===device).length;
              return (
                <div key={device} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontFamily:F.sans}}>
                    <span style={{fontSize:13,color:C.textMid}}>{device}</span>
                    <span style={{fontSize:12,color:C.textSub}}>{count}</span>
                  </div>
                  <ProgressBar value={count} max={SCAN_DATA.length||1} height={5} color={C.purple}/>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE SIGNALS VIEW
// ─────────────────────────────────────────────────────────────────────────────

const BOOSTS = {"Food & Beverage":{morning:2,cold:1,highFoot:2},"Health & Fitness":{morning:3,weekend:2,sunny:2},"Fashion & Retail":{weekend:2,highFoot:3,sunny:1},"Finance & Banking":{morning:3,weekday:2},"Entertainment":{evening:3,weekend:3},"Technology":{morning:1,weekday:2}};

function SignalsView({campaigns}) {
  const now = new Date();
  const [hour,setHour]       = useState(now.getHours());
  const [day,setDay]         = useState(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][now.getDay()]);
  const [weather,setWeather] = useState("Sunny");
  const [screen,setScreen]   = useState(SCREENS[0].id);
  const [liveMode,setLive]   = useState(true);
  const [simming,setSimming] = useState(false);

  const foot = (() => {
    const wknd=day==="Sat"||day==="Sun";
    const peaks=wknd?{10:70,11:82,12:90,13:88,14:84}:{7:78,8:92,9:80,12:84,13:82,17:86,18:90,19:72};
    const pct=peaks[hour]??Math.max(8,45-Math.abs(hour-13)*4);
    return {pct,label:pct>=80?"Very High":pct>=62?"High":pct>=42?"Medium":pct>=22?"Low":"Very Low"};
  })();

  const activeOnScreen = campaigns.filter(c=>c.screenId===screen&&["active","scheduled"].includes(c.status));
  const ranked = activeOnScreen.map(c=>{
    let score=50; const b=BOOSTS[c.category]||{};
    if(hour>=6&&hour<11&&b.morning)  score+=b.morning*10;
    if(hour>=17&&hour<22&&b.evening) score+=20;
    if((day==="Sat"||day==="Sun")&&b.weekend) score+=b.weekend*10;
    if(foot.pct>=62&&b.highFoot) score+=b.highFoot*10;
    if((weather==="Sunny")&&b.sunny) score+=10;
    if((weather==="Cold"||weather==="Rainy")&&b.cold) score+=10;
    if(day!=="Sat"&&day!=="Sun"&&b.weekday) score+=b.weekday*10;
    return {...c,score:Math.min(score,100)};
  }).sort((a,b)=>b.score-a.score);
  const winner = ranked[0];

  const runSim = () => {
    setLive(false); setSimming(true); let i=0;
    const hrs=[6,8,10,12,14,17,19,21];
    const id=setInterval(()=>{ if(i>=hrs.length){clearInterval(id);setSimming(false);return;} setHour(hrs[i]);i++;},700);
  };

  const timeLabel = h=>h<6?"Late Night":h<11?"Morning":h<14?"Midday":h<17?"Afternoon":h<21?"Evening":"Night";
  const scoreColor = s=>s>=75?C.green:s>=50?C.amber:C.textSub;

  return (
    <div>
      <PageHeader title="Live Signals" subtitle="Real-time context engine — weather, footfall, and ad ranking"/>
      <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:20,alignItems:"start"}}>
        {/* Controls */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Context Signals</div>
            <SelInput label="Screen" value={screen} onChange={e=>setScreen(e.target.value)} style={{marginBottom:12}}>
              {SCREENS.filter(s=>s.status==="live").map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </SelInput>
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans}}>Time of Day</label>
                <span style={{fontSize:12,color:C.blue,fontFamily:F.sans,fontWeight:500}}>{String(hour).padStart(2,"0")}:00 · {timeLabel(hour)}</span>
              </div>
              <input type="range" min={0} max={23} value={hour} onChange={e=>{setLive(false);setHour(parseInt(e.target.value));}} style={{width:"100%",accentColor:C.blue}}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Day of Week</label>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>(
                  <button key={d} onClick={()=>{setLive(false);setDay(d);}} style={{padding:"5px 9px",borderRadius:6,border:`1px solid ${day===d?C.blue:C.border}`,background:day===d?C.blueSoft:C.surface,color:day===d?C.blue:C.textSub,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:F.sans}}>{d}</button>
                ))}
              </div>
            </div>
            <SelInput label="Weather" value={weather} onChange={e=>setWeather(e.target.value)}>
              {["Sunny","Cloudy","Rainy","Cold","Hot","Windy"].map(w=><option key={w}>{w}</option>)}
            </SelInput>
          </Card>
          <Card style={{padding:"14px 18px"}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:10}}>Active Signals</div>
            {[
              [`⏱ ${String(hour).padStart(2,"0")}:00 · ${timeLabel(hour)}`,C.blue,C.blueSoft,C.blueBorder],
              [`📅 ${day}`,C.blue,C.blueSoft,C.blueBorder],
              [`${weather==="Sunny"?"☀️":weather==="Rainy"?"🌧️":weather==="Cold"?"🥶":"🌤️"} ${weather}`,C.green,C.greenSoft,C.greenBorder],
              [`👥 ${foot.label} (${foot.pct}%)`,foot.pct>=62?C.green:C.textSub,foot.pct>=62?C.greenSoft:C.surfaceAlt,foot.pct>=62?C.greenBorder:C.border],
            ].map(([l,c,bg,b])=>(
              <span key={l} style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:bg,color:c,border:`1px solid ${b}`,marginRight:6,marginBottom:6,fontFamily:F.sans}}>{l}</span>
            ))}
          </Card>
          <div style={{display:"flex",gap:8}}>
            <Btn variant={liveMode?"success":"secondary"} size="sm" onClick={()=>setLive(!liveMode)} style={{flex:1,justifyContent:"center"}}>{liveMode?"● Live":"○ Manual"}</Btn>
            <Btn size="sm" onClick={runSim} disabled={simming} style={{flex:1,justifyContent:"center"}}>{simming?"Simulating…":"▶ Simulate Day"}</Btn>
          </div>
        </div>

        {/* Rankings */}
        <div>
          {winner&&(
            <div style={{background:"linear-gradient(135deg,#f0fdf4,#eff6ff)",border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:20,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:C.green,letterSpacing:"0.5px",marginBottom:4,fontFamily:F.sans}}>NOW PLAYING — HIGHEST SIGNAL MATCH</div>
              <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:F.sans,marginBottom:2}}>{winner.advertiser}</div>
              <div style={{fontSize:12,color:C.textSub,fontFamily:F.sans,marginBottom:12}}>{winner.category} · {winner.screen}</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:40,fontWeight:800,color:scoreColor(winner.score),fontFamily:F.sans,lineHeight:1}}>{winner.score}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans,marginBottom:4}}>Signal match score</div>
                  <ProgressBar value={winner.score} max={100} height={8} color={scoreColor(winner.score)}/>
                </div>
              </div>
            </div>
          )}
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:12}}>All Campaigns — Ranked by Signal Match</div>
          {ranked.length===0&&<Card style={{textAlign:"center",padding:32,color:C.textMuted,fontFamily:F.sans}}>No active campaigns on this screen</Card>}
          {ranked.map((c,i)=>(
            <Card key={c.id} style={{marginBottom:10,padding:"14px 18px",border:i===0?`1px solid ${C.blueBorder}`:undefined}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:i===0?C.blue:C.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:i===0?"#fff":C.textSub,fontFamily:F.sans}}>#{i+1}</div>
                  <div>
                    <div style={{fontWeight:600,color:C.text,fontFamily:F.sans}}>{c.advertiser}</div>
                    <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{c.category} · {c.timeStart}–{c.timeEnd}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:800,color:scoreColor(c.score),fontFamily:F.sans,lineHeight:1}}>{c.score}</div>
                  <div style={{fontSize:10,color:C.textMuted,fontFamily:F.sans}}>/100</div>
                </div>
              </div>
              <ProgressBar value={c.score} max={100} height={4} color={scoreColor(c.score)}/>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLING & PAYOUTS VIEW
// ─────────────────────────────────────────────────────────────────────────────

const TRANSACTIONS = [
  {id:"pi_001",advertiser:"Pret A Manger", amount:480,  fee:44,  status:"paid",      date:"2026-03-21",method:"Visa ••••4242"},
  {id:"pi_002",advertiser:"Nike",           amount:2200, fee:194, status:"paid",      date:"2026-03-15",method:"Mastercard ••••5555"},
  {id:"pi_003",advertiser:"Lloyds Bank",   amount:1440, fee:131, status:"processing",date:"2026-04-01",method:"Visa ••••1234"},
  {id:"pi_004",advertiser:"Tim Hortons",   amount:720,  fee:67,  status:"paid",      date:"2026-03-21",method:"Mastercard ••••7777"},
  {id:"pi_005",advertiser:"MLSE",           amount:1200, fee:110, status:"paid",      date:"2026-03-21",method:"Amex ••••8888"},
];
const PAYOUTS = [
  {owner:"Corner Brew Coffee",      screen:"SCR-001",amount:248, status:"transferred",date:"2026-03-31"},
  {owner:"Greenfield Properties",   screen:"SCR-002",amount:776, status:"transferred",date:"2026-03-31"},
  {owner:"Slate Asset Management",  screen:"SCR-008",amount:346, status:"scheduled",  date:"2026-04-01"},
  {owner:"Ossington Hospitality",   screen:"SCR-009",amount:98,  status:"scheduled",  date:"2026-04-01"},
];

function BillingView({campaigns}) {
  const [tab,setTab] = useState("overview");
  const [processingId,setProcessing] = useState(null);
  const [payouts,setPayouts] = useState(PAYOUTS);
  const total   = TRANSACTIONS.filter(t=>t.status==="paid").reduce((a,t)=>a+t.amount,0);
  const fees    = TRANSACTIONS.filter(t=>t.status==="paid").reduce((a,t)=>a+t.fee,0);
  const pending = payouts.filter(p=>p.status==="scheduled").reduce((a,p)=>a+p.amount,0);
  const paid    = payouts.filter(p=>p.status==="transferred").reduce((a,p)=>a+p.amount,0);

  const doPayout = (owner) => {
    setProcessing(owner);
    setTimeout(()=>{ setPayouts(prev=>prev.map(p=>p.owner===owner?{...p,status:"transferred"}:p)); setProcessing(null); },1500);
  };

  return (
    <div>
      <PageHeader title="Billing & Payouts" subtitle="Stripe charges, owner revenue share, and payout management"
        actions={<a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer"><Btn variant="secondary" size="sm">Stripe Dashboard ↗</Btn></a>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Total Revenue"    value={`£${total.toLocaleString()}`}   sub="from advertisers" trend={14} icon="💰"/>
        <KPI label="Platform Net"     value={`£${(total-fees).toLocaleString()}`} sub="after Stripe fees" color={C.blue} icon="$"/>
        <KPI label="Pending Payouts"  value={`£${pending.toLocaleString()}`} sub="to screen owners" color={C.amber} icon="⏳"/>
        <KPI label="Paid Out"         value={`£${paid.toLocaleString()}`}    sub="to screen owners" color={C.green} icon="✓"/>
      </div>
      <Tabs tabs={[{id:"overview",label:"Overview"},{id:"charges",label:"Charges"},{id:"payouts",label:"Payouts"},{id:"connect",label:"Screen Accounts"}]} active={tab} onChange={setTab}/>

      {tab==="overview"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Revenue Split</div>
            <div style={{height:8,borderRadius:4,overflow:"hidden",display:"flex",marginBottom:14}}>
              <div style={{width:"12%",background:C.blue}}/><div style={{width:"35%",background:C.green}}/><div style={{flex:1,background:C.surfaceAlt}}/>
            </div>
            {[["Stripe Fees",`£${fees.toLocaleString()}`,C.textSub],["Platform (12%)",`£${Math.round(total*0.12).toLocaleString()}`,C.blue],["Screen Owners (40%)",`£${Math.round(total*0.88*0.40).toLocaleString()}`,C.green],["Network Pool",`£${Math.round(total*0.88*0.60).toLocaleString()}`,C.textSub]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`,fontFamily:F.sans}}>
                <span style={{fontSize:13,color:C.textMid}}>{l}</span><span style={{fontSize:14,fontWeight:700,color:c}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Recent Activity</div>
            {[...TRANSACTIONS.slice(0,4),...payouts.slice(0,2)].slice(0,6).map((t,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:C.text,fontFamily:F.sans}}>{t.advertiser||t.owner}</div>
                  <div style={{fontSize:11,color:C.textMuted,fontFamily:F.sans}}>{t.advertiser?"Charge":"Payout"} · {t.date}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:600,color:t.advertiser?C.green:C.amber,fontFamily:F.sans}}>{t.advertiser?"+":"−"}£{t.amount.toLocaleString()}</div>
                  <Badge status={t.status}>{t.status}</Badge>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab==="charges"&&(
        <Table
          columns={[
            {key:"id",          label:"ID",       render:v=><span style={{fontFamily:F.mono,fontSize:11,color:C.textSub}}>{v}</span>},
            {key:"advertiser",  label:"Advertiser"},
            {key:"date",        label:"Date",     render:v=><span style={{fontFamily:F.mono,fontSize:11}}>{v}</span>},
            {key:"method",      label:"Method",   render:v=><span style={{fontFamily:F.mono,fontSize:11}}>{v}</span>},
            {key:"amount",      label:"Gross",    render:v=><span style={{fontWeight:600}}>£{v.toLocaleString()}</span>},
            {key:"fee",         label:"Stripe Fee",render:v=><span style={{color:C.textSub}}>£{v}</span>},
            {key:"amount",      label:"Net",      render:(v,r)=><span style={{color:C.green,fontWeight:600}}>£{(v-r.fee).toLocaleString()}</span>},
            {key:"status",      label:"Status",   render:v=><Badge status={v}/>},
          ]}
          rows={TRANSACTIONS}/>
      )}

      {tab==="payouts"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
            <Btn variant="success" size="sm" onClick={()=>payouts.filter(p=>p.status==="scheduled").forEach(p=>doPayout(p.owner))}>Run All Pending Payouts</Btn>
          </div>
          <Table
            columns={[
              {key:"owner",   label:"Screen Owner"},
              {key:"screen",  label:"Screen ID",   render:v=><span style={{fontFamily:F.mono,fontSize:11,color:C.textSub}}>{v}</span>},
              {key:"date",    label:"Date"},
              {key:"amount",  label:"Amount",      render:v=><span style={{fontWeight:600,color:C.green}}>£{v.toLocaleString()}</span>},
              {key:"status",  label:"Status",      render:v=><Badge status={v}/>},
              {key:"owner",   label:"",            render:(v,r)=>r.status==="scheduled"?(
                <Btn variant="success" size="sm" onClick={()=>doPayout(v)}>
                  {processingId===v?"Sending…":"Pay Now"}
                </Btn>
              ):null},
            ]}
            rows={payouts}/>
        </div>
      )}

      {tab==="connect"&&(
        <div>
          <div style={{padding:"12px 16px",background:C.blueSoft,border:`1px solid ${C.blueBorder}`,borderRadius:8,marginBottom:16,fontSize:12,color:C.textSub,fontFamily:F.sans}}>
            Screen owners connect their bank via Stripe Connect. ADGRID never handles their banking details — Stripe transfers funds directly to their account on payout day.
          </div>
          <Table
            columns={[
              {key:"owner",  label:"Screen Owner"},
              {key:"screen", label:"Screen",     render:v=><span style={{fontFamily:F.mono,fontSize:11}}>{v}</span>},
              {key:"amount", label:"Pending",    render:v=><span style={{fontWeight:600,color:C.amber}}>£{v.toLocaleString()}</span>},
              {key:"status", label:"Stripe Status",render:v=><Badge status={v}/>},
              {key:"owner",  label:"",           render:(_,r)=>r.status==="scheduled"?<Btn variant="ghost" size="sm">Send Onboarding Link</Btn>:<span style={{fontSize:11,color:C.green,fontFamily:F.sans}}>✓ Connected</span>},
            ]}
            rows={payouts}/>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATIONS VIEW
// ─────────────────────────────────────────────────────────────────────────────

const INTEGRATIONS_LIST = [
  {id:"meta",    name:"Meta Conversions API",   logo:"📘",color:"#1877f2",category:"Advertising",status:"connected",detail:"Pixel 9876543210 · 142 events today",events:["Scan → ViewContent","Consent → Lead","Impression → Custom"]},
  {id:"google",  name:"Google Ads",             logo:"🔵",color:"#4285f4",category:"Advertising",status:"disconnected",detail:"Not connected",events:["Consent → Customer Match","Scan → Offline Conversion"]},
  {id:"shopify", name:"Shopify",                logo:"🛍️",color:"#96bf48",category:"E-commerce",status:"connected",detail:"timhortons.myshopify.com · 31 customers",events:["Consent → Create Customer","Scan → Custom Event"]},
  {id:"salesforce",name:"Salesforce",           logo:"☁️",color:"#00a1e0",category:"CRM",       status:"disconnected",detail:"Not connected",events:["Consent → Create Lead","Scan → Campaign Activity"]},
  {id:"hubspot", name:"HubSpot",                logo:"🟠",color:"#ff7a59",category:"CRM",       status:"disconnected",detail:"Not connected",events:["Consent → Create Contact","Scan → Custom Event"]},
  {id:"klaviyo", name:"Klaviyo",                logo:"📧",color:"#00b2a9",category:"Email",      status:"disconnected",detail:"Not connected",events:["Consent → Add to List","Scan → Track Event"]},
  {id:"tiktok",  name:"TikTok Events API",      logo:"🎵",color:"#ff0050",category:"Advertising",status:"disconnected",detail:"Not connected",events:["Scan → ViewContent","Consent → SubmitForm"]},
  {id:"webhook", name:"Custom Webhook",         logo:"🔗",color:"#7c3aed",category:"Custom",    status:"error",detail:"Last failed 14 min ago",events:["All scan events","All impression events"]},
];

function IntegrationsView() {
  const [selected,setSelected] = useState(null);
  const [connections,setConns] = useState({meta:{pixelId:"",token:""},shopify:{domain:"",key:""},webhook:{url:"",secret:""}});
  const [saved,setSaved] = useState("");
  const [tab,setTab] = useState("integrations");

  const PIXEL_SNIPPET = `<!-- ADGRID Tracking Pixel -->
<script src="https://cdn.adgrid.io/pixel.js"></script>
<script>
  adgrid('init', 'AG-XXXXXXXX');
  adgrid('track', 'PageView');
</script>`;

  const save = (id) => { setSaved(id); setTimeout(()=>setSaved(""),2000); };

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Connect ADGRID scan and impression data to your existing tools"/>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <KPI label="Connected"    value={INTEGRATIONS_LIST.filter(i=>i.status==="connected").length+""}  sub="integrations"  color={C.green} icon="✓"/>
        <KPI label="Errors"       value={INTEGRATIONS_LIST.filter(i=>i.status==="error").length+""}       sub="need attention" color={C.red}   icon="⚠"/>
        <KPI label="Available"    value={INTEGRATIONS_LIST.length+""}                                     sub="platforms"/>
      </div>

      <Tabs tabs={[{id:"integrations",label:"Integrations"},{id:"pixel",label:"Tracking Pixel"},{id:"logs",label:"Event Log"}]} active={tab} onChange={setTab}/>

      {tab==="integrations"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:16,alignItems:"start"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {INTEGRATIONS_LIST.map(intg=>(
              <Card key={intg.id} onClick={()=>setSelected(intg)} style={{cursor:"pointer",border:selected?.id===intg.id?`1px solid ${C.blue}`:undefined,padding:"16px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:24}}>{intg.logo}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,fontFamily:F.sans}}>{intg.name}</div>
                      <div style={{fontSize:10,color:C.textMuted,fontFamily:F.sans}}>{intg.category}</div>
                    </div>
                  </div>
                  <Badge status={intg.status==="connected"?"active":intg.status==="error"?"failed":"paused"}>{intg.status==="connected"?"Connected":intg.status==="error"?"Error":"Disconnected"}</Badge>
                </div>
                <div style={{fontSize:11,color:C.textSub,fontFamily:F.sans}}>{intg.detail}</div>
              </Card>
            ))}
          </div>
          {selected?(
            <Card style={{position:"sticky",top:80}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <span style={{fontSize:28}}>{selected.logo}</span>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:F.sans}}>{selected.name}</div>
                  <Badge status={selected.status==="connected"?"active":selected.status==="error"?"failed":"paused"}>{selected.status}</Badge>
                </div>
              </div>
              <div style={{fontSize:13,color:C.textSub,fontFamily:F.sans,lineHeight:1.7,marginBottom:16}}>Events sent by ADGRID:</div>
              {selected.events.map((e,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,fontFamily:F.sans}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:C.blue,flexShrink:0}}/>
                  <span style={{fontSize:12,color:C.textMid}}>{e}</span>
                </div>
              ))}
              <div style={{borderTop:`1px solid ${C.border}`,marginTop:14,paddingTop:14}}>
                {(selected.id==="meta"||selected.id==="shopify"||selected.id==="webhook")&&(
                  <>
                    <div style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,marginBottom:10}}>Configuration</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                      <Inp label={selected.id==="meta"?"Pixel ID":selected.id==="shopify"?"Shop Domain":"Webhook URL"}
                        placeholder={selected.id==="meta"?"e.g. 9876543210":selected.id==="shopify"?"yourstore.myshopify.com":"https://hooks.zapier.com/..."}/>
                      <Inp label={selected.id==="meta"?"Access Token":selected.id==="shopify"?"Admin API Key":"Signing Secret"} type="password" placeholder="••••••••••••"/>
                    </div>
                  </>
                )}
                <div style={{display:"flex",gap:8}}>
                  <Btn style={{flex:1,justifyContent:"center"}} onClick={()=>save(selected.id)}>{saved===selected.id?"✓ Saved":selected.status==="connected"?"Update Config":"Connect"}</Btn>
                  {selected.status==="connected"&&<Btn variant="danger" size="sm">Disconnect</Btn>}
                </div>
              </div>
            </Card>
          ):(
            <Card style={{textAlign:"center",padding:32,color:C.textMuted,fontFamily:F.sans}}>
              <div style={{fontSize:24,marginBottom:8}}>⇌</div>Select an integration to configure it
            </Card>
          )}
        </div>
      )}

      {tab==="pixel"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:4}}>Your Pixel ID</div>
            <div style={{fontSize:22,fontWeight:800,color:C.blue,fontFamily:F.mono,marginBottom:12}}>AG-XXXXXXXX</div>
            <div style={{fontSize:13,color:C.textSub,fontFamily:F.sans,lineHeight:1.7,marginBottom:14}}>Paste this into the {"<head>"} of your website. It tracks when someone arrives from an ADGRID QR scan and attributes conversions back to the screen and campaign.</div>
            <div style={{position:"relative"}}>
              <pre style={{background:C.surfaceAlt,borderRadius:8,padding:"12px 14px",fontSize:11,color:C.textMid,lineHeight:1.8,overflow:"auto",border:`1px solid ${C.border}`,whiteSpace:"pre-wrap",fontFamily:F.mono}}>{PIXEL_SNIPPET}</pre>
              <button onClick={()=>navigator.clipboard?.writeText(PIXEL_SNIPPET)} style={{position:"absolute",top:8,right:8,padding:"4px 10px",fontSize:11,background:C.surface,color:C.textSub,border:`1px solid ${C.border}`,borderRadius:6,cursor:"pointer",fontFamily:F.sans}}>Copy</button>
            </div>
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Platform Guides</div>
            {[["🛍️ Shopify","Paste in Online Store → Themes → Edit Code → theme.liquid before </head>"],["⚙️ WordPress","Use Insert Headers and Footers plugin → Scripts in Header"],["◼️ Squarespace","Settings → Advanced → Code Injection → Header"],["🌊 Webflow","Project Settings → Custom Code → Head Code"],["⚛️ Next.js","Add to _app.js or layout.tsx using next/script"]].map(([p,d])=>(
              <div key={p} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:C.text,fontFamily:F.sans,marginBottom:2}}>{p}</div>
                  <div style={{fontSize:11,color:C.textSub,fontFamily:F.sans,lineHeight:1.5}}>{d}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab==="logs"&&(
        <Table
          columns={[
            {key:"ts",    label:"Time",        render:()=><span style={{fontFamily:F.mono,fontSize:11,color:C.textSub}}>{new Date().toLocaleTimeString("en-GB")}</span>},
            {key:"intg",  label:"Integration", render:(_,r)=><span style={{fontFamily:F.sans}}>{r.intg}</span>},
            {key:"event", label:"Event"},
            {key:"detail",label:"Detail"},
            {key:"status",label:"Status",      render:v=><Badge status={v==="sent"?"active":"failed"}>{v}</Badge>},
          ]}
          rows={[
            {intg:"Meta Conversions API", event:"ViewContent",  detail:"BK-001 scan → pixel 9876543210",status:"sent"},
            {intg:"Shopify",              event:"CreateCustomer",detail:"alice@example.com → customer #4821",status:"sent"},
            {intg:"Meta Conversions API", event:"Lead",         detail:"Consent → fb_lead_id abc123",    status:"sent"},
            {intg:"Custom Webhook",       event:"scan.created", detail:"Connection timeout after 30s",     status:"failed"},
            {intg:"Shopify",              event:"CreateCustomer",detail:"ben@example.com → customer #4819",status:"sent"},
          ]}/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVERTISER SELF-SERVE CREATE FLOW (wired into adv-create)
// ─────────────────────────────────────────────────────────────────────────────

function AdvCreate({onSave,onCancel}) {
  const [step,setStep] = useState(1);
  const [form,setForm] = useState({advertiser:"",category:"Food & Beverage",screenId:"SCR-008",start:"",end:"",days:["Mon","Tue","Wed","Thu","Fri"],timeStart:"07:00",timeEnd:"20:00",slots:10,duration:10,budget:500,headline:"",cta:"Learn More →",color:"#f59e0b",destination:""});
  const [errors,setErrors] = useState({});
  const screen = SCREENS.find(s=>s.id===form.screenId);
  const days   = form.start&&form.end?Math.max(1,Math.round((new Date(form.end)-new Date(form.start))/(1000*60*60*24))):30;
  const estImpr = screen?Math.round((screen.impressions*(form.slots/100)/30)*days):0;

  const validate = () => {
    const e={};
    if(!form.advertiser.trim()) e.advertiser="Required";
    if(!form.start) e.start="Required";
    if(!form.end)   e.end="Required";
    if(!form.destination.includes(".")) e.destination="Enter a valid URL";
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleSave = () => {
    if(!validate()) return;
    onSave({id:`BK-${String(Date.now()).slice(-4)}`,...form,screen:screen?.name||"",city:screen?.city||"",spent:0,impressions:0,scans:0,status:"scheduled"});
  };

  return (
    <div>
      <PageHeader title="New Campaign" subtitle={`Step ${step} of 3 — ${["Campaign Details","Schedule & Budget","Creative & Launch"][step-1]}`}
        back="Overview" onBack={onCancel}/>

      {/* Step indicator */}
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:28,maxWidth:500}}>
        {["Details","Schedule","Creative"].map((l,i)=>{
          const n=i+1,done=n<step,active=n===step;
          return (
            <div key={l} style={{display:"flex",alignItems:"center",flex:i<2?1:"auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,fontFamily:F.sans,background:done?C.green:active?C.blue:C.surfaceAlt,color:done||active?"#fff":C.textMuted}}>{done?"✓":n}</div>
                <span style={{fontSize:12,fontWeight:active?600:400,color:active?C.text:C.textMuted,fontFamily:F.sans}}>{l}</span>
              </div>
              {i<2&&<div style={{flex:1,height:1,background:done?C.green:C.border,margin:"0 12px"}}/>}
            </div>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:24,alignItems:"start"}}>
        <Card>
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Inp label="Your Brand / Advertiser Name" placeholder="e.g. Tim Hortons" value={form.advertiser} onChange={e=>setForm(f=>({...f,advertiser:e.target.value}))} error={errors.advertiser}/>
              <SelInput label="Ad Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </SelInput>
              <SelInput label="Choose a Screen" value={form.screenId} onChange={e=>setForm(f=>({...f,screenId:e.target.value}))}>
                {SCREENS.filter(s=>s.status==="live").map(s=><option key={s.id} value={s.id}>{s.name} — {s.city} · {(s.impressions/1000).toFixed(0)}K impr/mo · £{s.cpm} CPM</option>)}
              </SelInput>
              {screen&&<div style={{padding:"12px 14px",background:C.blueSoft,border:`1px solid ${C.blueBorder}`,borderRadius:8,fontSize:12,color:C.blue,fontFamily:F.sans}}><strong>{screen.name}</strong> · {screen.neighbourhood}, {screen.city} · Max {screen.maxDuration}s ads</div>}
            </div>
          )}
          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Inp label="Start Date" type="date" value={form.start} onChange={e=>setForm(f=>({...f,start:e.target.value}))} error={errors.start} min={new Date().toISOString().split("T")[0]}/>
                <Inp label="End Date" type="date" value={form.end} onChange={e=>setForm(f=>({...f,end:e.target.value}))} error={errors.end} min={form.start}/>
              </div>
              <div>
                <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Days of Week</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {DAYS.map(d=>{const on=(form.days||[]).includes(d);return <button key={d} onClick={()=>setForm(f=>({...f,days:on?f.days.filter(x=>x!==d):[...f.days,d]}))} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${on?C.blue:C.border}`,background:on?C.blueSoft:C.surface,color:on?C.blue:C.textSub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:F.sans}}>{d}</button>;})}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <SelInput label="Start Time" value={form.timeStart} onChange={e=>setForm(f=>({...f,timeStart:e.target.value}))}>{HOURS.map(h=><option key={h}>{h}</option>)}</SelInput>
                <SelInput label="End Time" value={form.timeEnd} onChange={e=>setForm(f=>({...f,timeEnd:e.target.value}))}>{HOURS.map(h=><option key={h}>{h}</option>)}</SelInput>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Slot Share — {form.slots}%</label>
                  <input type="range" min={1} max={80} value={form.slots} onChange={e=>setForm(f=>({...f,slots:parseInt(e.target.value)}))} style={{width:"100%",accentColor:C.blue}}/>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Ad Duration — {form.duration}s</label>
                  <input type="range" min={5} max={screen?.maxDuration||30} value={form.duration} onChange={e=>setForm(f=>({...f,duration:parseInt(e.target.value)}))} style={{width:"100%",accentColor:C.blue}}/>
                </div>
              </div>
              <Inp label="Total Campaign Budget (£)" type="number" min={100} value={form.budget} onChange={e=>setForm(f=>({...f,budget:parseInt(e.target.value)||0}))} hint={`~${estImpr.toLocaleString()} impressions over ${days} days`}/>
            </div>
          )}
          {step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Inp label="Ad Headline" placeholder="e.g. Start Your Morning Right" value={form.headline} onChange={e=>setForm(f=>({...f,headline:e.target.value}))}/>
              <Inp label="Call to Action" placeholder="e.g. Order Now →" value={form.cta} onChange={e=>setForm(f=>({...f,cta:e.target.value}))}/>
              <Inp label="QR Code Destination URL" placeholder="https://yoursite.com/promo" value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))} error={errors.destination} hint="Where people go after scanning your QR code. You own this page completely."/>
              <div>
                <label style={{fontSize:13,fontWeight:500,color:C.textMid,fontFamily:F.sans,display:"block",marginBottom:6}}>Accent Colour</label>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {["#f59e0b","#2563eb","#16a34a","#dc2626","#7c3aed","#0891b2","#ffffff","#111827"].map(col=>(
                    <div key={col} onClick={()=>setForm(f=>({...f,color:col}))} style={{width:28,height:28,borderRadius:"50%",background:col,cursor:"pointer",border:`3px solid ${form.color===col?C.blue:"transparent"}`,outline:`1px solid ${C.border}`}}/>
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div style={{borderRadius:10,overflow:"hidden",aspectRatio:"16/9",position:"relative",background:"linear-gradient(145deg,#050a10,#0a1520)"}}>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.88),rgba(0,0,0,0.1))"}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"14px 18px"}}>
                  <div style={{fontSize:7,color:"rgba(255,255,255,0.35)",letterSpacing:"2px",textTransform:"uppercase",marginBottom:5,fontFamily:F.sans}}>{form.category}</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:"#fff",lineHeight:1.1,marginBottom:8}}>{form.headline||"Your Headline"}</div>
                  <div style={{display:"inline-block",padding:"4px 12px",border:`1.5px solid ${form.color}`,color:form.color,fontSize:9,borderRadius:2,fontFamily:F.sans}}>{form.cta}</div>
                </div>
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:form.color}}/>
              </div>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
            <Btn variant="secondary" onClick={step===1?onCancel:()=>setStep(s=>s-1)}>{step===1?"Cancel":"← Back"}</Btn>
            {step<3?<Btn onClick={()=>setStep(s=>s+1)} disabled={step===1&&!form.advertiser}>Next →</Btn>:<Btn onClick={handleSave} style={{background:"#635bff"}}>🚀 Launch Campaign</Btn>}
          </div>
        </Card>

        {/* Summary sidebar */}
        <Card style={{position:"sticky",top:80}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F.sans,marginBottom:14}}>Campaign Summary</div>
          {[["Screen",screen?.name||"—"],["City",screen?.city||"—"],["Duration",days+" days"],["Impressions",`~${estImpr.toLocaleString()}`],["CPM",`£${screen?.cpm?.toFixed(2)||"4.20"}`]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontFamily:F.sans}}>
              <span style={{fontSize:12,color:C.textSub}}>{l}</span><span style={{fontSize:12,fontWeight:500,color:C.text}}>{v}</span>
            </div>
          ))}
          <div style={{marginTop:14,padding:"12px",background:C.blueSoft,borderRadius:8}}>
            <div style={{fontSize:22,fontWeight:800,color:C.text,fontFamily:F.sans}}>£{form.budget.toLocaleString()}</div>
            <div style={{fontSize:11,color:C.textSub,fontFamily:F.sans,marginBottom:8}}>total campaign budget</div>
            {[["Platform (12%)",`£${Math.round(form.budget*0.12)}`],["Screen Owner (40%)",`£${Math.round(form.budget*0.88*0.40)}`],["Network",`£${Math.round(form.budget*0.88*0.60)}`]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.textSub,fontFamily:F.sans,marginBottom:3}}>
                <span>{l}</span><span style={{fontWeight:500,color:C.textMid}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:10,fontSize:11,color:C.textMuted,fontFamily:F.sans,lineHeight:1.6}}>💡 Ads only play when people are present at the screen.</div>
        </Card>
      </div>
    </div>
  );
}

export default function App() {
  const { user, profile, role, loading, signOut } = useAuth();
  const [active,    setActive]    = useState("overview");
  const [campaigns, setCampaigns] = useState([]);
  const [dbScreens, setDbScreens] = useState([]);
  const [detail,    setDetail]    = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const [{ data: bookings }, { data: screens }] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('screens').select('*').order('name'),
    ]);
    if (bookings) setCampaigns(bookings.map(b => ({
      ...b,
      advertiser: b.advertiser_name,
      screen: b.screen_name,
      start: b.start_date,
      end: b.end_date,
      days: b.schedule_days,
      timeStart: b.time_start,
      timeEnd: b.time_end,
      spent: Math.round(b.budget * 0.65),
      scans: Math.round(b.impressions * 0.003),
      color: b.accent_color,
      destination: b.destination_url,
    })));
    if (screens) setDbScreens(screens.map(s => ({
      ...s,
      neighbourhood: s.location,
      cpm: 4.20,
      maxDuration: s.max_ad_duration,
      revenue: s.monthly_revenue,
    })));
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      setActive(role === 'advertiser' ? 'adv-overview' : 'overview');
      loadData();
    }
  }, [user, role, loadData]);

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:13,color:C.textSub,fontFamily:"system-ui,sans-serif"}}>Loading…</div>
    </div>
  );

  if (!user) return <LoginPage />;

  const isAdv = role === 'advertiser';
  const nav   = isAdv ? ADV_NAV : OP_NAV;
  const displayUser = { name: profile?.name || user.email?.split('@')[0] || 'User', email: user.email, role };

  const updateCampaign = updated => {
    setCampaigns(prev => prev.map(c => c.id === updated.id ? updated : c));
    setDetail(updated);
  };

  const liveCount = dbScreens.filter(s => s.status === 'live').length || SCREENS.filter(s => s.status === 'live').length;
  const screenData = dbScreens.length > 0 ? dbScreens : SCREENS;

  const view = () => {
    if (detail && (active==="campaigns"||active==="analytics")) {
      return <CampaignDetail campaign={detail} onBack={()=>setDetail(null)} onUpdate={updateCampaign}/>;
    }
    if (isAdv) {
      if (active==="adv-overview")     return <AdvOverview user={displayUser} campaigns={campaigns} setAdvNav={setActive}/>;
      if (active==="adv-create")       return <AdvCreate onSave={c=>{setCampaigns(p=>[c,...p]);setActive("adv-campaigns");}} onCancel={()=>setActive("adv-overview")}/>;
      if (active==="adv-campaigns")    return <OperatorCampaigns campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c=>{setDetail(c);setActive("adv-campaigns");}}/>;
      if (active==="adv-analytics")    return <OperatorAnalytics campaigns={campaigns}/>;
      if (active==="adv-audience")     return <Placeholder title="Scans & Data" subtitle="QR leads and remarketing export" icon="◎"/>;
      if (active==="adv-billing")      return <Placeholder title="Billing" subtitle="Invoices and payments" icon="$"/>;
      if (active==="adv-integrations") return <Placeholder title="Integrations" subtitle="Meta, Google, Shopify and more" icon="⇌"/>;
      if (active==="adv-settings")     return <Placeholder title="Settings" subtitle="Account and preferences" icon="⚙"/>;
      return <AdvOverview user={displayUser} campaigns={campaigns} setAdvNav={setActive}/>;
    }
    if (active==="overview")     return <OperatorOverview campaigns={campaigns} setNav={setActive}/>;
    if (active==="screens")      return <ScreensView/>;
    if (active==="campaigns")    return <OperatorCampaigns campaigns={campaigns} setCampaigns={setCampaigns} setDetail={c=>{setDetail(c);}}/>;
    if (active==="analytics")    return <OperatorAnalytics campaigns={campaigns}/>;
    if (active==="audience")     return <AudienceView campaigns={campaigns}/>;
    if (active==="revenue")      return <OperatorRevenue campaigns={campaigns}/>;
    if (active==="billing")      return <BillingView campaigns={campaigns}/>;
    if (active==="advertisers")  return <Placeholder title="Advertisers" subtitle="Manage advertiser accounts" icon="◉"/>;
    if (active==="signals")      return <SignalsView campaigns={campaigns}/>;
    if (active==="integrations") return <IntegrationsView/>;
    if (active==="display")      return <DisplayView campaigns={campaigns}/>;
    return <OperatorOverview campaigns={campaigns} setNav={setActive}/>;
  };

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:F.sans,overflow:"hidden"}}>
      <style>{`
        @import url('${FONT}');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${C.bg};}
        ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px;}
        input,select{outline:none;}
        input:focus,select:focus{border-color:${C.blue}!important;}
      `}</style>
      <Sidebar nav={nav} active={active} setActive={v=>{setActive(v);setDetail(null);}} user={displayUser} onSignOut={signOut}/>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <div style={{height:52,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",background:C.surface,flexShrink:0,position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:C.textMuted}}>ADGRID</span>
            <span style={{color:C.border,fontSize:14}}>›</span>
            <span style={{fontSize:12,fontWeight:500,color:C.text,textTransform:"capitalize"}}>{active.replace("adv-","").replace(/-/g," ")}</span>
            {detail&&<><span style={{color:C.border,fontSize:14}}>›</span><span style={{fontSize:12,color:C.textSub}}>{detail.advertiser}</span></>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",background:C.greenSoft,border:`1px solid ${C.greenBorder}`,borderRadius:20}}>
              <Dot status="live"/>
              <span style={{fontSize:11,fontWeight:500,color:C.green,fontFamily:F.sans}}>{liveCount} screens live</span>
            </div>
            <div style={{width:30,height:30,borderRadius:"50%",background:C.blueSoft,border:`1px solid ${C.blueBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:C.blue,cursor:"pointer"}}>
              {(displayUser.name||"U")[0].toUpperCase()}
            </div>
          </div>
        </div>
        <div style={{padding:"28px 32px",flex:1}}>
          {dataLoading ? <div style={{fontSize:13,color:C.textSub,fontFamily:F.sans}}>Loading data…</div> : view()}
        </div>
      </div>
    </div>
  );
}
