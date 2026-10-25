# RoadSentryAI Testing Report

## 1. Project overview

RoadSentryAI is a client-rendered static HTML/CSS/JavaScript application. It uses Leaflet/OpenStreetMap for maps, browser geolocation, ONNX Runtime Web with a remote pothole model for on-device image analysis, localStorage for private reports, and optional Supabase anonymous-auth/storage/database integration for public community reports.

There is no frontend framework, backend server, package manifest, build pipeline, or pre-existing automated test suite in the project.

## 2. Pages and features tested

- Single-page navigation and anchor links
- Dashboard/hero rendering
- Image upload validation and preview flow
- Exact 5 MB image boundary
- Invalid PDF upload handling
- On-device analysis control state
- Browser geolocation start/stop flow
- Coordinates and map state updates
- Private report saving to localStorage
- Public-sharing consent integration behavior
- Route form empty-input and consent validation
- Responsive layout at 320, 375, 430, 768, 1366, and 1920 pixel widths
- Community report section initialization
- Static resource loading and root HTTP response
- Basic source-level security review and dependency audit

## 3. Tools used

- Playwright Test 1.64.1
- Installed Playwright Chromium 1243 executable
- Node.js local static server via `http-server`
- PowerShell HTTP smoke check
- `npm audit --omit=dev`
- Source inspection and targeted grep review

Firefox and WebKit were attempted but could not run because the installed browser revisions did not match the current Playwright package and downloading replacements was unavailable in this environment. No cross-browser pass is claimed.

## 4. Test counts

- Automated Chromium test cases: 7
- Final Chromium passes: 7
- Final Chromium failures: 0
- Blocked cross-browser cases: 2 browser families (Firefox, WebKit)
- Production build checks: not applicable; no build tool or package scripts exist
- Lint/typecheck: not applicable; no configured commands exist

## 5. Bugs discovered and fixed

### BUG-001: Exact 5 MB images rejected

- Reproduction: select an image whose size is exactly 5,242,880 bytes.
- Root cause: `app.js` used `file.size >= MAX_IMAGE_BYTES`, while the UI and Supabase configuration documented/allowed files up to 5 MB.
- Fix: changed the rejection condition to `file.size > MAX_IMAGE_BYTES` and updated the message to “up to 5 MB”.
- Regression test: `accepts an image exactly at the documented 5 MB limit`.

### BUG-002: Private save blocked when Supabase community sharing was configured

- Reproduction: choose an image, enable location, leave public-sharing consent unchecked, and click “Save report”.
- Root cause: the capture-phase listener in `shared-reports.js` called `preventDefault()` and stopped propagation before checking consent, preventing the normal private local-save handler from running.
- Fix: the listener now returns immediately when public consent is unchecked, allowing private local saving; it intercepts only the explicitly consented public-sharing flow.
- Regression test: `saves a private local report without public sharing consent`.

## 6. Testing rounds

### Round 1

- Added initial Playwright smoke coverage.
- 4/5 tests passed.
- The only failure was a test selector ambiguity (`getByLabel('Destination')` matched both the textbox and consent checkbox); this was a harness issue, not an application defect.
- Corrected the selector to the textbox role.

### Round 2

- Added the exact 5 MB boundary test.
- Test failed as expected, confirming BUG-001.
- Fixed the size comparison.
- Boundary regression passed.

### Round 3

- Added private local report persistence coverage with synthetic image and synthetic GPS data.
- Test failed, confirming BUG-002.
- Fixed the Supabase capture-phase handler.
- Focused regression passed.
- Full suite passed 7/7.

### Final regression

```text
7 passed (17.4s)
```

The suite was rerun after each behavioral fix and the final full suite passed.

## 7. Responsive results

Chromium checks passed with no horizontal overflow at:

- 320 × 568
- 375 × 812
- 430 × 932
- 768 × 1024
- 1366 × 768
- 1920 × 1080

## 8. Console and network findings

- The dashboard smoke test captured no page-level JavaScript errors.
- Root page HTTP check returned status 200.
- Route, model, map tile, and Supabase live integrations were not fully exercised against production services because that would depend on external availability and would risk creating public data.
- The public community map and uploads require Supabase setup, anonymous sign-in, storage policies, and network availability.

## 9. Security findings

- No service-role Supabase key was found; the configured browser key is an anon/publishable key.
- User-controlled popup text is escaped in report and destination display paths.
- External links opened by the application use `rel="noopener"` where applicable.
- SQL setup includes row-level security policies and coordinate constraints.
- Public community reports intentionally expose exact coordinates and photos after explicit consent; this is documented in the UI and SQL comments.
- No package manifest or lockfile exists, so a project dependency audit cannot represent the CDN dependencies. The temporary local Playwright install audit reported zero vulnerabilities.

## 10. Performance and build results

- No production build exists for this static project.
- No lint/typecheck scripts exist.
- The application intentionally downloads a roughly 45 MB ONNX model on first analysis; this is shown to users and is a known product tradeoff.
- A full performance trace was not claimed because the browser MCP/DevTools server was unavailable and external model/API timing is environment-dependent.

## 11. Remaining limitations

- Firefox and WebKit could not be executed because matching browser binaries were unavailable.
- Real Supabase upload/insert, anonymous authentication, Nominatim geocoding, OSRM routing, and Overpass hazard lookup were not run as destructive or externally mutating tests.
- No backend/server-side authorization runtime could be tested because this repository contains only browser code plus SQL setup.
- No production deployment smoke test was performed.

## 12. Readiness assessment

The locally testable critical UI flows are stable in Chromium after three test-and-fix cycles, with 7/7 final automated tests passing and no observed page errors. Production readiness remains conditional on validating the configured Supabase policies and external routing/model services in a dedicated staging environment, plus installing and running Firefox/WebKit compatibility checks.
