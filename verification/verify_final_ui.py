from playwright.sync_api import sync_playwright

def verify_mobile_ui(page):
    # Set to a mobile viewport
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto("http://localhost:8000")

    # Wait for app to load
    page.wait_for_selector("body:not(.is-loading)")

    # 1. Take screenshot of mobile editor and toolbar
    page.screenshot(path="verification/mobile_editor.png")

    # 2. Open Sidebar and take screenshot
    page.click("#mobile-menu-btn")
    page.wait_for_selector(".mobile-sidebar-overlay.show")
    page.screenshot(path="verification/mobile_sidebar.png")
    page.click("#close-sidebar-btn")

    # 3. Type something to trigger unsaved state
    page.fill("#markdown-input", "Testing unsaved state")
    page.wait_for_timeout(1000) # Wait for debounce
    page.screenshot(path="verification/mobile_unsaved_state.png")

def verify_desktop_ui(page):
    # Set to a desktop viewport
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto("http://localhost:8000")
    page.wait_for_selector("body:not(.is-loading)")

    # screenshot of divider handle
    page.screenshot(path="verification/desktop_divider.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_mobile_ui(page)
            verify_desktop_ui(page)
        finally:
            browser.close()
