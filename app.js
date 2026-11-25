import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,createUserWithEmailAndPassword} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,addDoc,updateDoc,deleteDoc,collection,getDocs,query,where,orderBy,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const DOMAIN="@lpl-checklist.app";
const ADMIN_UID="MjQLZheA6NhKLfy4Z8JM8VP8jVb2";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const br=d=>d?d.split("-").reverse().join("/"):"";
const LABEL={OK:"OK",NG:"NG",NA:"N/A",CRITICO:"CRÍTICO"};
const ICON={OK:"✓",NG:"!",NA:"–",CRITICO:"⚠"};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),2800)};
const show=id=>{["login","driver","admin"].forEach(s=>$("#"+s).hidden=s!==id);$("#top").hidden=id==="login"};
const firebaseError=e=>{
  const messages={
    "auth/invalid-email":"E-mail inválido.",
    "auth/user-not-found":"Conta não encontrada. Confira se o e-mail corresponde ao usuário criado no Firebase Authentication.",
    "auth/wrong-password":"Senha incorreta.",
    "auth/invalid-credential":"E-mail ou senha incorretos. Confira também se a conta existe no Firebase Authentication.",
    "auth/too-many-requests":"Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/operation-not-allowed":"O login por e-mail/senha não está habilitado no Firebase Authentication.",
    "auth/invalid-api-key":"A chave de API do Firebase é inválida. Confira firebase-config.js.",
    "auth/network-request-failed":"Falha de rede ao acessar o Firebase. Verifique a conexão.",
    "permission-denied":"Acesso ao Firestore negado. Publique as regras do arquivo firestore.rules no Console Firebase."
  };
  return messages[e?.code]||`Falha no Firebase (${e?.code||e?.message||"erro desconhecido"}).`;
};

// Itens do checklist (da planilha "Checklist Diário")
const ITENS=[
[1,"Segurança","Sistema luminoso: faróis, lanternas, luz de freio, ré, setas e alerta","Diário"],
[2,"Segurança","Buzina e alarme sonoro de ré","Diário"],
[3,"Segurança","Para-brisa: trincas, limpeza e visibilidade","Diário"],
[4,"Segurança","Espelhos retrovisores e pontos de visão","Diário"],
[5,"Segurança","Manutenção Preventivas / de acordo com o especificado","-"],
[6,"Freios","Freio de serviço","Diário"],
[7,"Freios","Freio de estacionamento","Diário"],
[8,"Freios","Mangueiras, conexões e sistema pneumático","Diário"],
[9,"Pneus/Rodas","Pneus: calibragem, cortes, bolhas e desgaste","Diário"],
[10,"Pneus/Rodas","Rodas, porcas e fixações aparentes","Diário"],
[11,"Acoplamento","Quinta roda, pino-rei e travamento do acoplamento","Diário"],
[12,"Acoplamento","Mangueiras/conexões de ar e elétrica do implemento","Diário"],
[13,"Suspensão","Feixes/molas, bolsas de ar e componentes visíveis","Diário"],
[14,"Estrutura","Chassi, longarinas e travessas: trincas, deformações ou danos","Diário"],
[15,"Baú/Carreta","Condições gerais do baú/carroceria","Diário"],
[16,"Baú/Carreta","Portas, dobradiças, travas e fechamentos","Diário"],
[17,"Baú/Carreta","Piso interno e pontos de fixação da carga","Diário"],
[18,"Baú/Carreta","Lona/teto/laterais (quando aplicável)","Diário"],
[19,"Elétrica","Chicote, tomadas e conexões elétricas","Diário"],
[20,"Vazamentos","Verificar vazamentos de óleo, combustível, água/ar e outros fluidos","Diário"],
[21,"Sinalização","Faixas refletivas, placas e identificação da carreta","Diário"],
[22,"Equipamentos","Triângulo, macaco, chave de roda e demais itens obrigatórios","Diário"],
[23,"Documentação","Documentação/identificação do veículo disponível e válida","Diário"],
[24,"Limpeza/5S","Limpeza geral e ausência de materiais soltos que possam causar risco","Diário"],
[25,"Condições gerais","Condição geral da carreta para operação segura","Diário"]];

let me=null;

// ---------- Login ----------
$("#loginForm").onsubmit=async e=>{
  e.preventDefault();$("#lErr").textContent="";
  const login=$("#lUser").value.trim();
  const email=(login.includes("@")?login:login+DOMAIN).toLowerCase();
  try{await signInWithEmailAndPassword(auth,email,$("#lPass").value)}
  catch(x){$("#lErr").textContent=firebaseError(x)}
};
$("#logout").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async u=>{
  if(!u){me=null;show("login");return}
  try{
    const isAdmin=u.uid===ADMIN_UID, userRef=doc(db,"users",u.uid);
    let s=await getDoc(userRef);
    if(isAdmin&&!s.exists()){
      await setDoc(userRef,{nome:"Administrador",usuario:u.email?.split("@")[0]||"admin",role:"admin",ativo:true,criadoEm:serverTimestamp()});
      s=await getDoc(userRef);
    }
    if(!s.exists()||s.data().ativo===false&&!isAdmin){
      await signOut(auth);$("#lErr").textContent="Acesso não liberado. Fale com o administrador.";return;
    }
    me={uid:u.uid,...s.data(),role:isAdmin?"admin":s.data().role};
    $("#who").textContent=`${me.nome} (${me.role==="admin"?"admin":"motorista"})`;
    me.role==="admin"?initAdmin():initDriver();
  }catch(x){
    console.error("Falha ao carregar o perfil ou os dados do usuário.",x);
    $("#lErr").textContent=firebaseError(x);
    await signOut(auth);
  }
});

// ---------- Motorista ----------
async function initDriver(){
  show("driver");
  const trucks=(await getDocs(collection(db,"caminhoes"))).docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.ativo!==false);
  const groups=[...new Set(ITENS.map(i=>i[1]))];
  const itemHtml=i=>`<div class="item" data-n="${i[0]}"><div class="t"><strong>${i[0]}.</strong> ${esc(i[2])} <small>(${esc(i[3])})</small></div>
    <div class="seg">${["OK","NG","NA","CRITICO"].map(v=>`<input type="radio" name="i${i[0]}" id="i${i[0]}${v}" value="${v}"><label for="i${i[0]}${v}"><span aria-hidden="true">${ICON[v]}</span> ${LABEL[v]}</label>`).join("")}</div>
    <div class="extra"><textarea rows="2" placeholder="Risco / observação (obrigatório)" data-f="obs"></textarea><input placeholder="Ação imediata" data-f="acao"></div></div>`;
  $("#driver").innerHTML=`<form id="ck" class="card"><h2>Checklist antes de sair</h2><div class="prog" id="prog" aria-live="polite"><span id="progTxt">0 de 25 respondidos</span><i><b id="progBar"></b></i></div>
    <p class="muted">Preencha antes do início da operação. NG: registre a ocorrência. CRÍTICO: não liberar para operação.</p>
    <div class="grid"><label>Data<input type="date" id="fData" value="${today()}" required></label>
    <label>Caminhão<select id="fTruck" required><option value="">Selecione…</option>${trucks.map(t=>`<option value="${t.id}">${esc(t.placa)}${t.numero?" · Nº "+esc(t.numero):""}</option>`).join("")}</select></label>
    <label>Quilometragem<input type="number" id="fKm" min="0" inputmode="numeric" required></label>
    <label>Horímetro<input type="number" id="fHor" min="0" step="0.1" inputmode="decimal"></label></div>
    ${groups.map(g=>`<h3 class="group">${esc(g)}</h3>${ITENS.filter(i=>i[1]===g).map(itemHtml).join("")}`).join("")}
    <label style="margin-top:16px">Observações gerais<textarea id="fObs" rows="3"></textarea></label>
    <p id="ckErr" class="err"></p><button class="primary" style="width:100%;padding:14px">Enviar checklist</button></form>
    <div class="card"><h2>Meus últimos checklists</h2><div id="hist" class="tw"></div></div>`;
  $("#ck").addEventListener("change",e=>{
    const it=e.target.closest(".item");if(!it)return;
    it.querySelector(".extra").classList.toggle("on",["NG","CRITICO"].includes(e.target.value));
    const n=document.querySelectorAll(".item input:checked").length;
    $("#progTxt").textContent=`${n} de ${ITENS.length} respondidos`;$("#progBar").style.width=(n/ITENS.length*100)+"%";
  });
  $("#ck").onsubmit=async e=>{
    e.preventDefault();const err=$("#ckErr");err.textContent="";
    const itens=[];
    for(const i of ITENS){
      const el=document.querySelector(`.item[data-n="${i[0]}"]`);
      const st=el.querySelector("input:checked")?.value;
      const obs=el.querySelector('[data-f=obs]').value.trim(),acao=el.querySelector('[data-f=acao]').value.trim();
      if(!st){err.textContent=`Responda o item ${i[0]}.`;el.scrollIntoView({block:"center"});return}
      if((st==="NG"||st==="CRITICO")&&!obs){err.textContent=`Descreva a ocorrência do item ${i[0]}.`;el.scrollIntoView({block:"center"});return}
      itens.push({n:i[0],grupo:i[1],item:i[2],status:st,obs,acao});
    }
    const t=trucks.find(x=>x.id===$("#fTruck").value);
    const resultado=itens.some(x=>x.status==="CRITICO")?"CRITICO":itens.some(x=>x.status==="NG")?"NG":"OK";
    try{
      await addDoc(collection(db,"checklists"),{data:$("#fData").value,caminhaoId:t.id,placa:t.placa,numero:t.numero||"",
        motoristaId:me.uid,motoristaNome:me.nome,km:+$("#fKm").value,horimetro:$("#fHor").value?+$("#fHor").value:null,
        itens,resultado,obs:$("#fObs").value.trim(),criadoEm:serverTimestamp()});
      toast(resultado==="CRITICO"?"Enviado. Item CRÍTICO: não liberar o veículo.":"Checklist enviado!");
      initDriver();window.scrollTo(0,0);
    }catch(x){err.textContent="Erro ao enviar. Verifique a conexão e tente de novo."}
  };
  const h=(await getDocs(query(collection(db,"checklists"),where("motoristaId","==",me.uid)))).docs.map(d=>d.data())
    .sort((a,b)=>(b.criadoEm?.seconds||0)-(a.criadoEm?.seconds||0)).slice(0,10);
  $("#hist").innerHTML=h.length?`<table><tr><th>Data</th><th>Placa</th><th>Resultado</th></tr>${h.map(c=>`<tr><td>${br(c.data)}</td><td>${esc(c.placa)}</td><td><span class="tag ${c.resultado}">${LABEL[c.resultado]}</span></td></tr>`).join("")}</table>`:'<p class="muted">Nenhum checklist enviado ainda.</p>';
}

// ---------- Admin ----------
let tab="checklists",cache={};
function initAdmin(){
  show("admin");
  $("#admin").innerHTML=`<div class="tabs noprint" role="tablist">${[["checklists","Checklists"],["motoristas","Motoristas"],["caminhoes","Caminhões"]].map(([k,l])=>`<button role="tab" data-t="${k}" aria-selected="${k===tab}">${l}</button>`).join("")}</div><div id="pane"></div>`;
  $("#admin .tabs").onclick=e=>{const b=e.target.closest("button");if(!b)return;tab=b.dataset.t;
    document.querySelectorAll(".tabs button").forEach(x=>x.setAttribute("aria-selected",x===b));render()};
  render();
}
const render=()=>({checklists:vChecklists,motoristas:vMotoristas,caminhoes:vCaminhoes})[tab]();

async function vChecklists(){
  const p=$("#pane");
  p.innerHTML=`<div class="card"><div class="row noprint"><label>Data<input type="date" id="qData" value="${today()}"></label>
    <label>Motorista<select id="qMot"><option value="">Todos</option></select></label>
    <label>Placa<input id="qPlaca" placeholder="Todas"></label>
    <button id="qAll">Ver recentes</button></div><div id="list" class="tw"></div></div><div id="detail"></div>`;
  const users=(await getDocs(collection(db,"users"))).docs.map(d=>({id:d.id,...d.data()}));
  $("#qMot").innerHTML+=users.filter(u=>u.id!==ADMIN_UID&&u.role!=="admin").map(u=>`<option value="${u.id}">${esc(u.nome)}</option>`).join("");
  const load=async(all)=>{
    const q=all||!$("#qData").value?query(collection(db,"checklists"),orderBy("criadoEm","desc"),limit(100)):query(collection(db,"checklists"),where("data","==",$("#qData").value));
    cache={};(await getDocs(q)).docs.forEach(d=>cache[d.id]={id:d.id,...d.data()});draw()};
  const draw=()=>{
    const m=$("#qMot").value,pl=$("#qPlaca").value.trim().toUpperCase();
    const rows=Object.values(cache).filter(c=>(!m||c.motoristaId===m)&&(!pl||c.placa.includes(pl)))
      .sort((a,b)=>(b.criadoEm?.seconds||0)-(a.criadoEm?.seconds||0));
    $("#list").innerHTML=rows.length?`<table><tr><th>Data</th><th>Hora</th><th>Motorista</th><th>Placa</th><th>Km</th><th>Resultado</th></tr>${rows.map(c=>`<tr class="click" data-id="${c.id}"><td>${br(c.data)}</td><td>${c.criadoEm?new Date(c.criadoEm.seconds*1e3).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}</td><td>${esc(c.motoristaNome)}</td><td>${esc(c.placa)}</td><td>${c.km??""}</td><td><span class="tag ${c.resultado}">${LABEL[c.resultado]}</span></td></tr>`).join("")}</table>`:'<p class="muted">Nenhum checklist para esse filtro.</p>';
    $("#detail").innerHTML="";
  };
  $("#qData").onchange=()=>load(false);$("#qAll").onclick=()=>load(true);
  $("#qMot").onchange=draw;$("#qPlaca").oninput=draw;
  $("#list").onclick=e=>{const tr=e.target.closest("tr.click");if(!tr)return;detail(cache[tr.dataset.id]);$("#detail").scrollIntoView({behavior:"smooth"})};
  load(false);
}
function detail(c){
  $("#detail").innerHTML=`<div class="card"><div class="row noprint" style="justify-content:space-between"><h2>Checklist · ${esc(c.placa)} · ${br(c.data)}</h2><button onclick="print()">Imprimir</button></div>
    <p>Motorista: <strong>${esc(c.motoristaNome)}</strong> · Carreta/Equip. Nº: ${esc(c.numero||"—")} · Km: ${c.km??"—"} · Horímetro: ${c.horimetro??"—"} · <span class="tag ${c.resultado}">${LABEL[c.resultado]}</span></p>
    <div class="tw"><table><tr><th>Nº</th><th>Grupo</th><th>Item</th><th>Status</th><th>Observação / ação</th></tr>${c.itens.map(i=>`<tr><td>${i.n}</td><td>${esc(i.grupo)}</td><td>${esc(i.item)}</td><td><span class="tag ${i.status}">${LABEL[i.status]}</span></td><td>${esc(i.obs)}${i.acao?`<br><em>Ação: ${esc(i.acao)}</em>`:""}</td></tr>`).join("")}</table></div>
    ${c.obs?`<p><strong>Observações gerais:</strong> ${esc(c.obs)}</p>`:""}</div>`;
}

async function vMotoristas(){
  const p=$("#pane");
  const users=(await getDocs(collection(db,"users"))).docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.id!==ADMIN_UID&&u.role!=="admin");
  p.innerHTML=`<div class="card"><h2>Novo motorista</h2><form id="nm" class="row"><label>Nome completo<input id="nNome" required></label>
    <label>Usuário (login)<input id="nUser" required pattern="[a-z0-9._\\-]+" title="minúsculas, números, ponto, hífen" autocapitalize="none"></label>
    <label>Senha (mín. 6)<input id="nPass" type="text" minlength="6" required></label><button class="primary">Cadastrar</button></form><p id="nErr" class="err"></p></div>
    <div class="card"><h2>Motoristas</h2><div class="tw"><table><tr><th>Nome</th><th>Usuário</th><th>Situação</th><th>Ações</th></tr>${users.map(u=>`<tr><td>${esc(u.nome)}</td><td>${esc(u.usuario)}</td><td><span class="tag ${u.ativo===false?"NA":"OK"}">${u.ativo===false?"Inativo":"Ativo"}</span></td><td class="actions"><button type="button" data-action="toggle" data-id="${u.id}" data-a="${u.ativo===false}">${u.ativo===false?"Reativar":"Desativar"}</button><button type="button" class="danger" data-action="delete" data-id="${u.id}">Excluir</button></td></tr>`).join("")||'<tr><td colspan="4" class="muted">Nenhum motorista cadastrado.</td></tr>'}</table></div></div>`;
  $("#nm").onsubmit=async e=>{
    e.preventDefault();$("#nErr").textContent="";
    const usuario=$("#nUser").value.trim().toLowerCase(),sec=initializeApp(firebaseConfig,"sec"+Date.now()),sa=getAuth(sec);
    try{
      const c=await createUserWithEmailAndPassword(sa,usuario+DOMAIN,$("#nPass").value);
      await setDoc(doc(db,"users",c.user.uid),{nome:$("#nNome").value.trim(),usuario,role:"motorista",ativo:true,criadoEm:serverTimestamp()});
      await signOut(sa);toast("Motorista cadastrado.");vMotoristas();
    }catch(x){$("#nErr").textContent=x.code==="auth/email-already-in-use"?"Esse usuário já existe.":"Não foi possível cadastrar ("+(x.code||x.message)+")."}
  };
  let motoristaParaExcluir=null;
  const dialog=$("#deleteDriverDialog"),confirmButton=$("#confirmDeleteDriver");
  p.querySelector("table").onclick=e=>{
    const b=e.target.closest("button[data-action][data-id]");if(!b)return;
    const user=users.find(u=>u.id===b.dataset.id);if(!user)return;
    if(b.dataset.action==="toggle"){
      updateDoc(doc(db,"users",user.id),{ativo:b.dataset.a==="true"}).then(vMotoristas).catch(x=>toast(firebaseError(x)));
      return;
    }
    motoristaParaExcluir=user;
    $("#deleteDriverName").textContent=user.nome;
    $("#deleteDriverError").textContent="";
    dialog.showModal();
  };
  $("#cancelDeleteDriver").onclick=()=>dialog.close();
  confirmButton.onclick=async()=>{
    if(!motoristaParaExcluir)return;
    confirmButton.disabled=true;
    confirmButton.textContent="Excluindo…";
    $("#deleteDriverError").textContent="";
    try{
      await deleteDoc(doc(db,"users",motoristaParaExcluir.id));
      const nome=motoristaParaExcluir.nome;
      motoristaParaExcluir=null;
      dialog.close();
      toast(`Cadastro de ${nome} excluído.`);
      await vMotoristas();
    }catch(x){
      console.error("Falha ao excluir cadastro do motorista.",x);
      $("#deleteDriverError").textContent=firebaseError(x);
    }finally{
      confirmButton.disabled=false;
      confirmButton.textContent="Excluir motorista";
    }
  };
}

async function vCaminhoes(){
  const p=$("#pane");
  const ts=(await getDocs(collection(db,"caminhoes"))).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.placa.localeCompare(b.placa));
  p.innerHTML=`<div class="card"><h2>Novo caminhão</h2><form id="nc" class="row"><label>Placa<input id="cPlaca" required maxlength="8" style="text-transform:uppercase"></label>
    <label>Carreta/Equip. Nº<input id="cNum"></label><label>Descrição<input id="cDesc" placeholder="Ex.: Carreta baú"></label><button class="primary">Cadastrar</button></form></div>
    <div class="card tw"><h2>Caminhões</h2><table><tr><th>Placa</th><th>Nº</th><th>Descrição</th><th>Situação</th><th></th></tr>${ts.map(t=>`<tr><td>${esc(t.placa)}</td><td>${esc(t.numero)}</td><td>${esc(t.descricao)}</td><td>${t.ativo===false?"Inativo":"Ativo"}</td><td><button data-id="${t.id}" data-a="${t.ativo===false}">${t.ativo===false?"Reativar":"Desativar"}</button></td></tr>`).join("")||'<tr><td colspan="5" class="muted">Nenhum caminhão cadastrado.</td></tr>'}</table></div>`;
  $("#nc").onsubmit=async e=>{e.preventDefault();
    const placa=$("#cPlaca").value.trim().toUpperCase().replace(/\s/g,"");
    if(ts.some(t=>t.placa===placa)){toast("Essa placa já está cadastrada.");return}
    await addDoc(collection(db,"caminhoes"),{placa,numero:$("#cNum").value.trim(),descricao:$("#cDesc").value.trim(),ativo:true});
    toast("Caminhão cadastrado.");vCaminhoes()};
  p.querySelector("table").onclick=async e=>{const b=e.target.closest("button[data-id]");if(!b)return;
    await updateDoc(doc(db,"caminhoes",b.dataset.id),{ativo:b.dataset.a==="true"});vCaminhoes()};
}
