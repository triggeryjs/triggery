# Triggery — notifications pipeline (Vite + React)

The flagship Triggery scenario: a chat message arrives and three side effects fan out across three independent components, gated by user-owned settings.

- **One trigger file** (`src/triggers/index.ts`) describes the rule top-to-bottom.
- **`<SettingsPanel>`** owns the settings condition.
- **`<ChatPanel>`** fires `new-message`.
- **`<NotificationLayer>`**, **`<BadgePanel>`**, **`<SoundLog>`** each register one action.

No prop drilling, no shared context, no global emitter. Tweak the trigger file and the whole scenario follows.

## Try it

- **Open in StackBlitz** — <https://triggeryjs.github.io/play/vite-react-notifications/>
- **Read the recipe** — <https://triggeryjs.github.io/recipes/react/notification-pipeline/>

Or run it locally:

```bash
pnpm install
pnpm dev
```
