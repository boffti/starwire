# Contributing to starwire

Thanks for helping. Here's how each kind of contribution works.

## Suggest a repo

Use the [submission form](https://github.com/boffti/starwire/issues/new?template=submit-repo.yml). Paste the repo link, pick a category if you like, and say what it does. Your own projects are welcome; tick the box that says you work on it.

Submissions are checked on the next update, usually within two days. The issue gets a reply and is closed with the result. A repo is added when it is public, not archived and has at least 10 stars.

## Show that your repo is listed

If your repo is on starwire, its page there has a **Copy badge** button under "Get started". It copies this Markdown, with your repo filled in, for your README:

```markdown
[![starwire](https://r.starwire.foo/owner/repo/badge.svg)](https://starwire.foo/?page=owner/repo&ref=badge)
```

The badge updates itself and shows the best true thing about the repo that day: its rank in its subarea ("#3 in Databases"), "Rising #2 in Databases", "Hidden gem", a strong week ("+38% this week"), its rank among small repos ("#4 under 1k in Databases") or, for everyone else, how early it was found ("Spotted at 47 ★"). The rules are in `share/src/badge.js`.

## Suggest a collection

Collections are short hand-picked sets for one job, like "A better terminal". They live in [`docs/collections.json`](docs/collections.json), which is written by hand, so a pull request is welcome. Each one needs an `id`, a `title`, a one or two sentence `intro`, and five to eight repos that are already on starwire, each with a plain line on why it's in the set. A repo that leaves the list drops out of its collection on its own.

## Please don't edit the list files by hand

`README.md`, everything in `lists/`, `data/`, `assets/badges/`, `assets/banner.svg`, `docs/data/*.json` and `docs/feed.xml` are generated on every update. Edits to them in a pull request would be overwritten, so these pull requests are closed. Use the submission form instead.

## Fix something on the site

The site at [starwire.foo](https://starwire.foo) is plain HTML, CSS and JavaScript in `docs/` (`index.html`, `css/style.css`, `js/app.js`). Pull requests for bugs, accessibility and small improvements are welcome. Open an issue first for anything bigger, so we can agree on it before you spend time.

To try it locally, serve the folder and open it:

```bash
python3 -m http.server 8000 --directory docs
```

## Improve the weekly email

The email's template, its wording and the instruction behind its short notes are in [`newsletter/`](newsletter/README.md).
`node newsletter/newsletter.mjs` builds a preview with no keys or packages. Ideas for sections are welcome as issues first.

## Report a problem

- A wrong category, a broken repo or a description that's off: open an issue with the repo link.
- A security issue: see [SECURITY.md](SECURITY.md).

Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).
