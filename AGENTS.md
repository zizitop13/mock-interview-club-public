# Repository instructions

## Quiz authoring

- Create or edit quiz Markdown files only after reading and following `.agents/skills/create-quiz/SKILL.md`.
- Store every quiz at `quizzes/<topic>/<slug>.md`; use exactly one topic directory, such as `quizzes/java/` or `quizzes/sql/`.
- Never create a deeper hierarchy under `quizzes/`.
- Keep exactly one quiz in each Markdown file and follow the strict format documented by the `create-quiz` skill.
- Every `quizzes/<topic>/<slug>.md` quiz must have a companion `quizzes/<topic>/<slug>-explain.md`; create or update both files together through the `create-quiz` skill.
- Reserve the `-explain.md` suffix for companion documents; never use it for a quiz filename.
- Use consecutive lowercase answer labels, starting with `a.`.
- Hide exactly one correct answer inside an HTML comment and place a concise Telegram-ready explanation inside a collapsed `<details>` section.
- The companion explanation must contain the correct answer, a thorough explanation, a fenced code example, explanations of every incorrect option, and an optional PlantUML diagram when helpful.
- A quiz may contain at most one fenced `plantuml` or `puml` diagram inside `## Question`. It is rendered through the public PlantUML Server and sent before the supporting text and poll.
- New quizzes must have `status: draft`; never change a `published` quiz back to `draft`.
- Treat `published` as a consumed publication attempt, even if Telegram delivery failed. This preserves at-most-once behavior.
- Run `npm run validate` and `npm test` after creating or editing quizzes or publication code.
- GitHub Pages content and navigation are generated from `quizzes/<topic>/`; never maintain a second hand-written quiz index.

## Publishing

- Never add Telegram credentials, chat identifiers, or secret values to tracked files.
- Keep Telegram polls anonymous, single-answer, non-revotable, and in their original answer order.
- Preserve the reserve-before-send sequence: commit and push `status: published` before calling Telegram.
- Preserve Telegram publication order for illustrated quizzes: PlantUML image, supporting text/code when present, then poll.
- Never publish `-explain.md` companion documents as Telegram polls.
- Include the generated GitHub Pages URL for the matching `-explain.md` page in every Telegram quiz explanation.

## GitHub Pages

- Keep reusable layouts and assets in `site/`; generated files belong in `.site-source/` and must not be committed.
- Preserve stable page URLs: `/quizzes/<topic>/<slug>/` and `/quizzes/<topic>/<slug>-explain/`.
- Render fenced `plantuml` and `puml` blocks through the public PlantUML Server. Never put secrets or private data in diagrams.
- Run `npm run build:site` after changing the generator, layouts, assets, or quiz content.

## Lab authoring

- Store labs at `labs/<track>/<slug>.md`, where `<track>` is currently `coding` or `design`; never nest labs more deeply.
- Structure each lab as ordered `## Stage N: ...` sections and include a stage navigation block near the top with anchors to every stage.
- Add previous/next links between stages so a reader can move through the task without returning to the sidebar.
- Use fenced code examples and fenced `plantuml` or `puml` diagrams where appropriate; never include secrets or private data.
- Labs are website content only and must not be processed by the Telegram quiz publisher.
- Run `npm test` and `npm run build:site` after adding or editing labs.
