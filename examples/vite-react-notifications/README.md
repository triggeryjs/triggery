# Triggery — notifications pipeline (Vite + React)

The flagship Triggery scenario: a chat message arrives and three side effects fan out across three independent components, gated by user-owned settings.

- **One trigger file** (`src/triggers/index.ts`) describes the rule top-to-bottom.
- **`<SettingsPanel>`** owns the settings condition.
- **`<ChatPanel>`** fires `new-message`.
- **`<NotificationLayer>`**, **`<BadgePanel>`**, **`<SoundLog>`** each register one action.

No prop drilling, no shared context, no global emitter. Tweak the trigger file and the whole scenario follows.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-notifications/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/notification-pipeline/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
