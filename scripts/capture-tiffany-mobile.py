"""Render Tiffany's founder candidate in a real Chromium mobile/desktop viewport.
Screenshots are evidence artifacts, not production deploys or physical iPhone tests.
"""
from __future__ import annotations
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "build" / "tiffany-mobile-review"
OUTPUT.mkdir(parents=True, exist_ok=True)


def assert_fits(page, label: str) -> None:
    metrics = page.evaluate("""() => ({
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        images: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src'))
    })""")
    assert metrics["width"] <= metrics["viewport"] + 2, f"{label}: horizontal scroll ({metrics})"
    assert not metrics["images"], f"{label}: broken image(s) ({metrics})"


def capture(browser, label: str, viewport: dict, base: str) -> None:
    context = browser.new_context(viewport=viewport, device_scale_factor=2, is_mobile=label == "mobile", has_touch=label == "mobile")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(base + "/arrival-experience.html", wait_until="networkidle")
    page.locator("#enter").wait_for()
    assert page.locator("#enter").count() == 1
    assert_fits(page, "arrival " + label)
    page.screenshot(path=str(OUTPUT / f"arrival-{label}.png"), full_page=True)
    page.get_by_role("button", name="Enter the Universe").click()
    page.locator("body.entered").wait_for()
    page.wait_for_timeout(450)
    assert page.locator(".cards a.card[href^='/games/']").count() == 5
    gateway = page.locator(".goatville-portal")
    gateway.wait_for(state="visible")
    assert gateway.get_by_role("link", name="Enter Goatville City").count() == 1
    assert gateway.get_by_text("ENTER GOATVILLE").count() == 1
    assert_fits(page, "Goatville gateway " + label)
    gateway.screenshot(path=str(OUTPUT / f"goatville-gateway-{label}.png"))
    assert_fits(page, "universe " + label)
    page.screenshot(path=str(OUTPUT / f"world-{label}.png"), full_page=True)

    page.goto(base + "/gpi.html", wait_until="networkidle")
    assert_fits(page, "GPI " + label)
    assert page.get_by_text("No verified rankings published").is_visible()
    page.screenshot(path=str(OUTPUT / f"gpi-{label}.png"), full_page=True)
    page.get_by_role("tab", name="State").click()
    assert page.get_by_role("heading", name="Take on your state.").is_visible()
    assert page.url.endswith("#state")
    assert_fits(page, "state GPI " + label)
    page.screenshot(path=str(OUTPUT / f"gpi-state-{label}.png"), full_page=True)
    # The primary gateway must actually open Pope's existing City, not a dead end.
    page.goto(base + "/arrival-experience.html#universe", wait_until="networkidle")
    page.locator(".goatville-portal-link").click()
    assert page.url.endswith("/goatville-city.html"), page.url
    assert page.get_by_text("WELCOME TO").count() >= 1
    assert_fits(page, "City handoff " + label)
    assert page.locator("article.district").count() == 7
    assert page.locator("#gv-gst-clock time").is_visible()
    page.screenshot(path=str(OUTPUT / f"city-{label}.png"), full_page=True)

    page.goto(base + "/goatville-stadium.html", wait_until="networkidle")
    assert page.locator("a.games-card-link[href^='/games/']").count() == 5
    assert page.locator("#gv-gst-clock time").is_visible()
    assert_fits(page, "stadium " + label)
    page.screenshot(path=str(OUTPUT / f"stadium-{label}.png"), full_page=True)

    page.goto(base + "/goatville-cinema.html", wait_until="networkidle")
    assert page.locator("article.media-shelf").count() == 4
    assert page.locator("#gv-gst-clock time").is_visible()
    assert_fits(page, "creative media " + label)
    page.screenshot(path=str(OUTPUT / f"creative-media-{label}.png"), full_page=True)

    page.goto(base + "/commerce.html", wait_until="networkidle")
    assert page.locator("article.collection").count() == 7
    assert page.locator("#gst-time").inner_text() != "--:--:--"
    assert page.locator("#gst-time").inner_text() == page.locator("#ny-time").inner_text()
    assert_fits(page, "luxury concepts " + label)
    page.screenshot(path=str(OUTPUT / f"collections-{label}.png"), full_page=True)
    page.get_by_role("button", name="GST", exact=True).click()
    assert page.locator("article.collection:visible").count() == 1
    page.get_by_role("button", name="All Collections").click()
    assert page.locator("article.collection:visible").count() == 7
    assert not errors, f"Browser script errors: {errors}"
    context.close()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        return


if __name__ == "__main__":
    import os
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Quiet)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                capture(browser, "mobile", {"width": 390, "height": 844}, base)
                capture(browser, "desktop", {"width": 1440, "height": 900}, base)
            finally:
                browser.close()
    finally:
        server.shutdown()
    print(f"Validated both viewports. Eighteen screenshots saved in {OUTPUT}")
