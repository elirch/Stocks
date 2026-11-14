import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

async function showTab(page: Page, tab: "Holdings" | "Atlas") {
  const tabs = page.locator(".tabs-mobile");
  if (await tabs.isVisible()) await tabs.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
}

async function open(page: Page) {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");
  await page.locator('[data-ready="true"]').waitFor();
}

function pngSize(file: string) {
  const buf = fs.readFileSync(file);
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test("enter holdings, explore, save and restore, export", async ({ page }, info) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("See your portfolio");
  await page.getByRole("button", { name: "Enter my holdings" }).click();
  await showTab(page, "Holdings");

  // Row 1 via security search (fixture provider is enabled for tests).
  const id1 = page.getByLabel("Identifier for row 1");
  await id1.fill("AAP");
  await page.getByRole("option", { name: /AAPL/ }).click();
  await expect(page.getByLabel("Name for Apple Inc.")).toHaveValue("Apple Inc.");
  await expect(page.getByText("Details from demo data")).toBeVisible();
  await page.getByLabel("Current value for Apple Inc.").fill("12,000");

  // Row 2: a fund typed manually.
  await page.getByRole("button", { name: "+ Add holding" }).click();
  await page.getByLabel("Identifier for row 2").fill("MYFUND");
  await page.getByLabel("Current value for MYFUND").fill("8000");
  await page.getByLabel("Instrument type for MYFUND").selectOption("etf");
  await expect(page.getByLabel("Sector for MYFUND")).toBeDisabled();

  // Row 3: unknown security with only a name.
  await page.getByRole("button", { name: "+ Add holding" }).click();
  await page.getByLabel("Name for row 3").fill("Mystery Co");
  await page.getByLabel("Current value for Mystery Co").fill("500");

  // Row 4: invalid (negative) value is explained and excluded.
  await page.getByRole("button", { name: "+ Add holding" }).click();
  await page.getByLabel("Identifier for row 4").fill("SHORTX");
  await page.getByLabel("Current value for SHORTX").fill("-300");
  await expect(page.getByText(/aren't supported in this version/).first()).toBeVisible();
  await expect(page.getByText(/1 row has an invalid value/)).toBeVisible();

  await showTab(page, "Atlas");
  const stats = page.locator(".stats");
  await expect(stats).toContainText("$20,500");
  await expect(stats).toContainText("3");
  await expect(stats).toContainText("58.5%"); // 12000 / 20500
  await expect(page.locator(".legend")).toContainText("Unclassified");
  await expect(page.locator(".legend")).toContainText("Funds & ETFs");

  // Keyboard exploration of the map.
  const map = page.getByRole("group", { name: /Portfolio map with 3 holdings/ });
  await map.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator(".detail-title")).toHaveText(/MYFUND|Apple Inc\./);

  // Pointer/touch selection.
  const svg = map.locator("svg");
  const box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".detail")).toContainText("Share of entered holdings");

  // Accessible table alternative.
  await page.getByRole("radio", { name: "Table" }).click();
  await expect(page.getByRole("table")).toContainText("Mystery Co");
  await page.getByRole("radio", { name: "Map" }).click();

  // Local persistence: reload restores.
  await page.waitForTimeout(700);
  await page.reload();
  await page.locator('[data-ready="true"]').waitFor();
  await showTab(page, "Holdings");
  await expect(page.getByText("Restored the portfolio saved in this browser.")).toBeVisible();
  await expect(page.getByLabel("Current value for Mystery Co")).toHaveValue("500");

  // Portfolio file export.
  const [fileDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save file" }).click()]);
  const jsonPath = info.outputPath("portfolio.json");
  await fileDl.saveAs(jsonPath);
  const saved = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  expect(saved.format).toBe("portfolio-atlas");
  expect(saved.holdings).toHaveLength(3);

  // Invalid import is rejected with a message.
  await page.getByTestId("file-input").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{nope") });
  await expect(page.getByText("Couldn't open that file.")).toBeVisible();
  // Valid import works.
  await page.getByTestId("file-input").setInputFiles(jsonPath);
  await expect(page.getByText(/Opened 3 holdings in USD/)).toBeVisible();

  // PNG export, percentages only by default.
  await showTab(page, "Atlas");
  await page.getByRole("button", { name: "Download image" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /Percentages only/ })).toBeChecked();
  await expect(dialog.getByRole("img", { name: /Preview/ })).toBeVisible();
  const [png] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download PNG" }).click()]);
  expect(png.suggestedFilename()).toMatch(/atlas-\d{4}-\d{2}-\d{2}\.png$/);
  const pngPath = info.outputPath("atlas.png");
  await png.saveAs(pngPath);
  expect(pngSize(pngPath)).toEqual({ w: 2160, h: 2700 });

  // Editable copy: download, then upload it to restore the holdings.
  const [editable] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download editable copy" }).click(),
  ]);
  expect(editable.suggestedFilename()).toMatch(/-editable\.png$/);
  const editablePath = info.outputPath("editable.png");
  await editable.saveAs(editablePath);
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.getByTestId("file-input").setInputFiles({
    name: "atlas.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Symbol,Market Value\nZZZ,100\n"),
  });
  await expect(page.getByText(/Imported 1 holdings/)).toBeVisible();
  await page.getByTestId("file-input").setInputFiles(editablePath);
  await expect(page.getByText(/Opened 3 holdings in USD/)).toBeVisible();
  await showTab(page, "Holdings");
  await expect(page.getByLabel("Current value for Mystery Co")).toHaveValue("500");
});

test("example portfolio is labelled and not saved", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Try the example" }).first().click();
  await expect(page.getByText("You're viewing an example portfolio.")).toBeVisible();
  await showTab(page, "Atlas");
  await expect(page.locator(".atlas-svg rect").first()).toBeVisible();
  // Zoom into a region via the legend, then back out.
  await page.locator(".legend-item").first().click();
  await expect(page.locator(".zoom-bar")).toContainText("Zoomed into");
  await page.getByRole("button", { name: "← Whole atlas" }).click();
  await expect(page.locator(".zoom-bar")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-ready="true"]').waitFor();
  await expect(page.getByText("You're viewing an example portfolio.")).toHaveCount(0);
});
