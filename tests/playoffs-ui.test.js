const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].map(match => match[1]).filter(Boolean);
const script = scripts.at(-1);

assert.ok(script, "The application script should exist.");
new Function(script); // Syntax check.
assert.match(html, /\.schedule-game\.loss \.game-status[^}]*color:#ff4545/, "Defeats should be red.");
assert.match(html, /\.schedule-game\.win \.game-status[^}]*color:#39d98a/, "Victories should be green.");
assert.match(script, /\$\{ownScore\} – \$\{opponentScore\}/, "Regular-season tiles should display the score.");
assert.match(script, /\$\('playoffsSection'\)\.hidden = !regularSeasonComplete && phase !== 'playoffs'/, "Playoffs should remain hidden until the regular season ends.");
assert.match(script, /view\.hidden = phase === 'playoffs'/, "The 82-game regular-season calendar should be hidden during playoffs.");
assert.match(script, /function renderSeasonAwardsPreview\(\)/, "Season awards should be revealed after the 82-game schedule.");
assert.match(script, /function initializePlayoffs\(\)/, "Starting playoffs should initialize the bracket rather than simulating everything immediately.");
assert.match(script, /function simulateOnePlayoffGame\(gameId\)/, "A selected playoff game should be simulated individually.");
assert.match(script, /function simulateCurrentPlayoffRound\(\)/, "The current round should be simulatable as a group.");
assert.match(script, /function simulatePlayoffsToConferenceFinals\(\)/, "Simulate Playoffs should advance through the conference finals.");
assert.match(script, /if \(!west \|\| !east \|\| !west\.series\.every\(s => s\.winner\) \|\| !east\.series\.every\(s => s\.winner\)\) return;/, "A later round must wait until every series in both conferences is complete.");
assert.match(script, /renderConferenceBracket\('West'\)/, "The West bracket should be rendered.");
assert.match(script, /renderConferenceBracket\('East'\)/, "The East bracket should be rendered.");
assert.match(script, /MVP DES FINALES/, "The NBA Finals MVP screen should be displayed after the Finals.");
assert.match(script, /!playoffs \|\| !playoffs\.champion/, "The offseason should be blocked until the NBA champion is determined.");

console.log("OK — tests statiques UI : couleurs, scores, masquage, trophées et progression des playoffs.");
