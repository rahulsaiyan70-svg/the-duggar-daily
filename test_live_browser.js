const { chromium } = require('playwright');

(async () => {
  console.log('Starting Live Browser Playwright Acceptance Test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('http://localhost:8080');
  await page.waitForSelector('#elevationCanvas');
  await page.waitForSelector('#cmdInputField');

  console.log('-> Page loaded successfully.');

  // Helper to click canvas at canvas-relative pixel coordinates
  const clickCanvas = async (x, y) => {
    const canvas = await page.$('#elevationCanvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + x, box.y + y);
    await page.waitForTimeout(200);
  };

  // Helper to move mouse over canvas
  const moveMouseCanvas = async (x, y) => {
    const canvas = await page.$('#elevationCanvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + x, box.y + y);
    await page.waitForTimeout(100);
  };

  // 1. LINE COMMAND
  console.log('1. Testing LINE (L) click + 10\' + Enter...');
  await page.type('#cmdInputField', 'L');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  const prompt1 = await page.$eval('#cmdPromptLabel', el => el.textContent);
  console.log('Prompt after L:', prompt1);
  if (!prompt1.includes('first point')) throw new Error('Expected prompt for first point');

  // Single click canvas
  await clickCanvas(200, 300);
  await moveMouseCanvas(300, 300);

  const prompt2 = await page.$eval('#cmdPromptLabel', el => el.textContent);
  console.log('Prompt after 1st click:', prompt2);
  if (!prompt2.includes('next point')) throw new Error('Expected prompt for next point');

  // Type distance 10' and Enter
  await page.keyboard.type("10'");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  // Finish LINE command
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  let objectsCount = await page.evaluate(() => window.cadCanvas.objects.length);
  console.log(`CAD Objects count after LINE: ${objectsCount}`);
  if (objectsCount < 1) throw new Error('LINE was not created!');

  // 2. OFFSET COMMAND
  console.log('2. Testing OFFSET (O) + 9" + Click Line + Click Side...');
  await page.type('#cmdInputField', 'O');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  const promptOff1 = await page.$eval('#cmdPromptLabel', el => el.textContent);
  console.log('Prompt after O:', promptOff1);

  await page.keyboard.type('9"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  const promptOff2 = await page.$eval('#cmdPromptLabel', el => el.textContent);
  console.log('Prompt after 9":', promptOff2);

  // Click created line to select it
  const lineScreenPt = await page.evaluate(() => {
    const line = window.cadCanvas.objects.find(o => o.type === 'line');
    const sp1 = window.cadCanvas.worldToScreen(line.x1, line.y1);
    const sp2 = window.cadCanvas.worldToScreen(line.x2, line.y2);
    return { x: (sp1.x + sp2.x) / 2, y: (sp1.y + sp2.y) / 2 };
  });

  await clickCanvas(lineScreenPt.x, lineScreenPt.y);
  await page.waitForTimeout(200);

  // Click side to offset (above line)
  await clickCanvas(lineScreenPt.x, lineScreenPt.y - 40);
  await page.waitForTimeout(300);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  objectsCount = await page.evaluate(() => window.cadCanvas.objects.length);
  console.log(`CAD Objects count after OFFSET: ${objectsCount}`);
  if (objectsCount < 2) throw new Error('OFFSET object was not created!');

  // 3. COPY COMMAND
  console.log('3. Testing COPY (CO)...');
  await page.type('#cmdInputField', 'CO');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await clickCanvas(lineScreenPt.x, lineScreenPt.y);
  await clickCanvas(lineScreenPt.x, lineScreenPt.y); // Base point
  await clickCanvas(lineScreenPt.x + 100, lineScreenPt.y); // Dest point
  await page.waitForTimeout(300);

  objectsCount = await page.evaluate(() => window.cadCanvas.objects.length);
  console.log(`CAD Objects count after COPY: ${objectsCount}`);

  // 4. CIRCLE COMMAND
  console.log('4. Testing CIRCLE (C) center click + 3\' + Enter...');
  await page.type('#cmdInputField', 'C');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await clickCanvas(400, 200);
  await moveMouseCanvas(450, 200);
  await page.keyboard.type("3'");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  const circlesCount = await page.evaluate(() => window.cadCanvas.objects.filter(o => o.type === 'circle').length);
  console.log(`Circles count: ${circlesCount}`);
  if (circlesCount < 1) throw new Error('CIRCLE was not created!');

  // 5. RECTANGLE COMMAND
  console.log('5. Testing RECTANGLE (REC) corner click + 10\', 8\' + Enter...');
  await page.type('#cmdInputField', 'REC');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await clickCanvas(500, 150);
  await moveMouseCanvas(550, 100);
  await page.keyboard.type("10', 8'");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  const rectsCount = await page.evaluate(() => window.cadCanvas.objects.filter(o => o.type === 'rectangle').length);
  console.log(`Rectangles count: ${rectsCount}`);
  if (rectsCount < 1) throw new Error('RECTANGLE was not created!');

  // Capture Screenshot of live CAD canvas
  await page.screenshot({ path: 'cad_live_verification.png', fullPage: true });
  console.log('-> Verification screenshot saved as cad_live_verification.png');

  await browser.close();
  console.log('====================================================');
  console.log('LIVE BROWSER ACCEPTANCE TEST COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
})();
