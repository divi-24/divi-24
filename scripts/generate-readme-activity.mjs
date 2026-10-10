import { readFile, writeFile } from "node:fs/promises";

const snapshot = JSON.parse(await readFile(new URL("../assets/data/coding-profiles.json", import.meta.url), "utf8"));
const github = snapshot.github.data;
const leetcode = snapshot.leetcode.data;
const codeforces = snapshot.codeforces.data;
const codechef = snapshot.codechef.data;
const DAY_MS = 86_400_000;
const END = new Date(snapshot.refreshedAt);
END.setUTCHours(0, 0, 0, 0);
const START = new Date(END.getTime() - 370 * DAY_MS);

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function levelFromCount(count) {
  if (!count) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function heatmap(calendar, colors, deriveLevel = (entry) => entry.level ?? levelFromCount(entry.count)) {
  const byDate = new Map(calendar.map((entry) => [entry.date, deriveLevel(entry)]));
  let cells = "";
  for (let offset = 0; offset < 371; offset += 1) {
    const date = new Date(START.getTime() + offset * DAY_MS);
    const column = Math.floor(offset / 7);
    const row = date.getUTCDay();
    const level = byDate.get(dateKey(date)) ?? 0;
    cells += `<rect x="${column * 10}" y="${row * 10}" width="8" height="8" rx="2" fill="${colors[level]}"/>`;
  }
  return cells;
}

const leetcodeCalendar = Object.entries(leetcode.submissionCalendar ?? {}).map(([timestamp, count]) => ({
  date: dateKey(new Date(Number(timestamp) * 1000)),
  count,
}));
const githubCells = heatmap(github.contributionCalendar ?? [], ["#1f2937", "#064e3b", "#047857", "#10b981", "#6ee7b7"]);
const leetcodeCells = heatmap(leetcodeCalendar, ["#1f2937", "#78350f", "#b45309", "#f59e0b", "#fcd34d"], (entry) => levelFromCount(entry.count));
const totalSolved = leetcode.totalSolved + codeforces.problemsSolved + codechef.totalProblemsSolved;
const refreshed = END.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const cards = [
  ["${totalSolved}", "problems solved", "#f59e0b"],
  ["${github.contributionsLastYear}", "GitHub contributions", "#10b981"],
  ["${github.publicRepositoryCommits}", "public repo commits", "#60a5fa"],
  ["${github.publicRepos}", "public repositories", "#c4b5fd"],
];
const cardMarkup = cards.map(([value, label, color], index) => {
  const x = 36 + index * 294;
  return `<g transform="translate(${x} 90)"><rect width="270" height="106" rx="12" fill="#111827" stroke="#263244"/><rect width="4" height="106" rx="2" fill="${color}"/><text x="22" y="45" fill="#f8fafc" font-size="30" font-weight="700">${value}</text><text x="22" y="74" fill="#94a3b8" font-size="13" letter-spacing="1.1">${label.toUpperCase()}</text></g>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1212" height="620" viewBox="0 0 1212 620" role="img" aria-labelledby="title desc">
<title id="title">Deepak Gupta coding activity dashboard</title>
<desc id="desc">GitHub contribution and LeetCode submission heatmaps with public coding-profile metrics.</desc>
<style>
  text { font-family: Arial, Helvetica, sans-serif; }
  .eyebrow { fill:#60a5fa; font-size:12px; font-weight:700; letter-spacing:2px; }
  .title { fill:#f8fafc; font-size:28px; font-weight:700; }
  .meta { fill:#94a3b8; font-size:12px; }
  .label { fill:#e2e8f0; font-size:17px; font-weight:700; }
  .detail { fill:#94a3b8; font-size:12px; }
</style>
<rect width="1212" height="620" rx="18" fill="#080d18"/>
<rect x="0.5" y="0.5" width="1211" height="619" rx="17.5" fill="none" stroke="#263244"/>
<text x="36" y="40" class="eyebrow">BUILDING IN PUBLIC</text>
<text x="36" y="70" class="title">Coding activity, one honest snapshot.</text>
<text x="1176" y="40" text-anchor="end" class="meta">LAST UPDATED ${refreshed.toUpperCase()}</text>
${cardMarkup}
<g transform="translate(36 250)"><rect width="558" height="302" rx="12" fill="#0d1524" stroke="#263244"/><text x="22" y="34" class="label">GitHub activity</text><text x="22" y="55" class="detail">${github.contributionsLastYear} contributions in the latest year</text><g transform="translate(16 76)">${githubCells}</g><text x="22" y="272" class="detail">Less</text><rect x="58" y="262" width="10" height="10" rx="2" fill="#1f2937"/><rect x="73" y="262" width="10" height="10" rx="2" fill="#064e3b"/><rect x="88" y="262" width="10" height="10" rx="2" fill="#047857"/><rect x="103" y="262" width="10" height="10" rx="2" fill="#10b981"/><rect x="118" y="262" width="10" height="10" rx="2" fill="#6ee7b7"/><text x="138" y="272" class="detail">More</text></g>
<g transform="translate(618 250)"><rect width="558" height="302" rx="12" fill="#0d1524" stroke="#263244"/><text x="22" y="34" class="label">LeetCode activity</text><text x="22" y="55" class="detail">${leetcode.totalSolved} solved: ${leetcode.easySolved} easy, ${leetcode.mediumSolved} medium, ${leetcode.hardSolved} hard</text><g transform="translate(16 76)">${leetcodeCells}</g><text x="22" y="272" class="detail">Less</text><rect x="58" y="262" width="10" height="10" rx="2" fill="#1f2937"/><rect x="73" y="262" width="10" height="10" rx="2" fill="#78350f"/><rect x="88" y="262" width="10" height="10" rx="2" fill="#b45309"/><rect x="103" y="262" width="10" height="10" rx="2" fill="#f59e0b"/><rect x="118" y="262" width="10" height="10" rx="2" fill="#fcd34d"/><text x="138" y="272" class="detail">More</text></g>
<text x="36" y="588" class="detail">CODECHEF ${codechef.currentRating} (PEAK ${codechef.highestRating})</text><text x="370" y="588" class="detail">CODEFORCES ${codeforces.problemsSolved} SOLVED</text><text x="1176" y="588" text-anchor="end" class="detail">github.com/divi-24</text>
</svg>`;

await writeFile(new URL("../assets/coding-dashboard.svg", import.meta.url), svg);
console.log("Generated assets/coding-dashboard.svg");
