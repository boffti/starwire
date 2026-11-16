# Working on starwire

Notes for coding agents and new contributors. [CONTRIBUTING.md](CONTRIBUTING.md) says what kinds of changes are
welcome; this file says how the repo is put together and what to check before a pull request.

## What is where

| Path | What it is | Edit by hand? |
|---|---|---|
| `docs/index.html`, `docs/how.html`, `docs/css/`, `docs/js/` | The website, [starwire.foo](https://starwire.foo) | Yes |
| `docs/collections.json` | Who each collection is for and what they need | Yes |
| `docs/data/`, `docs/alternatives/`, `docs/open-source/`, the feeds, `sitemap.xml`, `robots.txt` | Written by the daily update | No |
| `README.md`, `lists/`, `data/repos.json`, `assets/` | Written by the daily update | No |
| `data/README.md`, `docs/data/README.md` | Docs for the data files | Yes |
| `newsletter/` | The weekly email's template and builder | Yes |
| `share/` | The badge and share-card service at `r.starwire.foo` | Yes |
| `.github/stamp.mjs` | Versions the site's code at deploy time | Yes |

A pull request that edits a generated file is closed, because the next update overwrites it.

## The site

- **No build step, no packages.** It is plain HTML, CSS and ES modules. Don't add a framework, a bundler or a
  dependency.
- **Run it** with any static server, then open `http://localhost:8000/`:

  ```bash
  python3 -m http.server 8000 --directory docs
  ```

- **Everything in `docs/` is published.** Notes, drafts and screenshots don't belong there.
- **Don't add `?v=` to script or stylesheet links.** The deploy stamps one version onto every reference, so the
  source keeps plain names (`js/app.js`, `from "./repo.js"`).
- **`app.js` owns the URL, saved repos and settings; `repo.js` only draws.** `repo.js` and the modules it imports
  are also run outside a browser to pre-draw pages, so keep `document`, `window` and `localStorage` out of their
  top level.
- **Fields in `docs/data/*.json` are short and can change.** Anything built for other people to use reads
  `data/repos.json`, whose fields are only ever added.

## Pre-drawn pages

Each page under `docs/alternatives/` and `docs/open-source/` is a full copy of the app's page shell with its content
already drawn, written by the daily update. Two things follow:

- A change to `index.html`'s shell reaches those pages only at the next update, so for a day they can be a version
  behind. When `app.js` needs a new element in the shell, it creates the element if the page lacks it.
- CSS and script changes reach them at once. After any such change, open one of each and check the console:
  `http://localhost:8000/alternatives/1password/` and `http://localhost:8000/open-source/3d/`.

## Before a pull request

1. Load the home page, a repo page (`/?page=starship/starship`), one alternatives page and one open-source page.
   The console stays free of errors.
2. Check at phone width (about 390px) as well as desktop. The page must not scroll sideways.
3. Check light and dark. The theme is the moon button in the top bar; colours come from the tokens at the top of
   `style.css`, so use a token instead of a literal colour.
4. Keep it usable by keyboard and screen reader: real buttons and links, a visible focus ring, labels on icon
   buttons.
5. Say in the pull request what you checked and what you didn't.

## Style

- Short code over clever code, and the platform's own features before new code: a `<dialog>`, a `popover`, CSS
  before JavaScript.
- Comments say why, in plain words. Match the file you're in.
- User-facing text is plain and short. No marketing words.

## Things not to do

- Don't hand-edit generated files (see the table).
- Don't add trackers, cookies or third-party scripts. Visits are counted without cookies, and that is a promise the
  site makes.
- Don't add where a repo was picked from. The site shows how many curators picked a repo, never who.
- Don't put keys, tokens or other secrets in the repo, in a workflow log, or in a pull request.
- Don't change `.github/workflows/` to run on `pull_request_target`, and don't give checks on pull requests access
  to secrets.
