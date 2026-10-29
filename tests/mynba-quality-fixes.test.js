const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const nav = fs.readFileSync(path.join(root, "src", "mynba-navigation.js"), "utf8");
const fixes = fs.readFileSync(path.join(root, "src", "mynba-quality-fixes.js"), "utf8");
const inline = html.split("<script>")[1]?.split("</script>")[0] || "";

assert.ok(inline, "The inline app script should exist.");
new Function(inline);
new Function(nav);
new Function(fixes);

assert.match(nav, /\["teamCreator","Team Creator"/, "Team Creator must be available as a category.");
assert.doesNotMatch(nav, /\["playoffs","Playoffs"/, "Playoffs must not remain a menu category.");
assert.match(nav, /NBAMyNBAShowPlayoffs=function/, "The playoffs screen should be opened directly after regular-season awards.");
assert.match(nav, /window\.NBASimActualPlayerStats/, "Player leaders must use current-season played-game stats.");
assert.match(nav, /Math\.min\(48,mins\[i\]\)/, "Box scores must cap every player at 48 minutes.");

assert.match(fixes, /function ensureMinimumRoster\(code\)/, "Teams with fewer than five players should receive rookies.");
assert.match(fixes, /window\.NBASimEnsureMinimumRoster=ensureMinimumRoster/, "Box-score views should be able to complete short rosters.");
assert.match(fixes, /window\.simulateThroughRound\(game\.round\)/, "A selected game must advance all earlier rounds and its full round.");
assert.match(fixes, /function attributeTeamStrength\(code\)/, "Team strength should be calculated from player attributes.");
assert.match(fixes, /weightedAllocate\(minuteBudget, roster, p => Math\.max\(\.01, xMinutes\(mins,p\)\), 48\)/, "Player minutes should be allocated with a hard 48-minute cap.");
assert.match(fixes, /option value="spg"/, "Team leaders should be sortable by steals.");
assert.match(fixes, /option value="bpg"/, "Team leaders should be sortable by blocks.");
assert.match(html, /const offense = read\(\['finishing', 'threePoint', 'playmaking', 'passing', 'ballHandle'\]\)/, "Team strength should incorporate offensive attributes.");

console.log("OK — playoffs directs, Team Creator, statistiques de saison, rookies automatiques, minutes plafonnées, tri et simulation fondée sur les attributs.");
