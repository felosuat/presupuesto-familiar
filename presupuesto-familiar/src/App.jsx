import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { db } from "./firebase.js";

const CATEGORIES = [
  { id: "hogar",        label: "Hogar",        icon: "🏠", color: "#C8956C" },
  { id: "vacaciones",   label: "Vacaciones",   icon: "✈️", color: "#6C9EC8" },
  { id: "ahorros",      label: "Ahorros",      icon: "🐷", color: "#6CC87A" },
  { id: "educacion",    label: "Educación",    icon: "📚", color: "#A86CC8" },
  { id: "salud",        label: "Salud",        icon: "❤️", color: "#C86C6C" },
  { id: "auto",         label: "Auto",         icon: "🚗", color: "#C8C06C" },
  { id: "ropa",         label: "Ropa",         icon: "👗", color: "#C86CA8" },
  { id: "restaurantes", label: "Restaurantes", icon: "🍽️", color: "#6CC8C0" },
  { id: "otros",        label: "Otros",        icon: "📦", color: "#9E9E9E" },
];
const USERS = [
  { id: "francisco", label: "Francisco", color: "#1a3a5c" },
  { id: "esposa",    label: "Mi esposa",  color: "#8B4A6B" },
];
const PAYMENT = [
  { id: "cash",    label: "Cash",    icon: "💵" },
  { id: "tarjeta", label: "Tarjeta", icon: "💳" },
];
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const fmt = (n) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(n);
const pad = (n) => String(n).padStart(2,"0");
const today = new Date();
const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

function projectedDate(originalDate, month, year) {
  const orig = new Date(originalDate+"T12:00:00");
  const day = Math.min(orig.getDate(), new Date(year,month+1,0).getDate());
  return `${year}-${pad(month+1)}-${pad(day)}`;
}

function getExpensesForMonth(baseExpenses, month, year) {
  const results = [];
  for (const exp of baseExpenses) {
    if (!exp.date) continue;
    const d = new Date(exp.date+"T12:00:00");
    const expMonth = d.getMonth(), expYear = d.getFullYear();
    if (exp.recurring) {
      const originNum = expYear*12+expMonth, targetNum = year*12+month;
      if (targetNum >= originNum) {
        const isSame = expYear===year && expMonth===month;
        const key = `${year}-${pad(month+1)}`;
        results.push({
          ...exp,
          date: isSame ? exp.date : projectedDate(exp.date,month,year),
          isProjected: !isSame,
          paid: isSame ? (exp.paid||false) : (exp.recurringPaid?.[key]?.paid||false),
          paidAmount: isSame ? (exp.paidAmount??null) : (exp.recurringPaid?.[key]?.paidAmount??null),
        });
      }
    } else {
      if (expMonth===month && expYear===year) results.push(exp);
    }
  }
  return results.sort((a,b)=>a.date.localeCompare(b.date));
}

function Modal({onClose,children}) {
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(10,20,35,0.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"16px"}}>
      <div style={{background:"#FDFAF5",borderRadius:"20px",padding:"28px 24px",width:"100%",maxWidth:"440px",boxShadow:"0 24px 60px rgba(0,0,0,0.18)",maxHeight:"90vh",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  );
}

function ExpenseForm({initial,onSave,onClose,saving}) {
  const [form,setForm] = useState(initial||{name:"",amount:"",date:todayStr,category:"hogar",user:"francisco",payment:"cash",note:"",recurring:false});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inp = {width:"100%",padding:"10px 12px",borderRadius:"10px",border:"1.5px solid #E5DDD0",background:"#FFF9F2",fontSize:"15px",color:"#1a1a1a",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const lbl = {display:"block",fontSize:"12px",fontWeight:600,color:"#888",marginBottom:"5px",letterSpacing:"0.05em",textTransform:"uppercase"};
  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
        <h2 style={{margin:0,fontSize:"18px",fontFamily:"'Playfair Display',Georgia,serif",color:"#1a3a5c"}}>{initial?"Editar gasto":"Nuevo gasto planeado"}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:"22px",cursor:"pointer",color:"#999"}}>×</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
        <div><label style={lbl}>Descripción</label><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Vuelo Cancún, Colegiatura..." style={inp}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
          <div><label style={lbl}>Monto (MXN)</label><input type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0" style={inp}/></div>
          <div><label style={lbl}>Fecha</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={inp}/></div>
        </div>
        <div>
          <label style={lbl}>Forma de pago</label>
          <div style={{display:"flex",gap:"10px"}}>
            {PAYMENT.map(p=>(
              <button key={p.id} onClick={()=>set("payment",p.id)}
                style={{flex:1,padding:"10px",borderRadius:"12px",cursor:"pointer",border:`2px solid ${form.payment===p.id?"#1a3a5c":"#E5DDD0"}`,background:form.payment===p.id?"#1a3a5c15":"#FFF",color:form.payment===p.id?"#1a3a5c":"#888",fontWeight:form.payment===p.id?700:400,fontSize:"14px",fontFamily:"inherit",transition:"all 0.15s"}}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>Categoría</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:"7px"}}>
            {CATEGORIES.map(c=>(
              <button key={c.id} onClick={()=>set("category",c.id)}
                style={{padding:"6px 12px",borderRadius:"20px",fontSize:"13px",cursor:"pointer",border:`2px solid ${form.category===c.id?c.color:"#E5DDD0"}`,background:form.category===c.id?c.color+"22":"#FFF",color:form.category===c.id?c.color:"#666",fontWeight:form.category===c.id?600:400,transition:"all 0.15s"}}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>¿Quién lo agrega?</label>
          <div style={{display:"flex",gap:"10px"}}>
            {USERS.map(u=>(
              <button key={u.id} onClick={()=>set("user",u.id)}
                style={{flex:1,padding:"10px",borderRadius:"12px",cursor:"pointer",border:`2px solid ${form.user===u.id?u.color:"#E5DDD0"}`,background:form.user===u.id?u.color+"15":"#FFF",color:form.user===u.id?u.color:"#888",fontWeight:form.user===u.id?700:400,fontSize:"14px",fontFamily:"inherit",transition:"all 0.15s"}}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div><label style={lbl}>Nota (opcional)</label><textarea value={form.note} onChange={e=>set("note",e.target.value)} placeholder="Algún detalle..." rows={2} style={{...inp,resize:"none"}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <input type="checkbox" id="rec" checked={form.recurring} onChange={e=>set("recurring",e.target.checked)} style={{width:"16px",height:"16px",cursor:"pointer"}}/>
          <label htmlFor="rec" style={{fontSize:"14px",color:"#555",cursor:"pointer"}}>Gasto recurrente — se repite cada mes automáticamente</label>
        </div>
        <button onClick={()=>{if(!form.name.trim()||!form.amount||!form.date)return;onSave({...form,amount:parseFloat(form.amount)});}} disabled={saving}
          style={{width:"100%",padding:"13px",borderRadius:"12px",border:"none",background:saving?"#AAA":"linear-gradient(135deg,#1a3a5c 0%,#2a5a8c 100%)",color:"#FFF",fontSize:"15px",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",marginTop:"4px"}}>
          {saving?"Guardando...":(initial?"Guardar cambios":"Agregar al presupuesto")}
        </button>
      </div>
    </>
  );
}

function PaidModal({exp,onSave,onClose,saving}) {
  const [paid,setPaid] = useState(exp.paid||false);
  const [paidAmount,setPaidAmount] = useState(exp.paidAmount!=null?String(exp.paidAmount):String(exp.amount));
  const diff = paid&&paidAmount ? parseFloat(paidAmount)-exp.amount : 0;
  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
        <h2 style={{margin:0,fontSize:"18px",fontFamily:"'Playfair Display',Georgia,serif",color:"#1a3a5c"}}>Registrar pago real</h2>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:"22px",cursor:"pointer",color:"#999"}}>×</button>
      </div>
      <div style={{background:"#F5EFE8",borderRadius:"12px",padding:"12px 14px",marginBottom:"16px"}}>
        <p style={{margin:0,fontWeight:600,fontSize:"15px"}}>{exp.name}</p>
        <p style={{margin:"2px 0 0",fontSize:"13px",color:"#888"}}>Presupuestado: {fmt(exp.amount)}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <input type="checkbox" id="paid" checked={paid} onChange={e=>setPaid(e.target.checked)} style={{width:"18px",height:"18px",cursor:"pointer"}}/>
          <label htmlFor="paid" style={{fontSize:"15px",fontWeight:600,color:"#1a3a5c",cursor:"pointer"}}>✅ Marcar como pagado</label>
        </div>
        {paid&&(
          <div>
            <label style={{display:"block",fontSize:"12px",fontWeight:600,color:"#888",marginBottom:"5px",letterSpacing:"0.05em",textTransform:"uppercase"}}>¿Cuánto pagaste realmente? (MXN)</label>
            <input type="number" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)}
              style={{width:"100%",padding:"10px 12px",borderRadius:"10px",border:"1.5px solid #E5DDD0",background:"#FFF9F2",fontSize:"15px",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            {paidAmount&&diff!==0&&(
              <p style={{margin:"6px 0 0",fontSize:"13px",color:diff>0?"#C86C6C":"#6CC87A"}}>
                {diff>0?`⚠️ ${fmt(diff)} más de lo planeado`:`✅ ${fmt(Math.abs(diff))} menos de lo planeado`}
              </p>
            )}
          </div>
        )}
        <button onClick={()=>onSave({paid,paidAmount:paid&&paidAmount?parseFloat(paidAmount):null})} disabled={saving}
          style={{width:"100%",padding:"13px",borderRadius:"12px",border:"none",background:saving?"#AAA":"linear-gradient(135deg,#1a3a5c 0%,#2a5a8c 100%)",color:"#FFF",fontSize:"15px",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {saving?"Guardando...":"Guardar"}
        </button>
      </div>
    </>
  );
}

export default function App() {
  const [allExpenses,setAllExpenses]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [editTarget,setEditTarget]=useState(null);
  const [paidTarget,setPaidTarget]=useState(null);
  const [saving,setSaving]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [filterMonth,setFilterMonth]=useState(today.getMonth());
  const [filterYear,setFilterYear]=useState(today.getFullYear());
  const [filterCat,setFilterCat]=useState("all");
  const [filterUser,setFilterUser]=useState("all");
  const [filterPayment,setFilterPayment]=useState("all");
  const [activeTab,setActiveTab]=useState("timeline");

  useEffect(()=>{
    const q=query(collection(db,"expenses"),orderBy("date","asc"));
    return onSnapshot(q,snap=>{setAllExpenses(snap.docs.map(d=>({id:d.id,...d.data()})));setLoaded(true);},err=>{console.error(err);setLoaded(true);});
  },[]);

  const addExpense=async(form)=>{setSaving(true);try{await addDoc(collection(db,"expenses"),{...form,createdAt:serverTimestamp()});setShowForm(false);}finally{setSaving(false);}};
  const updateExpense=async(form)=>{setSaving(true);try{await updateDoc(doc(db,"expenses",editTarget.id),{...form});setEditTarget(null);}finally{setSaving(false);}};
  const savePaid=async({paid,paidAmount})=>{
    setSaving(true);
    try{
      if(paidTarget.isProjected){
        const key=`${filterYear}-${pad(filterMonth+1)}`;
        const base=allExpenses.find(e=>e.id===paidTarget.id);
        const rp={...(base?.recurringPaid||{}),[key]:{paid,paidAmount}};
        await updateDoc(doc(db,"expenses",paidTarget.id),{recurringPaid:rp});
      } else {
        await updateDoc(doc(db,"expenses",paidTarget.id),{paid,paidAmount});
      }
      setPaidTarget(null);
    }finally{setSaving(false);}
  };
  const deleteExpense=async(id)=>{await deleteDoc(doc(db,"expenses",id));setDeleteConfirm(null);};

  const prevMonth=()=>{if(filterMonth===0){setFilterMonth(11);setFilterYear(y=>y-1);}else setFilterMonth(m=>m-1);};
  const nextMonth=()=>{if(filterMonth===11){setFilterMonth(0);setFilterYear(y=>y+1);}else setFilterMonth(m=>m+1);};

  const monthExp=getExpensesForMonth(allExpenses,filterMonth,filterYear);
  const filtered=monthExp.filter(e=>(filterCat==="all"||e.category===filterCat)&&(filterUser==="all"||e.user===filterUser)&&(filterPayment==="all"||e.payment===filterPayment));

  const totalPlanned=filtered.reduce((s,e)=>s+e.amount,0);
  const paidExps=filtered.filter(e=>e.paid);
  const totalPaid=paidExps.reduce((s,e)=>s+(e.paidAmount??e.amount),0);
  const totalPaidPlanned=paidExps.reduce((s,e)=>s+e.amount,0);
  const totalPending=filtered.filter(e=>!e.paid).reduce((s,e)=>s+e.amount,0);
  const diff=totalPaid-totalPaidPlanned;

  const catOf=id=>CATEGORIES.find(c=>c.id===id)||CATEGORIES[CATEGORIES.length-1];
  const userOf=id=>USERS.find(u=>u.id===id)||USERS[0];
  const payOf=id=>PAYMENT.find(p=>p.id===id)||PAYMENT[0];

  const byCategory=CATEGORIES.map(c=>{
    const exps=filtered.filter(e=>e.category===c.id);
    return{...c,planned:exps.reduce((s,e)=>s+e.amount,0),real:exps.filter(e=>e.paid).reduce((s,e)=>s+(e.paidAmount??e.amount),0),count:exps.length,paidCount:exps.filter(e=>e.paid).length};
  }).filter(c=>c.planned>0).sort((a,b)=>b.planned-a.planned);

  const byUser=USERS.map(u=>({...u,planned:filtered.filter(e=>e.user===u.id).reduce((s,e)=>s+e.amount,0),real:filtered.filter(e=>e.user===u.id&&e.paid).reduce((s,e)=>s+(e.paidAmount??e.amount),0),count:filtered.filter(e=>e.user===u.id).length}));

  if(!loaded)return(<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FDFAF5"}}><div style={{fontFamily:"'Playfair Display',Georgia,serif",color:"#1a3a5c",fontSize:"22px"}}>Cargando...</div></div>);

  const tabBtn=(id,label)=>(
    <button key={id} onClick={()=>setActiveTab(id)}
      style={{flex:1,padding:"9px",borderRadius:"9px",border:"none",background:activeTab===id?"#FFF":"transparent",color:activeTab===id?"#1a3a5c":"#888",fontWeight:activeTab===id?700:500,fontSize:"12px",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",boxShadow:activeTab===id?"0 2px 8px rgba(0,0,0,0.08)":"none"}}>
      {label}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#FDFAF5 0%,#F5EFE8 100%)",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#1a1a1a"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;}`}</style>

      <div style={{background:"linear-gradient(135deg,#1a3a5c 0%,#0f2340 100%)",padding:"20px 20px 16px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:"480px",margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div>
              <p style={{margin:0,fontSize:"11px",color:"#8AAFD0",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:600}}>Presupuesto familiar</p>
              <h1 style={{margin:"2px 0 0",fontSize:"22px",fontFamily:"'Playfair Display',Georgia,serif",color:"#FDFAF5",fontWeight:600}}>Familia Elosua</h1>
            </div>
            <button onClick={()=>setShowForm(true)} style={{padding:"10px 18px",borderRadius:"50px",border:"none",background:"linear-gradient(135deg,#C8956C,#D4A574)",color:"#FFF",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 15px rgba(200,149,108,0.4)"}}>+ Agregar</button>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"16px"}}>
            <button onClick={prevMonth} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#FFF",width:"32px",height:"32px",borderRadius:"50%",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <span style={{color:"#FDFAF5",fontSize:"16px",fontWeight:600}}>{MONTHS[filterMonth]} {filterYear}</span>
            <button onClick={nextMonth} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#FFF",width:"32px",height:"32px",borderRadius:"50%",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:"480px",margin:"0 auto",padding:"16px"}}>
        {/* Summary card */}
        <div style={{background:"linear-gradient(135deg,#C8956C 0%,#A06840 100%)",borderRadius:"16px",padding:"20px 22px",marginBottom:"16px",boxShadow:"0 8px 24px rgba(200,149,108,0.3)"}}>
          <p style={{margin:0,fontSize:"12px",color:"rgba(255,255,255,0.75)",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600}}>Total planeado · {MONTHS[filterMonth]}</p>
          <p style={{margin:"4px 0 12px",fontSize:"32px",fontWeight:700,color:"#FFF",fontFamily:"'Playfair Display',Georgia,serif"}}>{fmt(totalPlanned)}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px"}}>
            {[["✅ Pagado",fmt(totalPaid)],["⏳ Pendiente",fmt(totalPending)],[diff>0?"⚠️ Extra":"💚 Ahorro",fmt(Math.abs(diff))]].map(([l,v])=>(
              <div key={l} style={{background:"rgba(255,255,255,0.2)",borderRadius:"10px",padding:"8px 10px"}}>
                <p style={{margin:0,fontSize:"10px",color:"rgba(255,255,255,0.8)",fontWeight:600}}>{l}</p>
                <p style={{margin:"2px 0 0",fontSize:"13px",fontWeight:700,color:"#FFF"}}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",background:"#EDE6DC",borderRadius:"12px",padding:"4px",marginBottom:"16px"}}>
          {[["timeline","📋 Gastos"],["resumen","📊 Resumen"],["reporte","📈 vs. Real"]].map(([id,lbl])=>tabBtn(id,lbl))}
        </div>

        {/* Filters */}
        <div style={{display:"flex",gap:"8px",marginBottom:"14px",overflowX:"auto",paddingBottom:"4px"}}>
          {[
            [filterUser,setFilterUser,[["all","👥 Todos"],...USERS.map(u=>[u.id,u.label])]],
            [filterCat,setFilterCat,[["all","🗂️ Todas"],...CATEGORIES.map(c=>[c.id,`${c.icon} ${c.label}`])]],
            [filterPayment,setFilterPayment,[["all","💰 Pago"],...PAYMENT.map(p=>[p.id,`${p.icon} ${p.label}`])]],
          ].map(([val,setter,opts],i)=>(
            <select key={i} value={val} onChange={e=>setter(e.target.value)}
              style={{padding:"7px 10px",borderRadius:"20px",border:"1.5px solid #E5DDD0",background:"#FFF",fontSize:"13px",cursor:"pointer",color:"#444",outline:"none",fontFamily:"inherit",flexShrink:0}}>
              {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>

        {/* Timeline */}
        {activeTab==="timeline"&&(
          filtered.length===0?(
            <div style={{textAlign:"center",padding:"48px 20px",color:"#B0A090"}}>
              <div style={{fontSize:"48px",marginBottom:"12px"}}>📭</div>
              <p style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"18px",color:"#888",margin:"0 0 6px"}}>Sin gastos planeados</p>
              <p style={{fontSize:"14px",margin:0}}>Agrega el primer gasto del mes</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {filtered.map(exp=>{
                const cat=catOf(exp.category),user=userOf(exp.user),pay=payOf(exp.payment);
                const d=new Date(exp.date+"T12:00:00");
                const isPast=exp.date<todayStr;
                return (
                  <div key={exp.id+(exp.isProjected?`-p${filterMonth}`:"")}
                    style={{background:"#FFF",borderRadius:"14px",padding:"14px 16px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",borderLeft:`4px solid ${cat.color}`,opacity:isPast&&!exp.paid?0.7:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px",flexWrap:"wrap"}}>
                          <span>{cat.icon}</span>
                          <span style={{fontWeight:600,fontSize:"15px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{exp.name}</span>
                          {exp.recurring&&<span style={{fontSize:"10px",background:"#E8F4FE",color:"#1a7ac7",padding:"1px 6px",borderRadius:"20px",fontWeight:600,flexShrink:0}}>↻ recurrente</span>}
                          {exp.paid&&<span style={{fontSize:"10px",background:"#E8FEF0",color:"#1a7a3c",padding:"1px 6px",borderRadius:"20px",fontWeight:600,flexShrink:0}}>✅ pagado</span>}
                        </div>
                        <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{fontSize:"12px",color:"#999"}}>{pad(d.getDate())} {MONTHS[d.getMonth()]}</span>
                          <span style={{fontSize:"11px",color:"#FFF",background:user.color,padding:"1px 7px",borderRadius:"20px",fontWeight:600}}>{user.label}</span>
                          <span style={{fontSize:"11px",color:"#666",background:"#F0EDE8",padding:"1px 7px",borderRadius:"20px"}}>{pay.icon} {pay.label}</span>
                        </div>
                        {exp.paid&&exp.paidAmount!=null&&exp.paidAmount!==exp.amount&&(
                          <p style={{margin:"4px 0 0",fontSize:"12px",color:exp.paidAmount>exp.amount?"#C86C6C":"#6CC87A"}}>
                            Real: {fmt(exp.paidAmount)} ({exp.paidAmount>exp.amount?"+":""}{fmt(exp.paidAmount-exp.amount)})
                          </p>
                        )}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px",marginLeft:"12px"}}>
                        <span style={{fontSize:"16px",fontWeight:700,color:"#1a3a5c"}}>{fmt(exp.amount)}</span>
                        <div style={{display:"flex",gap:"5px"}}>
                          <button onClick={()=>setPaidTarget(exp)} title="Registrar pago real"
                            style={{background:exp.paid?"#E8FEF0":"#F0EDE8",border:"none",borderRadius:"8px",width:"28px",height:"28px",cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {exp.paid?"✅":"☑️"}
                          </button>
                          {!exp.isProjected&&<>
                            <button onClick={()=>setEditTarget(exp)} style={{background:"#F0EDE8",border:"none",borderRadius:"8px",width:"28px",height:"28px",cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                            <button onClick={()=>setDeleteConfirm(exp.id)} style={{background:"#FEF0F0",border:"none",borderRadius:"8px",width:"28px",height:"28px",cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                          </>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Resumen */}
        {activeTab==="resumen"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            {byCategory.length===0?(
              <div style={{textAlign:"center",padding:"48px 20px"}}><div style={{fontSize:"48px",marginBottom:"12px"}}>📊</div><p style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"18px",color:"#888",margin:0}}>Sin datos</p></div>
            ):(
              <>
                <h3 style={{margin:"0 0 4px",fontSize:"13px",fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.08em"}}>Por categoría</h3>
                {byCategory.map(c=>{
                  const pct=totalPlanned>0?(c.planned/totalPlanned)*100:0;
                  return(
                    <div key={c.id} style={{background:"#FFF",borderRadius:"12px",padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span style={{fontWeight:600,fontSize:"14px"}}>{c.icon} {c.label}</span><span style={{fontWeight:700,fontSize:"15px",color:c.color}}>{fmt(c.planned)}</span></div>
                      <div style={{background:"#F0EDE8",borderRadius:"6px",height:"6px",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:c.color,borderRadius:"6px"}}/></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}><span style={{fontSize:"11px",color:"#AAA"}}>{c.paidCount}/{c.count} pagados</span><span style={{fontSize:"11px",color:"#AAA"}}>{pct.toFixed(0)}%</span></div>
                    </div>
                  );
                })}
                <h3 style={{margin:"8px 0 4px",fontSize:"13px",fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.08em"}}>Por persona</h3>
                {byUser.map(u=>{
                  const pct=totalPlanned>0?(u.planned/totalPlanned)*100:0;
                  return(
                    <div key={u.id} style={{background:"#FFF",borderRadius:"12px",padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span style={{fontWeight:600,fontSize:"14px"}}>{u.label}</span><span style={{fontWeight:700,fontSize:"15px",color:u.color}}>{fmt(u.planned)}</span></div>
                      <div style={{background:"#F0EDE8",borderRadius:"6px",height:"6px",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:u.color,borderRadius:"6px"}}/></div>
                      <div style={{fontSize:"11px",color:"#AAA",marginTop:"4px"}}>{u.count} gastos · {pct.toFixed(0)}%</div>
                    </div>
                  );
                })}
                <h3 style={{margin:"8px 0 4px",fontSize:"13px",fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.08em"}}>Por forma de pago</h3>
                {PAYMENT.map(p=>{
                  const exps=filtered.filter(e=>e.payment===p.id);
                  const total=exps.reduce((s,e)=>s+e.amount,0);
                  if(total===0)return null;
                  const pct=totalPlanned>0?(total/totalPlanned)*100:0;
                  return(
                    <div key={p.id} style={{background:"#FFF",borderRadius:"12px",padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span style={{fontWeight:600,fontSize:"14px"}}>{p.icon} {p.label}</span><span style={{fontWeight:700,fontSize:"15px",color:"#1a3a5c"}}>{fmt(total)}</span></div>
                      <div style={{background:"#F0EDE8",borderRadius:"6px",height:"6px",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"#1a3a5c",borderRadius:"6px"}}/></div>
                      <div style={{fontSize:"11px",color:"#AAA",marginTop:"4px"}}>{exps.length} gastos · {pct.toFixed(0)}%</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Reporte vs Real */}
        {activeTab==="reporte"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div style={{background:"#FFF",borderRadius:"14px",padding:"14px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                <p style={{margin:0,fontSize:"11px",color:"#888",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>Presupuestado</p>
                <p style={{margin:"4px 0 0",fontSize:"22px",fontWeight:700,color:"#1a3a5c",fontFamily:"'Playfair Display',Georgia,serif"}}>{fmt(totalPlanned)}</p>
                <p style={{margin:"2px 0 0",fontSize:"12px",color:"#AAA"}}>{filtered.length} gastos</p>
              </div>
              <div style={{background:"#FFF",borderRadius:"14px",padding:"14px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                <p style={{margin:0,fontSize:"11px",color:"#888",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>Real pagado</p>
                <p style={{margin:"4px 0 0",fontSize:"22px",fontWeight:700,color:diff>0?"#C86C6C":"#6CC87A",fontFamily:"'Playfair Display',Georgia,serif"}}>{fmt(totalPaid)}</p>
                <p style={{margin:"2px 0 0",fontSize:"12px",color:diff>0?"#C86C6C":"#6CC87A"}}>{diff>0?`+${fmt(diff)} sobre presupuesto`:diff<0?`${fmt(Math.abs(diff))} de ahorro`:"Exacto"}</p>
              </div>
            </div>
            <div style={{background:"#FFF",borderRadius:"14px",padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
              <p style={{margin:"0 0 8px",fontSize:"13px",fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em"}}>Avance del mes</p>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                <span style={{fontSize:"13px",color:"#555"}}>Gastos pagados</span>
                <span style={{fontSize:"13px",fontWeight:600}}>{totalPlanned>0?((totalPaid/totalPlanned)*100).toFixed(0):0}%</span>
              </div>
              <div style={{background:"#F0EDE8",borderRadius:"8px",height:"10px",overflow:"hidden"}}>
                <div style={{width:`${totalPlanned>0?Math.min((totalPaid/totalPlanned)*100,100):0}%`,height:"100%",background:diff>0?"#C86C6C":"#6CC87A",borderRadius:"8px",transition:"width 0.6s ease"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"6px"}}>
                <span style={{fontSize:"11px",color:"#AAA"}}>{paidExps.length} de {filtered.length} pagados</span>
                <span style={{fontSize:"11px",color:"#AAA"}}>Pendiente: {fmt(totalPending)}</span>
              </div>
            </div>
            <h3 style={{margin:"4px 0 0",fontSize:"13px",fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.08em"}}>Detalle por categoría</h3>
            {byCategory.length===0?(
              <div style={{textAlign:"center",padding:"32px 20px",color:"#B0A090"}}>
                <div style={{fontSize:"40px",marginBottom:"10px"}}>📈</div>
                <p style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"17px",color:"#888",margin:0}}>Sin datos aún</p>
                <p style={{fontSize:"13px",margin:"4px 0 0",color:"#AAA"}}>Agrega gastos y márcalos como pagados</p>
              </div>
            ):byCategory.map(c=>{
              const realDiff=c.real-c.planned;
              const paidPct=c.planned>0?Math.min((c.real/c.planned)*100,120):0;
              return(
                <div key={c.id} style={{background:"#FFF",borderRadius:"12px",padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                    <span style={{fontWeight:600,fontSize:"14px"}}>{c.icon} {c.label}</span>
                    <div style={{textAlign:"right"}}><span style={{fontWeight:700,fontSize:"14px",color:"#1a3a5c"}}>{fmt(c.real)}</span><span style={{fontSize:"12px",color:"#AAA"}}> / {fmt(c.planned)}</span></div>
                  </div>
                  <div style={{background:"#F0EDE8",borderRadius:"6px",height:"8px",overflow:"hidden",marginBottom:"4px"}}>
                    <div style={{width:`${paidPct}%`,height:"100%",background:realDiff>0?"#C86C6C":c.color,borderRadius:"6px",transition:"width 0.6s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:"11px",color:"#AAA"}}>{c.paidCount}/{c.count} pagados</span>
                    {c.real>0&&<span style={{fontSize:"11px",fontWeight:600,color:realDiff>0?"#C86C6C":"#6CC87A"}}>{realDiff>0?`+${fmt(realDiff)} extra`:realDiff<0?`${fmt(Math.abs(realDiff))} ahorrado`:"Exacto"}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{height:"32px"}}/>
      </div>

      {showForm&&<Modal onClose={()=>setShowForm(false)}><ExpenseForm onSave={addExpense} onClose={()=>setShowForm(false)} saving={saving}/></Modal>}
      {editTarget&&<Modal onClose={()=>setEditTarget(null)}><ExpenseForm initial={editTarget} onSave={updateExpense} onClose={()=>setEditTarget(null)} saving={saving}/></Modal>}
      {paidTarget&&<Modal onClose={()=>setPaidTarget(null)}><PaidModal exp={paidTarget} onSave={savePaid} onClose={()=>setPaidTarget(null)} saving={saving}/></Modal>}
      {deleteConfirm&&(
        <Modal onClose={()=>setDeleteConfirm(null)}>
          <h2 style={{margin:"0 0 10px",fontFamily:"'Playfair Display',Georgia,serif",color:"#1a3a5c",fontSize:"20px"}}>¿Eliminar gasto?</h2>
          <p style={{color:"#666",margin:"0 0 20px"}}>Esta acción no se puede deshacer.</p>
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,padding:"12px",borderRadius:"10px",border:"1.5px solid #E5DDD0",background:"#FFF",cursor:"pointer",fontFamily:"inherit",fontSize:"14px",fontWeight:600}}>Cancelar</button>
            <button onClick={()=>deleteExpense(deleteConfirm)} style={{flex:1,padding:"12px",borderRadius:"10px",border:"none",background:"#C86C6C",color:"#FFF",cursor:"pointer",fontFamily:"inherit",fontSize:"14px",fontWeight:700}}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
