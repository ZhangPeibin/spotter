# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Comments and conversation history append under a `## Comments` heading

## Publishing and fetching

When a skill says "publish to the issue tracker", create a file under `.scratch/<feature-slug>/`.

When a skill says "fetch the relevant ticket", read the referenced file or issue number.
