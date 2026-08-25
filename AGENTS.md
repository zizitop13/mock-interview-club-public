# Repository instructions

## Quiz authoring

- Create or edit quiz Markdown files only after reading and following `.agents/skills/create-quiz/SKILL.md`.
- Store every quiz at `quizzes/<topic>/<slug>.md`; use exactly one topic directory, such as `quizzes/java/` or `quizzes/sql/`.
- Never create a deeper hierarchy under `quizzes/`.
- Keep exactly one quiz in each Markdown file and follow the strict format documented by the `create-quiz` skill.
- Use consecutive lowercase answer labels, starting with `a.`.
- Hide exactly one correct answer inside an HTML comment and place the complete explanation inside a collapsed `<details>` section.
- A quiz may contain at most one fenced `plantuml` or `puml` diagram inside `## Question`. It is rendered through the public PlantUML Server and sent before the supporting text and poll.
- New quizzes must have `status: draft`; never change a `published` quiz back to `draft`.
- Treat `published` as a consumed publication attempt, even if Telegram delivery failed. This preserves at-most-once behavior.
- Run `npm run validate` and `npm test` after creating or editing quizzes or publication code.

## Publishing

- Never add Telegram credentials, chat identifiers, or secret values to tracked files.
- Keep Telegram polls anonymous, single-answer, non-revotable, and in their original answer order.
- Preserve the reserve-before-send sequence: commit and push `status: published` before calling Telegram.
- Preserve Telegram publication order for illustrated quizzes: PlantUML image, supporting text/code when present, then poll.
