import { test, expect, type Page } from "./fixtures";
import { selectDropdown } from "./dropdown";

const credentials = {
  username: "timeline-mockup",
  password: "disposable-test-password",
};
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(credentials.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  const first = await page
    .getByRole("button", { name: "Create Reliquary", exact: true })
    .isVisible();
  await page
    .getByRole("button", {
      name: first ? "Create Reliquary" : "Sign in",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
}
async function create(page: Page, name: string, content: string) {
  if (!(await page.locator(".sidebar").isVisible()))
    await page.getByRole("button", { name: "Toggle folders" }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "Create from file" });
  await createDialog.getByRole("button", { name: /New file/ }).click();
  await createDialog.getByRole("button", { name: /New blank file/ }).click();
  await page.getByLabel("File name", { exact: true }).fill(name);
  await page.getByLabel("Save in folder").click();
  if (
    await page
      .getByRole("listbox", { name: "Save in folder" })
      .locator('[data-value="Writing"]')
      .count()
  )
    await selectDropdown(page.getByLabel("Save in folder"), "Writing");
  else {
    await selectDropdown(page.getByLabel("Save in folder"), "__new__");
    await page.getByLabel("New folder path").fill("Writing");
  }
  await page.getByRole("button", { name: "Create file", exact: true }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByLabel("Markdown source").fill(content);
  await page.getByRole("button", { name: "Save file", exact: true }).click();
}

test("relationship timeline matches the monochrome calendar mockup at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await create(page, "Earlier", "[[Current]]");
  await create(page, "Unrelated", "No links here");
  await create(page, "Later", "[[Current]]");
  await create(page, "Current", "[[Earlier]] [[Later]]");
  if (!(await page.locator(".sidebar").isVisible()))
    await page.getByRole("button", { name: "Toggle folders" }).click();
  const map = page
    .locator(".sidebar")
    .getByRole("region", { name: "Reliquary mind map" });
  await expect(map).toHaveAttribute("data-view", "relationship-timeline");
  // Match Spire's neutral palette; tinted grays must not return.
  const tintedColors = await map.evaluate(root => {
    const failures: string[] = [];
    for (const element of [root, ...root.querySelectorAll('*')]) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo);
        for (const property of ['color', 'background-color', 'border-top-color', 'background-image']) {
          const value = style.getPropertyValue(property);
          for (const match of value.matchAll(/rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/g)) {
            if (match[1] !== match[2] || match[2] !== match[3]) failures.push(`${element.className} ${property}: ${value}`);
          }
        }
      }
    }
    return failures;
  });
  expect(tintedColors).toEqual([]);
  await expect(map.locator(".mock-year-nav")).toBeVisible();
  await expect(
    map.getByRole("region", { name: "Creation date" }),
  ).toBeVisible();
  await expect(
    map.getByRole("region", { name: "Related files" }),
  ).toBeVisible();
  await expect(map.locator(".mock-file-row")).toHaveCount(4);
  await expect(map.getByLabel("Timeline month")).toBeVisible();
  await expect(map.getByLabel("Timeline date")).toHaveValue(
    /\d{4}-\d{2}-\d{2}/,
  );
  await expect(map.locator(".mock-current-file")).toContainText("Current.md");
  const row = await map.locator(".mock-file-row").first().boundingBox(),
    panel = await map.locator(".mock-file-panel").boundingBox();
  expect(row).not.toBeNull();
  expect(panel).not.toBeNull();
  expect(row!.x).toBeGreaterThan(panel!.x);
  expect(row!.x + row!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // The supplied concept retains both year separators and all four lanes on mobile.
  await expect(map.locator('.mock-year-nav > i').first()).toBeVisible();
  const concept = await map.evaluate((root) => {
    const box = (s: string) => root.querySelector(s)!.getBoundingClientRect();
    const card = box('.mock-current-file'), icon = box('.mock-current-file > svg');
    const label = box('.mock-current-file strong'), files = box('.mock-file-panel');
    const ruler = box('.mock-ruler-line'), stem = box('.mock-date-marker i');
    const rows = [...root.querySelectorAll('.mock-file-row')].map(e => e.getBoundingClientRect());
    return {
      cardWidthRatio: card.width / files.width,
      iconCenterDelta: Math.abs(icon.x + icon.width / 2 - card.x - card.width / 2),
      iconAboveTitle: icon.bottom <= label.top,
      allRowsInside: rows.every(r => r.top >= files.top && r.bottom <= files.bottom),
      stemBaselineDelta: Math.abs(stem.bottom - (ruler.top + ruler.height / 2)),
    };
  });
  expect(concept.cardWidthRatio).toBeGreaterThan(0.98);
  expect(concept.iconCenterDelta).toBeLessThan(2);
  expect(concept.iconAboveTitle).toBe(true);
  expect(concept.allRowsInside).toBe(true);
  expect(concept.stemBaselineDelta).toBeLessThan(2);
  await map.screenshot({ path: 'artifacts/timeline-concept-mobile.png' });
  const rail = map.getByRole("group", {
    name: "Scrollable workspace chronology",
  });
  const unrelatedTick = rail.getByRole("button", { name: /Unrelated/ });
  await expect(unrelatedTick).toBeAttached();
  await rail.evaluate((track, id) => {
    const tick = track.querySelector<HTMLElement>(`[data-file-id="${id}"]`)!;
    track.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    track.scrollLeft = tick.offsetLeft - (track.clientWidth - tick.offsetWidth) / 2;
    track.dispatchEvent(new Event("scroll"));
  }, await unrelatedTick.getAttribute("data-file-id"));
  await expect(map.locator(".mock-current-file")).toContainText("Unrelated.md");
  await map.getByRole("button", { name: "Next file by creation date" }).click();
  await expect(map.locator(".mock-current-file")).toContainText("Later.md");
  await map.getByRole("button", { name: "Next file by creation date" }).click();
  await expect(map.locator(".mock-current-file")).toContainText("Current.md");
  await map.getByRole("region", { name: "Related files" }).getByRole("button", { name: /Earlier/ }).click();
  await expect(map.locator(".mock-current-file")).toContainText("Earlier.md");
  await map.getByRole("button", { name: /Open Earlier/ }).click();
  await expect(page.getByLabel("File path")).toHaveValue("Writing/Earlier.md");
  await page.screenshot({
    path: "artifacts/relationship-timeline-mockup-mobile.png",
    fullPage: true,
  });
});
