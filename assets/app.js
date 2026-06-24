import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const fallbackKey = 'skf_tt_league_platform_fallback_v3';
const defaultState = {
  settings:{ title:'SKF TT League Platform', activeSeasonId:'s2026', managerPassword:'skf2026', scorerPassword:'score2026' },
  seasons:[{id:'s2026', name:'Season 2026', status:'Active'}],
  players:[],
  groups:[{id:'A', name:'Group A', seasonId:'s2026'}, {id:'B', name:'Group B', seasonId:'s2026'}],
  stadiums:[
    {id:'stad1', name:'Santosh Arena', host:'Santosh'},
    {id:'stad2', name:'Sunil Pavilion', host:'Sunil'},
    {id:'stad3', name:'Rahul Champions Court', host:'Rahul'},
    {id:'stad4', name:'Karthik Spin Dome', host:'Karthik'},
    {id:'stad5', name:'Ashwin Smash Center', host:'Ashwin'}
  ],
  matches:[],
  hallOfFame:[]
};
let state = structuredClone(defaultState);
let docRef = null;
let role = localStorage.getItem('skf_tt_league_role') || 'viewer';
let isManager = false;
let isScorer = false;

const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const getConfig = () => window.firebaseConfig || window.SKF_FIREBASE_CONFIG || {};
const hasFirebaseConfig = () => { const c=getConfig(); return !!(c.apiKey && c.projectId); };
const activeSeasonId = () => state.settings?.activeSeasonId || state.seasons[0]?.id || '';
const seasonName = id => state.seasons.find(s=>s.id===id)?.name || 'No season';
const activeGroups = () => state.groups.filter(g=>g.seasonId===activeSeasonId());
const activePlayers = () => state.players.filter(p=>p.seasonId===activeSeasonId());
const activeMatches = () => state.matches.filter(m=>m.seasonId===activeSeasonId());
const groupName = id => state.groups.find(g=>g.id===id)?.name || '-';
const stadiumName = id => state.stadiums.find(s=>s.id===id)?.name || '-';
const playerName = id => state.players.find(p=>p.id===id)?.name || '-';

async function initData(){
  if(hasFirebaseConfig()){
    try{
      const app = initializeApp(getConfig());
      const db = getFirestore(app);
      docRef = doc(db, 'league', 'skf-tt-league');
      const snap = await getDoc(docRef);
      if(!snap.exists()) await setDoc(docRef, defaultState);
      onSnapshot(docRef, s=>{
        state = mergeState(s.exists()?s.data():{});
        render();
      }, err=>{ console.error(err); alert('Firebase connection error. Check Firestore rules.'); loadLocal(); });
    }catch(e){ console.error(e); loadLocal(); }
  } else loadLocal();
}
function mergeState(data){
  const merged = { ...structuredClone(defaultState), ...data };
  merged.settings = { ...defaultState.settings, ...(data.settings||{}) };
  for(const k of ['seasons','players','groups','stadiums','matches','hallOfFame']) merged[k] ||= [];
  return merged;
}
function loadLocal(){ state = mergeState(JSON.parse(localStorage.getItem(fallbackKey)||'{}')); render(); }
async function save(){ if(docRef) await setDoc(docRef, state); else localStorage.setItem(fallbackKey, JSON.stringify(state)); }
function canScore(){ return isManager || isScorer; }
function requireManager(){ if(!isManager){ alert('Manager login required'); return false; } return true; }
function requireScorer(){ if(!canScore()){ alert('Manager or scorer login required'); return false; } return true; }
function setRole(){
  isManager = role==='manager'; isScorer = role==='scorer';
  document.body.classList.toggle('is-manager', isManager);
  document.body.classList.toggle('is-scorer', isScorer);
  document.body.classList.toggle('can-score', canScore());
  $('roleBadge').textContent = isManager ? 'Manager Mode' : isScorer ? 'Scorer Mode' : (hasFirebaseConfig() ? 'Live Viewer Mode' : 'Viewer Mode - Firebase not configured');
  $('loginBtn').classList.toggle('hide', canScore());
  $('logoutBtn').classList.toggle('hide', !canScore());
}

window.closeLogin = () => $('loginModal').classList.add('hide');
window.loginUser = () => {
  const password = $('passwordInput').value;
  if(password === state.settings.managerPassword){ role='manager'; localStorage.setItem('skf_tt_league_role','manager'); closeLogin(); render(); }
  else if(password === state.settings.scorerPassword){ role='scorer'; localStorage.setItem('skf_tt_league_role','scorer'); closeLogin(); render(); }
  else alert('Wrong password');
};
$('loginBtn').onclick = () => $('loginModal').classList.remove('hide');
$('logoutBtn').onclick = () => { localStorage.removeItem('skf_tt_league_role'); role='viewer'; location.hash='dashboard'; render(); };
function showPage(){ let id=(location.hash||'#dashboard').slice(1); if(id==='settings'&&!isManager) id='dashboard'; document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); ($(id)||$('dashboard')).classList.add('active'); render(); }
window.addEventListener('hashchange', showPage);

window.addSeason = async()=>{ if(!requireManager())return; const name=$('seasonName').value.trim(); if(!name)return; const id=uid(); state.seasons.push({id,name,status:'Active'}); state.settings.activeSeasonId=id; $('seasonName').value=''; await save(); render(); };
window.setActiveSeason = async id=>{ if(!requireManager())return; state.settings.activeSeasonId=id; await save(); render(); };
window.archiveSeason = async id=>{ if(!requireManager())return; const s=state.seasons.find(x=>x.id===id); if(s){ s.status = s.status==='Archived'?'Active':'Archived'; await save(); render(); } };
window.deleteSeason = async id=>{ if(!requireManager())return; if(!confirm('Delete season and related groups/matches/players?'))return; state.seasons=state.seasons.filter(s=>s.id!==id); state.players=state.players.filter(p=>p.seasonId!==id); state.groups=state.groups.filter(g=>g.seasonId!==id); state.matches=state.matches.filter(m=>m.seasonId!==id); state.settings.activeSeasonId=state.seasons[0]?.id||''; await save(); render(); };

window.addPlayer = async()=>{ if(!requireManager())return; const name=$('playerName').value.trim(); const nick=$('playerNick').value.trim(); if(!name)return; state.players.push({id:uid(), name, nick, seasonId:activeSeasonId(), groupId:''}); $('playerName').value=''; $('playerNick').value=''; await save(); render(); };
window.deletePlayer = async id=>{ if(!requireManager())return; if(!confirm('Delete player and related matches?'))return; state.players=state.players.filter(p=>p.id!==id); state.matches=state.matches.filter(m=>m.aId!==id&&m.bId!==id); await save(); render(); };
window.changePlayerGroup = async(id, groupId)=>{ if(!requireManager())return; const p=state.players.find(x=>x.id===id); if(p){ p.groupId=groupId; await save(); render(); } };

window.addGroup = async()=>{ if(!requireManager())return; const name=$('groupName').value.trim(); if(!name)return; state.groups.push({id:uid(), name, seasonId:activeSeasonId()}); $('groupName').value=''; await save(); render(); };
window.deleteGroup = async id=>{ if(!requireManager())return; if(!confirm('Delete group? Players become unassigned and group matches are removed.'))return; state.groups=state.groups.filter(g=>g.id!==id); state.players.forEach(p=>{ if(p.groupId===id)p.groupId=''; }); state.matches=state.matches.filter(m=>m.groupId!==id); await save(); render(); };

window.addStadium = async()=>{ if(!requireManager())return; const name=$('stadiumName').value.trim(); const host=$('stadiumHost').value.trim(); if(!name)return; state.stadiums.push({id:uid(), name, host}); $('stadiumName').value=''; $('stadiumHost').value=''; await save(); render(); };
window.deleteStadium = async id=>{ if(!requireManager())return; if(!confirm('Delete stadium?'))return; state.stadiums=state.stadiums.filter(s=>s.id!==id); state.matches.forEach(m=>{ if(m.stadiumId===id)m.stadiumId=''; }); await save(); render(); };

window.generateGroupMatches = async()=>{
  if(!requireManager())return;
  if(!confirm('Generate round-robin matches within each group? Existing matches are kept.'))return;
  for(const g of activeGroups()){
    const list=activePlayers().filter(p=>p.groupId===g.id);
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const exists=state.matches.some(m=>m.seasonId===activeSeasonId() && m.type==='Group Match' && ((m.aId===list[i].id&&m.bId===list[j].id)||(m.aId===list[j].id&&m.bId===list[i].id)));
      if(!exists) state.matches.push({id:uid(), seasonId:activeSeasonId(), type:'Group Match', status:'Scheduled', round:g.name, groupId:g.id, stadiumId:'', date:'', time:'', aId:list[i].id, bId:list[j].id, a:list[i].name, b:list[j].name, score:'', winnerId:null});
    }
  }
  await save(); render();
};
window.clearGroupMatches = async()=>{ if(!requireManager())return; if(confirm('Clear all group matches for active season?')){ state.matches=state.matches.filter(m=>!(m.seasonId===activeSeasonId()&&m.type==='Group Match')); await save(); render(); } };
window.addManualMatch = async()=>{
  if(!requireManager())return;
  const aId=$('manualA').value, bId=$('manualB').value;
  if(!aId||!bId||aId===bId)return alert('Select two different players.');
  state.matches.push({id:uid(), seasonId:activeSeasonId(), type:$('manualType').value, status:'Scheduled', round:$('manualRound').value.trim() || $('manualType').value, groupId:$('manualGroup').value, stadiumId:$('manualStadium').value, date:$('manualDate').value, time:$('manualTime').value, aId, bId, a:playerName(aId), b:playerName(bId), score:'', winnerId:null});
  await save(); render();
};
window.deleteMatch = async id=>{ if(!requireManager())return; if(confirm('Delete match?')){ state.matches=state.matches.filter(m=>m.id!==id); await save(); render(); } };
window.changeStatus = async(id,status)=>{ if(!requireManager())return; const m=state.matches.find(x=>x.id===id); if(m){ m.status=status; await save(); render(); } };

function parseScore(score){ let aw=0,bw=0,pfa=0,pfb=0; (score||'').split(',').forEach(g=>{ const [a,b]=g.trim().split('-').map(Number); if(!isNaN(a)&&!isNaN(b)){ pfa+=a; pfb+=b; if(a>b)aw++; else if(b>a)bw++; }}); return {aw,bw,pfa,pfb,winner:aw>bw?'A':bw>aw?'B':null}; }
window.loadScoreForm = ()=>{ const m=activeMatches().find(x=>x.id===$('matchSelect').value); if(!m){ $('scoreForm').innerHTML=''; return; } $('scoreForm').innerHTML=`<p><b>${m.a}</b> vs <b>${m.b}</b></p><p class="muted">${m.type} • ${m.date||'No date'} ${m.time||''} • ${stadiumName(m.stadiumId)}</p><input id="scoreInput" placeholder="Example: 11-8, 9-11, 11-6" value="${m.score||''}"><button class="btn" onclick="saveScore('${m.id}')">Save Score</button>`; };
window.saveScore = async id=>{ if(!requireScorer())return; const m=state.matches.find(x=>x.id===id); if(!m)return; m.score=$('scoreInput').value.trim(); const r=parseScore(m.score); m.winnerId = r.winner==='A'?m.aId:r.winner==='B'?m.bId:null; if(m.winnerId)m.status='Completed'; await save(); render(); loadScoreForm(); };

function standingsForGroup(groupId){
  const rows=activePlayers().filter(p=>p.groupId===groupId).map(p=>({id:p.id,name:p.name,p:0,w:0,l:0,pf:0,pa:0}));
  activeMatches().filter(m=>m.groupId===groupId&&m.type==='Group Match'&&m.score).forEach(m=>{ const A=rows.find(r=>r.id===m.aId), B=rows.find(r=>r.id===m.bId); if(!A||!B)return; const s=parseScore(m.score); A.p++;B.p++;A.pf+=s.pfa;A.pa+=s.pfb;B.pf+=s.pfb;B.pa+=s.pfa; if(m.winnerId===m.aId){A.w++;B.l++;}else if(m.winnerId===m.bId){B.w++;A.l++;} });
  return rows.sort((a,b)=>b.w-a.w || (b.pf-b.pa)-(a.pf-a.pa) || b.pf-a.pf || a.name.localeCompare(b.name));
}
const allGroupStandings=()=>activeGroups().map(g=>({group:g,rows:standingsForGroup(g.id)}));
function table(rows, cols){ if(!rows.length)return '<p class="muted">No data yet.</p>'; return '<table><thead><tr>'+cols.map(c=>`<th>${c[0]}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${typeof c[1]==='function'?c[1](r):r[c[1]]}</td>`).join('')+'</tr>').join('')+'</tbody></table>'; }

window.generateKnockouts = async()=>{
  if(!requireManager())return;
  const q=Number($('qualifiersPerGroup').value||2);
  const groups=allGroupStandings().filter(g=>g.rows.length>=q);
  if(groups.length<2)return alert('Need at least 2 groups with enough qualified players.');
  state.matches=state.matches.filter(m=>!(m.seasonId===activeSeasonId()&&m.isKnockout));
  if(groups.length===2 && q===2){
    const A=groups[0],B=groups[1];
    addKOMatch('Semi Final',A.rows[0],B.rows[1],`${A.group.name} #1`,`${B.group.name} #2`);
    addKOMatch('Semi Final',B.rows[0],A.rows[1],`${B.group.name} #1`,`${A.group.name} #2`);
  } else {
    let qs=[]; groups.forEach(g=>g.rows.slice(0,q).forEach((r,i)=>qs.push({row:r,seed:`${g.group.name} #${i+1}`})));
    for(let i=0;i<qs.length;i+=2) if(qs[i+1]) addKOMatch('Knockout',qs[i].row,qs[i+1].row,qs[i].seed,qs[i+1].seed);
  }
  await save(); render();
};
function addKOMatch(round,a,b,aseed='',bseed=''){ state.matches.push({id:uid(), seasonId:activeSeasonId(), type:round, isKnockout:true, status:'Scheduled', round, groupId:'', stadiumId:'', date:'', time:'', aId:a.id,bId:b.id,a:`${aseed} ${a.name}`.trim(),b:`${bseed} ${b.name}`.trim(),score:'',winnerId:null}); }
window.addManualKnockout = async()=>{ if(!requireManager())return; const aId=$('koA').value,bId=$('koB').value; if(!aId||!bId||aId===bId)return alert('Select two different players.'); state.matches.push({id:uid(), seasonId:activeSeasonId(), type:$('koRound').value, isKnockout:true, status:'Scheduled', round:$('koRound').value, groupId:'', stadiumId:'', date:'', time:'', aId,bId,a:playerName(aId),b:playerName(bId),score:'',winnerId:null}); await save(); render(); };
window.clearKnockouts = async()=>{ if(!requireManager())return; if(confirm('Clear knockout matches?')){ state.matches=state.matches.filter(m=>!(m.seasonId===activeSeasonId()&&m.isKnockout)); await save(); render(); } };

window.addHallEntry = async()=>{ if(!requireManager())return; const season=$('hofSeason').value.trim(), champion=$('hofChampion').value.trim(), runner=$('hofRunner').value.trim(); if(!season||!champion)return; state.hallOfFame.push({id:uid(),season,champion,runner}); $('hofSeason').value='';$('hofChampion').value='';$('hofRunner').value=''; await save(); render(); };
window.deleteHallEntry = async id=>{ if(!requireManager())return; state.hallOfFame=state.hallOfFame.filter(h=>h.id!==id); await save(); render(); };
window.saveSettings = async()=>{ if(!requireManager())return; state.settings.title=$('settingTitle').value.trim()||state.settings.title; state.settings.activeSeasonId=$('activeSeasonSelect').value; state.settings.managerPassword=$('managerPasswordSetting').value.trim()||state.settings.managerPassword; state.settings.scorerPassword=$('scorerPasswordSetting').value.trim()||state.settings.scorerPassword; await save(); render(); };

function render(){
  setRole();
  $('appTitle').textContent=state.settings.title;
  $('dashSeason').textContent=seasonName(activeSeasonId()); $('dashPlayers').textContent=activePlayers().length; $('dashGroups').textContent=activeGroups().length; $('dashMatches').textContent=activeMatches().length; $('dashDone').textContent=activeMatches().filter(m=>m.status==='Completed'||m.score).length;
  $('seasonsList').innerHTML=table(state.seasons,[['Season','name'],['Status','status'],['Action',r=>isManager?`<button class="btn" onclick="setActiveSeason('${r.id}')">Make Active</button><button class="btn light" onclick="archiveSeason('${r.id}')">Archive/Activate</button><button class="btn danger" onclick="deleteSeason('${r.id}')">Delete</button>`:'']]);
  const groupOptions=['<option value="">Unassigned</option>'+activeGroups().map(g=>`<option value="${g.id}">${g.name}</option>`).join('')];
  $('playersList').innerHTML=table(activePlayers(),[['Player',r=>`${r.name}${r.nick?`<br><span class="muted">${r.nick}</span>`:''}`],['Group',r=>isManager?`<select onchange="changePlayerGroup('${r.id}',this.value)"><option value="">Unassigned</option>${activeGroups().map(g=>`<option value="${g.id}" ${g.id===r.groupId?'selected':''}>${g.name}</option>`).join('')}</select>`:groupName(r.groupId)],['Action',r=>isManager?`<button class="btn danger" onclick="deletePlayer('${r.id}')">Delete</button>`:'']]);
  $('groupsList').innerHTML=activeGroups().map(g=>`<h3>${g.name} ${isManager?`<button class="btn danger small" onclick="deleteGroup('${g.id}')">Delete</button>`:''}</h3>`+table(activePlayers().filter(p=>p.groupId===g.id),[['Player','name']])).join('') || '<p class="muted">No groups yet.</p>';
  $('stadiumsList').innerHTML=table(state.stadiums,[['Stadium','name'],['Host / Location','host'],['Action',r=>isManager?`<button class="btn danger" onclick="deleteStadium('${r.id}')">Delete</button>`:'']]);
  const pOpts=activePlayers().map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); ['manualA','manualB','koA','koB'].forEach(id=>{ if($(id))$(id).innerHTML=pOpts; });
  $('manualGroup').innerHTML='<option value="">No group</option>'+activeGroups().map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  $('manualStadium').innerHTML='<option value="">No stadium</option>'+state.stadiums.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  const scheduleRows=activeMatches().filter(m=>!m.isKnockout);
  $('scheduleList').innerHTML=table(scheduleRows,[['Date',r=>`${r.date||'-'} ${r.time||''}`],['Type','type'],['Group',r=>groupName(r.groupId)],['Match',r=>`${r.a} vs ${r.b}`],['Stadium',r=>stadiumName(r.stadiumId)],['Score',r=>r.score||'Pending'],['Status',r=>isManager?`<select onchange="changeStatus('${r.id}',this.value)">${['Scheduled','In Progress','Completed','Walkover','Postponed','Cancelled'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select>`:`<span class="status-${r.status}">${r.status}</span>`],['Action',r=>isManager?`<button class="btn danger" onclick="deleteMatch('${r.id}')">Delete</button>`:'']]);
  $('matchSelect').innerHTML=activeMatches().map(m=>`<option value="${m.id}">${m.type}: ${m.a} vs ${m.b}</option>`).join(''); if(activeMatches().length) loadScoreForm(); else $('scoreForm').innerHTML='';
  $('dashUpcoming').innerHTML=table(activeMatches().filter(m=>!m.score && m.status!=='Cancelled').slice(0,10),[['Date',r=>`${r.date||'-'} ${r.time||''}`],['Match',r=>`${r.a} vs ${r.b}`],['Stadium',r=>stadiumName(r.stadiumId)]]);
  $('dashLeaderboard').innerHTML=allGroupStandings().map(g=>`<h3>${g.group.name}</h3>`+table(g.rows.slice(0,4),[['Rank',r=>g.rows.indexOf(r)+1],['Player','name'],['W','w'],['L','l'],['Diff',r=>r.pf-r.pa]])).join('');
  $('groupStandings').innerHTML=allGroupStandings().map(g=>`<h3>${g.group.name}</h3>`+table(g.rows,[['Rank',r=>g.rows.indexOf(r)+1],['Player','name'],['P','p'],['W','w'],['L','l'],['PF','pf'],['PA','pa'],['Diff',r=>r.pf-r.pa]])).join('');
  $('knockoutList').innerHTML=table(activeMatches().filter(m=>m.isKnockout),[['Round','round'],['Match',r=>`${r.a} vs ${r.b}`],['Score',r=>r.score||'Pending'],['Winner',r=>r.winnerId?(r.winnerId===r.aId?r.a:r.b):'-'],['Action',r=>isManager?`<button class="btn danger" onclick="deleteMatch('${r.id}')">Delete</button>`:'']]);
  $('hallList').innerHTML=table(state.hallOfFame,[['Season','season'],['Champion','champion'],['Runner-up','runner'],['Action',r=>isManager?`<button class="btn danger" onclick="deleteHallEntry('${r.id}')">Delete</button>`:'']]);
  $('activeSeasonSelect').innerHTML=state.seasons.map(s=>`<option value="${s.id}" ${s.id===activeSeasonId()?'selected':''}>${s.name}</option>`).join('');
  $('settingTitle').value=state.settings.title; $('managerPasswordSetting').value=state.settings.managerPassword; $('scorerPasswordSetting').value=state.settings.scorerPassword;
}
window.exportCSV=()=>{ let lines=[['Season','Group','Rank','Player','Played','Won','Lost','PF','PA','Diff']]; allGroupStandings().forEach(g=>g.rows.forEach((r,i)=>lines.push([seasonName(activeSeasonId()),g.group.name,i+1,r.name,r.p,r.w,r.l,r.pf,r.pa,r.pf-r.pa]))); download('skf-tt-standings.csv',lines.map(r=>r.join(',')).join('\n')); };
window.downloadBackup=()=>download('skf-tt-league-backup.json',JSON.stringify(state,null,2));
function download(name,text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=name; a.click(); }
window.resetAll=async()=>{ if(!requireManager())return; if(confirm('Reset all league data?')){ state=structuredClone(defaultState); await save(); render(); } };

initData(); showPage();
