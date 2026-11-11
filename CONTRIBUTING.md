# Contributing to starwire

Thanks for helping. Here's how each kind of contribution works.

## Suggest a repo

Use the [submission form](https://github.com/boffti/starwire/issues/new?template=submit-repo.yml). Paste the repo link, pick a category if you like, and say what it does. Your own projects are welcome; tick the box that says you work on it.

Submissions are checked on the next update, usually within two days. The issue gets a reply and is closed with the result. A repo is added when it is public, not archived and has at least 10 stars.

## Please don't edit the list files by hand

`README.md`, everything in `lists/`, `data/`, `assets/badges/`, `assets/banner.svg`, `docs/data/*.json` and `docs/feed.xml` are generated on every update. Edits to them in a pull request would be overwritten, so these pull requests are closed. Use the submission form instead.

## Fix something on the site

The site at [starwire.foo](https://starwire.foo) is plain HTML, CSS and JavaScript in `docs/` (`index.html`, `css/style.css`, `js/app.js`). Pull requests for bugs, accessibility and small improvements are welcome. Open an issue first for anything bigger, so we can agree on it before you spend time.

To try it locally, serve the folder and open it:

```bash
python3 -m http.server 8000 --directory docs
```

## Report a problem

- A wrong category, a broken repo or a description that's off: open an issue with the repo link.
- A security issue: see [SECURITY.md](SECURITY.md).

Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).
