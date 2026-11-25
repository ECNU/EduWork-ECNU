// Layout only: controls, modal behavior, icons and feedback use DSH primitives.
export const styles = `
.ecnu-feedback-action { width: 28px; height: 28px; padding: 0; }
.ecnu-feedback-action[aria-disabled="true"] { cursor: default; opacity: .4; }
.ecnu-feedback-dialog.ecnu-feedback-dialog { width: min(488px, 100%); max-height: 100%; }
.ecnu-feedback-content { min-height: 0; overflow: auto; }
.ecnu-feedback-categories { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.ecnu-feedback-label { display: block; font-size: 14px; color: var(--dsw-alias-label-primary); }
.ecnu-feedback-detail { display: block; width: 100%; min-height: 116px; max-height: 220px; box-sizing: border-box; margin-top: 8px; padding: 12px 14px; border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; line-height: 22px; resize: vertical; }
.ecnu-feedback-detail::placeholder { color: var(--dsw-alias-label-caption); }
.ecnu-feedback-detail:focus-visible, .ecnu-feedback-preview summary:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.ecnu-feedback-disclosure { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); margin: 16px 0 8px; }
.ecnu-feedback-preview { font-size: 13px; color: var(--dsw-alias-label-secondary); }
.ecnu-feedback-preview summary { cursor: pointer; padding: 4px 0; }
.ecnu-feedback-preview > div { max-height: 200px; overflow: auto; padding: 12px; margin-top: 8px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-1); }
.ecnu-feedback-preview p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 20px; }
.ecnu-feedback-notice { display: inline-flex; align-items: start; gap: 6px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
`
