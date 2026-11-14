# The site's data files

These files are what [starwire.foo](https://starwire.foo) loads to draw its pages. They are generated every night and
overwritten, so a change made here by hand is lost at the next run.

**Building something on starwire's data? Use [`data/repos.json`](../../data/repos.json) instead.** Its fields are only
ever added, never renamed or removed. The files in this folder are the site's own: their short field names and shapes
can change without notice.

| File | Loaded | Holds |
|---|---|---|
| `data.json` | On every page | Every listed repo with its labels, stars and trend numbers, plus the label vocabulary |
| `vitals.json` | On a repo page | Vital signs per repo: commits, releases, issue handling |
| `fit.json` | On an alternatives page or a repo that replaces a product | How well each repo replaces a paid product |
| `mentions.json` | On a repo page and the home page | Hacker News and Reddit posts that link to a repo |
| `art.json` | By the share-card service | The picture each repo's share card uses |

## data.json

```json
{
  "updated": "2026-11-13T23:59:59Z",
  "taxonomy": { "areas": [], "forms": [], "platforms": [], "worksWith": [] },
  "repos": []
}
```

`taxonomy` turns label ids into display names. `forms`, `platforms` and `worksWith` are lists of `[id, name]`, such as
`["macos", "macOS"]`. Each entry of `areas` is `{ "id", "name", "subs" }`, where `subs` lists that area's sub-areas as
`[id, name]`.

### One repo

Field names are one or two letters because every visitor downloads this file.

```json
{
  "r": "owner/name",
  "c": "AI agents",
  "a": "ai", "sa": "agents", "ai": 2,
  "fo": ["reference"], "tg": ["agents"],
  "l": "One-line summary of what it is",
  "s": 23033, "fk": 2804,
  "g": "TypeScript", "gc": "#3178c6", "li": "MIT",
  "t": [],
  "p": "2026-11-03T09:29:14Z", "ca": "2026-10-31", "f": "2026-11-10",
  "k": 1,
  "w": 7135, "wt": "~+7.1k a week", "h": 46.911, "hy": 61.344,
  "hs": [["2026-11-13", 22963], ["2026-11-14", 23033]],
  "sp": 22308,
  "oi": 148330874
}
```

| Field | Meaning | Present |
|---|---|---|
| `r` | Owner and name | Always |
| `l` | One-line summary | Always |
| `c` | Category used in the README lists | Always |
| `a`, `sa` | Area and sub-area | Always |
| `mo` | Other areas it also belongs to, as `area/subarea` | When it has any |
| `ai` | How central AI is: 0 none, 1 AI-powered, 2 AI is the point | Always |
| `fo` | Kinds: desktop app, library, command-line tool and so on | Always |
| `pl` | Platforms it runs on | When known |
| `ww` | Tools it works with | When it has any |
| `tg` | Tags | When it has any |
| `alt` | Paid products it can replace | When it has any |
| `s`, `fk` | Stars and forks | Always |
| `g`, `gc` | Main language and that language's colour; `null` when GitHub reports none | Always |
| `li` | License; `null` when GitHub finds none | Always |
| `t` | Up to five GitHub topics | Always |
| `p` | Last push | Always |
| `ca` | Date the repo was created | Always |
| `f` | Date starwire first listed it | Always |
| `k` | How many separate curators picked it | Always |
| `w`, `wt` | Stars gained this week, as a number and as display text | Always |
| `h` | Today's trending score; 0 means not trending | Always |
| `hy` | Yesterday's trending score, for the rank arrows | When it was trending |
| `hs` | Star count per day as `[date, stars]`, at most the last 30 days | Always |
| `sp` | Stars on the day it was first listed | Always |
| `hp` | Homepage link | When it has one |
| `ho` | Has a hosted version: `f` with a free plan, `p` paid only, `y` yes | When it has one |
| `oi` | The owner's GitHub account number | Always |

Lists that would be empty are left out, which is why several fields appear only on some repos. The ids in `a`, `sa`,
`mo`, `fo`, `pl` and `ww` are looked up in `taxonomy`.

## vitals.json

An object keyed by `owner/name`.

```json
{ "release": ["v2.0.5", "2026-09-30"], "guide": true, "gfi": 0, "weeks": [15, 15, 114, 39, 11, 90, 4, 9, 9, 25, 11, 8], "opened": 16, "closed": 20 }
```

| Field | Meaning |
|---|---|
| `weeks` | Commits per week on the default branch for the last 12 weeks, oldest first |
| `release` | Latest release as `[tag, date]`; `null` when the repo has none |
| `opened`, `closed` | Issues opened and closed in the last 90 days |
| `gfi` | Open issues labelled as good first issues |
| `guide` | Whether the repo has a contributing guide |

## fit.json

```json
{
  "products": { "notion": { "name": "Notion", "about": "What the product is", "jobs": [["Pages and docs with rich blocks", 2]] } },
  "pairs": { "notion": { "owner/name": [0.91, "drop-in", "yyyyyyny", ["a quote from the README per job"]] } }
}
```

- `products`: each paid product's checklist. A job is `[what the product does, weight]`; weight 2 marks a core job.
- `pairs`: for each product, each repo that can replace it, as `[score from 0 to 1, verdict, one letter per job, the
  README quote behind each letter]`. The verdict is `drop-in`, `part` or `different`. The letters are `y` covers it,
  `p` partly, `n` no.

## mentions.json

```json
{
  "updated": "2026-11-14T21:08:34.708Z",
  "repos": { "owner/name": [{ "s": "hn", "t": "Post title", "u": "https://news.ycombinator.com/item?id=1", "p": 987, "c": 120, "d": "2026-11-12" }] }
}
```

| Field | Meaning |
|---|---|
| `s` | Site: `hn` for Hacker News, `reddit` for Reddit |
| `t` | The post's title, as its author wrote it |
| `u` | Link to the discussion |
| `p`, `c` | Points and comments when the post was last checked |
| `d` | Date posted |
| `in` | The subreddit, on Reddit posts |

A repo appears only when a post links to that repo itself. Each site contributes its three most upvoted posts with at
least 3 points; a repo's list is sorted by points.

## art.json

An object keyed by `owner/name`. Each value is `[kind, url]`: `og` is the social preview the owner uploaded, `readme`
is the first real image in the README. A repo with neither is left out and its card uses the owner's avatar.
