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
const presentation = fs.readFileSync(path.join(__dirname, "..", "src", "season-presentation.js"), "utf8");
new Function(presentation); // Syntax check for fullscreen presentation.
assert.match(script, /function ensureNextPlayoffRound\(\)/, "Playoff round transitions should be explicit.");
assert.match(script, /const seriesCount = west\.series\.length/, "Round transitions should validate the number of series before pairing winners.");
assert.match(script, /seriesCount === 4/, "The first round should pair four series winners into two semifinals.");
assert.match(script, /seriesCount === 2/, "The conference semifinals should pair their two winners into the conference finals.");
assert.match(script, /seriesCount === 1/, "The conference finals should produce the NBA Finals.");
assert.match(script, /renderConferenceBracket\('West'\)/, "The West bracket should be rendered.");
assert.match(script, /renderConferenceBracket\('East'\)/, "The East bracket should be rendered.");
assert.match(script, /Bilan de la série/, "Each playoff matchup should show its aggregate series score.");
assert.doesNotMatch(script, /Partie jouée · Box score/, "The bracket should not list every game as a separate tile.");
assert.match(presentation, /series-scoreline/, "The playoff layout should fit a full-width bracket.");
assert.match(presentation, /while\(playoffs&&!playoffs\.champion&&guard\+\+<500\)/, "Simulate playoffs should advance safely until a champion is decided.");
assert.match(presentation, /function showFinalsMvp\(\)/, "The Finals MVP screen should appear after the champion confirmation.");
assert.doesNotMatch(presentation, /Aucune récompense disponible\./, "The season awards screen should recover awards if the preview cards are missing.");
assert.match(script, /if \(!playoffs \|\| !playoffs\.champion/, "The offseason should be blocked until the NBA champion is determined.");

console.log("OK — playoffs : transitions sécurisées, scores cumulés des séries, tableau responsive et écrans de récompenses.");
