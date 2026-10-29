/* Focused MyNBA fixes: schedule recovery, match actions, real played-game leader averages and rotation minutes. */
(function () {
"use strict";
const $ = id => document.getElementById(id);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const actual = window.NBASimActualPlayerStats = window.NBASimActualPlayerStats || Object.create(null);
const boxScores = window.NBASimActualBoxScores = window.NBASimActualBoxScores || Object.create(null);
let renderingLeaders = false;
let applyingAuto = false;
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
function weightedAllocate(total, list, weightFn, capEach = Infinity) {
  const out = new Map();
  if (!list.length || total <= 0) return out;
  let remaining = Math.round(total);
  let active = list.slice();
  while (active.length && remaining > 0) {
    const sum = active.reduce((n, p) => n + Math.max(.01, weightFn(p)), 0);
    let capped = false;
    active.slice().forEach(p => {
      const share = remaining * Math.max(.01, weightFn(p)) / sum;
      if (share >= capEach && active.length > 1) {
        out.set(String(p.id), capEach);
        remaining -= capEach;
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
  // Prefer the possession engine's real per-player box score so player totals reconcile to the game score.
  if (game.playerBoxScores && game.playerBoxScores.home && game.playerBoxScores.away) {
    const gameBox = {id:String(game.id),homeCode:teamCodeForSchedule(game.home.code),awayCode:teamCodeForSchedule(game.away.code),homeScore:game.homeScore,awayScore:game.awayScore,players:{}};
    const sides = [
      {code:game.home.code, lines:game.playerBoxScores.home},
      {code:game.away.code, lines:game.playerBoxScores.away}
    ];
    sides.forEach(side => {
      const roster=playersForTeam(side.code);
      roster.forEach(p => {
        const id=String(p.id),src=side.lines[id]||{};
        const line={pts:Number(src.pts)||0,ast:Number(src.ast)||0,reb:Number(src.reb)||0,stl:Number(src.stl)||0,blk:Number(src.blk)||0,tov:Number(src.tov)||0,minutes:Math.min(48,Number(src.minutes)||0),gp:Number(src.gp)||0,fgm:Number(src.fgm)||0,fga:Number(src.fga)||0,threeMade:Number(src.threeMade)||0,threeAttempts:Number(src.threeAttempts)||0,ftm:Number(src.ftm)||0,fta:Number(src.fta)||0};
        const old=actual[id]||(actual[id]={pts:0,ast:0,reb:0,stl:0,blk:0,tov:0,minutes:0,gp:0,fgm:0,fga:0,threeMade:0,threeAttempts:0,ftm:0,fta:0});
        Object.keys(line).forEach(k=>old[k]=(Number(old[k])||0)+(Number(line[k])||0));
        gameBox.players[id]=line;
      });
    });
    boxScores[String(game.id)]=gameBox;
    return;
  }
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
    if (minuteSum <= 0) { mins.forEach(x => x.m=48); minuteSum=mins.length*48; }
    const minuteBudget = Math.min(240, 48 * roster.length);
    const integerMinutes = weightedAllocate(minuteBudget, roster, p => Math.max(.01, xMinutes(mins,p)), 48);
    const weight = p => {
      const a = p.attributes || {};
      const tendency = typeof window.NBAMyNBATendency === "function" ? window.NBAMyNBATendency(p) : {};
      const shooting=Number(a.threePoint||a.shooting)||50,finishing=Number(a.finishing)||50;
      const playmaking=Number(a.playmaking||a.passing)||50,defense=((Number(a.interiorDefense)||50)+(Number(a.perimeterDefense)||50))/2;
      const speed=Number(a.speed)||50,stamina=Number(a.stamina)||65;
      return Math.max(1,(overall(p)*.32+(Number(p.pts)||0)*.45+(Number(p.ast)||0)*.2+(Number(p.reb)||0)*.15+
        shooting*.16+finishing*.14+playmaking*.08+defense*.035+speed*.025+stamina*.02)*
        (.7+(Number(tendency.touch==null?50:tendency.touch)/100)*.6)*Math.max(.1,xMinutes(mins,p)/30));
    };
    function xMinutes(items,p) { const found=items.find(x=>String(x.p.id)===String(p.id)); return found?found.m:20; }
    const playingRoster = roster.filter(p => Number(integerMinutes.get(String(p.id)) || 0) > 0);
    const pts = weightedAllocate(side.score, playingRoster, weight, 65);
    const assists = weightedAllocate(Math.round(side.score * .22), playingRoster, p => weight(p) * (.7 + (Number(p.ast)||0)*.09), 15);
    const rebounds = weightedAllocate(44, playingRoster, p => {const a=p.attributes||{};return weight(p)*(.6+(Number(p.reb)||0)*.05+(Number(a.defensiveRebound)||50)*.012+(Number(a.offensiveRebound)||50)*.008+Math.max(0,(Number(p.height)||200)-195)*.012);}, 25);
    const steals = weightedAllocate(7, playingRoster, p => {const a=p.attributes||{};return weight(p)*(.6+(Number(p.stl)||0)*.08+(Number(a.steal)||50)*.012+(Number(a.perimeterDefense)||50)*.008+(Number(a.speed)||50)*.004);}, 10);
    const blocks = weightedAllocate(5, playingRoster, p => {const a=p.attributes||{};return weight(p)*(.5+(Number(p.blk)||0)*.08+(Number(a.block)||50)*.014+(Number(a.interiorDefense)||50)*.01+Math.max(0,(Number(p.height)||200)-195)*.015);}, 10);
    roster.forEach(p => {
      const id=String(p.id), minsValue=mins.find(x=>String(x.p.id)===id);
      const line={pts:pts.get(id)||0,ast:assists.get(id)||0,reb:rebounds.get(id)||0,stl:steals.get(id)||0,blk:blocks.get(id)||0,minutes:Math.min(48,Number(integerMinutes.get(id)||0)),gp:Number(integerMinutes.get(id)||0)>0?1:0};
      const old=actual[id] || (actual[id]={pts:0,ast:0,reb:0,stl:0,blk:0,minutes:0,gp:0});
      ["pts","ast","reb","stl","blk","minutes","gp"].forEach(k=>old[k]=(Number(old[k])||0)+(Number(line[k])||0));
      gameBox.players[id]=line;
    });
  });
  boxScores[String(game.id)] = gameBox;
}
function ensureMinimumRoster(code) {
  const actualCode=teamCodeForSchedule(code);
  const custom=(typeof customTeams!=="undefined"?customTeams:[]).find(t=>String(t.code)===String(actualCode));
  let roster=(players||[]).filter(p=>String(p.team)===String(actualCode));
  let nextId=typeof nextPlayerId!=="undefined"?Number(nextPlayerId):Math.max(999,...(players||[]).map(p=>Number(p.id)||0))+1;
  const usedNames=new Set();(players||[]).forEach(p=>{const name=String(p.name||"");usedNames.add(name);usedNames.add(name.toLowerCase());});
  let pickNo=1;
  while(roster.length<5){
    // Utilise le même générateur de prospects que le vrai repêchage d'intersaison.
    let rookie;
    if(typeof window.makeRookie==="function" || typeof makeRookie==="function"){
      try {
        const factory=typeof makeRookie==="function"?makeRookie:window.makeRookie;
        rookie=factory(.28+Math.random()*.38,actualCode,typeof resultsLabel!=="undefined"?resultsLabel:"Saison",pickNo,usedNames);
      } catch (_) {}
    }
    if(!rookie){
      const positions=["PG","SG","SF","PF","C"],pos=positions[roster.length%positions.length];
      const first=["Malik","Jordan","Cameron","Darius","Isaiah","Jalen","Tyrese","Andre","Micah","Elijah","Nolan","Kobe","Jaylen","Marcus","Devin","Amari"];
      const last=["Brooks","Carter","Bennett","Mitchell","Hayes","Foster","Reed","Parker","Washington","Coleman","Turner","Price","Morris","Bailey","Richardson","Young"];
      let name;
      do{name=first[Math.floor(Math.random()*first.length)]+" "+last[Math.floor(Math.random()*last.length)];}while(usedNames.has(name.toLowerCase()));
      const height=[185,193,198,205,211][roster.length%5];
      rookie={id:nextId,name,team:actualCode,pos,height,weight:[80,88,94,104,112][roster.length%5],age:19+Math.floor(Math.random()*4),rookie:true,
        pts:4+Math.random()*8,reb:1.5+Math.random()*4,ast:1+Math.random()*3,stl:.4+Math.random()*.8,blk:.1+Math.random()*.8,
        ts:.48+Math.random()*.08,three:.28+Math.random()*.1,mpg:10+Math.random()*14,history:[],trophies:[],careerGames:[],
        attributes:{finishing:52+Math.round(Math.random()*20),playmaking:50+Math.round(Math.random()*20),passing:50+Math.round(Math.random()*20),ballHandle:50+Math.round(Math.random()*20),threePoint:48+Math.round(Math.random()*25),steal:45+Math.round(Math.random()*20),block:45+Math.round(Math.random()*20),speed:52+Math.round(Math.random()*20),interiorDefense:45+Math.round(Math.random()*20),perimeterDefense:45+Math.round(Math.random()*20),defensiveRebound:48+Math.round(Math.random()*20),offensiveRebound:45+Math.round(Math.random()*20),strength:48+Math.round(Math.random()*20),vertical:48+Math.round(Math.random()*20),stamina:60+Math.round(Math.random()*25),offensiveIQ:48+Math.round(Math.random()*20),defensiveIQ:48+Math.round(Math.random()*20)}};
    }
    rookie.id=nextId++;rookie.team=actualCode;rookie.rookie=true;rookie.age=Number(rookie.age)||19;
    rookie.season=typeof seasonYear!=="undefined"&&typeof seasonLabel==="function"?seasonLabel(seasonYear):rookie.season;
    rookie.source=rookie.source||"Rookie généré automatiquement pour compléter l’effectif";
    rookie.mpg=clamp(Number(rookie.mpg)||18,8,28);
    if(usedNames.has(String(rookie.name).toLowerCase()))rookie.name=String(rookie.name)+" "+String(actualCode);
    usedNames.add(String(rookie.name));usedNames.add(String(rookie.name).toLowerCase());
    while((players||[]).some(p=>String(p.id)===String(rookie.id)))rookie.id=nextId++;
    nextId=Math.max(nextId,Number(rookie.id)+1);
    players.push(rookie);roster.push(rookie);
    if(custom){custom.playerIds=custom.playerIds||[];if(!custom.playerIds.some(id=>String(id)===String(rookie.id)))custom.playerIds.push(rookie.id);}
    pickNo++;
  }
  if(typeof nextPlayerId!=="undefined")nextPlayerId=nextId;
  if(typeof window.NBAMyNBARosterChanged==="function")window.NBAMyNBARosterChanged();
  return roster;
}
function attributeTeamStrength(code) {
  const roster=ensureMinimumRoster(code).slice().sort((a,b)=>overall(b)-overall(a)).slice(0,5);
  const rating=p=>{
    const a=p.attributes||{};
    const avg=(keys,fallback=50)=>keys.reduce((n,k)=>n+(Number(a[k])||fallback),0)/keys.length;
    const offense=avg(["finishing","threePoint","playmaking","passing","ballHandle"]);
    const defense=avg(["interiorDefense","perimeterDefense","steal","block","defensiveRebound"]);
    const physical=avg(["speed","strength","vertical","stamina"]);
    return overall(p)*.45+offense*.25+defense*.20+physical*.10;
  };
  return clamp(.35+(roster.reduce((n,p)=>n+rating(p),0)/Math.max(1,roster.length)-50)*.0085,.28,.8);
}
function installGameTracking() {
  if (typeof window.simulateScheduledGame !== "function" || window.simulateScheduledGame.__actualStatsWrapped) return;
  const original=window.simulateScheduledGame;
  const wrapped=function(game) {
    if(game&&game.home&&game.away){
      ensureMinimumRoster(game.home.code);ensureMinimumRoster(game.away.code);
      const homeCode=teamCodeForSchedule(game.home.code),awayCode=teamCodeForSchedule(game.away.code);
      const home=seasonCalendar&&seasonCalendar.teams.find(t=>String(t.scheduleCode||t.code)===String(game.home.code));
      const away=seasonCalendar&&seasonCalendar.teams.find(t=>String(t.scheduleCode||t.code)===String(game.away.code));
      if(home)home.strength=attributeTeamStrength(homeCode);
      if(away)away.strength=attributeTeamStrength(awayCode);
    }
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
      if((action==="one"||action==="until") && typeof window.simulateThroughRound==="function") window.simulateThroughRound(game.round);
      else if(action==="one") window.simulateScheduledGame(game);
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
    const gameLines=Object.values(boxScores).map(box=>({id:box.id,line:box.players&&box.players[String(p.id)]})).filter(x=>x.line&&Number(x.line.gp||0)>=0);
    const bestGame=gameLines.reduce((best,x)=>!best||Number(x.line.pts||0)>Number(best.line.pts||0)?x:best,null);
    return {p,gp,pts:gp?a.pts/gp:0,totalPts:Number(a.pts)||0,bestGamePts:bestGame?Number(bestGame.line.pts)||0:0,bestGameId:bestGame?bestGame.id:"",ast:gp?a.ast/gp:0,reb:gp?a.reb/gp:0,stl:gp?a.stl/gp:0,blk:gp?a.blk/gp:0,minutes:gp?a.minutes/gp:0,ovr:overall(p)};
  });
  const sortId="mynbaActualLeaderSort";
  const old=$(sortId)?.value||"bestGamePts";
  const options=[["bestGamePts","Plus de points en un match"],["totalPts","Points cumulés"],["pts","Points par match"],["ast","Passes par match"],["reb","Rebonds par match"],["stl","Interceptions par match"],["blk","Contres par match"],["ovr","Puissance du joueur"],["name-az","Nom A–Z"],["name-za","Nom Z–A"],["age-old","Plus âgé → moins âgé"],["age-young","Moins âgé → plus âgé"]];
  const sorted=rows.slice().sort((a,b)=>{
    if(old==="name-az")return String(a.p.name).localeCompare(String(b.p.name),"fr");
    if(old==="name-za")return String(b.p.name).localeCompare(String(a.p.name),"fr");
    if(old==="age-old")return (Number(b.p.age)||0)-(Number(a.p.age)||0);
    if(old==="age-young")return (Number(a.p.age)||0)-(Number(b.p.age)||0);
    return (Number(b[old])||0)-(Number(a[old])||0);
  });
  pane.innerHTML='<div class="mynba-feature-card"><h2>Statistiques des matchs simulés</h2><p class="muted">Calculées à partir des box scores enregistrés : '+current+' matchs de ligue terminés. Le record de points correspond au plus grand total individuel sur un seul match.</p><label class="field">Trier par <select id="'+sortId+'">'+options.map(o=>'<option value="'+o[0]+'" '+(o[0]===old?'selected':'')+'>'+o[1]+'</option>').join("")+'</select></label><div class="tablewrap"><table><thead><tr><th>#</th><th>Joueur</th><th>Équipe</th><th>G</th><th>MIN</th><th>PTS/m</th><th>PTS cumulés</th><th>Record PTS (1 match)</th><th>AST</th><th>REB</th><th>STL</th><th>BLK</th><th>GÉN.</th></tr></thead><tbody>'+sorted.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+String(x.p.name||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))+'</td><td>'+String(x.p.team||"")+'</td><td>'+x.gp+'</td><td>'+x.minutes.toFixed(1)+'</td><td>'+x.pts.toFixed(1)+'</td><td>'+x.totalPts+'</td><td><b>'+x.bestGamePts+'</b></td><td>'+x.ast.toFixed(1)+'</td><td>'+x.reb.toFixed(1)+'</td><td>'+x.stl.toFixed(1)+'</td><td>'+x.blk.toFixed(1)+'</td><td>'+x.ovr+'</td></tr>').join("")+'</tbody></table></div></div>';
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
          const fga=Math.max(0,Number.isFinite(Number(l.fga))?Number(l.fga):Math.round(pts/Math.max(1.1,Number(p.ts)||.55)/2));
          const threeA=Math.min(fga,Math.max(0,Number.isFinite(Number(l.threeAttempts))?Number(l.threeAttempts):Math.round(fga*(Number(p.three)||.35))));
          const threeM=Math.min(threeA,Math.max(0,Number.isFinite(Number(l.threeMade))?Number(l.threeMade):Math.round(pts/3*.25)));
          const fgm=Math.min(fga,Math.max(0,Number.isFinite(Number(l.fgm))?Number(l.fgm):Math.round((pts-threeM*3)/2)));
          const ftm=Math.max(0,Number.isFinite(Number(l.ftm))?Number(l.ftm):pts-threeM*3-fgm*2);
          return {name:p.name,min:min,pts:pts,fgm:fgm,fga:fga,threeM:threeM,threeA:threeA,ftm:ftm,fta:Math.max(ftm,Number(l.fta)||Math.round(ftm/.75)),reb:Number(l.reb)||0,ast:Number(l.ast)||0,stl:Number(l.stl)||0,blk:Number(l.blk)||0,to:Number(l.tov)||Math.max(0,Math.round((Number(l.ast)||0)*.18)),pf:Number(l.pf)||Math.min(6,Math.round(min/12)),pm:Math.round((score-opp)*min/48)};
        });
      };
      game.mynbaBoxScore={home:buildRows(game.home.code,game.homeScore,game.awayScore),away:buildRows(game.away.code,game.awayScore,game.homeScore)};
    }
    return original.apply(this,arguments);
  };
  wrapped.__actualBoxWrapped=true;window.NBAMyNBAShowRegularBox=wrapped;
}


function installMinuteBudget() {
  const current=window.NBAMyNBAMinutes;
  if(typeof current!=="function" || current.__budgetWrapped)return;
  const wrapped=function(p){
    const team=String(p&&p.team||"");
    const roster=playersForTeam(team);
    const bases=roster.map(x=>({p:x,m:clamp(Number(current(x))||0,0,48)}));
    const sum=bases.reduce((n,x)=>n+x.m,0);
    const factor=sum>240?240/sum:1;
    const row=bases.find(x=>String(x.p.id)===String(p.id));
    return clamp((row?row.m:0)*factor,0,48);
  };
  wrapped.__budgetWrapped=true;window.NBAMyNBAMinutes=wrapped;
}
function normalizeVisibleMinuteInputs() {
  if(applyingAuto)return;
  ["input[data-minutes]","input[data-plan]"].forEach(selector=>{
    const groups=new Map();
    document.querySelectorAll(selector).forEach(input=>{
      const row=input.closest("tr");
      const teamSelect=$("mynbaRosterTeam");
      const code=teamSelect&&teamSelect.value||"default";
      if(!groups.has(code))groups.set(code,[]);
      groups.get(code).push(input);
    });
    groups.forEach(list=>{
      const values=list.map(x=>clamp(Number(x.value)||0,0,48));
      const total=values.reduce((n,x)=>n+x,0);
      if(total<=240)return;
      applyingAuto=true;
      let used=0;
      list.forEach((input,i)=>{
        const value=i===list.length-1?Math.max(0,240-used):Math.floor(values[i]*240/total);
        input.value=String(clamp(value,0,48));used+=Number(input.value)||0;
        input.dispatchEvent(new Event("change",{bubbles:true}));
      });
      applyingAuto=false;
    });
  });
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
  if(applyingAuto)return;
  const input=event.target;
  if(!input || !input.matches || !input.matches('input[data-plan],input[data-minutes]'))return;
  const isPlan=input.hasAttribute("data-plan");
  const selector=isPlan?'input[data-plan]':'input[data-minutes]';
  const all=[...document.querySelectorAll(selector)];
  const id=input.dataset.plan || input.dataset.minutes;
  const others=all.filter(x=>(x.dataset.plan||x.dataset.minutes)!==id);
  const requested=clamp(Number(input.value)||0,0,48);
  const otherSum=others.reduce((n,x)=>n+clamp(Number(x.value)||0,0,48),0);
  applyingAuto=true;
  input.value=String(requested);
  if(otherSum+Number(input.value)>240 && otherSum>0){
    const available=Math.max(0,240-Number(input.value));
    let used=0;
    others.forEach((x,i)=>{
      const old=clamp(Number(x.value)||0,0,48);
      const v=i===others.length-1?Math.max(0,available-used):Math.floor(old*available/otherSum);
      x.value=String(clamp(v,0,48));used+=Number(x.value)||0;
      x.dispatchEvent(new Event("change",{bubbles:true}));
    });
  }
  applyingAuto=false;
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
    const cell=row.cells?.[3];
    if(!cell)return;
    const existing=cell.querySelector(".mynba-development-delta");
    if(!p || !Number(p._mynbaOverallDelta)){if(existing)existing.remove();return;}
    if(existing)return;
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

function trimOversizedRosters() {
  const codes=new Set((typeof nbaTeams!=="undefined"?nbaTeams:[]).map(t=>String(Array.isArray(t)?t[0]:t.code)));
  (typeof customTeams!=="undefined"?customTeams:[]).forEach(t=>codes.add(String(t.code)));
  codes.forEach(code=>{
    const list=(players||[]).filter(p=>String(p.team)===code).sort((a,b)=>overall(b)-overall(a)||(Number(b.mpg)||0)-(Number(a.mpg)||0));
    list.slice(15).forEach(p=>{
      p.team="FA";
      (typeof customTeams!=="undefined"?customTeams:[]).forEach(t=>{t.playerIds=(t.playerIds||[]).filter(id=>String(id)!==String(p.id));});
    });
  });
}



function installPlayoffRosterTracking() {
  if(typeof window.simulateOnePlayoffGame!=="function"||window.simulateOnePlayoffGame.__attributeRosterWrapped)return;
  const original=window.simulateOnePlayoffGame;
  const wrapped=function(gameId){
    if(typeof playoffs!=="undefined"&&playoffs){
      const seriesList=[...(playoffs.confRounds?.West||[]),...(playoffs.confRounds?.East||[])].flatMap(round=>round.series||[]);
      if(playoffs.final)seriesList.push(playoffs.final);
      seriesList.forEach(series=>{
        ensureMinimumRoster(series.a.code);ensureMinimumRoster(series.b.code);
        series.a.strength=attributeTeamStrength(series.a.code);series.b.strength=attributeTeamStrength(series.b.code);
      });
    }
    return original.apply(this,arguments);
  };
  wrapped.__attributeRosterWrapped=true;window.simulateOnePlayoffGame=wrapped;
}

function preparePlayoffsFromCompletedCalendar(){
  if(typeof seasonCalendar==="undefined"||!seasonCalendar||!Array.isArray(seasonCalendar.games)||!seasonCalendar.games.length||seasonCalendar.games.some(g=>g.status!=="completed"))return false;
  if(typeof playoffs!=="undefined"&&playoffs)return true;
  if(!Array.isArray(seasonCalendar.teams)||seasonCalendar.teams.length<16)return false;
  const rows=seasonCalendar.teams.map(t=>{
    const played=(Number(t.wins)||0)+(Number(t.losses)||0),games=Math.max(1,played);
    return {code:t.code,name:t.name,conference:t.conference,custom:!!t.custom,strength:Number(t.strength)||.5,wins:Number(t.wins)||0,losses:Number(t.losses)||0,played:played,winPct:played?(Number(t.wins)||0)/played:0,ppg:(Number(t.points)||0)/games,oppg:(Number(t.oppPoints)||0)/games,diff:played?((Number(t.points)||0)-(Number(t.oppPoints)||0))/played:0,apg:(Number(t.assists)||0)/games,rpg:(Number(t.rebounds)||0)/games,spg:(Number(t.steals)||0)/games,bpg:(Number(t.blocks)||0)/games,tov:(Number(t.turnovers)||0)/games,seed:null};
  });
  ["East","West"].forEach(conf=>rows.filter(t=>t.conference===conf).sort((a,b)=>b.wins-a.wins||b.diff-a.diff).forEach((t,i)=>t.seed=i<8?i+1:null));
  if(rows.filter(t=>t.conference==="East"&&t.seed).length<8||rows.filter(t=>t.conference==="West"&&t.seed).length<8){
    const status=$("seasonStatus");if(status)status.textContent="Impossible de créer les playoffs : il faut au moins 8 équipes dans chaque conférence.";
    return false;
  }
  seasonResults=rows;
  if(typeof phase!=="undefined")phase="regular";
  if(typeof initializePlayoffs==="function")initializePlayoffs();
  return !!(typeof playoffs!=="undefined"&&playoffs);
}
window.NBAMyNBAPreparePlayoffs=preparePlayoffsFromCompletedCalendar;
function installDirectPlayoffs() {
  if(document.documentElement.dataset.mynbaDirectPlayoffs)return;
  document.documentElement.dataset.mynbaDirectPlayoffs="1";
  const open=()=>setTimeout(()=>{
    try {
      const complete=typeof seasonCalendar!=="undefined"&&seasonCalendar&&Array.isArray(seasonCalendar.games)&&seasonCalendar.games.length>0&&seasonCalendar.games.every(g=>g.status==="completed");
      if(complete&&typeof playoffs!=="undefined"&&!playoffs&&typeof preparePlayoffsFromCompletedCalendar==="function")preparePlayoffsFromCompletedCalendar();
      if(complete&&typeof phase!=="undefined"&&phase!=="playoffs"){
        phase="regular";
        if(!playoffs&&typeof window.initializePlayoffs==="function")window.initializePlayoffs();
        else if(!playoffs&&typeof initializePlayoffs==="function")initializePlayoffs();
      }
      if(typeof playoffs!=="undefined"&&playoffs&&typeof phase!=="undefined")phase="playoffs";
      if(typeof $("seasonSection")!=="undefined"&&$("seasonSection"))$("seasonSection").hidden=true;
      if(typeof $("seasonAwardsScreen")!=="undefined"&&$("seasonAwardsScreen"))$("seasonAwardsScreen").hidden=true;
      if(typeof $("playoffsSection")!=="undefined"&&$("playoffsSection"))$("playoffsSection").hidden=false;
      if(typeof window.NBAMyNBAShowPlayoffs==="function")window.NBAMyNBAShowPlayoffs();
      if(typeof window.renderAll==="function")window.renderAll();
      if(typeof window.NBAMyNBAShowPlayoffs==="function")window.NBAMyNBAShowPlayoffs();
    } catch(err) { console.error("Impossible d’ouvrir les playoffs automatiquement",err); }
  },0);
  document.addEventListener("click",event=>{if(event.target.closest("#enterPlayoffs,#season-awards-fullscreen [data-confirm]"))open();},true);
  document.addEventListener("keydown",event=>{
    if(event.key!=="Enter"||event.target&&/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName))return;
    const awardsOverlay=$("season-awards-fullscreen"),awards=$("seasonAwardsScreen");
    if(awardsOverlay||awards&&!awards.hidden)open();
  },true);
}

function start() {
  window.NBASimEnsureMinimumRoster=ensureMinimumRoster;trimOversizedRosters();installGameTracking();installPlayoffRosterTracking();recoverCalendarAfterLoad();installScheduleActions();installAutoMinutes();installMinuteBudget();installActualRegularBox();recordDevelopment();normalizeVisibleMinuteInputs();installDirectPlayoffs();
  document.addEventListener("change",enforceMinuteCap,true);
  document.addEventListener("click",event=>{
    if(event.target.closest('[data-leader-tab="players"]'))setTimeout(renderLeaderTable,0);
    if(event.target.closest('[data-leader-tab="teams"]'))setTimeout(()=>{
      const pane=$("mynbaTeamLeaderCards");
      if(pane && !pane.querySelector("#mynbaTeamSort")) {
        const table=pane.querySelector("table");
        if(table){
          const select=document.createElement("select");select.id="mynbaTeamSort";select.className="field";
          select.innerHTML='<option value="strength">Puissance estimée</option><option value="winPct">Pourcentage de victoires</option><option value="wins">Victoires</option><option value="losses">Défaites (moins → plus)</option><option value="ppg">Points/match</option><option value="apg">Passes/match</option><option value="rpg">Rebonds/match</option><option value="spg">Interceptions/match</option><option value="bpg">Contres/match</option><option value="name-az">Nom A–Z</option><option value="name-za">Nom Z–A</option>';
          select.addEventListener("change",()=>{const body=table.tBodies[0];[...body.rows].sort((a,b)=>{const v=select.value;if(v==="name-az"||v==="name-za"){const c=a.cells[1].textContent.localeCompare(b.cells[1].textContent,"fr");return v==="name-az"?c:-c;}if(v==="wins"||v==="losses"){const read=row=>{const m=row.cells[4]?.textContent.match(/(\d+)\s*[-–]\s*(\d+)/);return m?(v==="wins"?Number(m[1]):-Number(m[2])):0;};return read(b)-read(a);}const ix={winPct:2,strength:3,ppg:5,apg:6,rpg:7,spg:8,bpg:9}[v];return (parseFloat(b.cells[ix]?.textContent)||0)-(parseFloat(a.cells[ix]?.textContent)||0);}).forEach((row,i)=>{row.cells[0].textContent=i+1;body.appendChild(row);});});
          pane.prepend(select);
        }
      }
    },0);
  },true);
  const observer=new MutationObserver(records=>{
    hidePlayoffsCategory();installAutoMinutes();normalizeVisibleMinuteInputs();clearOldDevelopment();decorateDevelopment();
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