# Mock Interview Club

Technical interview quizzes are stored as strict Markdown files and published automatically to Telegram.

## Add a quiz

Use the repository-local `create-quiz` skill at `.agents/skills/create-quiz/SKILL.md`. Each quiz belongs at `quizzes/<topic>/<slug>.md`, for example `quizzes/java/read-write-lock-downgrade.md` or `quizzes/sql/skip-locked.md`. Deeper topic hierarchies are not supported.

Every quiz file contains an `id`, a publication `status`, a question, consecutively lettered answers, one hidden correct-answer comment, and a short Telegram-ready explanation inside a collapsed `<details>` block. A question may also contain one fenced `plantuml` or `puml` diagram.

Every quiz also requires a companion file with the same name and the `-explain.md` suffix, for example:

```text
quizzes/java/read-write-lock-downgrade.md
quizzes/java/read-write-lock-downgrade-explain.md
```

The companion contains the correct answer, a thorough explanation, at least one fenced code example, and an explanation of every incorrect option. Add a PlantUML diagram when it clarifies the behavior. Companion files are study material and are never published as Telegram polls.

```bash
npm run validate
npm test
```

No npm dependencies are required. Node.js 20 or newer is sufficient.

## Quiz library website

GitHub Pages publishes the quiz library at <https://zizitop13.github.io/mock-interview-club-public/>. The site generator discovers `quizzes/<topic>/*.md`, creates topic-based navigation, and gives every quiz and detailed explanation a stable page. Fenced `plantuml` and `puml` blocks are rendered as SVG images through the public PlantUML Server.

Build the source locally with:

```bash
npm run build:site
```

The generated `.site-source/` directory is disposable and ignored by Git. Edit the Markdown under `quizzes/`, the generator in `scripts/build-site.js`, or the reusable layout and assets under `site/`. The `Deploy quiz library to GitHub Pages` workflow validates, tests, builds, and deploys the site whenever relevant files change on `main`.

Before the first deployment, select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**.

## Configure Telegram publication

Create a Telegram bot, add it to the target group or channel with permission to publish, and add these repository secrets under **Settings → Secrets and variables → Actions**:

- `TELEGRAM_BOT_TOKEN`: the BotFather bot token.
- `TELEGRAM_CHAT_ID`: the target group or channel ID, or its `@channel_username`.
- `TELEGRAM_MESSAGE_THREAD_ID`: optional forum topic ID; both the supporting message and quiz are sent to this topic.

For a private forum-group message URL formatted as `https://t.me/c/<group-id>/<topic-id>/<message-id>`, set `TELEGRAM_CHAT_ID` to `-100<group-id>` and `TELEGRAM_MESSAGE_THREAD_ID` to `<topic-id>`. Add the bot to the group before publishing.

The `Publish Telegram quizzes` workflow runs when quiz files change on `main`, and can also be started manually from the Actions tab. It publishes anonymous, single-answer quizzes without shuffled options or revoting. A PlantUML diagram is rendered as PNG by the public PlantUML Server and sent first, followed by a formatted supporting message when needed and then the poll. The short poll explanation ends with a link to the matching detailed explanation on GitHub Pages. Do not include secrets or private data in diagram source.

## At-most-once delivery

Before contacting Telegram, the workflow changes `status: draft` to `status: published`, commits that change, and successfully pushes it to `main`. Only then does it send the Telegram message and quiz. A consumed quiz is never sent again, even when its Markdown file changes.

This intentionally favors **at-most-once** over guaranteed delivery: if Telegram rejects the request after the marker has been pushed, the quiz remains `published` and will not be retried automatically. Check the failed workflow logs, then change the status to `draft` if another publication attempt is required.

GitHub Actions needs `contents: write` permission to commit publication markers. Workflow-created commits use `GITHUB_TOKEN` and therefore do not recursively trigger another publication workflow.
