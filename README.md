# RoadSentryAI

## Local testing

Start a static server and run the browser checks:

```powershell
npx --yes http-server . -p 4173 -a 127.0.0.1
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Users\kartikey\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe'
npx playwright test
```

Set `PW_BROWSER=firefox` or `PW_BROWSER=webkit` when the corresponding Playwright browser is installed.