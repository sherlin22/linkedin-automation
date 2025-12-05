const { chromium } = require("playwright");

(async () => {
  const userData = "/tmp/chrome-profile-copy";
  const exe = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const ctx = await chromium.launchPersistentContext(userData, {
    headless: false,
    executablePath: exe,
    args: ["--start-maximized"],
    viewport: null
  });
  const page = await ctx.newPage();
  const url = "https://www.linkedin.com/messaging/thread/2-ZjJjN2VjMDUtM2NiNy00YjY4LWIxZmMtNTVkNTU3NjlkZmZmXzEwMA==/";
  console.log("Opening:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(()=>null);

  const sel = 'div.msg-form__contenteditable[contenteditable="true"][role="textbox"]';
  console.log("Waiting for composer selector:", sel);
  await page.waitForSelector(sel, { timeout: 30000 });

  // Focus + replace contents
  await page.evaluate(({ sel, text }) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.focus();
    while (el.firstChild) el.removeChild(el.firstChild);
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(text));
    el.appendChild(p);
    ["input", "change", "blur"].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
    return true;
  }, { sel, text: "Pls share your Resume to proceed with further discussion." });

  const shot = "composer_test.png";
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot, fullPage: true });
  console.log("Saved screenshot:", shot);
  // keep browser open for manual inspection
})();
