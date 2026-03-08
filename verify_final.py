
import asyncio
from playwright.async_api import async_playwright
import os

async def verify_redesign():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Point to the local file
        path = os.path.abspath("index.html")
        await page.goto(f"file://{path}")
        await page.wait_for_timeout(1000)

        # 1. Verify Management Modal (Note rows)
        await page.click("#btn-manage")
        await page.wait_for_selector("#management-modal.show")
        await page.screenshot(path="verification/management_modal_redesign.png")
        await page.click("#manage-modal-close")

        # 2. Verify All Notes Modal (Note rows)
        await page.click("#btn-notes-desktop")
        await page.wait_for_selector("#notes-modal.show")
        # Ensure at least one folder is expanded to see notes
        await page.click(".dashboard-folder-title")
        await page.screenshot(path="verification/all_notes_modal_redesign.png")
        await page.click("#notes-modal-close")

        # 3. Verify Transfer Modal
        await page.click("#btn-transfer")
        await page.wait_for_selector("#transfer-modal.show")
        await page.screenshot(path="verification/transfer_modal_redesign.png")
        await page.click("#transfer-modal-close")

        # 4. Verify Settings Modal (with Transfer toggle)
        await page.click("#btn-settings")
        await page.wait_for_selector("#settings-modal.show")
        await page.screenshot(path="verification/settings_modal_transfer_toggle.png")
        await page.click("#settings-modal-close")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(verify_redesign())
