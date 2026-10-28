const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const nav = fs.readFileSync(path.join(root, "src", "mynba-navigation.js"), "utf8");
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");

new Function(inline);
new Function(nav);
assert.match(html, /src="src\/mynba-navigation\.js"/, "The MyNBA navigation script should load.");
assert.match(nav, /position:fixed;inset:0/, "Category screens should occupy the full viewport.");
for (const category of ["View Roster", "View Team", "Team Selection", "Player Creator", "League Leaders", "Load Save", "Save State"]) {
    assert.ok(nav.includes(category), "Missing MyNBA category: " + category);
}
assert.match(nav, /e\.key==="Enter"/, "Enter should open the menu or selected category.");
assert.match(nav, /e\.key==="Backspace"/, "Backspace should navigate back.");
assert.match(nav, /Number\(b\.dataset\.taps\)>=2/, "Mobile categories should require two taps.");
assert.match(nav, /return a\.slice\(0,15\)/, "An active roster must be limited to 15 players.");
assert.match(nav, /data-tendency="shot"/, "Shot tendency should be editable in the roster.");
assert.match(nav, /data-tendency="touch"/, "Touch tendency should be editable in the roster.");
assert.match(html, /players\.filter\(p => window\.NBAMyNBAIsRostered\(p\)\)/, "Season stats should be generated only for active roster players.");
assert.match(html, /window\.NBAMyNBATendency/, "Player tendencies should influence season statistics.");
assert.match(nav, /performanceFactor:"Facteur de performance"/, "Coach performance factor should be adjustable.");
assert.match(nav, /data-plan=/, "Gameplan minutes should be editable.");
for (const stat of ["MIN", "PTS", "FG", "3PT", "FT", "REB", "AST", "STL", "BLK", "TO", "PF", "+/-"]) {
    assert.ok(nav.includes("<th>" + stat + "</th>"), "Missing box-score column: " + stat);
}
assert.match(nav, /Erreur de conversion JSON/, "Invalid JSON should show a conversion error.");
assert.match(nav, /seasonCalendar:seasonCalendar/, "Save files should retain the regular-season calendar.");
assert.match(nav, /confRounds:/, "Save files should retain playoff progress.");
assert.match(nav, /state\.rosterCache=s/, "The active roster list should be cached to reduce simulation work.");
console.log("OK — navigation MyNBA, écrans plein écran, effectifs de 15, tendances, gameplan, box scores et sauvegardes.");
