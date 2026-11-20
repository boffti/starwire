# starwire's public data

`repos.json` is every repo on [starwire.foo](https://starwire.foo), as one JSON array with an entry per repo. It is
rebuilt once a day.

- **Free to use.** The list and its data are [CC0](../LICENSE): no key, no sign-up, no credit needed.
- **Stable.** Fields are only ever added. None will be renamed or removed, so what you build on it keeps working.
- **Fetch it from anywhere,** a web page included, since GitHub serves it to any site:

```
https://raw.githubusercontent.com/boffti/starwire/main/data/repos.json
```

```bash
curl -s https://raw.githubusercontent.com/boffti/starwire/main/data/repos.json | jq '[.[] | select(.trending)] | length'
```

```js
const repos = await fetch("https://raw.githubusercontent.com/boffti/starwire/main/data/repos.json").then((r) => r.json())
const rust = repos.filter((r) => r.language === "Rust").sort((a, b) => b.starsThisWeek - a.starsThisWeek)
```

## One entry

```json
{
  "repo": "owner/name",
  "id": 1098765432,
  "ownerId": 12345678,
  "url": "https://github.com/owner/name",
  "page": "https://starwire.foo/?page=owner/name",
  "line": "Our one-line summary of what it is",
  "description": "The repo's own description",
  "area": "ai",
  "subarea": "agents",
  "category": "AI agents",
  "forms": ["reference"],
  "platforms": [],
  "worksWith": [],
  "tags": ["agents"],
  "alternativeTo": [],
  "stars": 23033,
  "forks": 2804,
  "language": "TypeScript",
  "license": "MIT",
  "topics": [],
  "homepage": null,
  "createdAt": "2026-10-31T09:32:46Z",
  "pushedAt": "2026-11-03T09:29:14Z",
  "firstSeen": "2026-11-10",
  "picks": 1,
  "starsThisWeek": 7135,
  "trending": true,
  "starsWhenPicked": 22308
}
```

Every entry has every field. A list with nothing in it is `[]`, and a fact that is missing is `null`.

## Fields

| Field | What it holds |
|---|---|
| `repo`, `url`, `page` | The `owner/name`, its GitHub address and its page on starwire |
| `id` | GitHub's own number for the repo (`id` in its REST API, `databaseId` in GraphQL). It stays the same when a repo is renamed or moved, so key on it instead of the name |
| `ownerId` | GitHub's number for the owner, or `null`. The owner's picture is at `https://avatars.githubusercontent.com/u/<ownerId>` |
| `line` | Our one-line summary |
| `description` | The repo's own description, or `null` when it has none |
| `area`, `subarea` | Where it sits in the list, as ids such as `ai` and `agents` |
| `category` | The heading it appears under in the [Markdown lists](../lists) |
| `forms` | What kind of thing it is: desktop app, library, command-line tool and so on |
| `platforms` | Where it runs |
| `worksWith` | Tools it plugs into |
| `tags` | Its themes |
| `alternativeTo` | Paid products it can stand in for |
| `stars`, `forks` | Counts from GitHub, measured once a day |
| `language` | Main language, or `null` when GitHub reports none |
| `license` | An SPDX id, `Other` for a custom license, or `null` for none |
| `topics` | The repo's GitHub topics |
| `homepage` | The repo's website, or `null` |
| `createdAt`, `pushedAt` | When the repo was created and last pushed to |
| `firstSeen` | The day it was first picked for starwire |
| `picks` | How many separate curators have picked it |
| `starsThisWeek` | Stars gained in the last 7 days as we measured them, or `null` when it hasn't been tracked long enough |
| `trending` | Whether it is on the Trending list |
| `starsWhenPicked` | Stars it had on the `firstSeen` day, or `null` when we couldn't measure it |

## What else is published

Feeds, badges and share cards are listed under [Use the data](https://starwire.foo/how.html#data).

The files the website itself loads are in [`docs/data/`](../docs/data). They use short field names and can change
shape without notice, so build on `repos.json` instead.
