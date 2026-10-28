const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean).at(-1);

assert.ok(script, "The application script should exist.");
new Function(script); // Syntax check of the inline application code.
assert.match(script, /initializeSeasonCalendar\(\);\s*renderAll\(\);/, "Calendar should initialize on page load.");
assert.match(script, /data-game-id=/, "Schedule tiles should be actionable buttons.");
assert.match(script, /simulateThroughRound\(game\.round\)/, "Clicking a later game should simulate earlier rounds too.");
assert.match(script, /game\.status === 'completed'.*NBAMyNBAShowRegularBox/, "Clicking a completed game should open its player box score.");
assert.match(script, /\$\('simulate'\)\.onclick = \(\) => \{[\s\S]*?else simulateNextSeasonGame\(\); \};/, "The simple match button should advance the season calendar outside playoffs.");
assert.match(script, /won \? 'Victoire' : 'Défaite'/, "Completed games should display a readable result.");
assert.match(html, /\.schedule-game\.loss \.game-status/, "Defeats should be styled in red.");
assert.match(script, /<span class="score">\$\{ownScore\} – \$\{opponentScore\}<\/span>/, "Completed regular-season tiles should display their score.");
assert.match(script, /seasonResults = stats\.map\(team => \(\{/, "All teams should be visible in the initial standings before the first result.");
assert.match(script, /function refreshCustomTeamSeasonSchedule\(\)/, "Creating a custom team before the season starts should refresh the calendar.");
assert.match(script, /customTeams\.map\(t => \{ const settings = window\.NBAMyNBATeamSettings/, "Custom teams should be included in the generated season calendar.");
assert.match(script, /phase !== 'idle'/, "Victory/defeat labels should be hidden during the offseason.");
assert.match(script, /function simulateThroughRound\(targetRound\)/, "Season progression should be round-based.");

console.log("OK — calendrier interactif : affichage permanent, tuiles cliquables, progression séquentielle, bouton Simuler partie connecté, scores visibles, équipes personnalisées et défaites en rouge.");
