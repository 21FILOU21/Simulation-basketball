/* Focused MyNBA fixes: schedule recovery, match actions, real played-game leader averages and rotation minutes. */
(function () {
"use strict";
const $ = id => document.getElementById(id);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const actual = window.NBASimActualPlayerStats = window.NBASimActualPlayerStats || Object.create(null);
const boxScores = window.NBASimActualBoxScores = window.NBASimActualBoxScores || Object.create(null);
let renderingLeaders = false;
let lastRegularGameCount = 0;

function teamCodeForSchedule(code) {
  if (!seasonCalendar || !Array.isArray(seasonCalendar.teams)) return code;
  const t = seasonCalendar.teams.find(x => String(x.scheduleCode || x.code) === String(code));
  return t ? t.code : code;
}
function playersForTeam(code) {
  const teamCode = teamCodeForSchedule(code);
  return (players || []).filter(p => p.team === teamCode &&
    (typeof window.NBAMyNBAIsRostered !== "function" || window.NBAMyNBAIsRostered(p)));
}
function overall(p) {
  try { return typeof window.overallRating === "function" ? Number(window.overallRating(p)) || 50 : 50; }
  catch (_) { return 50; }
}
function weightedAllocate(total, list, weightFn) {
  const out = new Map();
  if (!list.length || total <= 0) return out;
  let remaining = Math.round(total);
  let active = list.slice();
  while (active.length && remaining > 0) {
    const sum = active.reduce((n, p) => n + Math.max(.01, weightFn(p)), 0);
    let capped = false;
    active.slice().forEach(p => {
      const share = remaining * Math.max(.01, weightFn(p)) / sum;
      if (share >= 48 && active.length > 1) {
        out.set(String(p.id), 48);
        remaining -= 48;
        active = active.filter(x => x !== p);
        capped = true;
      }
    });
    if (!capped) {
      const weights = active.map(p => ({p, w: Math.max(.01, weightFn(p))}));
      const denom = weights.reduce((n, x) => n + x.w, 0);
      let used = 0;
      weights.forEach((x, i) => {
        const value = i === weights.length - 1 ? remaining - used : Math.floor(remaining * x.w / denom);
        out.set(String(x.p.id), Math.max(0, value));
        used += Math.max(0, value);
      });
      remaining = 0;
    }
  }
  return out;
}
function updateActualStats(game) {
  if (!game || !seasonCalendar) return;
  const sides = [
    {code:game.home.code, score:Number(game.homeScore)||0, opp:Number(game.awayScore)||0},
    {code:game.away.code, score:Number(game.awayScore)||0, opp:Number(game.homeScore)||0}
  ];
  const gameBox = {id:String(game.id), homeCode:teamCodeForSchedule(game.home.code), awayCode:teamCodeForSchedule(game.away.code), homeScore:game.homeScore, awayScore:game.awayScore, players:{}};
  sides.forEach(side => {
    const roster = playersForTeam(side.code);
    if (!roster.length) return;
    const mins = roster.map(p => ({p, m: typeof window.NBAMyNBAMinutes === "function" ? clamp(Number(window.NBAMyNBAMinutes(p))||0,0,48) : clamp(Number(p.mpg)||20,0,48)}));
    let minuteSum = mins.reduce((n,x)=>n+x.m,0);
    if (minuteSum <= 0) { mins.forEach(x => x.m=240/Math.max(1,mins.length)); minuteSum=240; }
    const weight = p => {
      const a = p.attributes || {};
      const tendency = typeof window.NBAMyNBATendency === "function" ? window.NBAMyNBATendency(p) : {};
      return Math.max(1, (overall(p)*.55 + (Number(p.pts)||0)*.7 + (Number(p.ast)||0)*.35 +
        (Number(p.reb)||0)*.25 + (Number(a.shooting)||50)*.12 + (Number(a.finishing)||50)*.08) *
        (.75 + (Number(tendency.touch == null ? 50 : tendency.touch)/100)*.5) * Math.max(.1,xMinutes(mins,p)/30));
    };
    function xMinutes(items,p) { const found=items.find(x=>String(x.p.id)===String(p.id)); return found?found.m:20; }
    const pts = weightedAllocate(side.score, roster, weight);
    const assists = weightedAllocate(Math.round(side.score * .22), roster, p => weight(p) * (.7 + (Number(p.ast)||0)*.09));
    const rebounds = weightedAllocate(44, roster, p => weight(p) * (.8 + (Number(p.reb)||0)*.07 + (Number((p.attributes||{}).rebounding)||50)*.01));
    const steals = weightedAllocate(7, roster, p => weight(p) * (.8 + (Number(p.stl)||0)*.12));
    const blocks = weightedAllocate(5, roster, p => weight(p) * (.7 + (Number(p.blk)||0)*.15 + (Number((p.attributes||{}).block)||50)*.01));
    roster.forEach(p => {
      const id=String(p.id), minsValue=mins.find(x=>String(x.p.id)===id);
      const line={pts:pts.get(id)||0,ast:assists.get(id)||0,reb:rebounds.get(id)||0,stl:steals.get(id)||0,blk:blocks.get(id)||0,minutes:Math.round(minsValue?minsValue.m:0),gp:1};
      const old=actual[id] || (actual[id]={pts:0,ast:0,reb:0,stl:0,blk:0,minutes:0,gp:0});
      ["pts","ast","reb","stl","blk","minutes","gp"].forEach(k=>old[k]=(Number(old[k])||0)+(Number(line[k])||0));
      gameBox.players[id]=line;
    });
  });
  boxScores[String(game.id)] = gameBox;
}
function installGameTracking() {
  if (typeof window.simulateScheduledGame !== "function" || window.simulateScheduledGame.__actualStatsWrapped) return;
  const original=window.simulateScheduledGame;
  const wrapped=function(game) {
    const result=original.apply(this,arguments);
    if (game && game.status === "completed" && !boxScores[String(game.id)]) updateActualStats(game);
    return result;
  };
  wrapped.__actualStatsWrapped=true;
  window.simulateScheduledGame=wrapped;
}
function recoverCalendarAfterLoad() {
  if (typeof window.load !== "function" || window.load.__calendarRecoveryWrapped) return;
  const original=window.load;
  const wrapped=function() {
    const result=original.apply(this,arguments);
    if (!seasonCalendar || !Array.isArray(seasonCalendar.games) || !seasonCalendar.games.length) {
      if (typeof window.initializeSeasonCalendar === "function") window.initializeSeasonCalendar();
    }
    if (typeof window.renderAll === "function") window.renderAll();
    return result;
  };
  wrapped.__calendarRecoveryWrapped=true;
  window.load=wrapped;
}
function scheduleDialog(game) {
  const done=game.status==="completed";
  const title=done ? "Match déjà joué" : "Que veux-tu faire ?";
  const body=done
    ? '<button class="btn primary" data-action="box">Voir box score</button>'
    : '<button class="btn primary" data-action="one">Simuler ce match</button><button class="btn" data-action="until">Simuler jusqu’à ce match</button>';
  const overlay=document.createElement("div");
  overlay.className="fullscreen-overlay mynba-regular-match-modal";
  overlay.innerHTML='<div class="fullscreen-shell mynba-match-dialog"><div class="fullscreen-kicker">SAISON RÉGULIÈRE</div><h2 class="fullscreen-title">'+(game.home.name||game.home.code)+' — '+(game.away.name||game.away.code)+'</h2><p class="fullscreen-subtitle">'+(done ? (game.homeScore+' – '+game.awayScore+' · Match joué') : 'Choisis comment avancer dans le calendrier.')+'</p><div class="fullscreen-actions">'+body+'<button class="btn" data-action="cancel">Annuler</button></div></div>';
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.addEventListener("click",event=>{
    const b=event.target.closest("button[data-action]");
    if(!b)return;
    const action=b.dataset.action; close();
    if(action==="cancel")return;
    if(action==="box") { if(typeof window.NBAMyNBAShowRegularBox==="function")window.NBAMyNBAShowRegularBox(game); return; }
    try {
      if(action==="one") window.simulateScheduledGame(game);
      else if(action==="until" && typeof window.simulateThroughRound==="function") window.simulateThroughRound(game.round);
      if(typeof window.updateTeamSeasonAverages==="function")window.updateTeamSeasonAverages();
      if(typeof window.renderAll==="function")window.renderAll();
    } catch(err) { alert("Impossible de simuler ce match : "+err.message); }
  });
  const esc=e=>{if(e.key==="Escape"&&overlay.isConnected){close();document.removeEventListener("keydown",esc,true);}};
  document.addEventListener("keydown",esc,true);
}
function installScheduleActions() {
  const view=$("seasonCalendarView");
  if(!view || view.dataset.mynbaDialogInstalled)return;
  view.dataset.mynbaDialogInstalled="1";
  view.addEventListener("click",event=>{
    const tile=event.target.closest("button[data-game-id]");
    if(!tile || !seasonCalendar)return;
    const game=seasonCalendar.games.find(g=>String(g.id)===String(tile.dataset.gameId));
    if(!game)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    scheduleDialog(game);
  },true);
}
function renderLeaderTable() {
  const pane=$("mynbaLeaderPlayers");
  if(!pane || pane.hidden || renderingLeaders)return;
  renderingLeaders=true;
  const current=Number(seasonCalendar?.games?.filter(g=>g.status==="completed").length)||0;
  const rows=(players||[]).filter(p=>typeof window.NBAMyNBAIsRostered!=="function"||window.NBAMyNBAIsRostered(p)).map(p=>{
    const a=actual[String(p.id)]||{pts:0,ast:0,reb:0,stl:0,blk:0,gp:0,minutes:0};
    const gp=Number(a.gp)||0;
    return {p,gp,pts:gp?a.pts/gp:0,ast:gp?a.ast/gp:0,reb:gp?a.reb/gp:0,stl:gp?a.stl/gp:0,blk:gp?a.blk/gp:0,minutes:gp?a.minutes/gp:0,ovr:overall(p)};
  });
  const sortId="mynbaActualLeaderSort";
  const old=$(sortId)?.value||"pts";
  const options=[["pts","Points par match"],["ast","Passes par match"],["reb","Rebonds par match"],["stl","Interceptions par match"],["blk","Contres par match"],["ovr","Puissance du joueur"],["name-az","Nom A–Z"],["name-za","Nom Z–A"],["age-old","Plus âgé → moins âgé"],["age-young","Moins âgé → plus âgé"]];
  const sorted=rows.slice().sort((a,b)=>{
    if(old==="name-az")return String(a.p.name).localeCompare(String(b.p.name),"fr");
    if(old==="name-za")return String(b.p.name).localeCompare(String(a.p.name),"fr");
    if(old==="age-old")return (Number(b.p.age)||0)-(Number(a.p.age)||0);
    if(old==="age-young")return (Number(a.p.age)||0)-(Number(b.p.age)||0);
    return (Number(b[old])||0)-(Number(a[old])||0);
  });
  pane.innerHTML='<div class="mynba-feature-card"><h2>Statistiques des matchs simulés</h2><p class="muted">Calculées sur les matchs réellement simulés dans cette saison : '+current+' matchs de ligue terminés. Les joueurs sans match joué restent à 0,0.</p><label class="field">Trier par <select id="'+sortId+'">'+options.map(o=>'<option value="'+o[0]+'" '+(o[0]===old?'selected':'')+'>'+o[1]+'</option>').join("")+'</select></label><div class="tablewrap"><table><thead><tr><th>#</th><th>Joueur</th><th>Équipe</th><th>G</th><th>MIN</th><th>PTS</th><th>AST</th><th>REB</th><th>STL</th><th>BLK</th><th>GÉN.</th></tr></thead><tbody>'+sorted.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+String(x.p.name||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))+'</td><td>'+String(x.p.team||"")+'</td><td>'+x.gp+'</td><td>'+x.minutes.toFixed(1)+'</td><td>'+x.pts.toFixed(1)+'</td><td>'+x.ast.toFixed(1)+'</td><td>'+x.reb.toFixed(1)+'</td><td>'+x.stl.toFixed(1)+'</td><td>'+x.blk.toFixed(1)+'</td><td>'+x.ovr+'</td></tr>').join("")+'</tbody></table></div></div>';
  const select=$(sortId); if(select)select.onchange=renderLeaderTable;
  renderingLeaders=false;
}

function installActualRegularBox() {
  if(typeof window.NBAMyNBAShowRegularBox!=="function" || window.NBAMyNBAShowRegularBox.__actualBoxWrapped)return;
  const original=window.NBAMyNBAShowRegularBox;
  const wrapped=function(game){
    if(game && game.status==="completed"){
      let data=boxScores[String(game.id)];
      if(!data){updateActualStats(game);data=boxScores[String(game.id)];}
      const buildRows=(code,score,opp)=>{
        const roster=playersForTeam(teamCodeForSchedule(code));
        const lines=data&&data.players||{};
        return roster.map(p=>{
          const l=lines[String(p.id)]||{pts:0,ast:0,reb:0,stl:0,blk:0,minutes:0};
          const pts=Number(l.pts)||0,min=clamp(Number(l.minutes)||0,0,48);
          const fga=Math.max(0,Math.round(pts/Math.max(1.1,Number(p.ts)||.55)/2));
          const threeA=Math.min(fga,Math.max(0,Math.round(fga*(Number(p.three)||.35))));
          const threeM=Math.min(threeA,Math.round(pts/3*.25));
          const fgm=Math.min(fga,Math.max(0,Math.round((pts-threeM*3)/2)));
          const ftm=Math.max(0,pts-threeM*3-fgm*2);
          return {name:p.name,min:min,pts:pts,fgm:fgm,fga:fga,threeM:threeM,threeA:threeA,ftm:ftm,fta:Math.max(ftm,Math.round(ftm/.75)),reb:Number(l.reb)||0,ast:Number(l.ast)||0,stl:Number(l.stl)||0,blk:Number(l.blk)||0,to:Math.max(0,Math.round((Number(l.ast)||0)*.18)),pf:Math.min(6,Math.round(min/12)),pm:Math.round((score-opp)*min/48)};
        });
      };
      game.mynbaBoxScore={home:buildRows(game.home.code,game.homeScore,game.awayScore),away:buildRows(game.away.code,game.awayScore,game.homeScore)};
    }
    return original.apply(this,arguments);
  };
  wrapped.__actualBoxWrapped=true;window.NBAMyNBAShowRegularBox=wrapped;
}

function autoMinutes(code) {
  const roster=playersForTeam(code);
  if(!roster.length)return {sum:0,count:0};
  const weight=p=>{
    const s=actual[String(p.id)]||{};
    const gp=Number(s.gp)||0;
    const previousPPG=gp?(Number(s.pts)||0)/gp:(Number(p.pts)||0);
    const previousAPG=gp?(Number(s.ast)||0)/gp:(Number(p.ast)||0);
    const previousRPG=gp?(Number(s.reb)||0)/gp:(Number(p.reb)||0);
    return Math.max(1,overall(p)*.75+previousPPG*.65+previousAPG*.45+previousRPG*.25);
  };
  let minutes=new Map(roster.map(p=>[String(p.id),0]));
  let remaining=roster.length>=5?240:roster.length*48;
  let active=roster.slice();
  while(active.length&&remaining>0){
    const sum=active.reduce((n,p)=>n+weight(p),0);
    let capped=false;
    active.slice().forEach(p=>{
      const share=remaining*weight(p)/sum;
      if(share>=48){
        minutes.set(String(p.id),48);remaining-=48;active=active.filter(x=>x!==p);capped=true;
      }
    });
    if(!capped){
      const parts=active.map(p=>({p,raw:remaining*weight(p)/sum}));
      let used=0;
      parts.forEach((x,i)=>{const v=i===parts.length-1?remaining-used:Math.floor(x.raw);minutes.set(String(x.p.id),v);used+=v;});
      remaining=0;
    }
  }
  let sum=0;
  roster.forEach(p=>{
    const id=String(p.id),value=minutes.get(id)||0;sum+=value;
    document.querySelectorAll('[data-plan="'+id+'"],[data-minutes="'+id+'"]').forEach(input=>{
      input.value=String(value);
      input.dispatchEvent(new Event("change",{bubbles:true}));
    });
  });
  return {sum,count:roster.length};
}
function installAutoMinutes() {
  const pane=$("mynbaPaneGameplan");
  if(!pane || $("mynbaAutoMinutes"))return;
  const btn=document.createElement("button");
  btn.type="button";btn.className="btn primary";btn.id="mynbaAutoMinutes";btn.textContent="⚙ Auto · répartir 240 minutes";
  const editor=$("mynbaMinutesEditor");
  if(editor)editor.parentNode.insertBefore(btn,editor);
  btn.addEventListener("click",()=>{
    const select=$("mynbaRosterTeam");
    const code=select?.value || (window.NBAMyNBASelectedTeam||"LAL");
    const result=autoMinutes(code);
    if($("mynbaGameplanStatus"))$("mynbaGameplanStatus").textContent="Minutes automatiques : "+result.sum+"/240 réparties sur "+result.count+" joueurs. Chaque joueur est limité à 48 minutes.";
    if(typeof window.renderAll==="function")window.renderAll();
  });
}
function enforceMinuteCap(event) {
  const input=event.target;
  if(!input || !input.matches || !input.matches('input[data-plan],input[data-minutes]'))return;
  const id=input.dataset.plan || input.dataset.minutes;
  const all=[...document.querySelectorAll('input[data-plan],input[data-minutes]')];
  const unique=new Map();
  all.forEach(x=>{const k=x.dataset.plan||x.dataset.minutes;if(!unique.has(k)||x===input)unique.set(k,x);});
  let others=0;unique.forEach((x,k)=>{if(k!==id)others+=clamp(Number(x.value)||0,0,48);});
  input.value=String(clamp(Number(input.value)||0,0,Math.min(48,Math.max(0,240-others))));
}
function recordDevelopment() {
  if(typeof window.runOffseason!=="function" || window.runOffseason.__developmentWrapped)return;
  const original=window.runOffseason;
  const wrapped=function(){
    const before=new Map((players||[]).map(p=>[String(p.id),overall(p)]));
    const result=original.apply(this,arguments);
    (players||[]).forEach(p=>{const old=before.get(String(p.id));if(old!=null){p._mynbaOverallDelta=overall(p)-old;p._mynbaDeltaStartGames=Number(seasonCalendar?.games?.filter(g=>g.status==="completed").length)||0;}});
    return result;
  };
  wrapped.__developmentWrapped=true;window.runOffseason=wrapped;
}
function clearOldDevelopment() {
  const count=Number(seasonCalendar?.games?.filter(g=>g.status==="completed").length)||0;
  (players||[]).forEach(p=>{
    if(Number(p._mynbaOverallDelta) && (phase==="playoffs" || count-(Number(p._mynbaDeltaStartGames)||0)>=41)){
      delete p._mynbaOverallDelta;delete p._mynbaDeltaStartGames;
    }
  });
  lastRegularGameCount=count;
}
function decorateDevelopment() {
  const people=players||[];
  document.querySelectorAll("#mynbaRosterTable tbody tr,#playerStatsSection tbody tr").forEach(row=>{
    const name=row.cells?.[1]?.textContent?.trim() || row.cells?.[0]?.textContent?.trim();
    const p=people.find(x=>x.name===name);
    if(!p || !Number(p._mynbaOverallDelta))return;
    const cell=row.cells?.[3];
    if(!cell || cell.querySelector(".mynba-development-delta"))return;
    const d=Number(p._mynbaOverallDelta),span=document.createElement("span");
    span.className="mynba-development-delta";span.style.fontWeight="900";span.style.marginLeft="6px";
    span.style.color=d>0?"#39d98a":"#ff4545";span.textContent=(d>0?"↑ +":"↓ ")+d;
    span.title=d>0?"Joueur en progression":"Joueur en régression";cell.appendChild(span);
  });
}
function hidePlayoffsCategory() {
  document.querySelectorAll(".mynba-category-card").forEach(card=>{
    if(/playoffs/i.test(card.textContent||"")){card.hidden=true;card.style.display="none";}
  });
}
function start() {
  installGameTracking();recoverCalendarAfterLoad();installScheduleActions();installAutoMinutes();installActualRegularBox();recordDevelopment();
  document.addEventListener("change",enforceMinuteCap,true);
  document.addEventListener("click",event=>{
    if(event.target.closest('[data-leader-tab="players"]'))setTimeout(renderLeaderTable,0);
    if(event.target.closest('[data-leader-tab="teams"]'))setTimeout(()=>{
      const pane=$("mynbaTeamLeaderCards");
      if(pane && !pane.querySelector("#mynbaTeamSort")) {
        const table=pane.querySelector("table");
        if(table){
          const select=document.createElement("select");select.id="mynbaTeamSort";select.className="field";
          select.innerHTML='<option value="winPct">Pourcentage de victoires</option><option value="strength">Puissance</option><option value="ppg">Points/match</option><option value="apg">Passes/match</option><option value="rpg">Rebonds/match</option><option value="name-az">Nom A–Z</option><option value="name-za">Nom Z–A</option>';
          select.addEventListener("change",()=>{const body=table.tBodies[0];[...body.rows].sort((a,b)=>{const v=select.value;if(v==="name-az"||v==="name-za"){const c=a.cells[1].textContent.localeCompare(b.cells[1].textContent,"fr");return v==="name-az"?c:-c;}const ix={winPct:2,strength:3,ppg:5,apg:6,rpg:7}[v];return (parseFloat(b.cells[ix]?.textContent)||0)-(parseFloat(a.cells[ix]?.textContent)||0);}).forEach((row,i)=>{row.cells[0].textContent=i+1;body.appendChild(row);});});
          pane.prepend(select);
        }
      }
    },0);
  },true);
  const observer=new MutationObserver(records=>{
    hidePlayoffsCategory();installAutoMinutes();clearOldDevelopment();decorateDevelopment();
    if(records.some(r=>r.type==="attributes" && r.target && r.target.id==="mynbaLeaderPlayers" && !r.target.hidden))setTimeout(renderLeaderTable,0);
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
  setTimeout(()=>{hidePlayoffsCategory();installAutoMinutes();decorateDevelopment();},0);
}
const style=document.createElement("style");
style.textContent='.mynba-regular-match-modal{z-index:20000}.mynba-match-dialog{max-width:760px;padding:clamp(18px,4vw,44px);border:1px solid #344d72;border-radius:22px;background:#0b1425;box-shadow:0 25px 100px #000a}.mynba-match-dialog .fullscreen-title{font-size:clamp(22px,4vw,42px)}.mynba-match-dialog .fullscreen-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.mynba-match-dialog .btn{min-width:150px}.mynba-development-delta{white-space:nowrap}@media(max-width:640px){.mynba-match-dialog .fullscreen-actions .btn{flex:1 1 100%}}';
document.head.appendChild(style);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();