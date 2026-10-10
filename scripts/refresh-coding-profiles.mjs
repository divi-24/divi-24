import { writeFile } from "node:fs/promises";

const profiles = {
  github: { username: "divi-24", url: "https://github.com/divi-24" },
  leetcode: { username: "divi_2405", url: "https://leetcode.com/u/divi_2405/" },
  codeforces: { username: "Divi-2405", url: "https://codeforces.com/profile/Divi-2405" },
  codechef: { username: "divi_2405", url: "https://www.codechef.com/users/divi_2405" },
};

async function request(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), ...options });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

async function getJson(url, options) {
  return (await request(url, options)).json();
}

async function fetchGithub() {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  const user = await getJson(`https://api.github.com/users/${profiles.github.username}`, { headers });
  const repos = [];
  for (let page = 1; ; page += 1) {
    const batch = await getJson(`https://api.github.com/users/${profiles.github.username}/repos?per_page=100&page=${page}&type=owner&sort=updated`, { headers });
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  let contributionsLastYear = null;
  let contributionCalendar = [];
  let publicRepositoryCommits = 0;
  let commitCountComplete = true;
  for (const repo of repos.filter((item) => !item.fork)) {
    try {
      const response = await request(`${repo.url}/commits?author=${encodeURIComponent(profiles.github.username)}&per_page=1`, { headers });
      const commits = await response.json();
      const lastPage = response.headers.get("link")?.match(/[?&]page=(\d+)>; rel="last"/)?.[1];
      publicRepositoryCommits += lastPage ? Number(lastPage) : commits.length;
    } catch {
      commitCountComplete = false;
    }
  }
  try {
    const activity = await getJson(`https://github-contributions-api.jogruber.de/v4/${profiles.github.username}?y=last`);
    contributionsLastYear = activity.total?.lastYear ?? null;
    contributionCalendar = activity.contributions ?? [];
  } catch {}
  return {
    username: profiles.github.username,
    url: profiles.github.url,
    publicRepos: user.public_repos ?? 0,
    followers: user.followers ?? 0,
    following: user.following ?? 0,
    totalStars: repos.reduce((total, repo) => total + (repo.stargazers_count || 0), 0),
    totalForks: repos.reduce((total, repo) => total + (repo.forks_count || 0), 0),
    publicRepositoryCommits: commitCountComplete ? publicRepositoryCommits : null,
    commitCountComplete,
    commitCountScope: "Public commits authored in owned repositories",
    contributionsLastYear,
    contributionCalendar,
  };
}

async function fetchLeetcode() {
  const query = `query userProfile($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal { acSubmissionNum { difficulty count } }
      profile { ranking }
      userCalendar { submissionCalendar }
    }
    userContestRanking(username: $username) { rating attendedContestsCount }
  }`;
  const payload = await getJson("https://leetcode.com/graphql/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { username: profiles.leetcode.username } }),
  });
  const user = payload.data?.matchedUser;
  if (!user) throw new Error("LeetCode user was not found");
  const submissions = user.submitStatsGlobal?.acSubmissionNum ?? [];
  const solved = (difficulty) => submissions.find((item) => item.difficulty === difficulty)?.count ?? 0;
  return {
    username: profiles.leetcode.username,
    url: profiles.leetcode.url,
    totalSolved: solved("All"),
    easySolved: solved("Easy"),
    mediumSolved: solved("Medium"),
    hardSolved: solved("Hard"),
    ranking: user.profile?.ranking ?? null,
    contestRating: Math.round(payload.data?.userContestRanking?.rating ?? 0),
    contestsAttended: payload.data?.userContestRanking?.attendedContestsCount ?? 0,
    submissionCalendar: JSON.parse(user.userCalendar?.submissionCalendar ?? "{}"),
  };
}

async function fetchCodeforces() {
  const [userResponse, submissionsResponse] = await Promise.all([
    getJson(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(profiles.codeforces.username)}`),
    getJson(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(profiles.codeforces.username)}&from=1&count=10000`),
  ]);
  const user = userResponse.result?.[0];
  if (!user) throw new Error("Codeforces user was not found");
  const solved = new Set();
  const hardSolved = new Set();
  for (const submission of submissionsResponse.result ?? []) {
    if (submission.verdict !== "OK") continue;
    const key = `${submission.problem?.contestId}-${submission.problem?.index}`;
    solved.add(key);
    if ((submission.problem?.rating ?? 0) >= 1600) hardSolved.add(key);
  }
  return {
    username: profiles.codeforces.username,
    url: profiles.codeforces.url,
    rating: user.rating ?? 0,
    maxRating: user.maxRating ?? 0,
    rank: user.rank ?? "unrated",
    maxRank: user.maxRank ?? "unrated",
    problemsSolved: solved.size,
    hardProblemsSolved: hardSolved.size,
  };
}

async function fetchCodechef() {
  const response = await request(`https://www.codechef.com/users/${encodeURIComponent(profiles.codechef.username)}`, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  const html = await response.text();
  const totalProblemsSolved = Number(html.match(/Total Problems Solved:\s*(\d+)/)?.[1] ?? 0);
  const currentRating = Number(html.match(/rating-container[\s\S]{0,300}?class=['"]rating['"][^>]*>(\d+)/)?.[1] ?? 0);
  const stars = (html.match(/rating-star[^>]*>[^<]*(★+)/)?.[1]?.length ?? 0);
  const ratings = [...html.matchAll(/"rating"\s*:\s*"?(\d+)"?/g)].map((match) => Number(match[1]));
  return {
    username: profiles.codechef.username,
    url: profiles.codechef.url,
    currentRating,
    highestRating: Math.max(currentRating, ...ratings, 0),
    stars,
    totalProblemsSolved,
  };
}

async function capture(label, task) {
  try {
    return { data: await task(), error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

const [github, leetcode, codeforces, codechef] = await Promise.all([
  capture("github", fetchGithub),
  capture("leetcode", fetchLeetcode),
  capture("codeforces", fetchCodeforces),
  capture("codechef", fetchCodechef),
]);

const snapshot = {
  refreshedAt: new Date().toISOString(),
  profiles,
  github,
  leetcode,
  codeforces,
  codechef,
};

await writeFile(
  new URL("../assets/data/coding-profiles.json", import.meta.url),
  `${JSON.stringify(snapshot, null, 2)}\n`,
);
