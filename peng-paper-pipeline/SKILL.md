---
name: peng-paper-pipeline
description: Orchestrate an academic manuscript from scoping to a pandoc-built DOCX and pre-submission checks — freeze data inputs, search literature, verify citations, plan figures, write sections, build with gates, then hand off to submission-review skills. Use when writing or revising a research article, literature review, survey, or manuscript (论文、综述、撰稿、投稿、manuscript), especially when a pandoc docx build or reference-doc styling is involved.
---

# Peng Paper Pipeline

Orchestration skill for taking an academic paper from an idea to a submission-ready
manuscript. It does **not** reimplement the domain skills; it calls them in the right
order and guards the hand-offs with a small build gate.

Call the installed skills when available:

| Stage | Skill |
|-------|-------|
| scoping / angle | `$brainstorming` |
| literature search | `$awescholar`, `$paper-lookup` |
| citation verification | `$citation-management`, `$nature-ref-verifier` |
| writing | `$literature-review`, `$nature-writing`, `$scientific-writing`, `$manuscript-optimizer` |
| figures & tables | `$figure-planner`, `$nature-figure` |
| typesetting | `$docx` |
| pre-submission | `$submission-audit`, `$nature-reviewer` |

If a skill is not installed, do that step by hand and say so in the status report.

## Input Contract

Accept at least:

- a project directory (created if missing)
- paper type: `review` (survey/census) or `research` article
- optional data sources to freeze (registry snapshot, dataset files)
- optional reference `.docx` for pandoc styling

If the project directory is not given, ask before creating anything.

## Project Layout

```text
<project>/
├── outline.md            # frozen story: taxonomy, chapters, writing principles
├── sections/             # 00-abstract.md, 01-introduction.md, ... NN-methods.md
├── figures/              # fig*.png + legends.md
├── tables/               # table data (csv) used by sections
├── data/                 # frozen inputs + freeze-manifest.json
├── references.bib        # only verified entries
└── manuscript.docx       # generated, never hand-edited as source of truth
```

## Workflow

### Step 1: Scope

Use `$brainstorming` to fix the paper's angle (which corpus, which taxonomy, what
claim). Record decisions in `outline.md` before writing any section. One claim per
figure and per section heading; numbers follow from accepted computations only.

### Step 2: Freeze Data Inputs

Before any statistic:

```bash
cp <source> data/<name>.json
sha256sum data/<name>.json   # record in data/freeze-manifest.json
```

All later computation reads only the frozen copies. Note the freeze time and the
source's own collection time separately.

### Step 3: Literature and Citations

- Search with `$awescholar` / `$paper-lookup`; keep a query log with dates and links.
- Verify every DOI through more than one source before adding it to
  `references.bib`. Multi-source disagreement or a missing DOI means the entry
  stays blocked, not guessed.
- Distinguish "verified against full text" from "verified against metadata".

### Step 4: Figures and Tables

Use `$figure-planner`: one claim per figure, panel purpose, data source, denominators,
and unknowns — caption-level conclusions first, rendered figures after. Final images
land in `figures/`; every figure caption in `sections/` is synced from
`figures/legends.md` (the legend file is the single authority).

### Step 5: Write Sections

- One file per section, zero-padded filenames (`00-abstract.md`, `01-introduction.md`);
  `sections/*.md` is globbed in filename order, so never rename mid-run.
- Image paths in sections are resolved by pandoc against the working directory (the
  project root), not the section file: write `![...](figures/fig1-overview.png)`.
- Every number comes from an accepted computation or table; unknowns are stated as
  unknown, never coerced to zero.
- Write the abstract and introduction last.
- Run `$manuscript-optimizer` before calling a draft complete.

### Step 6: Build

```bash
pandoc sections/*.md --citeproc --bibliography=references.bib -o manuscript.docx
```

Build through the gate script instead of running pandoc bare:

```bash
python3 scripts/build_docx.py --project <project>
```

It runs the build, then checks the output DOCX. Exit `0` = build candidate accepted,
non-zero = do not treat the DOCX as final. Checks: valid OOXML package, no unresolved
`[@key]` citations, every referenced local image exists and is embedded, title and
section headings present, bibliography non-empty when sources cite.

**Reference-doc gotcha:** any `.docx` works as `--reference-doc` (pandoc only reads
its styles), but pandoc keeps the reference file's embedded media — a paper-sized
reference doc drags megabytes of dead images into every output. Strip the body first
(open in Word, delete all content, keep styles, save) or generate a clean one:

```bash
pandoc --print-default-data-file reference.docx > reference.docx
```

## Assets

### English SCI template

`templates/template_sci_en.docx` — English variant of the sci template: Times New
Roman body (double-spaced, no first-line indent), Arial bold headings, plus front
matter styles (`Author`, `Affiliation`, `Correspondence`). Derived from
`template_sci论文-标题不编号.docx`; the QE proposal was built on the same base.

`templates/scaffold_en.md` — front matter boilerplate matching journal manuscript
layout (title → Title style; authors with `^1,2^` superscripts → Author; numbered
"Affiliations of authors:" → Affiliation; "Correspondence:" line). Start a paper
from this file; the placeholder text is meant to be finished in Word or in the
section files.

```bash
pandoc scaffold_en.md --reference-doc template_sci_en.docx -o paper.docx
```

### Optional: live Zotero citations

`filters/pandoc-zotero-live-citemarkers-bundled.lua` converts `[@key]` citations
into real Zotero Word fields (`ADDIN ZOTERO_ITEM`) so citations stay refreshable
in Word. Requires Zotero running locally with Better BibTeX — the filter crashes
the build otherwise, so add it only when that is true:

```bash
pandoc ... --lua-filter filters/pandoc-zotero-live-citemarkers-bundled.lua -o paper.docx
```

### Step 7: Pre-submission

- Refine layout with `$docx` (page size, fonts, heading numbering) — layout only, no
  content edits without re-running the build gate.
- Run `$submission-audit` for claim support, figure/table sync, and terminology.
- Run `$nature-reviewer` for simulated peer review; record reviewer concerns and
  responses before submission.
- Report status honestly: separate "done and verified" from "needs author input" and
  "not done". A batch of green gates is not user review.

## Safety Rules

- Never fabricate metadata, DOIs, citations, statistics, or evaluation results.
- Statistics read only frozen copies; external verification never rewrites frozen
  counts silently — record differences instead.
- Do not record "user reviewed" unless the user actually reviewed.
- Never git commit or push unless explicitly asked.
- The manuscript body language follows the outline's decision (default: English body,
  Chinese working notes); keep both consistent within one project.
