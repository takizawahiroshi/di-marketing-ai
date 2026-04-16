# -*- coding: utf-8 -*-
import sys, os, time
sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = "C:/tmp/di-screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # --- 1. ページロード ---
    page.goto("http://localhost:8000")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_loaded.png", full_page=True)
    print("[1] page loaded:", page.title())

    buttons = [b.inner_text().strip() for b in page.locator("button").all()]
    inputs = page.locator("textarea, input[type=text]").all()
    print("    buttons:", buttons[:15])
    print("    inputs:", len(inputs))

    # --- 2. 目標入力 & 実行 ---
    # テキストエリアまたはinputを探す
    goal_input = page.locator("#task-input")
    goal_input.fill("new product concept development")
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_input.png", full_page=True)
    print("[2] goal entered via #task-input")

    run_btn = page.locator("#run-btn")
    run_btn.click()
    page.screenshot(path=f"{SCREENSHOT_DIR}/03_after_click.png", full_page=True)
    print("[3] run button clicked")

    # --- 3. エージェント開始を確認 ---
    print("[4] waiting for pipeline to start...")
    page.wait_for_selector(".agent-card, #agent-outputs", timeout=30000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/04_pipeline_started.png", full_page=True)
    print("[4] pipeline started")

    # --- 4. 統合アウトプット(.final-output が visible になるまで待機・最大3分) ---
    print("[5] waiting for synthesis (synth_start event, max 180s)...")
    page.wait_for_selector(".final-output", timeout=180000, state="visible")
    page.screenshot(path=f"{SCREENSHOT_DIR}/05_synth_started.png", full_page=True)
    print("[5] synthesis output visible")

    # --- 4. 統合アウトプット完了待機 & エクスポート ---
    print("[6] waiting for synthesis output (fo-header)...")
    try:
        page.wait_for_selector(".fo-header", timeout=60000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/06_synth.png", full_page=True)
        print("[6] synthesis output appeared")

        export_btn = page.locator(".export-btn")
        export_btn.scroll_into_view_if_needed()
        with page.expect_download(timeout=10000) as dl_info:
            export_btn.click()
        download = dl_info.value
        print(f"[6] export download: {download.suggested_filename}")
        page.screenshot(path=f"{SCREENSHOT_DIR}/07_exported.png", full_page=True)
    except Exception as e:
        print(f"[6] export step error: {e}")

    browser.close()
    print("\nDone. Screenshots at:", SCREENSHOT_DIR)
