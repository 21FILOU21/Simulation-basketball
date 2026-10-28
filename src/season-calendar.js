/* Season calendar foundation.
 * CommonJS for Node tests and browser global for the game.
 * This module intentionally does not alter the existing simulation until integrated.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NBASimSeasonCalendar = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_STAGES = [
    { label: "Octobre", count: 12 },
    { label: "Novembre", count: 12 },
    { label: "Décembre", count: 12 },
    { label: "Janvier", count: 12 },
    { label: "Février", count: 12 },
    { label: "Mars", count: 11 },
    { label: "Avril", count: 11 }
  ];

  function normalizeTeams(teams) {
    if (!Array.isArray(teams) || teams.length < 2) {
      throw new Error("Il faut au moins deux équipes pour générer un calendrier.");
    }
    const normalized = teams.map((team, index) => {
      const code = String(team && team.code || "").trim();
      const name = String(team && team.name || code).trim();
      if (!code || !name) throw new Error("Chaque équipe doit avoir un code et un nom.");
      return { code, name, conference: team.conference || null, custom: Boolean(team.custom), _index: index };
    });
    const codes = normalized.map(team => team.code.toUpperCase());
    if (new Set(codes).size !== codes.length) {
      throw new Error("Chaque équipe doit avoir un code unique.");
    }
    return normalized;
  }

  function makeRoundRobinRounds(teams) {
    const rotation = teams.length % 2 === 0
      ? teams.slice()
      : [...teams, { code: "__BYE__", name: "Exemption", conference: null, custom: false, _index: teams.length, _bye: true }];
    const rounds = [];
    const roundCount = rotation.length - 1;
    for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
      const games = [];
      for (let i = 0; i < rotation.length / 2; i++) {
        games.push([rotation[i], rotation[rotation.length - 1 - i]]);
      }
      rounds.push(games);
      const fixed = rotation[0];
      const rest = rotation.slice(1);
      rest.unshift(rest.pop());
      rotation.splice(0, rotation.length, fixed, ...rest);
    }
    return rounds;
  }

  function stageForGame(gameNumber, stages) {
    let remaining = gameNumber;
    for (const stage of stages) {
      remaining -= stage.count;
      if (remaining <= 0) return stage.label;
    }
    return stages[stages.length - 1].label;
  }

  function generateSeasonCalendar(inputTeams, options = {}) {
    const teams = normalizeTeams(inputTeams);
    const gamesPerTeam = options.gamesPerTeam == null ? 82 : Number(options.gamesPerTeam);
    if (!Number.isInteger(gamesPerTeam) || gamesPerTeam < 1) {
      throw new Error("gamesPerTeam doit être un entier positif.");
    }
    const stages = Array.isArray(options.stages) && options.stages.length
      ? options.stages.map(stage => ({ label: String(stage.label), count: Number(stage.count) }))
      : DEFAULT_STAGES;
    if (stages.some(stage => !stage.label || !Number.isInteger(stage.count) || stage.count < 1)) {
      throw new Error("Chaque étape doit avoir un nom et un nombre de matchs positif.");
    }

    const baseRounds = makeRoundRobinRounds(teams);
    const counts = new Map(teams.map(team => [team.code, 0]));
    const homeCounts = new Map(teams.map(team => [team.code, 0]));
    const games = [];
    const maxRounds = gamesPerTeam + Math.ceil(gamesPerTeam / Math.max(1, teams.length - 1)) + teams.length * 2;
    let roundIndex = 0;
    while ([...counts.values()].some(count => count < gamesPerTeam) && roundIndex < maxRounds) {
      const cycleIndex = Math.floor(roundIndex / baseRounds.length);
      const baseRound = baseRounds[roundIndex % baseRounds.length];
      const roundGames = baseRound.filter(([left, right]) =>
        !left._bye && !right._bye &&
        counts.get(left.code) < gamesPerTeam &&
        counts.get(right.code) < gamesPerTeam
      ).map(([left, right], matchIndex) => {
        // Reverse home court every other complete round-robin cycle.
        let home = cycleIndex % 2 === 1 ? right : left;
        let away = home === left ? right : left;
        const leftHome = homeCounts.get(left.code);
        const rightHome = homeCounts.get(right.code);
        // Prefer the team with fewer home games; the cycle order breaks ties deterministically.
        if (leftHome > rightHome) { home = right; away = left; }
        else if (rightHome > leftHome) { home = left; away = right; }
        else if ((roundIndex + matchIndex) % 2 === 1) { const previousHome = home; home = away; away = previousHome; }
        homeCounts.set(home.code, homeCounts.get(home.code) + 1);
        counts.set(left.code, counts.get(left.code) + 1);
        counts.set(right.code, counts.get(right.code) + 1);
        const gameNumberHome = counts.get(home.code);
        return {
          id: "RS-" + String(games.length + matchIndex + 1).padStart(4, "0"),
          round: roundIndex + 1,
          gameNumberHome,
          home: { code: home.code, name: home.name },
          away: { code: away.code, name: away.name },
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          stage: stageForGame(gameNumberHome, stages)
        };
      });
      // One game per team per round; IDs are reassigned globally to avoid collisions.
      for (const game of roundGames) {
        game.id = "RS-" + String(games.length + 1).padStart(4, "0");
        game.stage = stageForGame(game.gameNumberHome, stages);
        games.push(game);
      }
      roundIndex++;
    }
    if ([...counts.values()].some(count => count !== gamesPerTeam)) {
      throw new Error("Impossible de générer un calendrier équilibré avec les équipes fournies.");
    }

    const teamGames = new Map(teams.map(team => [team.code, []]));
    for (const game of games) {
      teamGames.get(game.home.code).push(game);
      teamGames.get(game.away.code).push(game);
    }
    // Normalize a team's per-team schedule number and stage after all rounds are generated.
    for (const [code, list] of teamGames) {
      list.sort((a, b) => a.round - b.round);
      list.forEach((game, index) => {
        const gameNumber = index + 1;
        if (game.home.code === code) game.homeGameNumber = gameNumber;
        if (game.away.code === code) game.awayGameNumber = gameNumber;
      });
    }

    return {
      seasonType: "regular",
      gamesPerTeam,
      teamCount: teams.length,
      totalGames: games.length,
      stages: stages.map(stage => ({ ...stage })),
      games,
      teamSchedules: Object.fromEntries([...teamGames.entries()].map(([code, list]) => [
        code,
        list.map(game => ({
          ...game,
          home: { ...game.home },
          away: { ...game.away },
          gameNumber: game.home.code === code ? game.homeGameNumber : game.awayGameNumber,
          isHome: game.home.code === code,
          opponent: game.home.code === code ? { ...game.away } : { ...game.home }
        }))
      ]))
    };
  }

  function validateSeasonCalendar(calendar) {
    const errors = [];
    if (!calendar || !Array.isArray(calendar.games) || !calendar.teamSchedules) {
      return { valid: false, errors: ["Format de calendrier invalide."] };
    }
    const allCodes = Object.keys(calendar.teamSchedules);
    for (const code of allCodes) {
      const games = calendar.teamSchedules[code];
      if (games.length !== calendar.gamesPerTeam) {
        errors.push(code + " possède " + games.length + " matchs au lieu de " + calendar.gamesPerTeam + ".");
      }
      const numbers = games.map(game => game.gameNumber);
      if (new Set(numbers).size !== numbers.length || numbers.some(n => !Number.isInteger(n) || n < 1 || n > calendar.gamesPerTeam)) {
        errors.push(code + " a une numérotation de matchs invalide.");
      }
      const homeCount = games.filter(game => game.isHome).length;
      if (Math.abs(homeCount - (calendar.gamesPerTeam / 2)) > 1) {
        errors.push(code + " a un équilibre domicile/extérieur trop déséquilibré (" + homeCount + " à domicile).");
      }
    }
    const ids = calendar.games.map(game => game.id);
    if (new Set(ids).size !== ids.length) errors.push("Les identifiants des matchs ne sont pas uniques.");
    if (calendar.games.length !== calendar.teamCount * calendar.gamesPerTeam / 2) {
      errors.push("Le nombre total de matchs ne correspond pas au nombre de matchs par équipe.");
    }
    return { valid: errors.length === 0, errors };
  }

  return { DEFAULT_STAGES, generateSeasonCalendar, validateSeasonCalendar };
});
