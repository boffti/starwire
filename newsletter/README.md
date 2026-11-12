# The weekly email

Everything subscribers see from starwire's newsletter is in this folder, and changes are welcome.

- `newsletter.mjs` builds the weekly email: the repo of the week, five trending repos, five new picks, one hidden
  gem and one "instead of" spotlight. It also holds the instruction given to Claude for the short notes.
- `listmonk/static/email-templates/subscriber-optin.html` is the "confirm your subscription" email.
- `listmonk/static/public/templates/message.html` is the page of short messages on list.starwire.foo; after someone
  confirms, it also links to the latest issue.
- `listmonk/public.css` styles the signup and confirmation pages on list.starwire.foo.

## Try a change

You need Node 22 and nothing else. No keys, no packages.

```bash
node newsletter/newsletter.mjs
```

That reads the live data from starwire.foo and writes `newsletter.html`; open it in a browser. Without a Claude key
the notes fall back to each repo's description, which is enough to work on layout. A pull request that touches this
folder gets the same file attached as a build artifact.

Email is not the web: keep to tables and inline styles, no scripts, no web fonts, and check a phone width.

## How it is sent

A scheduled job in a private repo runs `newsletter.mjs` from this repo's `main` with the mailing list's keys, and
creates a draft in [listmonk](https://listmonk.app) that a person reads before sending. The keys are not in this
repo, and nothing here can send email on its own.

Every issue that is sent is also published at [list.starwire.foo/archive](https://list.starwire.foo/archive), with an RSS
feed at `/archive.xml`. That is listmonk's own archive; `newsletter.mjs` only marks each issue for it.
