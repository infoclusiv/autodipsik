# New Website Automation Lab

Chrome MV3 extension scaffold for discovering and stabilizing automation against a new website before migrating it into `autohom`.

## Current Status

- This folder was empty when the implementation started.
- The extension is isolated under `newsite-automation-extension/`.
- Placeholder site values are still in use because the real website was not provided yet.
- The current MVP focuses on modular architecture, observability, selector testing, page-state detection, dry-run workflow execution, and diagnostic export.

## Assumptions

- `NEW_SITE_ID = "newsite"`
- `NEW_SITE_DISPLAY_NAME = "New Website Automation"`
- `NEW_SITE_BASE_URL = "https://example.com"`
- `NEW_SITE_URL_PATTERN = "https://example.com/*"`
- `NEW_SITE_STORAGE_KEY = "newsite_site_profile"`
- `NEW_SITE_EXTENSION_TYPE = "newsite-automation"`

Update those values centrally in [sites/newsite/config.js](./sites/newsite/config.js) and [sites/newsite/siteProfile.js](./sites/newsite/siteProfile.js) when the real target site is known.

## Folder Structure

```txt
newsite-automation-extension/
  manifest.json
  README.md
  background-main.js
  core/
  sites/newsite/
  sidepanel/
```

## How To Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Choose Load unpacked.
4. Select the folder `newsite-automation-extension`.
5. Open any matching website tab and then open the extension side panel.

## Manual Testing Checklist

- [ ] Extension loads in Chrome.
- [ ] Side panel opens.
- [ ] Default profile loads.
- [ ] Profile can be saved.
- [ ] Selector test works on the target website.
- [ ] Invalid selector is handled safely.
- [ ] Page state detection works.
- [ ] Dry run works.
- [ ] Main workflow runs.
- [ ] Workflow failure produces expected vs actual diagnostics.
- [ ] Diagnostic JSON exports correctly.

## Recommended Developer Workflow

1. Load the extension in Chrome.
2. Open the new website.
3. Open the side panel.
4. Configure one selector at a time in the Site Profile tab.
5. Test selectors before running automation.
6. Run the dry run first.
7. Run the main automation only after selector health is good.
8. Export diagnostics after any failure.
9. Share the diagnostic JSON when debugging with an AI agent.

## Future Integration Into autohom

1. Move `sites/newsite` into the `autohom` extension as a dedicated site module.
2. Move reusable helpers from `core/` into shared `autohom` modules only when they do not duplicate existing helpers.
3. Register the new site in a capability registry.
4. Add manifest `host_permissions` and `content_scripts` for the real domain.
5. Add a side-panel tab or page for the new site.
6. Preserve the storage namespace `newsite_site_profile`.
7. Preserve telemetry event names.
8. Document the workflow inside `autohom`.
9. Include the new workflow in the AI-ready diagnostic package.

## Known Limitations

- The real website selectors are still placeholders and must be configured manually.
- The main workflow is safe-by-default and only performs real clicks when the configured selectors are valid.
- Page-state detection is heuristic until real selectors are defined.
