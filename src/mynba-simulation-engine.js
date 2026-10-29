/* Possession-based regular-season engine. Loaded after the legacy engine so the existing UI and calendar stay intact. */
(function () {
  "use strict";
  const clampN = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const rand = () => typeof window.rnd === "function" ? window.rnd() : Math.random();
  const num = (v, fallback=50) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const attr = (p, keys, fallback=50) => {
    const a=p && p.attributes || {};
    for (const key of keys) if (Number.isFinite(Number(a[key]))) return Number(a[key]);
    return fallback;
  };
  const autoTendency = p => {
    const a=p.attributes||{};
    const offense=(attr(p,["offensiveIQ","offense","offensiveAwareness"])+attr(p,["shooting","threePoint","midRange","finishing"]))/4;
    const touch=clampN((num(p.pts,0)*2.2+num(p.ast,0)*1.7+offense*.55),15,95);
    const shot=clampN((num(p.pts,0)*2.5+attr(p,["threePoint","shooting"])*.35+attr(p,["shotIQ","offensiveIQ"])*.25),10,95);
    return {shot,touch};
  };
  const pickWeighted = (rows, weight) => {
    const total=rows.reduce((s,p)=>s+Math.max(.01,weight(p)),0);
    let r=rand()*total;
    for(const p of rows){r-=Math.max(.01,weight(p));if(r<=0)return p;}
    return rows[rows.length-1];
  };
  function rosterFor(code) {
    const teamCode = typeof window.NBAMyNBATeamCodeForSchedule==="function" ? window.NBAMyNBATeamCodeForSchedule(code) : code;
    const all = typeof players!=="undefined" ? players : [];
    let rows=all.filter(p=>String(p.team)===String(teamCode) &&
      (typeof window.NBAMyNBAIsRostered!=="function" || window.NBAMyNBAIsRostered(p)));
    if(rows.length<5) rows=all.filter(p=>String(p.team)===String(teamCode));
    return rows.slice().sort((a,b)=>num(b.mpg,20)-num(a.mpg,20)).slice(0,15);
  }
  function createLines(rows) {
    return rows.map(p=>({p,pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,fgm:0,fga:0,threeMade:0,threeAttempts:0,ftm:0,fta:0,pf:0,minutes:0,gp:0}));
  }
  function teamGame(code, opponentStrength) {
    const roster=rosterFor(code);
    const lines=createLines(roster);
    const byId=new Map(lines.map(x=>[String(x.p.id),x]));
    const minuteWeights=lines.map(x=>Math.max(0,num(x.p.mpg,20)));
    const totalMinutes=minuteWeights.reduce((a,b)=>a+b,0);
    lines.forEach((x,i)=>x.minutes=totalMinutes>0?Math.min(48,Math.round(240*minuteWeights[i]/totalMinutes)):0);
    // Keep a five-player floor even when a custom team is not fully configured.
    if(lines.length && lines.every(x=>x.minutes===0)) lines.slice(0,5).forEach(x=>x.minutes=48);
    const active=lines.filter(x=>x.minutes>0);
    if(!active.length) return {code,score:0,lines:byId,totals:{ast:0,reb:0,stl:0,blk:0,tov:0}};
    const teamDefense=active.reduce((s,x)=>s+attr(x.p,["perimeterDefense","interiorDefense"])/2,0)/active.length;
    const totals={ast:0,reb:0,stl:0,blk:0,tov:0};
    let score=0;
    const possessions=96+Math.round(rand()*8);
    const usageWeight=x=>{
      const t=autoTendency(x.p);
      return Math.max(.15,x.minutes/32) * (.45+t.touch/100*.75) * (.5+num(x.p.pts,0)/18) * (.75+attr(x.p,["offensiveIQ","shotIQ"])/200);
    };
    const defender=()=>pickWeighted(active,x=>Math.max(.1,x.minutes/32)*(.65+attr(x.p,["steal","perimeterDefense","defensiveIQ"])/160));
    for(let pos=0;pos<possessions;pos++){
      const shooter=pickWeighted(active,usageWeight), line=byId.get(String(shooter.p.id));
      const a=shooter.p.attributes||{}, tendency=autoTendency(shooter.p);
      const turnoverRate=clampN(.075+(100-attr(shooter.p,["ballHandle","playmaking"]))/1800+num(shooter.p.ast,0)*.0015,.035,.19);
      if(rand()<turnoverRate){
        line.tov++;totals.tov++;
        if(rand()<.42){const thief=defender();byId.get(String(thief.p.id)).stl++;totals.stl++;}
        continue;
      }
      const threeShare=clampN(.18+(attr(shooter.p,["threePoint","shooting"])-50)*.004+(tendency.shot-50)*.0015,.08,.52);
      const isThree=rand()<threeShare;
      line.fga++; if(isThree)line.threeAttempts++;
      const rating=isThree?attr(shooter.p,["threePoint","shooting"]):attr(shooter.p,["midRange","shooting","finishing"]);
      const offenseIQ=attr(shooter.p,["shotIQ","offensiveIQ"]);
      const fatigue=num(shooter.p.mpg,24)>36?.025:0;
      const defensePenalty=(teamDefense-50)*.0011;
      const base=isThree?.345:.505;
      const pct=clampN(base+(rating-70)*.0032+(offenseIQ-70)*.0011+defensePenalty-fatigue+(rand()-.5)*.055,.19,isThree?.53:.69);
      if(rand()<pct){
        line.fgm++; const points=isThree?3:2;line.pts+=points;score+=points;
        if(isThree) {line.threeMade++;}
        if(rand()<(isThree?.69:.59) && active.length>1){
          const passer=pickWeighted(active,x=>x===line?0.01:Math.max(.01,x.minutes/32)*(.55+attr(x.p,["playmaking","passing"])/100));
          if(passer!==line){byId.get(String(passer.p.id)).ast++;totals.ast++;}
        }
      } else {
        const blocker=defender();
        const blockChance=clampN(.018+(attr(blocker.p,["block","interiorDefense","vertical"])-60)*.00055+(num(blocker.p.height,200)-200)*.00035,.005,.12);
        if(rand()<blockChance){byId.get(String(blocker.p.id)).blk++;totals.blk++;}
        const rebounder=pickWeighted(active,x=>Math.max(.01,x.minutes/32)*(.45+attr(x.p,["defensiveRebound","offensiveRebound"])/130+(num(x.p.height,200)-200)*.002));
        byId.get(String(rebounder.p.id)).reb++;totals.reb++;
      }
      if(!isThree && rand()<clampN(.075+(attr(shooter.p,["finishing"])-60)*.0012,.035,.16)){
        const attempts=rand()<.08?3:2;
        for(let k=0;k<attempts;k++){line.fta++;const ft=clampN(.69+(attr(shooter.p,["freeThrow"])-60)*.003+(rand()-.5)*.08,.45,.96);if(rand()<ft){line.ftm++;line.pts++;score++;}}
      }
    }
    lines.forEach(x=>{x.gp=x.minutes>0?1:0;});
    return {code,score,lines:byId,totals};
  }
  function simulateScheduledGamePossessions(game) {
    if(!seasonCalendar || !game || game.status==="completed") return false;
    const teams=new Map(seasonCalendar.teams.map(t=>[String(t.scheduleCode||t.code),t]));
    const home=teams.get(String(game.home.code)),away=teams.get(String(game.away.code));
    if(!home||!away) return false;
    const h=teamGame(game.home.code,away.strength),a=teamGame(game.away.code,home.strength);
    // Overtime: continue with short, paired possession bursts until scores differ.
    let guard=0;
    while(h.score===a.score && guard++<6){
      const extraH=teamGame(game.home.code,away.strength),extraA=teamGame(game.away.code,home.strength);
      h.score+=extraH.score;a.score+=extraA.score;
      for(const [id,l] of extraH.lines){const old=h.lines.get(id);if(old)Object.keys(l).forEach(k=>{if(k!=="p")old[k]=(Number(old[k])||0)+(Number(l[k])||0);});}
      for(const [id,l] of extraA.lines){const old=a.lines.get(id);if(old)Object.keys(l).forEach(k=>{if(k!=="p")old[k]=(Number(old[k])||0)+(Number(l[k])||0);});}
    }
    if(h.score===a.score){if(rand()<.5)h.score++;else a.score++;}
    game.homeScore=h.score;game.awayScore=a.score;game.status="completed";
    game.winnerCode=h.score>a.score?game.home.code:game.away.code;
    if(h.score>a.score){home.wins++;away.losses++;}else{away.wins++;home.losses++;}
    home.points+=h.score;home.oppPoints+=a.score;away.points+=a.score;away.oppPoints+=h.score;
    const sumTotals=(side,key)=>[...side.lines.values()].reduce((s,l)=>s+(Number(l[key])||0),0);
    home.assists+=sumTotals(h,"ast");away.assists+=sumTotals(a,"ast");
    home.rebounds+=sumTotals(h,"reb");away.rebounds+=sumTotals(a,"reb");
    home.steals+=sumTotals(h,"stl");away.steals+=sumTotals(a,"stl");
    home.blocks+=sumTotals(h,"blk");away.blocks+=sumTotals(a,"blk");
    home.turnovers+=sumTotals(h,"tov");away.turnovers+=sumTotals(a,"tov");
    game.playerBoxScores={home:Object.fromEntries([...h.lines].map(([id,l])=>[id,{pts:l.pts,reb:l.reb,ast:l.ast,stl:l.stl,blk:l.blk,tov:l.tov,fgm:l.fgm,fga:l.fga,threeMade:l.threeMade,threeAttempts:l.threeAttempts,ftm:l.ftm,fta:l.fta,minutes:l.minutes,gp:l.gp}])),away:Object.fromEntries([...a.lines].map(([id,l])=>[id,{pts:l.pts,reb:l.reb,ast:l.ast,stl:l.stl,blk:l.blk,tov:l.tov,fgm:l.fgm,fga:l.fga,threeMade:l.threeMade,threeAttempts:l.threeAttempts,ftm:l.ftm,fta:l.fta,minutes:l.minutes,gp:l.gp}]))};
    return true;
  }
  // Potential is a hard ceiling for displayed overall; preserve the original position-weighted calculation.
  if(typeof window.overallRating==="function"&&!window.overallRating.__potentialCapped){
    const oldOverall=window.overallRating;
    const cappedOverall=function(p){
      const raw=oldOverall.apply(this,arguments);
      const potential=num(p&&p.attributes&&p.attributes.potential,99);
      return Math.min(raw,clampN(potential,40,99));
    };
    cappedOverall.__potentialCapped=true;
    window.overallRating=cappedOverall;
  }
  // More visible, age-aware offseason development, moderated by work ethic and prior-season performance.
  if(typeof window.progress==="function"&&!window.progress.__variableGrowthWrapped){
    const oldProgress=window.progress;
    const variableGrowth=function(p){
      const before=typeof window.overallRating==="function"?window.overallRating(p):50;
      oldProgress.apply(this,arguments);
      const age=num(p.age,27),a=p.attributes||{},work=num(a.workEthic,50),potential=num(a.potential,99);
      const last=(Array.isArray(p.history)&&p.history.length)?p.history[p.history.length-1]:null;
      const career=(Array.isArray(p.history)&&p.history.length)?p.history.reduce((s,h)=>s+(num(h.pts,0)+num(h.ast,0)*.8+num(h.reb,0)*.5),0)/p.history.length:0;
      const lastScore=last?num(last.pts,0)+num(last.ast,0)*.8+num(last.reb,0)*.5:career;
      const performance=last?clampN((lastScore-career)/35,-1,1)*.65:0;
      const ageTrend=age<=21?1.7:age<=24?1.15:age<=28?.35:age<=31?-.05:age<=34?-.65:age<=37?-1.45:-2.35;
      const target=clampN(ageTrend+(work-50)*.025+performance,-3.5,3.5);
      const after=typeof window.overallRating==="function"?window.overallRating(p):before;
      const correction=Math.round(target-(after-before));
      if(correction!==0){
        Object.keys(a).forEach(key=>{
          if(key==="potential"||key==="workEthic"||key==="consistency")return;
          a[key]=clampN(Math.round(num(a[key],50)+correction),20,99);
        });
      }
      // Re-clamp every attribute and never let the effective overall exceed potential.
      Object.keys(a).forEach(key=>{if(key!=="potential")a[key]=clampN(Math.round(num(a[key],50)),20,99);});
      a.potential=clampN(Math.round(potential),40,99);
    };
    variableGrowth.__variableGrowthWrapped=true;
    window.progress=variableGrowth;
  }
  window.NBASimAutoTendency=autoTendency;
  // Override the legacy neutral/manual tendency provider after MyNBA initializes.
  document.addEventListener("DOMContentLoaded",function(){
    window.NBAMyNBATendency=autoTendency;
  },{once:true});
  // A fresh calendar means a fresh regular season: leaders must never carry over old totals.
  if(typeof window.initializeSeasonCalendar==="function"&&!window.initializeSeasonCalendar.__seasonStatsResetWrapped){
    const oldInitialize=window.initializeSeasonCalendar;
    const wrappedInitialize=function(){
      const result=oldInitialize.apply(this,arguments);
      if(result!==false){
        const stats=window.NBASimActualPlayerStats||{};
        Object.keys(stats).forEach(k=>delete stats[k]);
        const boxes=window.NBASimActualBoxScores||{};
        Object.keys(boxes).forEach(k=>delete boxes[k]);
      }
      return result;
    };
    wrappedInitialize.__seasonStatsResetWrapped=true;
    window.initializeSeasonCalendar=wrappedInitialize;
  }
  window.simulateScheduledGame=simulateScheduledGamePossessions;
})();
