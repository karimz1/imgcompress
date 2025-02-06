import { test, expect } from "@playwright/test";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";


test.describe("Web Page Title and Basic Checks", () => {
  test("has the correct page title", async ({ page }) => {
    await page.goto(BASE_URL);

    // Check that the page's <title> matches something like "Image Compression Tool"
    // or whatever is rendered in your Next.js application.
    await expect(page).toHaveTitle(/Image Compression Tool/i);
  })
});


test.describe("Home Page E2E Tests", () => {
  test("renders the homepage with default UI elements", async ({ page }) => {
    await page.goto(BASE_URL);

    // Check the page title or some unique text
    await expect(page).toHaveTitle(/Image Compression Tool/i);

    // The text "Drag & drop Images" should be visible
    await expect(page.locator("text=Drag & drop Images here, or click to select")).toBeVisible();

    // The default output format (JPEG) should be selected
    // (We look for 'JPEG (smaller file size)' in the dropdown)
    const dropdown = page.locator("#outputFormat");
    await expect(dropdown).toContainText("JPEG (smaller file size)");

    // "Start Converting" button is visible
    await expect(page.locator("button:has-text('Start Converting')")).toBeVisible();
  });

  test("check that 'Resize Width' toggle is off by default and can be toggled", async ({ page }) => {
    await page.goto(BASE_URL);

    // The toggle might have an id="resizeWidthToggle"
    const toggle = page.locator("#resizeWidthToggle");
    await expect(toggle).not.toBeChecked();

    // Turn the toggle on
    await toggle.click();
    await expect(toggle).toBeChecked();

    // When toggled on, we expect an input for the width to appear
    const widthInput = page.locator("#width");
    await expect(widthInput).toBeVisible();

    // Turn toggle off
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(widthInput).toBeHidden();
  });

  test("should show an error if we try to convert with no files selected", async ({ page }) => {
    await page.goto(BASE_URL);

    // Click "Start Converting" with no files
    await page.click("button:has-text('Start Converting')");

    // Expect an error toast or error message. 
    // The toast text is "Please drop or select some files first."
    const errorMessage = page.locator("text=Please drop or select some files first.");
    await expect(errorMessage).toBeVisible();
  });

  test("upload an image file and remove it from the list", async ({ page }) => {
    await page.goto(BASE_URL);

    // We can simulate uploading a file by setting input files 
    // to the hidden <input> in the dropzone. We'll use a local test image for demonstration.
    const fileInput = page.locator('input[type="file"]');
    const testImagePath = path.resolve(__dirname, "test_assets/sample.jpg"); 
    // Provide your real local file path or a fixture

    await fileInput.setInputFiles(testImagePath);

    // The file name should appear in the "Files to convert" list
    await expect(page.locator(`text=sample.jpg`)).toBeVisible();

    // Remove the file
    await page.click(`button:has-text('Remove')`);

    // The file should disappear from the list
    await expect(page.locator(`text=sample.jpg`)).not.toBeVisible();
  });

  test("open storage manager and see 'No converted files found' if no conversions yet", async ({ page }) => {
    await page.goto(BASE_URL);

    // The floating button to open File Manager (with 'HardDrive' icon).
    // We can click it by role/button or by class, whichever is more stable.
    await page.click("button[title='Open Storage Manager'], button:has-text('HardDrive')");
    // If you have a more specific selector for that button, use it instead.

    // The file manager drawer should appear 
    // "No converted files found." text is expected if there's nothing
    await expect(page.locator("text=No converted files found.")).toBeVisible();
    
    // Close the File Manager
    // The drawer might have a close button or you can click outside. 
    // If you have a <DrawerClose> with text="Close", you can do:
    await page.keyboard.press("Escape"); // or click the close button in the drawer
    await expect(page.locator("text=No converted files found.")).toBeHidden();
  });

  // --- If your server is running and /api/compress works properly ---
  // We can do a more advanced test that checks the compressed files drawer:
  test("simulate a real file upload -> check the compressed files drawer appears", async ({ page }) => {
    await page.goto(BASE_URL);

    // 1) Upload a valid file
    const fileInput = page.locator('input[type="file"]');
    const testImagePath = path.resolve(__dirname, "test_assets/sample.jpg");
    await fileInput.setInputFiles(testImagePath);

    // 2) Click 'Start Converting'
    await page.click("button:has-text('Start Converting')");

    // 3) Wait for either a success message or the compressed files drawer
    // The code shows it should open a drawer with text: "Compressed Image" or "Compressed Images"
    // We'll wait up to ~10 seconds in case the backend takes some time
    const drawerTitle = page.locator(".drawer >>> text=Compressed Image");
    await expect(drawerTitle).toBeVisible({ timeout: 10000 });

    // 4) Check we can see a "Download All as Zip" button if multiple images
    // (Adjust based on whether you tested with multiple files)
    // For a single file, the button might not appear; so let's just check for a single link:
    await expect(page.locator("text=sample.jpg")).toBeVisible();

    // 5) We can optionally do a final check that a toast says "compressed successfully"
    // The library displays a toast w/ "compressed successfully!"
    await expect(page.locator("text=compressed successfully")).toBeVisible();
  });
});
