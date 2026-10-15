const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SHORT=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
let currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear();
let entries={}, editingId=null, deletingId=null, currentTab='all', chartMode='bars', financeChart=null, modalType='expense';
const animated={balance:0,income:0,expense:0,highest:0};

function uid(){try{if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();}catch{}return 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);}
function applyTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('cf_theme',t);}catch(e){}document.getElementById('themeIcon').textContent=t==='light'?'dark_mode':'light_mode';if(financeChart){buildChart();}}
function themeOrigin(ev){
  if(ev&&typeof ev.clientX==='number'&&typeof ev.clientY==='number')return{x:ev.clientX,y:ev.clientY};
  const b=document.getElementById('themeBtn');
  if(b){const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
  return{x:window.innerWidth-60,y:60};
}
function toggleTheme(ev){
  const next=document.documentElement.dataset.theme==='light'?'dark':'light';
  const btn=document.getElementById('themeBtn');
  if(btn){btn.classList.remove('spin');void btn.offsetWidth;btn.classList.add('spin');}
  if(reduceMotion()){applyTheme(next);return;}
  const o=themeOrigin(ev), x=o.x, y=o.y;
  if(document.startViewTransition){
    try{
      const vt=document.startViewTransition(()=>applyTheme(next));
      if(vt&&vt.ready)vt.ready.then(()=>{
        try{
          const R=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y));
          document.documentElement.animate(
            {clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+R+'px at '+x+'px '+y+'px)']},
            {duration:700,easing:'cubic-bezier(.21,1.02,.55,1)',pseudoElement:'::view-transition-new(root)'}
          );
        }catch(err){}
      }).catch(()=>{});
      return;
    }catch(err){}
  }
  themeWipe(x,y,next);
}
function themeWipe(x,y,next){
  const d=document.createElement('div');d.className='theme-wipe';
  d.style.background=next==='dark'?'#0B0E11':'#ECEEF1';
  d.style.clipPath='circle(0px at '+x+'px '+y+'px)';
  document.body.appendChild(d);
  const R=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y));
  let a;
  try{
    a=d.animate(
      {clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+R+'px at '+x+'px '+y+'px)']},
      {duration:600,easing:'cubic-bezier(.21,1.02,.55,1)',fill:'forwards'}
    );
  }catch(err){applyTheme(next);d.remove();return;}
  a.onfinish=()=>{
    applyTheme(next);
    try{
      d.animate({opacity:[1,0]},{duration:220,easing:'ease-out',fill:'forwards'}).onfinish=()=>d.remove();
    }catch(err){d.remove();}
  };
  setTimeout(()=>{if(d.isConnected)d.remove();},1600);
}
try{applyTheme(localStorage.getItem('cf_theme')||'dark');}catch(e){applyTheme('dark');}

const monthKey=()=>`${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
const getMonthEntries=()=>entries[monthKey()]||[];
const setMonthEntries=d=>{entries[monthKey()]=d;};
const saveToStorage=()=>{try{localStorage.setItem('controle_financeiro_v2',JSON.stringify(entries));}catch(e){}};
const fmt=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const fmtCompact=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:2}).format(v||0);
// Valores muito altos (milhões/bi/tri) estouravam os cards — usa forma compacta e guarda o valor cheio no title.
const fmtSmart=v=>{const a=Math.abs(Number(v)||0);return a>=1000000000?fmtCompact(v):fmt(v);};
function fitValue(el){if(!el)return;const len=(el.textContent||'').length;el.classList.toggle('is-long',len>16&&len<=24);el.classList.toggle('is-xlong',len>24);}
const esc=v=>String(v==null?'':v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const isDark=()=>document.documentElement.dataset.theme==='dark';
const reduceMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(new Date(s+'T12:00:00').getTime());
const fmtDate=s=>{
  if(!validDate(s))return '—';
  const d=new Date(s+'T12:00:00');
  const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0');
  return d.getFullYear()===new Date().getFullYear()?(dd+'/'+mm):(dd+'/'+mm+'/'+String(d.getFullYear()).slice(2));
};

function toast(msg,icon){
  icon=icon||'check_circle';
  const w=document.getElementById('toastWrap');
  const t=document.createElement('div');t.className='toast';
  const ic=document.createElement('span');ic.className='material-symbols-rounded';ic.textContent=icon;
  const tx=document.createElement('span');tx.textContent=msg;
  t.appendChild(ic);t.appendChild(tx);w.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320);},2600);
}
function animateValue(el,to,key){
  const from=animated[key]||0;animated[key]=to;
  if(!el)return;
  const paint=v=>{el.textContent=fmtSmart(v);el.title=fmt(v);fitValue(el);};
  if(Math.abs(to-from)<.005||reduceMotion()){paint(to);return;}
  if(el._raf)cancelAnimationFrame(el._raf);
  const t0=performance.now(),dur=650;
  const step=n=>{const p=Math.min(1,(n-t0)/dur),e=1-Math.pow(1-p,4);
    paint(from+(to-from)*e);
    if(p<1)el._raf=requestAnimationFrame(step);};
  el._raf=requestAnimationFrame(step);
}

function loadData(){
  try{entries=JSON.parse(localStorage.getItem('controle_financeiro_v2')||'{}')||{};}catch(e){entries={};}
  if(entries&&typeof entries!=='object')entries={};
  if(!Object.keys(entries).length){
    try{const old=JSON.parse(localStorage.getItem('controle_financeiro')||'null');
      if(Array.isArray(old)&&old.length){entries[monthKey()]=old.map(i=>({id:i.id||uid(),description:i.description||'',value:Number(i.value)||0,type:'expense',paid:false}));}
    }catch(e){}
  }
  const base=Date.now();
  Object.keys(entries).forEach(k=>{
    if(!Array.isArray(entries[k])){entries[k]=[];return;}
    const fallbackDate=/^\d{4}-\d{2}$/.test(k)?(k+'-15'):todayStr();
    entries[k].forEach((e,idx)=>{
      if(e.type==='income')e.paid=true;if(typeof e.paid!=='boolean')e.paid=false;if(typeof e.value!=='number')e.value=Number(e.value)||0;
      if(!validDate(e.date))e.date=fallbackDate;
      if(typeof e.createdAt!=='number')e.createdAt=base-(entries[k].length-idx);
    });
  });
  saveToStorage();render();hideBootLoader();
}

const bootStart=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
let bootHidden=false;
function hideBootLoader(){
  if(bootHidden)return;bootHidden=true;
  // garante um tempo mínimo elegante mesmo em máquinas rápidas
  let wait=750;
  try{wait=Math.max(0,750-(performance.now()-bootStart));}catch(e){}
  setTimeout(()=>{
    const loader=document.getElementById('bootLoader');
    if(loader)loader.classList.add('done');
    document.body.classList.remove('is-loading');
    setTimeout(()=>{if(loader&&loader.parentNode)loader.parentNode.removeChild(loader);},600);
  },wait);
}
// segurança: nunca prende o usuário no loading
setTimeout(hideBootLoader,3500);

function render(){updateMonthLabel(true);renderTable();updateSummary();updateChart();updateCounts();}
function updateCounts(){
  const n=Object.values(entries).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
  const dm=document.getElementById('docMeta');
  if(dm)dm.textContent=n===0?'Arquivo local':(n+' registro'+(n===1?'':'s')+' em arquivo');
  const fl=document.getElementById('footLeft');
  if(fl)fl.textContent=n===0?'Dados salvos neste computador':('Dados locais · '+n+' registro'+(n===1?'':'s'));
}
function updateMonthLabel(pulse){const el=document.getElementById('monthLabel');el.textContent=MONTHS[currentMonth]+' '+currentYear;if(pulse){el.classList.remove('switch');void el.offsetWidth;el.classList.add('switch');}}
function changeMonth(d){currentMonth+=d;if(currentMonth>11){currentMonth=0;currentYear++;}if(currentMonth<0){currentMonth=11;currentYear--;}render();}
function setTab(t){currentTab=t;document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));document.getElementById({all:'tabAll',expenses:'tabExpenses',incomes:'tabIncomes'}[t]).classList.add('active');renderTable();}

function renderTable(){
  const tb=document.getElementById('tableBody');
  const all=getMonthEntries();
  document.getElementById('countAll').textContent=all.length;
  document.getElementById('countExp').textContent=all.filter(e=>e.type==='expense').length;
  document.getElementById('countInc').textContent=all.filter(e=>e.type==='income').length;
  let data=all.slice();
  if(currentTab==='expenses')data=data.filter(e=>e.type==='expense');
  if(currentTab==='incomes')data=data.filter(e=>e.type==='income');
  data.sort((a,b)=>{
    if(a.date<b.date)return 1;if(a.date>b.date)return -1;
    return (b.createdAt||0)-(a.createdAt||0);
  });
  tb.innerHTML='';
  if(!data.length){tb.innerHTML='<tr><td colspan="5" class="empty"><span class="material-symbols-rounded">receipt_long</span><strong>Nenhum lançamento neste mês</strong><p>Adicione um gasto ou ganho para começar.</p></td></tr>';return;}
  data.forEach((e,i)=>{
    const inc=e.type==='income', paid=!!e.paid;
    const tr=document.createElement('tr');if(inc)tr.classList.add('income-row');
    tr.setAttribute('data-rowid',e.id);
    tr.style.animationDelay=reduceMotion()?'0ms':Math.min(i*40,320)+'ms';
    const status=inc
      ?'<span class="badge received"><span class="material-symbols-rounded">trending_up</span>Recebido</span>'
      :(paid?'<span class="badge paid"><span class="material-symbols-rounded">check_circle</span>Pago</span>':'<span class="badge pending"><span class="material-symbols-rounded">schedule</span>Pendente</span>');
    let html='<td><div class="desc"><span class="avatar '+(inc?'inc':'exp')+'"><span class="material-symbols-rounded">'+(inc?'trending_up':'trending_down')+'</span></span><span>'+esc(e.description)+'</span></div></td>';
    html+='<td class="datecell">'+fmtDate(e.date)+'</td>';
    html+='<td class="value '+(inc?'income':'expense')+'" title="'+esc(fmt(Number(e.value)))+'">'+(inc?'+':'−')+' '+esc(fmtSmart(Number(e.value)))+'</td>';
    html+='<td class="status-cell">'+status+'</td><td><div class="actions">';
    if(!inc)html+='<button class="icon-btn toggle '+(paid?'is-paid':'')+'" data-act="toggle" data-id="'+e.id+'" title="'+(paid?'Marcar como pendente':'Marcar como pago')+'"><span class="material-symbols-rounded">'+(paid?'check_circle':'radio_button_unchecked')+'</span></button>';
    html+='<button class="icon-btn edit" data-act="edit" data-id="'+e.id+'" title="Editar"><span class="material-symbols-rounded">edit</span></button>';
    html+='<button class="icon-btn delete" data-act="del" data-id="'+e.id+'" title="Excluir"><span class="material-symbols-rounded">delete</span></button>';
    html+='</div></td>';
    tr.innerHTML=html;
    tb.appendChild(tr);
  });
}
document.getElementById('tableBody').addEventListener('click',ev=>{
  const b=ev.target.closest('button[data-act]');if(!b)return;
  const id=b.getAttribute('data-id'), act=b.getAttribute('data-act');
  if(act==='toggle')togglePaid(id);
  else if(act==='edit')editEntry(id);
  else if(act==='del')openDeleteModal(id);
});

function updateSummary(){
  const d=getMonthEntries();
  const inc=d.filter(e=>e.type==='income'), exp=d.filter(e=>e.type==='expense');
  const tI=inc.reduce((s,e)=>s+Number(e.value),0), tE=exp.reduce((s,e)=>s+Number(e.value),0);
  const bal=tI-tE, high=exp.length?Math.max.apply(null,exp.map(e=>Number(e.value))):0;
  const highName=exp.length?exp.reduce((a,b)=>Number(a.value)>=Number(b.value)?a:b).description:'—';
  animateValue(document.getElementById('balanceValue'),bal,'balance');
  animateValue(document.getElementById('totalIncome'),tI,'income');
  animateValue(document.getElementById('totalExpense'),tE,'expense');
  animateValue(document.getElementById('highestExpense'),high,'highest');
  const pct=tI>0?Math.round(bal/tI*100):(bal===0?0:(bal>0?100:-100));
  document.getElementById('balancePct').textContent=(pct>=0?'+':'')+pct+'%';
  const dIcon=document.querySelector('#balanceDelta .material-symbols-rounded');
  if(dIcon)dIcon.textContent=bal>=0?'trending_up':'trending_down';
  const pend=exp.filter(e=>!e.paid).length;
  document.getElementById('balanceSub').textContent=d.length+' lançamento'+(d.length===1?'':'s')+' · '+pend+' pendente'+(pend===1?'':'s');
  document.getElementById('incomeSub').textContent=inc.length+' recebimento'+(inc.length===1?'':'s');
  document.getElementById('expenseSub').textContent=exp.length?(fmt(tE/Math.max(1,exp.length))+' ticket médio'):'Nenhum gasto';
  document.getElementById('highestSub').textContent=exp.length?String(highName).slice(0,28):'—';
}

function setChartMode(m){chartMode=m;document.getElementById('segBars').classList.toggle('active',m==='bars');document.getElementById('segArea').classList.toggle('active',m==='area');buildChart();}
function getSeries(){
  const labels=[],full=[],inc=[],exp=[],bal=[];
  for(let i=5;i>=0;i--){let m=currentMonth-i,y=currentYear;if(m<0){m+=12;y--;}
    const list=entries[y+'-'+String(m+1).padStart(2,'0')]||[];
    const gi=list.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.value),0);
    const ge=list.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.value),0);
    labels.push(SHORT[m]+'/'+String(y).slice(2));full.push(MONTHS[m]+' '+y);inc.push(gi);exp.push(ge);bal.push(gi-ge);}
  return{labels:labels,full:full,inc:inc,exp:exp,bal:bal};
}
function updateChartMeta(s){
  const kI=document.getElementById('kpiIncome'),kE=document.getElementById('kpiExpense');
  const totI=s.inc.reduce((a,b)=>a+b,0),totE=s.exp.reduce((a,b)=>a+b,0);
  kI.textContent=fmtSmart(totI);kI.title=fmt(totI);
  kE.textContent=fmtSmart(totE);kE.title=fmt(totE);
  document.getElementById('kpiSave').textContent=totI>0?Math.round((totI-totE)/totI*100)+'%':'—';
  let best=0;s.bal.forEach((v,i)=>{if(v>s.bal[best])best=i;});
  document.getElementById('chartInsight').textContent=(totI+totE===0)?'Sem dados nos últimos 6 meses. Adicione lançamentos para ver a evolução.':('Melhor saldo em '+s.full[best]+' ('+fmt(s.bal[best])+') · acumulado de '+fmt(s.bal.reduce((a,b)=>a+b,0))+' no período.');
}
function updateChartLive(){
  if(typeof Chart==='undefined'||!financeChart){updateChart();return;}
  const s=getSeries();
  updateChartMeta(s);
  financeChart.data.labels=s.labels;
  if(financeChart.data.datasets[0])financeChart.data.datasets[0].data=s.inc;
  if(financeChart.data.datasets[1])financeChart.data.datasets[1].data=s.exp;
  if(financeChart.data.datasets[2])financeChart.data.datasets[2].data=s.bal;
  financeChart.update();
}
function updateChart(){
  if(typeof Chart==='undefined'){renderFallback();return;}
  document.getElementById('financeChart').style.display='block';
  document.getElementById('chartFallback').style.display='none';
  const s=getSeries();
  updateChartMeta(s);
  buildChart();
}
function chartPalette(){return isDark()?{grid:'rgba(148,163,184,.14)',tick:'#79828E',tipBg:'#1A1F24',tipBorder:'#354049',tipTitle:'#F2F4F6',tipBody:'#A9B2BC'}:{grid:'rgba(13,18,23,.08)',tick:'#98A2AD',tipBg:'#FFFFFF',tipBorder:'#E2E7EC',tipTitle:'#0D1217',tipBody:'#55606C'};}
function buildChart(){
  if(typeof Chart==='undefined'){renderFallback();return;}
  const s=getSeries(), p=chartPalette();
  const canvas=document.getElementById('financeChart');
  canvas.style.display='block';document.getElementById('chartFallback').style.display='none';
  const c=canvas.getContext('2d');
  const green=isDark()?'#34D399':'#0E9F6E', red=isDark()?'#F87171':'#DC2626', line=isDark()?'#94A3B8':'#64748B';
  const gI=c.createLinearGradient(0,0,0,240);gI.addColorStop(0,green);gI.addColorStop(1,green+'66');
  const gE=c.createLinearGradient(0,0,0,240);gE.addColorStop(0,red);gE.addColorStop(1,red+'66');
  const tip={backgroundColor:p.tipBg,titleColor:p.tipTitle,bodyColor:p.tipBody,borderColor:p.tipBorder,borderWidth:1,padding:12,cornerRadius:8,
    titleFont:{family:'Inter',weight:'700',size:12},bodyFont:{family:'Inter',size:12},displayColors:true,boxPadding:4,
    callbacks:{title:it=>s.full[it[0].dataIndex],label:ctx=>' '+ctx.dataset.label+': '+fmt(ctx.raw)}};
  const scales={x:{grid:{display:false},ticks:{color:p.tick,font:{size:11,family:'Inter',weight:'600'}},border:{display:false}},
    y:{grid:{color:p.grid},ticks:{color:p.tick,font:{size:11,family:'Inter'},maxTicksLimit:6,callback:v=>v>=1000?'R$ '+(v/1000).toFixed(v%1000===0?0:1)+'k':'R$ '+v},border:{display:false},beginAtZero:true}};
  if(financeChart)financeChart.destroy();
  const common={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},animation:reduceMotion()?false:{duration:700,easing:'easeOutQuart'},plugins:{legend:{display:false},tooltip:tip}};
  if(chartMode==='bars'){
    financeChart=new Chart(c,{type:'bar',data:{labels:s.labels,datasets:[
      {label:'Ganhos',data:s.inc,backgroundColor:gI,borderRadius:4,borderSkipped:'start',maxBarThickness:24,barPercentage:.6,categoryPercentage:.62},
      {label:'Gastos',data:s.exp,backgroundColor:gE,borderRadius:4,borderSkipped:'start',maxBarThickness:24,barPercentage:.6,categoryPercentage:.62},
      {label:'Saldo',data:s.bal,type:'line',borderColor:line,backgroundColor:line,borderWidth:2,pointRadius:3,pointBackgroundColor:line,pointBorderColor:'#fff',pointBorderWidth:1.5,tension:.4}]},options:Object.assign({},common,{scales:scales})});
  }else{
    const gA=c.createLinearGradient(0,0,0,240);gA.addColorStop(0,green+'44');gA.addColorStop(1,green+'00');
    const gS=c.createLinearGradient(0,0,0,240);gS.addColorStop(0,red+'33');gS.addColorStop(1,red+'00');
    financeChart=new Chart(c,{type:'line',data:{labels:s.labels,datasets:[
      {label:'Ganhos',data:s.inc,borderColor:green,backgroundColor:gA,fill:true,borderWidth:2,tension:.42,pointRadius:2.5,pointBackgroundColor:green,pointBorderWidth:0},
      {label:'Gastos',data:s.exp,borderColor:red,backgroundColor:gS,fill:true,borderWidth:2,tension:.42,pointRadius:2.5,pointBackgroundColor:red,pointBorderWidth:0},
      {label:'Saldo',data:s.bal,borderColor:line,borderDash:[6,4],borderWidth:1.8,fill:false,tension:.42,pointRadius:0}]},options:Object.assign({},common,{scales:scales})});
  }
}
function renderFallback(){
  document.getElementById('financeChart').style.display='none';
  const s=getSeries(), box=document.getElementById('chartFallback');
  box.style.display='flex';box.innerHTML='';
  const max=Math.max.apply(null,[1].concat(s.inc,s.exp));
  s.labels.forEach((l,i)=>{
    const pair=document.createElement('div');pair.className='pair';
    pair.title=l+': ganhos '+fmt(s.inc[i])+' · gastos '+fmt(s.exp[i]);
    const b1=document.createElement('div');b1.className='bar';b1.style.height=Math.max(3,s.inc[i]/max*100)+'%';b1.style.background='var(--income)';
    const b2=document.createElement('div');b2.className='bar';b2.style.height=Math.max(3,s.exp[i]/max*100)+'%';b2.style.background='var(--expense)';
    pair.appendChild(b1);pair.appendChild(b2);box.appendChild(pair);
  });
  document.getElementById('chartInsight').textContent='Gráfico simplificado (sem conexão para o motor de gráficos). Conecte-se uma vez para ativar a versão completa.';
}

function openAddModal(type){editingId=null;modalType=(type==='income')?'income':'expense';const inc=modalType==='income';
  document.getElementById('modalTitleText').textContent=inc?'Adicionar ganho':'Adicionar gasto';
  document.getElementById('modalSub').textContent=inc?'Ganhos entram direto como recebidos - sem status.':'Controle o status do gasto como pago ou pendente.';
  document.getElementById('description').value='';document.getElementById('value').value='';document.getElementById('expDate').value=todayStr();
  document.getElementById('saveBtn').className='btn '+(inc?'btn-primary':'btn-dark');
  document.getElementById('modal').classList.add('active');setTimeout(()=>document.getElementById('description').focus(),80);}
function closeModal(){document.getElementById('modal').classList.remove('active');editingId=null;}
function openDeleteModal(id){const e=getMonthEntries().find(x=>x.id===id);if(!e)return;deletingId=id;document.getElementById('deleteItemName').textContent='"'+e.description+'"';document.getElementById('deleteModal').classList.add('active');}
function closeDeleteModal(){document.getElementById('deleteModal').classList.remove('active');deletingId=null;}
function confirmDelete(){if(!deletingId)return;setMonthEntries(getMonthEntries().filter(e=>e.id!==deletingId));saveToStorage();render();closeDeleteModal();toast('Lançamento excluído','delete');}
function saveEntry(){
  const desc=document.getElementById('description').value.trim();
  const val=Number(document.getElementById('value').value);
  const type=modalType;
  if(!desc){toast('Informe uma descrição','edit');return;}
  if(!Number.isFinite(val)||val<=0){toast('Informe um valor válido','edit');return;}
  let date=document.getElementById('expDate').value;
  if(!validDate(date))date=todayStr();
  const target=date.slice(0,7), here=monthKey();
  if(editingId){
    const data=getMonthEntries();
    const idx=data.findIndex(x=>x.id===editingId);
    const cur=idx>=0?data[idx]:null;
    if(cur){cur.description=desc;cur.value=val;cur.type=type;cur.date=date;cur.paid=(type==='income')?true:!!cur.paid;}
    if(cur&&target!==here){
      data.splice(idx,1);setMonthEntries(data);
      if(!entries[target])entries[target]=[];
      entries[target].push(cur);
    }else{setMonthEntries(data);}
  }else{
    const rec={id:uid(),description:desc,value:val,type:type,paid:(type==='income'),date:date,createdAt:Date.now()};
    if(target!==here){if(!entries[target])entries[target]=[];entries[target].push(rec);}
    else{const data=getMonthEntries();data.push(rec);setMonthEntries(data);}
  }
  saveToStorage();render();closeModal();
  const label=(type==='income'?'Ganho registrado':'Gasto registrado');
  toast(target!==here?(label+' em '+MONTHS[Number(target.slice(5,7))-1]):label,'check_circle');
}
function editEntry(id){const e=getMonthEntries().find(x=>x.id===id);if(!e)return;editingId=id;modalType=e.type;
  document.getElementById('modalTitleText').textContent=e.type==='income'?'Editar ganho':'Editar gasto';
  document.getElementById('modalSub').textContent=e.type==='income'?'Ganhos são sempre recebidos.':'Atualize os dados do lançamento.';
  document.getElementById('description').value=e.description;document.getElementById('value').value=e.value;
  document.getElementById('expDate').value=validDate(e.date)?e.date:todayStr();
  document.getElementById('saveBtn').className='btn '+(e.type==='income'?'btn-primary':'btn-dark');
  document.getElementById('modal').classList.add('active');setTimeout(()=>document.getElementById('description').focus(),80);}
function paidBadge(paid,pop){
  const cls=pop?'badge pop':'badge';
  return paid
    ?'<span class="'+cls+' paid"><span class="material-symbols-rounded">check_circle</span>Pago</span>'
    :'<span class="'+cls+' pending"><span class="material-symbols-rounded">schedule</span>Pendente</span>';
}
function togglePaid(id){
  const data=getMonthEntries();const e=data.find(x=>x.id===id);if(!e||e.type==='income')return;
  e.paid=!e.paid;setMonthEntries(data);saveToStorage();
  const row=document.querySelector('#tableBody tr[data-rowid="'+id+'"]');
  if(row){
    const cell=row.querySelector('.status-cell');
    if(cell)cell.innerHTML=paidBadge(e.paid,true);
    const btn=row.querySelector('[data-act="toggle"]');
    if(btn){
      btn.classList.toggle('is-paid',e.paid);
      btn.title=e.paid?'Marcar como pendente':'Marcar como pago';
      const ic=btn.querySelector('.material-symbols-rounded');
      if(ic)ic.textContent=e.paid?'check_circle':'radio_button_unchecked';
    }
    row.classList.add('hl');setTimeout(()=>row.classList.remove('hl'),750);
  }else{renderTable();}
  updateSummary();
  updateChartLive();
}

function exportJSON(){
  const blob=new Blob([JSON.stringify(entries,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='financeiro_'+monthKey()+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  toast('Backup exportado','download');
}
function normalizeItem(it){
  if(!it||typeof it!=='object')return null;
  const desc=String(it.description||'').trim().slice(0,80);
  const val=Number(it.value);
  const type=it.type==='income'?'income':'expense';
  if(!desc||!Number.isFinite(val)||val<=0)return null;
  return{id:(typeof it.id==='string'&&it.id)?it.id:uid(),description:desc,value:val,type:type,
    paid:type==='income'?true:!!it.paid,
    date:validDate(it.date)?it.date:todayStr(),
    createdAt:(typeof it.createdAt==='number')?it.createdAt:Date.now()};
}
function importJSON(ev){
  const f=ev.target.files&&ev.target.files[0];
  ev.target.value='';
  if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const raw=JSON.parse(r.result);
      const months={};
      const push=e=>{const k=e.date.slice(0,7);(months[k]=months[k]||[]).push(e);};
      if(Array.isArray(raw)){raw.forEach(it=>{const e=normalizeItem(it);if(e)push(e);});}
      else if(raw&&typeof raw==='object'){
        Object.keys(raw).forEach(k=>{
          if(!/^\d{4}-\d{2}$/.test(k)||!Array.isArray(raw[k]))return;
          raw[k].forEach(it=>{const e=normalizeItem(it);if(e)push(e);});
        });
      }else{toast('Arquivo inválido','error');return;}
      let n=0;
      Object.keys(months).forEach(k=>{
        if(!entries[k])entries[k]=[];
        const ids=new Set(entries[k].map(e=>e.id));
        months[k].forEach(e=>{if(!ids.has(e.id)){entries[k].push(e);ids.add(e.id);n++;}});
      });
      if(!n){toast('Nada novo para importar','upload');return;}
      saveToStorage();render();
      toast(n+' lançamento'+(n===1?'':'s')+' importado'+(n===1?'':'s'),'upload');
    }catch(err){toast('Não foi possível ler o arquivo','error');}
  };
  r.readAsText(f);
}
function openClearModal(){
  const n=Object.values(entries).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
  if(!n){toast('Nada para apagar','delete_forever');return;}
  document.getElementById('clearModal').classList.add('active');
}
function closeClearModal(){document.getElementById('clearModal').classList.remove('active');}
function confirmClear(){
  entries={};saveToStorage();render();closeClearModal();
  toast('Todos os dados foram apagados','delete_forever');
}
/* ---------- events ---------- */

document.getElementById('modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.getElementById('deleteModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDeleteModal();});
document.getElementById('clearModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeClearModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeDeleteModal();closeClearModal();}});
document.getElementById('modal').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveEntry();}});
loadData();
