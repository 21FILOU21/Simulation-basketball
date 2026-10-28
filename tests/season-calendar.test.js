const assert = require("node:assert/strict");
const { generateSeasonCalendar, validateSeasonCalendar } = require("../src/season-calendar.js");

function makeTeams(count) {
  return Array.from({ length: count }, (_, index) => ({
    code: "T" + String(index + 1).padStart(2, "0"),
    name: "Team " + (index + 1),
    conference: index < count / 2 ? "East" : "West"
  }));
}

const teams = makeTeams(30);
const calendar = generateSeasonCalendar(teams);
const validation = validateSeasonCalendar(calendar);
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.equal(calendar.teamCount, 30);
assert.equal(calendar.gamesPerTeam, 82);
assert.equal(calendar.totalGames, 1230);
assert.equal(calendar.games.length, 1230);
assert.equal(new Set(calendar.games.map(game => game.id)).size, 1230);

for (const team of teams) {
  const schedule = calendar.teamSchedules[team.code];
  assert.equal(schedule.length, 82, team.code + " should have 82 games");
  assert.deepEqual(schedule.map(game => game.gameNumber).sort((a, b) => a - b),
    Array.from({ length: 82 }, (_, index) => index + 1));
  assert.ok(schedule.every(game => game.opponent.code !== team.code), "a team cannot play itself");
  assert.ok(schedule.every(game => game.status === "scheduled"));
  assert.ok(schedule.every(game => game.homeScore === null && game.awayScore === null));
  const homeCount = schedule.filter(game => game.isHome).length;
  assert.ok(homeCount >= 40 && homeCount <= 42, team.code + " home/away balance should stay within one game of 41.");
}

const oddTeamCalendar = generateSeasonCalendar(makeTeams(31));
assert.equal(oddTeamCalendar.totalGames, 31 * 82 / 2);
assert.equal(validateSeasonCalendar(oddTeamCalendar).valid, true);
assert.ok(Object.values(oddTeamCalendar.teamSchedules).every(schedule => schedule.length === 82));
assert.throws(() => generateSeasonCalendar([{ code: "AAA" }, { code: "aaa" }]), /code unique/);
assert.throws(() => generateSeasonCalendar(teams, { gamesPerTeam: 0 }), /entier positif/);

const twoTeamCalendar = generateSeasonCalendar(makeTeams(2), { gamesPerTeam: 4 });
assert.equal(twoTeamCalendar.games.length, 4);
assert.equal(twoTeamCalendar.teamSchedules.T01.length, 4);
assert.equal(validateSeasonCalendar(twoTeamCalendar).valid, true);

console.log("OK — calendrier : équipes paires ou impaires, 82 matchs par équipe, matchs uniques et validation des cas limites.");
