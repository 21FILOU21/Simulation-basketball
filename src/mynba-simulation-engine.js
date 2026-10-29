/* Game-by-game possession simulation. Attributes drive expected results; game form adds realistic variance. */
(function () {
  "use strict";
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const rand = () => typeof window.rnd === "function" ? window.rnd() : Math.random();
  const num = (v, fallback = 50) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const attr = (p, keys, fallback = 50) => {
    const a = p && p.attributes || {};
    for (const key of keys) if (a[key] !== undefined && a[key] !== null && Number.isFinite(Number(a[key]))) return Number(a[key]);
    return fallback;
  };
  const autoTendency = p => {
    const shooting = attr(p, ["threePoint", "threePointShot", "threePointShooting", "shooting"], 50);
    const offense = attr(p, ["offensiveIQ", "offense", "offensiveAwareness", "shotIQ"], 50);
    const finishing = attr(p, ["finishing", "layup", "closeShot"], 50);
    const playmaking = attr(p, ["playmaking", "passing", "passAccuracy", "passIQ"], 50);
    const baselinePoints = num(p && p.pts, 0);
    const baselineAssists = num(p && p.ast, 0);
    const shot = clamp(22 + baselinePoints * 2.0 + shooting * .25 + offense * .13, 12, 94);
    const touch = clamp(22 + baselinePoints * 1.5 + baselineAssists * 1.9 + playmaking * .23 + finishing * .08, 12, 96);
    const three = clamp(.24 + (shooting - 60) * .005 + (baselinePoints > 18 ? .025 : 0), .08, .58);
    return { shot, touch, three };
  };
  const pickWeighted = (rows, weight) => {
    if (!rows.length) return null;
    let total = rows.reduce((s, row) => s + Math.max(.001, weight(row)), 0);
    let r = rand() * total;
    for (const row of rows) { r -= Math.max(.001, weight(row)); if (r <= 0) return row; }
    return rows[rows.length - 1];
  };
  function rosterFor(code) {
    const scheduledTeam = typeof seasonCalendar !== "undefined" && seasonCalendar && Array.isArray(seasonCalendar.teams)
      ? seasonCalendar.teams.find(t => String(t.scheduleCode || t.code) === String(code)) : null;
    const teamCode = scheduledTeam ? scheduledTeam.code : code;
    const all = typeof players !== "undefined" ? players : [];
    let rows = all.filter(p => String(p.team) === String(teamCode) &&
      (typeof window.NBAMyNBAIsRostered !== "function" || window.NBAMyNBAIsRostered(p)));
    if (rows.length < 5) rows = all.filter(p => String(p.team) === String(teamCode));
    return rows.slice().sort((a, b) => num(b.mpg, 20) - num(a.mpg, 20)).slice(0, 15);
  }
  function makeSide(code, teamDef) {
    const roster = rosterFor(code);
    const lines = roster.map(p => ({ p, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, threeMade: 0, threeAttempts: 0, ftm: 0, fta: 0, pf: 0, minutes: 0, gp: 0, form: 0, usage: 1 }));
    const totalMpg = lines.reduce((sum, l) => sum + Math.max(0, num(l.p.mpg, 20)), 0);
    if (totalMpg > 0) lines.forEach(l => { l.minutes = clamp(Math.round(240 * Math.max(0, num(l.p.mpg, 20)) / totalMpg), 0, 48); });
    if (lines.length && lines.every(l => !l.minutes)) lines.slice(0, 5).forEach(l => { l.minutes = 48; });
    // Correct rounding while preserving the 240 team-minute budget and the 48-minute player cap.
    let difference = 240 - lines.reduce((sum, l) => sum + l.minutes, 0);
    for (let guard = 0; difference !== 0 && lines.length && guard < 1000; guard++) {
      const eligible = lines.filter(l => difference > 0 ? l.minutes < 48 : l.minutes > 0);
      if (!eligible.length) break;
      const player = pickWeighted(eligible, l => Math.max(1, num(l.p.mpg, 20)));
      player.minutes += difference > 0 ? 1 : -1;
      difference += difference > 0 ? -1 : 1;
    }
    const active = lines.filter(l => l.minutes > 0);
    active.forEach(l => {
      const consistency = attr(l.p, ["consistency"], 65);
      // A player's game form persists for the entire match, creating hot/cold nights rather than identical stat lines.
      const noise = (rand() + rand() + rand() + rand() - 2);
      l.form = noise * (.018 + (100 - consistency) * .00065);
      const tendency = autoTendency(l.p);
      const creation = attr(l.p, ["playmaking", "passing", "ballHandle", "offensiveIQ"], 50);
      const scorer = attr(l.p, ["threePoint", "threePointShot", "threePointShooting", "shooting", "finishing"], 50);
      l.usage = Math.max(.15, l.minutes / 32) *
        (.5 + tendency.touch / 100 * .65) *
        (.62 + Math.max(0, num(l.p.pts, 0)) / 22) *
        (.72 + attr(l.p, ["offensiveIQ", "shotIQ"], 50) / 190) *
        (.85 + scorer / 330 + creation / 600);
    });
    const defense = active.length ? active.reduce((s, l) => s + (
      attr(l.p, ["perimeterDefense"], 50) * .48 +
      attr(l.p, ["interiorDefense"], 50) * .34 +
      attr(l.p, ["defensiveIQ"], 50) * .18
    ) * l.minutes, 0) / Math.max(1, active.reduce((s, l) => s + l.minutes, 0)) : 50;
    return { code, teamDef, lines, active, score: 0, defense, totals: { ast: 0, reb: 0, stl: 0, blk: 0, tov: 0 } };
  }
  function rebound(side, offensive) {
    const player = pickWeighted(side.active, l => Math.max(.1, l.minutes / 30) *
      (.6 + attr(l.p, [offensive ? "offensiveRebound" : "defensiveRebound", "rebounding"], 50) / 85 +
      Math.max(0, num(l.p.height, 200) - 195) * .004 + attr(l.p, ["strength"], 50) * .001));
    if (player) { player.reb++; side.totals.reb++; }
  }
  function possession(offense, defense) {
    if (!offense.active.length || !defense.active.length) return;
    const handler = pickWeighted(offense.active, l => l.usage * (.7 + attr(l.p, ["ballHandle", "playmaking", "offensiveIQ"], 50) / 220));
    if (!handler) return;
    const defender = pickWeighted(defense.active, l => Math.max(.1, l.minutes / 30) *
      (.55 + attr(l.p, ["steal", "perimeterDefense", "defensiveIQ"], 50) / 145));
    const handle = attr(handler.p, ["ballHandle", "playmaking", "passing"], 50);
    const pressure = defender ? (attr(defender.p, ["steal", "perimeterDefense", "defensiveIQ"], 50) - 50) * .0007 : 0;
    const turnoverChance = clamp(.105 + (55 - handle) * .00105 + pressure + (rand() - .5) * .035, .035, .205);
    if (rand() < turnoverChance) {
      handler.tov++; offense.totals.tov++;
      if (defender && rand() < clamp(.25 + attr(defender.p, ["steal"], 50) * .0032, .25, .57)) {
        defender.stl++; defense.totals.stl++;
      }
      return;
    }
    const tendency = autoTendency(handler.p);
    const threeRating = attr(handler.p, ["threePoint", "threePointShot", "threePointShooting", "shooting"], 50);
    const twoRating = attr(handler.p, ["midRange", "midRangeShot", "shooting", "finishing"], 50);
    const finishing = attr(handler.p, ["finishing", "layup", "closeShot"], 50);
    const shotIQ = attr(handler.p, ["shotIQ", "offensiveIQ", "offensiveAwareness"], 50);
    const isThree = rand() < tendency.three;
    handler.fga++;
    if (isThree) handler.threeAttempts++;
    const rating = isThree ? threeRating : (twoRating * .52 + finishing * .48);
    const defensiveContest = ((defense.defense - 50) * .00105) + (defender ? (attr(defender.p, ["perimeterDefense", "interiorDefense"], 50) - 50) * .00042 : 0);
    const base = isThree ? .345 : .505;
    const skillBonus = (rating - 70) * (isThree ? .00335 : .00245) + (shotIQ - 65) * .00105;
    const fatigue = handler.minutes > 38 ? .012 : handler.minutes > 33 ? .006 : 0;
    const shotQuality = (rand() - .5) * .045;
    const pct = clamp(base + skillBonus + handler.form - defensiveContest - fatigue + shotQuality, isThree ? .19 : .27, isThree ? .54 : .70);
    const blockChance = clamp(.018 + (attr(defender && defender.p, ["block", "interiorDefense", "vertical"], 50) - 60) * .00065 +
      (num(defender && defender.p.height, 200) - 200) * .00035, .003, isThree ? .065 : .115);
    const blocked = !isThree && rand() < blockChance;
    const made = !blocked && rand() < pct;
    if (blocked && defender) { defender.blk++; defense.totals.blk++; }
    if (made) {
      handler.fgm++;
      const points = isThree ? 3 : 2;
      handler.pts += points; offense.score += points;
      if (isThree) handler.threeMade++;
      const assistChance = clamp(.54 + attr(handler.p, ["shotIQ", "finishing"], 50) * .00035, .53, .62);
      if (offense.active.length > 1 && rand() < assistChance) {
        const passer = pickWeighted(offense.active.filter(l => l !== handler), l => Math.max(.1, l.minutes / 30) *
          (.45 + attr(l.p, ["playmaking", "passing", "passIQ", "offensiveIQ"], 50) / 80) *
          (.7 + autoTendency(l.p).touch / 100));
        if (passer) { passer.ast++; offense.totals.ast++; }
      }
    } else {
      // Most misses are defensive rebounds; a smaller share extends the possession with an offensive board.
      const offensiveBoardChance = clamp(.19 + (attr(handler.p, ["offensiveRebound"], 50) - 50) * .0014, .10, .31);
      if (rand() < offensiveBoardChance) {
        rebound(offense, true);
        if (rand() < .46) {
          // Second-chance shots are less likely to be threes and receive a modest quality penalty.
          const secondIsThree = rand() < tendency.three * .62;
          handler.fga++;
          if (secondIsThree) handler.threeAttempts++;
          const secondRating = secondIsThree ? threeRating : finishing;
          const secondPct = clamp((secondIsThree ? .335 : .535) + (secondRating - 70) * (secondIsThree ? .00325 : .0024) +
            handler.form - defensiveContest - .025 + (rand() - .5) * .05, secondIsThree ? .18 : .25, secondIsThree ? .52 : .72);
          if (rand() < secondPct) {
            handler.fgm++; const points = secondIsThree ? 3 : 2; handler.pts += points; offense.score += points;
            if (secondIsThree) handler.threeMade++;
          } else rebound(defense, false);
        }
      } else rebound(defense, false);
    }
    // Fouls/FTs: free throws add to points but do not inflate field-goal attempts.
    const foulChance = clamp(.075 + (finishing - 60) * .001 + (isThree ? .025 : .015), .035, isThree ? .115 : .19);
    if (!isThree && rand() < foulChance) {
      const attempts = rand() < .045 ? 3 : 2;
      const ftSkill = attr(handler.p, ["freeThrow", "freeThrowShooting", "ft"], 70);
      const ftPct = clamp(.69 + (ftSkill - 70) * .0032 + handler.form * .25, .42, .96);
      for (let i = 0; i < attempts; i++) {
        handler.fta++;
        if (rand() < ftPct) { handler.ftm++; handler.pts++; offense.score++; }
      }
    }
  }
  function simulateScheduledGamePossessions(game) {
    if (typeof seasonCalendar === "undefined" || !seasonCalendar || !game || game.status === "completed") return false;
    const teams = new Map(seasonCalendar.teams.map(t => [String(t.scheduleCode || t.code), t]));
    const homeTeam = teams.get(String(game.home.code)), awayTeam = teams.get(String(game.away.code));
    if (!homeTeam || !awayTeam) return false;
    const home = makeSide(game.home.code, homeTeam), away = makeSide(game.away.code, awayTeam);
    const possessions = 94 + Math.floor(rand() * 13);
    for (let i = 0; i < possessions; i++) {
      possession(home, away);
      possession(away, home);
    }
    // Overtime is another paired burst, keeping score and player totals reconciled.
    let overtime = 0;
    while (home.score === away.score && overtime++ < 8) {
      for (let i = 0; i < 5; i++) { possession(home, away); possession(away, home); }
    }
    if (home.score === away.score) {
      const side = rand() < .5 ? home : away;
      const scorer = pickWeighted(side.active, l => Math.max(.1, l.minutes));
      if (scorer) { scorer.pts++; scorer.ftm++; scorer.fta++; side.score++; }
    }
    [home, away].forEach(side => side.lines.forEach(l => { l.gp = l.minutes > 0 ? 1 : 0; }));
    game.homeScore = home.score; game.awayScore = away.score; game.status = "completed";
    game.winnerCode = home.score > away.score ? game.home.code : game.away.code;
    if (home.score > away.score) { homeTeam.wins++; awayTeam.losses++; }
    else { awayTeam.wins++; homeTeam.losses++; }
    homeTeam.points += home.score; homeTeam.oppPoints += away.score;
    awayTeam.points += away.score; awayTeam.oppPoints += home.score;
    const sum = (side, key) => side.lines.reduce((total, l) => total + (Number(l[key]) || 0), 0);
    homeTeam.assists += sum(home, "ast"); awayTeam.assists += sum(away, "ast");
    homeTeam.rebounds += sum(home, "reb"); awayTeam.rebounds += sum(away, "reb");
    homeTeam.steals += sum(home, "stl"); awayTeam.steals += sum(away, "stl");
    homeTeam.blocks += sum(home, "blk"); awayTeam.blocks += sum(away, "blk");
    homeTeam.turnovers += sum(home, "tov"); awayTeam.turnovers += sum(away, "tov");
    const pack = side => Object.fromEntries(side.lines.map(l => [String(l.p.id), {
      pts:l.pts, reb:l.reb, ast:l.ast, stl:l.stl, blk:l.blk, tov:l.tov, fgm:l.fgm, fga:l.fga,
      threeMade:l.threeMade, threeAttempts:l.threeAttempts, ftm:l.ftm, fta:l.fta, minutes:l.minutes, gp:l.gp, pf:l.pf
    }]));
    game.playerBoxScores = { home: pack(home), away: pack(away) };
    return true;
  }
  if (typeof window.overallRating === "function" && !window.overallRating.__potentialCapped) {
    const oldOverall = window.overallRating;
    const cappedOverall = function (p) { return Math.min(oldOverall.apply(this, arguments), clamp(num(p && p.attributes && p.attributes.potential, 99), 40, 99)); };
    cappedOverall.__potentialCapped = true; window.overallRating = cappedOverall;
  }
  if (typeof window.progress === "function" && !window.progress.__variableGrowthWrapped) {
    const oldProgress = window.progress;
    const variableGrowth = function (p) {
      const before = typeof window.overallRating === "function" ? window.overallRating(p) : 50;
      oldProgress.apply(this, arguments);
      const age = num(p.age, 27), a = p.attributes || {}, work = num(a.workEthic, 50), potential = num(a.potential, 99);
      const history = Array.isArray(p.history) ? p.history : [];
      const last = history.length ? history[history.length - 1] : null;
      const career = history.length ? history.reduce((s, h) => s + num(h.pts, 0) + num(h.ast, 0) * .8 + num(h.reb, 0) * .5, 0) / history.length : 0;
      const lastScore = last ? num(last.pts, 0) + num(last.ast, 0) * .8 + num(last.reb, 0) * .5 : career;
      const performance = last ? clamp((lastScore - career) / 35, -1, 1) * .65 : 0;
      const ageTrend = age <= 21 ? 1.7 : age <= 24 ? 1.15 : age <= 28 ? .35 : age <= 31 ? -.05 : age <= 34 ? -.65 : age <= 37 ? -1.45 : -2.35;
      const target = clamp(ageTrend + (work - 50) * .025 + performance, -3.5, 3.5);
      const after = typeof window.overallRating === "function" ? window.overallRating(p) : before;
      const correction = Math.round(target - (after - before));
      if (correction) Object.keys(a).forEach(key => {
        if (["potential", "workEthic", "consistency"].includes(key)) return;
        a[key] = clamp(Math.round(num(a[key], 50) + correction), 20, 99);
      });
      Object.keys(a).forEach(key => { if (key !== "potential") a[key] = clamp(Math.round(num(a[key], 50)), 20, 99); });
      a.potential = clamp(Math.round(potential), 40, 99);
    };
    variableGrowth.__variableGrowthWrapped = true; window.progress = variableGrowth;
  }
  if (typeof window.updateTeamSeasonAverages === "function" && !window.updateTeamSeasonAverages.__possessionStatsWrapped) {
    const oldUpdate = window.updateTeamSeasonAverages;
    const wrapped = function () {
      const result = oldUpdate.apply(this, arguments);
      const finished = typeof seasonCalendar !== "undefined" && seasonCalendar && seasonCalendar.games.length > 0 && seasonCalendar.games.every(g => g.status === "completed");
      if (finished && typeof seasonLines !== "undefined" && typeof players !== "undefined") {
        const stats = window.NBASimActualPlayerStats || {};
        seasonLines = new Map();
        players.forEach(p => {
          const s = stats[String(p.id)];
          if (!s || !Number(s.gp)) return;
          const gp = Number(s.gp), fgm = Number(s.fgm) || 0, fga = Number(s.fga) || 0;
          const threeMade = Number(s.threeMade) || 0, threeAttempts = Number(s.threeAttempts) || 0;
          const ftm = Number(s.ftm) || 0, fta = Number(s.fta) || 0, pts = Number(s.pts) || 0;
          seasonLines.set(p.id, { gp, missed: Math.max(0, 82 - gp), pts:pts/gp, reb:(Number(s.reb)||0)/gp, ast:(Number(s.ast)||0)/gp,
            stl:(Number(s.stl)||0)/gp, blk:(Number(s.blk)||0)/gp, tov:(Number(s.tov)||0)/gp, mpg:(Number(s.minutes)||0)/gp,
            fgm, fga, fg:fga?fgm/fga:0, threeMade, threeAttempts, three:threeAttempts?threeMade/threeAttempts:0,
            ftMade:ftm, fta, ft:fta?ftm/fta:0, ts:fga+fta*.44?pts/(2*(fga+fta*.44)):0, plusMinus:0 });
        });
        if (typeof window.renderSeasonAwardsPreview === "function") window.renderSeasonAwardsPreview();
      }
      return result;
    };
    wrapped.__possessionStatsWrapped = true; window.updateTeamSeasonAverages = wrapped;
  }
  window.NBASimAutoTendency = autoTendency;
  if (typeof window.initializeSeasonCalendar === "function" && !window.initializeSeasonCalendar.__seasonStatsResetWrapped) {
    const oldInitialize = window.initializeSeasonCalendar;
    const wrappedInitialize = function () {
      const result = oldInitialize.apply(this, arguments);
      if (result !== false) {
        Object.keys(window.NBASimActualPlayerStats || {}).forEach(k => delete window.NBASimActualPlayerStats[k]);
        Object.keys(window.NBASimActualBoxScores || {}).forEach(k => delete window.NBASimActualBoxScores[k]);
      }
      return result;
    };
    wrappedInitialize.__seasonStatsResetWrapped = true; window.initializeSeasonCalendar = wrappedInitialize;
  }
  window.simulateScheduledGame = simulateScheduledGamePossessions;
  document.addEventListener("DOMContentLoaded", function () { window.NBAMyNBATendency = autoTendency; }, { once: true });
})();