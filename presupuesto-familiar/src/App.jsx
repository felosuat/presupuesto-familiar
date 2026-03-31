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

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

function Modal({ onClose, children }) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position:"fixed", inset:0, background:"rgba(10,20,35,0.55)",
        backdropFilter:"blur(4px)", display:"flex", alignItems:"center",
        justifyContent:"center", zIndex:100, padding:"16px",
      }}
    >
      <div style={{
        background:"#FDFAF5", borderRadius:"20px", padding:"28px 24px",
        width:"100%", maxWidth:"440px", boxShadow:"0 24px 60px rgba(0,0,0,0.18)",
        maxHeight:"90vh", overflowY:"auto",
      }}>
        {children}
      </div>
    </div>
  );
}

function ExpenseForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial || {
    name:"", amount:"", date: todayStr,
    category:"hogar", user:"francisco", note:"", recurring:false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width:"100%", padding:"10px 12px", borderRadius:"10px",
    border:"1.5px solid #E5DDD0", background:"#FFF9F2",
    fontSize:"15px", color:"#1a1a1a", outline:"none",
    fontFamily:"inherit", boxSizing:"border-box",
  };

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ margin:0, fontSize:"18px", fontFamily:"'Playfair Display',Georgia,serif", color:"#1a3a5c" }}>
          {initial ? "Editar gasto" : "Nuevo gasto planeado"}
        </h2>
        <button onClick={onClose} style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", color:"#999" }}>×</button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        <div>
          <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#888", marginBottom:"5px", letterSpacing:"0.05em", textTransform:"uppercase" }}>
            Descripción
          </label>
          <input value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="Ej: Vuelo Cancún, Pago de colegiatura..." style={inputStyle} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#888", marginBottom:"5px", letterSpacing:"0.05em", textTransform:"uppercase" }}>
              Monto (MXN)
            </label>
            <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)}
              placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#888", marginBottom:"5px", letterSpacing:"0.05em", textTransform:"uppercase" }}>
              Fecha
            </label>
            <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#888", marginBottom:"8px", letterSpacing:"0.05em", textTransform:"uppercase" }}>
            Categoría
          </label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"7px" }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => set("category", c.id)}
                style={{
                  padding:"6px 12px", borderRadius:"20px", fontSize:"13px", cursor:"pointer",
                  border:`2px solid ${form.category === c.id ? c.color : "#E5DDD0"}`,
                  background: form.category === c.id ? c.color+"22" : "#FFF",
                  color: form.category === c.id ? c.color : "#666",
                  fontWeight: form.category === c.id ? 600 : 400, transition:"all 0.15s",
                }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#888", marginBottom:"8px", letterSpacing:"0.05em", textTransform:"uppercase" }}>
            ¿Quién lo agrega?
          </label>
          <div style={{ display:"flex", gap:"10px" }}>
            {USERS.map(u => (
              <button key={u.id} onClick={() => set("user", u.id)}
                style={{
                  flex:1, padding:"10px", borderRadius:"12px", cursor:"pointer",
                  border:`2px solid ${form.user === u.id ? u.color : "#E5DDD0"}`,
                  background: form.user === u.id ? u.color+"15" : "#FFF",
                  color: form.user === u.id ? u.color : "#888",
                  fontWeight: form.user === u.id ? 700 : 400, fontSize:"14px",
                  fontFamily:"inherit", transition:"all 0.15s",
                }}>
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#888", marginBottom:"5px", letterSpacing:"0.05em", textTransform:"uppercase" }}>
            Nota (opcional)
          </label>
          <textarea value={form.note} onChange={e => set("note", e.target.value)}
            placeholder="Algún detalle adicional..." rows={2}
            style={{ ...inputStyle, resize:"none" }} />
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <input type="checkbox" id="recurring" checked={form.recurring}
            onChange={e => set("recurring", e.target.checked)}
            style={{ width:"16px", height:"16px", cursor:"pointer" }} />
          <label htmlFor="recurring" style={{ fontSize:"14px", color:"#555", cursor:"pointer" }}>
            Gasto recurrente (mensual)
          </label>
        </div>

        <button
          onClick={() => {
            if (!form.name.trim() || !form.amount || !form.date) return;
            onSave({ ...form, amount: parseFloat(form.amount) });
          }}
          disabled={saving}
          style={{
            width:"100%", padding:"13px", borderRadius:"12px", border:"none",
            background: saving ? "#AAA" : "linear-gradient(135deg,#1a3a5c 0%,#2a5a8c 100%)",
            color:"#FFF", fontSize:"15px", fontWeight:700, cursor: saving ? "not-allowed" : "pointer",
            fontFamily:"inherit", marginTop:"4px",
          }}>
          {saving ? "Guardando..." : (initial ? "Guardar cambios" : "Agregar al presupuesto")}
        </button>
      </div>
    </>
  );
}

export default function App() {
  const [expenses, setExpenses]       = useState([]);
  const [loaded, setLoaded]           = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterMonth, setFilterMonth] = useState(today.getMonth());
  const [filterYear, setFilterYear]   = useState(today.getFullYear());
  const [filterCat, setFilterCat]     = useState("all");
  const [filterUser, setFilterUser]   = useState("all");
  const [activeTab, setActiveTab]     = useState("timeline");

  // Real-time listener from Firestore
  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    }, err => {
      console.error(err);
      setLoaded(true);
    });
    return unsub;
  }, []);

  const addExpense = async (form) => {
    setSaving(true);
    try {
      await addDoc(collection(db, "expenses"), { ...form, createdAt: serverTimestamp() });
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const updateExpense = async (form) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "expenses", editTarget.id), { ...form });
      setEditTarget(null);
    } finally { setSaving(false); }
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "expenses", id));
    setDeleteConfirm(null);
  };

  const prevMonth = () => {
    if (filterMonth === 0) { setFilterMonth(11); setFilterYear(y => y - 1); }
    else setFilterMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (filterMonth === 11) { setFilterMonth(0); setFilterYear(y => y + 1); }
    else setFilterMonth(m => m + 1);
  };

  const filtered = expenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + "T12:00:00");
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear
      && (filterCat === "all" || e.category === filterCat)
      && (filterUser === "all" || e.user === filterUser);
  }).sort((a,b) => a.date.localeCompare(b.date));

  const totalMonth = filtered.reduce((s,e) => s + e.amount, 0);
  const catOf  = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length-1];
  const userOf = id => USERS.find(u => u.id === id) || USERS[0];

  const byCategory = CATEGORIES.map(c => ({
    ...c, total: filtered.filter(e => e.category === c.id).reduce((s,e) => s+e.amount, 0)
  })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);

  const byUser = USERS.map(u => ({
    ...u,
    total: filtered.filter(e => e.user === u.id).reduce((s,e) => s+e.amount, 0),
    count: filtered.filter(e => e.user === u.id).length,
  }));

  if (!loaded) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#FDFAF5" }}>
      <div style={{ fontFamily:"'Playfair Display',Georgia,serif", color:"#1a3a5c", fontSize:"22px" }}>
        Cargando...
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#FDFAF5 0%,#F5EFE8 100%)", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:#F5EFE8; }
        ::-webkit-scrollbar-thumb { background:#D4C4B0; border-radius:10px; }
      `}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1a3a5c 0%,#0f2340 100%)", padding:"20px 20px 16px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:"480px", margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
            <div>
              <p style={{ margin:0, fontSize:"11px", color:"#8AAFD0", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600 }}>Presupuesto familiar</p>
              <h1 style={{ margin:"2px 0 0", fontSize:"22px", fontFamily:"'Playfair Display',Georgia,serif", color:"#FDFAF5", fontWeight:600 }}>
                Familia Elosua
              </h1>
            </div>
            <button onClick={() => setShowForm(true)}
              style={{ padding:"10px 18px", borderRadius:"50px", border:"none", background:"linear-gradient(135deg,#C8956C,#D4A574)", color:"#FFF", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 15px rgba(200,149,108,0.4)" }}>
              + Agregar
            </button>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"16px" }}>
            <button onClick={prevMonth} style={{ background:"rgba(255,255,255,0.1)", border:"none", color:"#FFF", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <span style={{ color:"#FDFAF5", fontSize:"16px", fontWeight:600 }}>{MONTHS[filterMonth]} {filterYear}</span>
            <button onClick={nextMonth} style={{ background:"rgba(255,255,255,0.1)", border:"none", color:"#FFF", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:"480px", margin:"0 auto", padding:"16px" }}>

        {/* Total card */}
        <div style={{ background:"linear-gradient(135deg,#C8956C 0%,#A06840 100%)", borderRadius:"16px", padding:"20px 22px", marginBottom:"16px", boxShadow:"0 8px 24px rgba(200,149,108,0.3)" }}>
          <p style={{ margin:0, fontSize:"12px", color:"rgba(255,255,255,0.75)", letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600 }}>
            Total planeado · {MONTHS[filterMonth]}
          </p>
          <p style={{ margin:"4px 0 12px", fontSize:"32px", fontWeight:700, color:"#FFF", fontFamily:"'Playfair Display',Georgia,serif" }}>
            {fmt(totalMonth)}
          </p>
          <div style={{ display:"flex", gap:"16px" }}>
            {byUser.map(u => (
              <div key={u.id} style={{ flex:1, background:"rgba(255,255,255,0.2)", borderRadius:"10px", padding:"8px 12px" }}>
                <p style={{ margin:0, fontSize:"11px", color:"rgba(255,255,255,0.8)", fontWeight:600 }}>{u.label}</p>
                <p style={{ margin:"2px 0 0", fontSize:"15px", fontWeight:700, color:"#FFF" }}>{fmt(u.total)}</p>
                <p style={{ margin:"1px 0 0", fontSize:"11px", color:"rgba(255,255,255,0.7)" }}>{u.count} gasto{u.count !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"#EDE6DC", borderRadius:"12px", padding:"4px", marginBottom:"16px" }}>
          {[["timeline","📋 Gastos"],["resumen","📊 Resumen"]].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ flex:1, padding:"9px", borderRadius:"9px", border:"none", background: activeTab === id ? "#FFF" : "transparent", color: activeTab === id ? "#1a3a5c" : "#888", fontWeight: activeTab === id ? 700 : 500, fontSize:"14px", cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s", boxShadow: activeTab === id ? "0 2px 8px rgba(0,0,0,0.08)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:"8px", marginBottom:"14px", overflowX:"auto", paddingBottom:"4px" }}>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
            style={{ padding:"7px 10px", borderRadius:"20px", border:"1.5px solid #E5DDD0", background:"#FFF", fontSize:"13px", cursor:"pointer", color:"#444", outline:"none", fontFamily:"inherit" }}>
            <option value="all">👥 Todos</option>
            {USERS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            style={{ padding:"7px 10px", borderRadius:"20px", border:"1.5px solid #E5DDD0", background:"#FFF", fontSize:"13px", cursor:"pointer", color:"#444", outline:"none", fontFamily:"inherit" }}>
            <option value="all">🗂️ Todas</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>

        {/* Timeline tab */}
        {activeTab === "timeline" && (
          filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 20px", color:"#B0A090" }}>
              <div style={{ fontSize:"48px", marginBottom:"12px" }}>📭</div>
              <p style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"18px", color:"#888", margin:"0 0 6px" }}>Sin gastos planeados</p>
              <p style={{ fontSize:"14px", margin:0 }}>Agrega el primer gasto del mes</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {filtered.map(exp => {
                const cat  = catOf(exp.category);
                const user = userOf(exp.user);
                const d    = new Date(exp.date + "T12:00:00");
                const isPast = exp.date < todayStr;
                return (
                  <div key={exp.id} style={{ background:"#FFF", borderRadius:"14px", padding:"14px 16px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", borderLeft:`4px solid ${cat.color}`, opacity: isPast ? 0.65 : 1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"3px" }}>
                          <span style={{ fontSize:"16px" }}>{cat.icon}</span>
                          <span style={{ fontWeight:600, fontSize:"15px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{exp.name}</span>
                          {exp.recurring && <span style={{ fontSize:"11px", background:"#E8F4FE", color:"#1a7ac7", padding:"1px 7px", borderRadius:"20px", fontWeight:600 }}>↻</span>}
                        </div>
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                          <span style={{ fontSize:"12px", color:"#999" }}>{pad(d.getDate())} {MONTHS[d.getMonth()]}</span>
                          <span style={{ fontSize:"11px", color:"#FFF", background:user.color, padding:"1px 7px", borderRadius:"20px", fontWeight:600 }}>{user.label}</span>
                          {exp.note && <span style={{ fontSize:"11px", color:"#AAA", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"100px" }}>· {exp.note}</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px", marginLeft:"12px" }}>
                        <span style={{ fontSize:"16px", fontWeight:700, color:"#1a3a5c" }}>{fmt(exp.amount)}</span>
                        <div style={{ display:"flex", gap:"6px" }}>
                          <button onClick={() => setEditTarget(exp)} style={{ background:"#F0EDE8", border:"none", borderRadius:"8px", width:"28px", height:"28px", cursor:"pointer", fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center" }}>✏️</button>
                          <button onClick={() => setDeleteConfirm(exp.id)} style={{ background:"#FEF0F0", border:"none", borderRadius:"8px", width:"28px", height:"28px", cursor:"pointer", fontSize:"13px", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Resumen tab */}
        {activeTab === "resumen" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            {byCategory.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 20px", color:"#B0A090" }}>
                <div style={{ fontSize:"48px", marginBottom:"12px" }}>📊</div>
                <p style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"18px", color:"#888", margin:0 }}>Sin datos para mostrar</p>
              </div>
            ) : (
              <>
                <h3 style={{ margin:"0 0 4px", fontSize:"13px", fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:"0.08em" }}>Por categoría</h3>
                {byCategory.map(c => {
                  const pct = totalMonth > 0 ? (c.total / totalMonth)*100 : 0;
                  return (
                    <div key={c.id} style={{ background:"#FFF", borderRadius:"12px", padding:"14px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                        <span style={{ fontWeight:600, fontSize:"14px" }}>{c.icon} {c.label}</span>
                        <span style={{ fontWeight:700, fontSize:"15px", color:c.color }}>{fmt(c.total)}</span>
                      </div>
                      <div style={{ background:"#F0EDE8", borderRadius:"6px", height:"6px", overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:c.color, borderRadius:"6px" }} />
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:"4px" }}>
                        <span style={{ fontSize:"11px", color:"#AAA" }}>{filtered.filter(e => e.category === c.id).length} gastos</span>
                        <span style={{ fontSize:"11px", color:"#AAA" }}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}

                <h3 style={{ margin:"8px 0 4px", fontSize:"13px", fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:"0.08em" }}>Por persona</h3>
                {byUser.map(u => {
                  const pct = totalMonth > 0 ? (u.total / totalMonth)*100 : 0;
                  return (
                    <div key={u.id} style={{ background:"#FFF", borderRadius:"12px", padding:"14px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                        <span style={{ fontWeight:600, fontSize:"14px" }}>{u.label}</span>
                        <span style={{ fontWeight:700, fontSize:"15px", color:u.color }}>{fmt(u.total)}</span>
                      </div>
                      <div style={{ background:"#F0EDE8", borderRadius:"6px", height:"6px", overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:u.color, borderRadius:"6px" }} />
                      </div>
                      <div style={{ fontSize:"11px", color:"#AAA", marginTop:"4px" }}>{u.count} gastos · {pct.toFixed(0)}%</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        <div style={{ height:"32px" }} />
      </div>

      {/* Modals */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <ExpenseForm onSave={addExpense} onClose={() => setShowForm(false)} saving={saving} />
        </Modal>
      )}
      {editTarget && (
        <Modal onClose={() => setEditTarget(null)}>
          <ExpenseForm initial={editTarget} onSave={updateExpense} onClose={() => setEditTarget(null)} saving={saving} />
        </Modal>
      )}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)}>
          <h2 style={{ margin:"0 0 10px", fontFamily:"'Playfair Display',Georgia,serif", color:"#1a3a5c", fontSize:"20px" }}>¿Eliminar gasto?</h2>
          <p style={{ color:"#666", margin:"0 0 20px" }}>Esta acción no se puede deshacer.</p>
          <div style={{ display:"flex", gap:"10px" }}>
            <button onClick={() => setDeleteConfirm(null)}
              style={{ flex:1, padding:"12px", borderRadius:"10px", border:"1.5px solid #E5DDD0", background:"#FFF", cursor:"pointer", fontFamily:"inherit", fontSize:"14px", fontWeight:600 }}>
              Cancelar
            </button>
            <button onClick={() => deleteExpense(deleteConfirm)}
              style={{ flex:1, padding:"12px", borderRadius:"10px", border:"none", background:"#C86C6C", color:"#FFF", cursor:"pointer", fontFamily:"inherit", fontSize:"14px", fontWeight:700 }}>
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
