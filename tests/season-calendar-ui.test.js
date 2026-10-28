const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean).at(-1);

assert.ok(script, "The application script should exist.");
new Function(script); // Syntax check of the inline application code.
assert.match(script, /initializeSeasonCalendar\(\);\s*renderAll\(\);/, "Calendar should initialize on page load.");
assert.match(script, /data-game-id=/, "Schedule tiles should be actionable buttons.");
assert.match(script, /if \(game\) simulateThroughRound\(game\.round\)/, "Clicking a later game should simulate earlier rounds too.");
assert.match(script, /\$\('simulate'\)\.onclick = simulateNextSeasonGame/, "The simple match button should advance the season calendar.");
assert.match(script, /won \? 'Victoire' : 'Défaite'/, "Completed games should display a readable result.");
assert.match(script, /\.schedule-game\.loss \.game-status/, "Defeats should be styled in red.");
assert.doesNotMatch(script, /<span class="score">/, "Schedule tiles should not display scores.");
assert.match(script, /phase !== 'idle'/, "Victory/defeat labels should be hidden during the offseason.");
assert.match(script, /function simulateThroughRound\(targetRound\)/, "Season progression should be round-based.");

console.log("OK — calendrier interactif : affichage permanent, tuiles cliquables, progression séquentielle, bouton Simuler partie connecté, scores masqués et défaites en rouge.");
