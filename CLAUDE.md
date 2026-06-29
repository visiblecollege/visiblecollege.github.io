# CLAUDE.md — The Visible College website

Working notes for this repo. Read before editing or deploying.

## Deploy & git workflow

The **live site** (thevisiblecollege.org) is served from the **org repo**
`github.com/visiblecollege/visiblecollege.github.io`, default branch **`master`**.
A push to `master` triggers the "Deploy site" GitHub Action → builds Jekyll →
publishes to `gh-pages`.

`AuthentikCraig/visiblecollege.github.io` is a **personal fork**. Pushing to the
fork does **not** update the live site. Deploy by pushing to the org repo, which
is the `upstream` remote:

```bash
cd "/Users/craigwhitton/Documents/Claude/Projects/Visible College Website/visiblecollege.github.io"
git add -A
git commit -m "Your message"
git push upstream master
```

If `upstream` isn't set yet:

```bash
git remote add upstream https://github.com/visiblecollege/visiblecollege.github.io.git
```

Requires write access to the org repo (otherwise open a PR).

## Preview locally before pushing

Jekyll can't render inside Cowork (heavy al-folio plugin deps). Always preview
locally first:

```bash
cd "/Users/craigwhitton/Documents/Claude/Projects/Visible College Website/visiblecollege.github.io"
bundle exec jekyll serve
```

Then open http://127.0.0.1:4000/ (or a specific page like /people/) and check.

## Cowork sandbox git limitation

Cowork's bash sandbox **cannot write `.git` internals** on the mounted folder
(`git clone`/`init`/`commit`/`push` fail with `unable to unlink '.git/...lock'`).
Run all git commands yourself in **VS Code's integrated terminal** (or any local
Mac terminal). Cowork edits the working-tree files; you handle add/commit/push.

If a push fails with `fatal: Unable to create '.git/index.lock': File exists`,
clear the stale lock and retry:

```bash
rm .git/index.lock
```
