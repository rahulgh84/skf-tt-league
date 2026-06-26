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
let isOnlineMode = navigator.onLine;
let lastSyncStatus = 'Not synced';
let pendingLocalChanges = localStorage.getItem('skf_tt_league_pending_sync') === 'yes';
let role = localStorage.getItem('skf_tt_league_role') || 'viewer';
let isManager = false;
let isScorer = false;
// Score page state: preserve selected match and search filter across renders.
let selectedScoreMatchId = localStorage.getItem('skf_tt_selected_match') || '';
let scoreMatchSearch = '';

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
        saveLocalSnapshot();
        if(!pendingLocalChanges) lastSyncStatus = 'Live synced';
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
function loadLocal(){ state = mergeState(JSON.parse(localStorage.getItem(fallbackKey)||'{}')); lastSyncStatus = hasFirebaseConfig() ? 'Offline/local mode' : 'Local mode'; render(); }
function saveLocalSnapshot(){ localStorage.setItem(fallbackKey, JSON.stringify(state)); }
function markPending(){ pendingLocalChanges = true; localStorage.setItem('skf_tt_league_pending_sync','yes'); }
function clearPending(){ pendingLocalChanges = false; localStorage.removeItem('skf_tt_league_pending_sync'); }
async function save(){
  saveLocalSnapshot();
  if(docRef && navigator.onLine){
    try{
      await setDoc(docRef, state);
      clearPending();
      lastSyncStatus = 'Synced';
      updateSyncBadge();
    }catch(e){
      console.error(e);
      markPending();
      lastSyncStatus = 'Offline - saved on this device';
      updateSyncBadge();
    }
  } else {
    markPending();
    lastSyncStatus = 'Offline - saved on this device';
    updateSyncBadge();
  }
}
async function syncNow(){
  if(!docRef) return alert('Firebase is not connected yet.');
  if(!navigator.onLine) return alert('No internet connection. Scores are saved on this device.');
  try{
    saveLocalSnapshot();
    await setDoc(docRef, state);
    clearPending();
    lastSyncStatus = 'Synced';
    updateSyncBadge();
    alert('Synced to Firebase.');
  }catch(e){
    console.error(e);
    markPending();
    lastSyncStatus = 'Sync failed - saved locally';
    updateSyncBadge();
    alert('Sync failed. Data is still saved on this device.');
  }
}
window.syncNow = syncNow;
function updateSyncBadge(){
  const el = document.getElementById('syncBadge');
  if(!el) return;
  const online = navigator.onLine;
  const text = !hasFirebaseConfig() ? 'Local Only' : !online ? 'Offline - saved locally' : pendingLocalChanges ? 'Online - sync pending' : lastSyncStatus || 'Online';
  el.textContent = text;
  el.className = 'sync-badge ' + (!online ? 'offline' : pendingLocalChanges ? 'pending' : 'online');
}
window.addEventListener('online', () => { isOnlineMode = true; updateSyncBadge(); if(pendingLocalChanges) syncNow(); });
window.addEventListener('offline', () => { isOnlineMode = false; lastSyncStatus = 'Offline - saved locally'; updateSyncBadge(); });
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

function setsFromScore(score){
  return (score||'').split(',').map(g=>g.trim()).filter(Boolean).map(g=>{
    const [a,b]=g.split('-').map(Number);
    return (!isNaN(a)&&!isNaN(b)) ? {a,b,done:true} : null;
  }).filter(Boolean);
}
function scoreFromSets(sets){ return (sets||[]).filter(s=>s.done || s.a || s.b).map(s=>`${Number(s.a)||0}-${Number(s.b)||0}`).join(', '); }
function setWinner(set, pointsToWin=11, winBy=2){
  const a=Number(set?.a)||0, b=Number(set?.b)||0;
  if(a>=pointsToWin && a-b>=winBy) return 'A';
  if(b>=pointsToWin && b-a>=winBy) return 'B';
  return null;
}
function parseScore(score){
  let aw=0,bw=0,pfa=0,pfb=0;
  setsFromScore(score).forEach(s=>{ pfa+=s.a; pfb+=s.b; if(s.a>s.b)aw++; else if(s.b>s.a)bw++; });
  return {aw,bw,pfa,pfb,winner:aw>bw?'A':bw>aw?'B':null};
}
function normalizeLiveMatch(m){
  if(!Array.isArray(m.sets)) m.sets = setsFromScore(m.score);
  if(!m.sets.length) m.sets = [{a:0,b:0,done:false}];
  m.bestOf = Number(m.bestOf || 3);
  m.pointsToWin = Number(m.pointsToWin || 11);
  m.winBy = Number(m.winBy || 2);
  if(!Array.isArray(m.pointHistory)) m.pointHistory = [];
  return m;
}
function matchResultFromSets(m){
  normalizeLiveMatch(m);
  let aw=0,bw=0,pfa=0,pfb=0;
  m.sets.forEach(s=>{
    pfa += Number(s.a)||0; pfb += Number(s.b)||0;
    const w = setWinner(s, m.pointsToWin, m.winBy) || (s.done ? (s.a>s.b?'A':s.b>s.a?'B':null) : null);
    if(w==='A') aw++; if(w==='B') bw++;
  });
  const need = Math.ceil((Number(m.bestOf)||3)/2);
  const winner = aw>=need ? 'A' : bw>=need ? 'B' : null;
  return {aw,bw,pfa,pfb,need,winner};
}
function refreshMatchFromLive(m){
  normalizeLiveMatch(m);
  m.sets.forEach(s=>{ if(setWinner(s, m.pointsToWin, m.winBy)) s.done = true; });
  m.score = scoreFromSets(m.sets);
  const r = matchResultFromSets(m);
  m.winnerId = r.winner==='A' ? m.aId : r.winner==='B' ? m.bId : null;
  if(m.winnerId) m.status = 'Completed';
  else if(m.sets.some(s=>s.a||s.b)) m.status = 'Live';
  return r;
}
function currentSetIndex(m){
  normalizeLiveMatch(m);
  let idx = m.sets.findIndex(s=>!s.done && !setWinner(s, m.pointsToWin, m.winBy));
  if(idx < 0){
    const r = matchResultFromSets(m);
    if(!r.winner){ m.sets.push({a:0,b:0,done:false}); idx = m.sets.length-1; }
    else idx = m.sets.length-1;
  }
  return idx;
}
function matchScoreText(m){
  if(!m) return 'Pending';
  const txt = m.score || scoreFromSets(m.sets);
  return txt || 'Pending';
}
function matchStatus(m){
  const s = m?.status || 'Scheduled';
  return s === 'In Progress' ? 'Live' : s;
}
function hasScoreStarted(m){
  if(!m) return false;
  if((m.score||'').trim() && !/^pending$/i.test((m.score||'').trim()) && !/^w\/?o$/i.test((m.score||'').trim())) return true;
  if(Array.isArray(m.sets) && m.sets.some(s => (Number(s.a)||0) > 0 || (Number(s.b)||0) > 0)) return true;
  return false;
}
function isPublicLive(m){ return matchStatus(m)==='Live' && !m.winnerId && hasScoreStarted(m); }
function isPublicCompleted(m){ return ['Completed','Walkover'].includes(matchStatus(m)) || !!m.winnerId; }
function statusClass(m){ return 'status-' + matchStatus(m).replace(/\s+/g,'-'); }
function statusBadge(m){
  const s = matchStatus(m);
  const icon = s === 'Scheduled' ? '🟡' : s === 'Live' ? '🔴' : s === 'Completed' ? '🟢' : s === 'Walkover' ? '🏳️' : '';
  return `<span class="match-status ${statusClass(m)}">${icon} ${s}</span>`;
}
function liveSetsHtml(m){
  normalizeLiveMatch(m);
  const cur=currentSetIndex(m);
  return `<div class="live-sets">${m.sets.map((s,i)=>{
    const w=setWinner(s,m.pointsToWin,m.winBy) || (s.done ? (s.a>s.b?'A':s.b>s.a?'B':'') : '');
    return `<div class="set-pill ${i===cur?'current':''}"><b>Game ${i+1}</b><span>${s.a||0}-${s.b||0}</span><small>${w==='A'?m.a:w==='B'?m.b:s.done?'Done':'Live'}</small></div>`;
  }).join('')}</div>`;
}

function scoreMatchLabel(m){
  const no = m.matchNumber || m.serial || m.no || '';
  const noText = no ? `#${no} • ` : '';
  const where = stadiumName(m.stadiumId);
  return `${noText}${matchStatus(m)} • ${m.type}: ${m.a} vs ${m.b}${where && where !== '-' ? ' • '+where : ''}`;
}
function filteredScoreMatches(){
  const q = (scoreMatchSearch || '').trim().toLowerCase();
  const matches = activeMatches();
  if(!q) return matches;
  return matches.filter(m => [
    m.matchNumber, m.serial, m.no, m.type, m.round, m.a, m.b,
    groupName(m.groupId), stadiumName(m.stadiumId), matchStatus(m)
  ].join(' ').toLowerCase().includes(q));
}
window.openMatchPicker = () => {
  const list = $('matchPickerList');
  if(list) list.classList.remove('hide');
  renderScoreMatchSelect();
};
window.filterScoreMatches = () => {
  scoreMatchSearch = $('matchSearch')?.value || '';
  renderScoreMatchSelect();
};
window.pickScoreMatch = (id) => {
  selectedScoreMatchId = id || '';
  if(selectedScoreMatchId) localStorage.setItem('skf_tt_selected_match', selectedScoreMatchId);
  const m = activeMatches().find(x=>x.id===selectedScoreMatchId);
  if($('matchSearch') && m) $('matchSearch').value = scoreMatchLabel(m);
  const list = $('matchPickerList');
  if(list) list.classList.add('hide');
  loadScoreForm();
};
window.selectScoreMatch = (id) => window.pickScoreMatch(id);
function renderScoreMatchSelect(){
  const select = $('matchSelect');
  const picker = $('matchPickerList');
  const matches = filteredScoreMatches();
  if(select){
    select.innerHTML = matches.map(m=>`<option value="${m.id}">${scoreMatchLabel(m)}</option>`).join('');
  }
  const stillExists = activeMatches().some(m=>m.id===selectedScoreMatchId);
  if(!selectedScoreMatchId || !stillExists){
    selectedScoreMatchId = matches[0]?.id || activeMatches()[0]?.id || '';
    if(selectedScoreMatchId) localStorage.setItem('skf_tt_selected_match', selectedScoreMatchId);
  }
  if(select && selectedScoreMatchId) select.value = selectedScoreMatchId;
  if(picker){
    picker.innerHTML = matches.length ? matches.slice(0,80).map(m=>`
      <button type="button" class="match-picker-item ${m.id===selectedScoreMatchId?'selected':''}" onclick="pickScoreMatch('${m.id}')">
        <span>${scoreMatchLabel(m)}</span>
        <small>${m.date||'No date'} ${m.time||''} • ${groupName(m.groupId)} • ${statusBadge(m)}</small>
      </button>`).join('') : '<p class="muted match-picker-empty">No matches found.</p>';
  }
  const selected = activeMatches().find(m=>m.id===selectedScoreMatchId);
  if($('matchSearch') && selected && !scoreMatchSearch) $('matchSearch').value = scoreMatchLabel(selected);
  if(!matches.length && $('scoreForm')) $('scoreForm').innerHTML = '<p class="muted">No matches found.</p>';
}
document.addEventListener('click', (e)=>{
  const combo = document.querySelector('.match-combo');
  if(combo && !combo.contains(e.target)) $('matchPickerList')?.classList.add('hide');
});
window.loadScoreForm = ()=>{
  const id = selectedScoreMatchId || $('matchSelect')?.value;
  const m=activeMatches().find(x=>x.id===id);
  if(!m){ $('scoreForm').innerHTML=''; return; }
  normalizeLiveMatch(m);
  const r=matchResultFromSets(m), idx=currentSetIndex(m), cur=m.sets[idx] || {a:0,b:0};
  $('scoreForm').innerHTML=`
    <div class="live-score-card">
      <h3>${m.a} vs ${m.b}</h3>
      <p class="muted">${m.type} • ${m.date||'No date'} ${m.time||''} • ${stadiumName(m.stadiumId)} • ${statusBadge(m)}</p>
      <div class="formrow live-settings">
        <label>Match format <select id="bestOfInput" onchange="updateLiveSettings('${m.id}')">${[1,3,5,7].map(n=>`<option value="${n}" ${Number(m.bestOf)===n?'selected':''}>Best of ${n}</option>`).join('')}</select></label>
        <label>Game to <input id="pointsToWinInput" type="number" min="1" value="${m.pointsToWin}"></label>
        <label>Win by <input id="winByInput" type="number" min="1" value="${m.winBy}"></label>
        <button class="btn light" onclick="updateLiveSettings('${m.id}')">Apply</button>
      </div>
      ${liveSetsHtml(m)}
      <div class="live-board">
        <div class="player-score"><b>${m.a}</b><span>${cur.a||0}</span><button class="btn" onclick="addPoint('${m.id}','A')">+1 ${m.a}</button></div>
        <div class="player-score"><b>${m.b}</b><span>${cur.b||0}</span><button class="btn" onclick="addPoint('${m.id}','B')">+1 ${m.b}</button></div>
      </div>
      <p class="muted">Sets: ${m.a} ${r.aw} - ${r.bw} ${m.b} ${r.winner ? '• Winner: '+(r.winner==='A'?m.a:m.b) : ''}</p>
      <div class="formrow">
        <button class="btn light" onclick="undoPoint('${m.id}')">Undo Last Point</button>
        <button class="btn light" onclick="nextGame('${m.id}')">Start Next Game</button>
        <button class="btn danger" onclick="resetLiveScore('${m.id}')">Reset Score</button>
      </div>
      <hr>
      <h4>Walkover / Forfeit</h4>
      <p class="muted">Use this only when one player does not show up or is not willing/able to play. Winner gets 2 points. PF/PA/Diff stay 0 for this match.</p>
      <div class="formrow walkover-actions">
        <button class="btn walkover" onclick="declareWalkover('${m.id}','A')">Declare ${m.a} Walkover Win</button>
        <button class="btn walkover" onclick="declareWalkover('${m.id}','B')">Declare ${m.b} Walkover Win</button>
      </div>
      <hr>
      <p class="muted">Optional final/manual score entry:</p>
      <input id="scoreInput" placeholder="Example: 11-8, 9-11, 11-6" value="${matchScoreText(m)==='Pending'?'':matchScoreText(m)}">
      <button class="btn" onclick="saveScore('${m.id}')">Save Manual Score</button>
    </div>`;
};
window.updateLiveSettings = async id=>{
  if(!requireScorer())return;
  const m=state.matches.find(x=>x.id===id); if(!m)return;
  normalizeLiveMatch(m);
  m.bestOf=Number($('bestOfInput')?.value || m.bestOf || 3);
  m.pointsToWin=Number($('pointsToWinInput')?.value || m.pointsToWin || 11);
  m.winBy=Number($('winByInput')?.value || m.winBy || 2);
  refreshMatchFromLive(m); await save(); render(); loadScoreForm();
};
window.addPoint = async(id, side)=>{
  if(!requireScorer())return;
  const m=state.matches.find(x=>x.id===id); if(!m)return;
  normalizeLiveMatch(m);
  if(matchResultFromSets(m).winner){ alert('Match already completed. Reset score to score again.'); return; }
  m.pointHistory.push(JSON.stringify(m.sets));
  const idx=currentSetIndex(m); const s=m.sets[idx];
  if(side==='A') s.a=(Number(s.a)||0)+1; else s.b=(Number(s.b)||0)+1;
  if(setWinner(s,m.pointsToWin,m.winBy)) s.done=true;
  refreshMatchFromLive(m);
  if(!m.winnerId && s.done) m.sets.push({a:0,b:0,done:false});
  await save(); render(); loadScoreForm();
};
window.undoPoint = async id=>{
  if(!requireScorer())return;
  const m=state.matches.find(x=>x.id===id); if(!m)return; normalizeLiveMatch(m);
  const prev=m.pointHistory.pop(); if(!prev)return alert('No point history to undo.');
  m.sets=JSON.parse(prev); m.status='Live'; refreshMatchFromLive(m); if(!m.winnerId && m.status==='Completed') m.status='Live';
  await save(); render(); loadScoreForm();
};
window.nextGame = async id=>{
  if(!requireScorer())return;
  const m=state.matches.find(x=>x.id===id); if(!m)return; normalizeLiveMatch(m);
  if(matchResultFromSets(m).winner) return alert('Match already completed.');
  const idx=currentSetIndex(m); const s=m.sets[idx];
  if(!s.done && (s.a || s.b) && !confirm('Current game is not finished. Start next game anyway?')) return;
  if(!s.done && (s.a || s.b)) s.done=true;
  m.sets.push({a:0,b:0,done:false}); refreshMatchFromLive(m); await save(); render(); loadScoreForm();
};
window.resetLiveScore = async id=>{
  if(!requireScorer())return;
  if(!confirm('Reset score for this match?'))return;
  const m=state.matches.find(x=>x.id===id); if(!m)return;
  m.sets=[{a:0,b:0,done:false}]; m.pointHistory=[]; m.score=''; m.winnerId=null; m.status='Scheduled';
  await save(); render(); loadScoreForm();
};

window.declareWalkover = async (id, side)=>{
  if(!requireScorer())return;
  const m=state.matches.find(x=>x.id===id); if(!m)return;
  const winnerName = side==='A' ? m.a : m.b;
  if(!confirm(`Declare walkover win for ${winnerName}?`)) return;
  m.sets=[];
  m.pointHistory=[];
  m.score='W/O';
  m.winnerId = side==='A' ? m.aId : m.bId;
  m.status='Walkover';
  m.completedAt=new Date().toISOString();
  await save(); render(); loadScoreForm();
};

window.saveScore = async id=>{
  if(!requireScorer())return;
  const m=state.matches.find(x=>x.id===id); if(!m)return;
  m.score=$('scoreInput').value.trim();
  if(/^w\/?o$/i.test(m.score) || /^walkover$/i.test(m.score)){
    alert('For walkover, use the Walkover buttons so the winner is selected correctly.');
    return;
  }
  m.sets=setsFromScore(m.score);
  if(!m.sets.length) m.sets=[{a:0,b:0,done:false}];
  m.pointHistory=[];
  const r=refreshMatchFromLive(m);
  if(!r.winner && m.score) m.status='Live';
  await save(); render(); loadScoreForm();
};

function standingsForGroup(groupId){
  const rows=activePlayers().filter(p=>p.groupId===groupId).map(p=>({id:p.id,name:p.name,p:0,w:0,l:0,pts:0,pf:0,pa:0}));
  activeMatches().filter(m=>m.groupId===groupId&&m.type==='Group Match'&&m.score).forEach(m=>{
    const A=rows.find(r=>r.id===m.aId), B=rows.find(r=>r.id===m.bId); if(!A||!B)return;
    A.p++; B.p++;
    if(matchStatus(m)==='Walkover'){
      if(m.winnerId===m.aId){ A.w++; A.pts+=2; B.l++; }
      else if(m.winnerId===m.bId){ B.w++; B.pts+=2; A.l++; }
      return;
    }
    const s=parseScore(m.score); A.pf+=s.pfa; A.pa+=s.pfb; B.pf+=s.pfb; B.pa+=s.pfa;
    if(m.winnerId===m.aId){A.w++;A.pts+=2;B.l++;}else if(m.winnerId===m.bId){B.w++;B.pts+=2;A.l++;}
  });
  return rows.sort((a,b)=>b.pts-a.pts || (b.pf-b.pa)-(a.pf-a.pa) || b.pf-a.pf || a.name.localeCompare(b.name));
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
  updateSyncBadge();
  $('appTitle').textContent=state.settings.title;
  const matches = activeMatches();
  const scheduledCount = matches.filter(m=>matchStatus(m)==='Scheduled').length;
  const liveCount = matches.filter(m=>isPublicLive(m)).length;
  const completedCount = matches.filter(m=>isPublicCompleted(m)).length;
  $('dashSeason').textContent=seasonName(activeSeasonId()); $('dashPlayers').textContent=activePlayers().length; $('dashGroups').textContent=activeGroups().length; $('dashMatches').textContent=matches.length; $('dashScheduled').textContent=scheduledCount; $('dashLive').textContent=liveCount; $('dashDone').textContent=completedCount;
  $('seasonsList').innerHTML=table(state.seasons,[['Season','name'],['Status','status'],['Action',r=>isManager?`<button class="btn" onclick="setActiveSeason('${r.id}')">Make Active</button><button class="btn light" onclick="archiveSeason('${r.id}')">Archive/Activate</button><button class="btn danger" onclick="deleteSeason('${r.id}')">Delete</button>`:'']]);
  const groupOptions=['<option value="">Unassigned</option>'+activeGroups().map(g=>`<option value="${g.id}">${g.name}</option>`).join('')];
  $('playersList').innerHTML=table(activePlayers(),[['Player',r=>`${r.name}${r.nick?`<br><span class="muted">${r.nick}</span>`:''}`],['Group',r=>isManager?`<select onchange="changePlayerGroup('${r.id}',this.value)"><option value="">Unassigned</option>${activeGroups().map(g=>`<option value="${g.id}" ${g.id===r.groupId?'selected':''}>${g.name}</option>`).join('')}</select>`:groupName(r.groupId)],['Action',r=>isManager?`<button class="btn danger" onclick="deletePlayer('${r.id}')">Delete</button>`:'']]);
  $('groupsList').innerHTML=activeGroups().map(g=>`<h3>${g.name} ${isManager?`<button class="btn danger small" onclick="deleteGroup('${g.id}')">Delete</button>`:''}</h3>`+table(activePlayers().filter(p=>p.groupId===g.id),[['Player','name']])).join('') || '<p class="muted">No groups yet.</p>';
  $('stadiumsList').innerHTML=table(state.stadiums,[['Stadium','name'],['Host / Location','host'],['Action',r=>isManager?`<button class="btn danger" onclick="deleteStadium('${r.id}')">Delete</button>`:'']]);
  const pOpts=activePlayers().map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); ['manualA','manualB','koA','koB'].forEach(id=>{ if($(id))$(id).innerHTML=pOpts; });
  $('manualGroup').innerHTML='<option value="">No group</option>'+activeGroups().map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  $('manualStadium').innerHTML='<option value="">No stadium</option>'+state.stadiums.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  const scheduleRows=activeMatches().filter(m=>!m.isKnockout);
  $('scheduleList').innerHTML=table(scheduleRows,[['Date',r=>`${r.date||'-'} ${r.time||''}`],['Type','type'],['Group',r=>groupName(r.groupId)],['Match',r=>`${r.a} vs ${r.b}`],['Stadium',r=>stadiumName(r.stadiumId)],['Score',r=>matchScoreText(r)],['Status',r=>isManager?`<select class="status-select ${statusClass(r)}" onchange="changeStatus('${r.id}',this.value)">${['Scheduled','Live','Completed','Walkover','Postponed','Cancelled'].map(s=>`<option ${matchStatus(r)===s?'selected':''}>${s}</option>`).join('')}</select>`:statusBadge(r)],['Action',r=>isManager?`<button class="btn danger" onclick="deleteMatch('${r.id}')">Delete</button>`:'']]);
  renderScoreMatchSelect(); if(activeMatches().length) loadScoreForm(); else if($('scoreForm')) $('scoreForm').innerHTML='<p class="muted">No matches found.</p>';
  const liveMatches = activeMatches().filter(m=>isPublicLive(m)).slice(0,6);
  if($('dashLiveMatches')) $('dashLiveMatches').innerHTML = liveMatches.length ? liveMatches.map(m=>{
    normalizeLiveMatch(m); const idx=currentSetIndex(m); const cur=m.sets[idx]||{a:0,b:0}; const r=matchResultFromSets(m);
    return `<div class="public-match-card live"><div><b>${m.a} vs ${m.b}</b><p class="muted">${m.type} • ${stadiumName(m.stadiumId)} • Match #${m.matchNumber||m.serial||'-'}</p>${statusBadge(m)}</div><div class="public-score"><span>${cur.a||0}</span><b>-</b><span>${cur.b||0}</span><small>Sets ${r.aw}-${r.bw}</small></div></div>`;
  }).join('') : '<p class="muted">No live matches right now.</p>';
  const completedMatches = activeMatches().filter(m=>isPublicCompleted(m)).slice(-8).reverse();
  if($('dashCompletedMatches')) $('dashCompletedMatches').innerHTML = completedMatches.length ? table(completedMatches, [['Match #',r=>r.matchNumber||r.serial||'-'], ['Match',r=>`${r.a} vs ${r.b}`], ['Score',r=>matchScoreText(r)], ['Winner',r=>r.winnerId?(r.winnerId===r.aId?r.a:r.b):'-'], ['Status',r=>statusBadge(r)]]) : '<p class="muted">No completed matches yet.</p>';
  $('dashUpcoming').innerHTML=table(activeMatches().filter(m=>matchStatus(m)==='Scheduled').slice(0,10),[['Date',r=>`${r.date||'-'} ${r.time||''}`],['Match',r=>`${r.a} vs ${r.b}`],['Stadium',r=>stadiumName(r.stadiumId)], ['Status',r=>statusBadge(r)]]);
  $('dashLeaderboard').innerHTML=allGroupStandings().map(g=>`<h3>${g.group.name}</h3>`+table(g.rows.slice(0,4),[['Rank',r=>g.rows.indexOf(r)+1],['Player','name'],['W','w'],['L','l'],['Pts','pts'],['Diff',r=>r.pf-r.pa]])).join('');
  $('groupStandings').innerHTML=allGroupStandings().map(g=>`<h3>${g.group.name}</h3>`+table(g.rows,[['Rank',r=>g.rows.indexOf(r)+1],['Player','name'],['P','p'],['W','w'],['L','l'],['Pts','pts'],['PF','pf'],['PA','pa'],['Diff',r=>r.pf-r.pa]])).join('');
  $('knockoutList').innerHTML=table(activeMatches().filter(m=>m.isKnockout),[['Round','round'],['Match',r=>`${r.a} vs ${r.b}`],['Score',r=>matchScoreText(r)],['Winner',r=>r.winnerId?(r.winnerId===r.aId?r.a:r.b):'-'],['Action',r=>isManager?`<button class="btn danger" onclick="deleteMatch('${r.id}')">Delete</button>`:'']]);
  $('hallList').innerHTML=table(state.hallOfFame,[['Season','season'],['Champion','champion'],['Runner-up','runner'],['Action',r=>isManager?`<button class="btn danger" onclick="deleteHallEntry('${r.id}')">Delete</button>`:'']]);
  $('activeSeasonSelect').innerHTML=state.seasons.map(s=>`<option value="${s.id}" ${s.id===activeSeasonId()?'selected':''}>${s.name}</option>`).join('');
  $('settingTitle').value=state.settings.title; $('managerPasswordSetting').value=state.settings.managerPassword; $('scorerPasswordSetting').value=state.settings.scorerPassword;
}
window.exportCSV=()=>{ let lines=[['Season','Group','Rank','Player','Played','Won','Lost','Pts','PF','PA','Diff']]; allGroupStandings().forEach(g=>g.rows.forEach((r,i)=>lines.push([seasonName(activeSeasonId()),g.group.name,i+1,r.name,r.p,r.w,r.l,r.pts,r.pf,r.pa,r.pf-r.pa]))); download('skf-tt-standings.csv',lines.map(r=>r.join(',')).join('\n')); };
window.downloadBackup=()=>download('skf-tt-league-backup.json',JSON.stringify(state,null,2));
function download(name,text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=name; a.click(); }
window.resetAll=async()=>{ if(!requireManager())return; if(confirm('Reset all league data?')){ state=structuredClone(defaultState); await save(); render(); } };

if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error)); }
initData(); showPage();
