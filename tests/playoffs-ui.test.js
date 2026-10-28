const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scriptStart = html.lastIndexOf("<script>") + "<script>".length;
const scriptEnd = html.indexOf("</script>", scriptStart);
const script = html.slice(scriptStart, scriptEnd);

assert.ok(script && scriptEnd > scriptStart, "The application script should exist.");
new Function(script); // Syntax check.
assert.match(html, /\.schedule-game\.loss \.game-status[^}]*color:#ff4545/, "Defeats should be red.");
assert.match(html, /\.schedule-game\.win \.game-status[^}]*color:#39d98a/, "Victories should be green.");
assert.match(script, /\$\{ownScore\} – \$\{opponentScore\}/, "Regular-season tiles should display the score.");
assert.match(script, /\$\('playoffsSection'\)\.hidden = phase !== 'playoffs'/, "The playoff bracket should only appear after entering the playoffs.");
assert.match(script, /\$\('seasonAwardsScreen'\)\.hidden = !waitingForAwardsContinue/, "The season awards transition screen should appear when all 82 games are complete.");
assert.match(script, /event\.key !== 'Enter'/, "Enter should open the playoffs from the awards screen.");
assert.match(script, /id="enterPlayoffs"/, "A touch-friendly button should allow mobile users to enter the playoffs.");
assert.match(script, /\$\('seasonSection'\)\.hidden = waitingForAwardsContinue \|\| phase === 'playoffs'/, "The regular-season section should be hidden for awards and playoffs.");
assert.match(script, /view\.hidden = phase === 'playoffs'/, "The 82-game regular-season calendar should be hidden during playoffs.");
assert.match(script, /function renderSeasonAwardsPreview\(\)/, "Season awards should be revealed after the 82-game schedule.");
assert.match(script, /function initializePlayoffs\(\)/, "Starting playoffs should initialize the bracket rather than simulating everything immediately.");
assert.match(script, /function simulateOnePlayoffGame\(gameId\)/, "Clicking an unplayed playoff game should simulate that game.");
assert.match(script, /function showPlayoffBoxScore\(\)/, "Played games should have a box-score view.");
assert.match(script, /id="viewPlayoffBoxScore"/, "The box-score button should be present.");
assert.doesNotMatch(html, /id="simulatePlayoffGame"|id="simulatePlayoffRound"|id="simulatePlayoffs"/, "The old playoff simulation buttons should be removed.");
assert.match(script, /if \(found && found\.game\.completed\)/, "A completed playoff game should be selectable for its box score.");
assert.match(script, /Partie jouée · Box score/, "Playoff tiles should no longer display every game score.");
assert.match(script, /if \(!west \|\| !east \|\| !west\.series\.every\(s => s\.winner\) \|\| !east\.series\.every\(s => s\.winner\)\) return;/, "A later round must wait until every series in both conferences is complete.");
assert.match(script, /renderConferenceBracket\('West'\)/, "The West bracket should be rendered.");
assert.match(script, /renderConferenceBracket\('East'\)/, "The East bracket should be rendered.");
assert.match(script, /MVP DES FINALES/, "The NBA Finals MVP screen should be displayed after the Finals.");
assert.match(script, /!playoffs \|\| !playoffs\.champion/, "The offseason should be blocked until the NBA champion is determined.");

console.log("OK — tests statiques UI : couleurs, transition de fin de saison, navigation playoffs et box scores.");
