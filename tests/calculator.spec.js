const { test, expect } = require('@playwright/test');

// Helper: bypass Firebase auth and show app
async function bypassAuth(page) {
  // Block Firebase scripts to avoid auth requirement
  await page.route('**/gstatic.com/**', route => route.abort());

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Wait a moment for any remaining scripts
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    // Hide login screen if it exists
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    // Show app
    const app = document.getElementById('app');
    if (app) app.style.display = 'block';
  });
}

test.describe('Calculator - Basic Flow', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test('page loads with correct version', async ({ page }) => {
    const footer = await page.textContent('.app-footer');
    expect(footer).toContain('Версия 2.14');
  });

  test('cost input accepts values', async ({ page }) => {
    const costInput = page.locator('#cost');
    await costInput.fill('28815');
    expect(await costInput.inputValue()).toBe('28815');
  });

  test('month and year selectors exist', async ({ page }) => {
    const month = page.locator('#month');
    const year = page.locator('#year');
    await expect(month).toBeVisible();
    await expect(year).toBeVisible();
  });

  test('calculate button triggers calculation', async ({ page }) => {
    await page.fill('#cost', '28815');
    await page.selectOption('#month', '3');
    await page.selectOption('#year', '2026');
    await page.click('button:has-text("Рассчитать")');

    const result = page.locator('#result');
    await expect(result).toBeVisible();

    const costLabel = await page.textContent('#costLabel');
    expect(costLabel).toContain('Стоимость');

    const finalValue = await page.textContent('#finalValue');
    expect(finalValue).toContain('тыс. руб.');
  });

  test('error on empty cost', async ({ page }) => {
    await page.click('button:has-text("Рассчитать")');
    const error = page.locator('#error');
    await expect(error).toBeVisible();
    expect(await error.textContent()).toContain('корректную стоимость');
  });
});

test.describe('Calculator - SMR Index Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test('calculates factual index for date before 2025', async ({ page }) => {
    await page.fill('#cost', '100000');
    await page.selectOption('#month', '10');
    await page.selectOption('#year', '2024');
    await page.click('button:has-text("Рассчитать")');

    const indexValue = await page.textContent('#indexValue');
    // Should be a number (factual index)
    expect(parseFloat(indexValue.replace(',', '.'))).toBeGreaterThan(0);

    const finalValue = await page.textContent('#finalValue');
    expect(finalValue).toContain('тыс. руб.');
  });

  test('calculates factual index for date after 2025', async ({ page }) => {
    await page.fill('#cost', '50000');
    await page.selectOption('#month', '3');
    await page.selectOption('#year', '2026');
    await page.click('button:has-text("Рассчитать")');

    const indexValue = await page.textContent('#indexValue');
    expect(parseFloat(indexValue.replace(',', '.'))).toBeGreaterThan(0);
  });

  test('no recalc needed for Jan 2025', async ({ page }) => {
    await page.fill('#cost', '50000');
    await page.selectOption('#month', '1');
    await page.selectOption('#year', '2025');
    await page.click('button:has-text("Рассчитать")');

    const indexValue = await page.textContent('#indexValue');
    expect(indexValue).toContain('Пересчёт не требуется');
  });

  test('Хор is in thousands', async ({ page }) => {
    await page.fill('#cost', '100000'); // 100 000 руб
    await page.selectOption('#month', '1');
    await page.selectOption('#year', '2025');
    await page.click('button:has-text("Рассчитать")');

    const finalValue = await page.textContent('#finalValue');
    // 100000 / 1000 = 100 тыс.руб
    expect(finalValue).toContain('100');
    expect(finalValue).toContain('тыс. руб.');
  });
});

test.describe('Calculator - NZT Functions', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
    // Set up a calculation first
    await page.fill('#cost', '28815');
    await page.selectOption('#month', '3');
    await page.selectOption('#year', '2026');
    await page.click('button:has-text("Рассчитать")');
  });

  test('NZT section appears after calculation', async ({ page }) => {
    const nztSection = page.locator('#nztSection');
    await expect(nztSection).toBeVisible();
  });

  test('NZT checkboxes are present', async ({ page }) => {
    const checkboxes = page.locator('#nztCheckboxes input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(10); // 28 items expected
  });

  test('selecting NZT 9.1 shows sub-functions', async ({ page }) => {
    // Check NZT 9.1
    await page.check('input[data-nzt-id="9.1"]');
    const subFunctions = page.locator('#nzt_9_1_subfunctions');
    await expect(subFunctions).toBeVisible();
  });

  test('NZT 9.1 with sub-function calculates correctly', async ({ page }) => {
    await page.check('input[data-nzt-id="9.1"]');
    // Check a sub-function (e.g., технический надзор)
    const subCheckboxes = page.locator('#nzt_9_1_subfunctions input[type="checkbox"]');
    await subCheckboxes.first().check();

    const nztResults = page.locator('#nztResults');
    await expect(nztResults).toBeVisible();

    const totalValue = await page.textContent('#nztTotalValue');
    expect(totalValue).toContain('чел.дн.');
    const nztVal = parseFloat(totalValue.replace(/\s/g, '').replace(',', '.'));
    expect(nztVal).toBeGreaterThan(0);
  });

  test('simple NZT function calculates', async ({ page }) => {
    await page.check('input[data-nzt-id="1.1"]');

    const nztResults = page.locator('#nztResults');
    await expect(nztResults).toBeVisible();

    const totalValue = await page.textContent('#nztTotalValue');
    const nztVal = parseFloat(totalValue.replace(/\s/g, '').replace(',', '.'));
    expect(nztVal).toBeGreaterThan(0);
  });

  test('multiple NZT functions sum up', async ({ page }) => {
    await page.check('input[data-nzt-id="1.1"]');
    const val1 = await page.textContent('#nztTotalValue');
    const nzt1 = parseFloat(val1.replace(/\s/g, '').replace(',', '.'));

    await page.check('input[data-nzt-id="2.1"]');
    const val2 = await page.textContent('#nztTotalValue');
    const nzt2 = parseFloat(val2.replace(/\s/g, '').replace(',', '.'));

    expect(nzt2).toBeGreaterThan(nzt1);
  });

  test('unchecking NZT removes it from total', async ({ page }) => {
    await page.check('input[data-nzt-id="1.1"]');
    await page.check('input[data-nzt-id="2.1"]');
    const val2 = await page.textContent('#nztTotalValue');
    const nzt2 = parseFloat(val2.replace(/\s/g, '').replace(',', '.'));

    await page.uncheck('input[data-nzt-id="2.1"]');
    const val1 = await page.textContent('#nztTotalValue');
    const nzt1 = parseFloat(val1.replace(/\s/g, '').replace(',', '.'));

    expect(nzt1).toBeLessThan(nzt2);
  });
});

test.describe('Calculator - Суст, Иуслуга, Кконкурс, Цпредл', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
    await page.fill('#cost', '28815');
    await page.selectOption('#month', '3');
    await page.selectOption('#year', '2026');
    await page.click('button:has-text("Рассчитать")');
    // Select NZT 9.1 + a sub-function to trigger full chain
    await page.check('input[data-nzt-id="9.1"]');
    const subCheckboxes = page.locator('#nzt_9_1_subfunctions input[type="checkbox"]');
    await subCheckboxes.first().check();
  });

  test('Суст section appears', async ({ page }) => {
    const sust = page.locator('#nztSust');
    await expect(sust).toBeVisible();
    const sustValue = await page.textContent('#sustValue');
    expect(sustValue).toContain('руб.');
  });

  test('Иуслуга section appears', async ({ page }) => {
    const iusluga = page.locator('#iuslugaSection');
    await expect(iusluga).toBeVisible();
  });

  test('Кконкурс defaults to 1', async ({ page }) => {
    const kkonkurs = page.locator('#kkonkursInput');
    expect(await kkonkurs.inputValue()).toBe('1');
  });

  test('Цпредл section appears with value', async ({ page }) => {
    const cpredl = page.locator('#cpredlSection');
    await expect(cpredl).toBeVisible();

    const cpredlValue = await page.textContent('#cpredlValue');
    expect(cpredlValue).toContain('Цпредл');
    expect(cpredlValue).toContain('руб.');
  });

  test('Цпредл formula is displayed', async ({ page }) => {
    const formula = await page.textContent('#cpredlFormula');
    expect(formula).toContain('ΣНЗТ');
    expect(formula).toContain('Суст');
    expect(formula).toContain('Иуслуга');
    expect(formula).toContain('Кконкурс');
  });

  test('changing Кконкурс updates Цпредл', async ({ page }) => {
    const cpredlBefore = await page.textContent('#cpredlValue');
    const valBefore = parseFloat(cpredlBefore.replace(/[^\d.,]/g, '').replace(',', '.'));

    await page.fill('#kkonkursInput', '0.5');
    // Trigger oninput
    await page.locator('#kkonkursInput').dispatchEvent('input');

    const cpredlAfter = await page.textContent('#cpredlValue');
    const valAfter = parseFloat(cpredlAfter.replace(/[^\d.,]/g, '').replace(',', '.'));

    expect(valAfter).toBeLessThan(valBefore);
  });

  test('Суст value is used in Цпредл calculation', async ({ page }) => {
    // Verify Цпредл calc detail includes Суст value
    const calcDetail = await page.textContent('#cpredlCalc');
    const sustText = await page.textContent('#sustValue');
    const sustVal = parseFloat(sustText.replace(/\s/g, '').replace(',', '.'));
    // The calculation line should contain the Суст value
    expect(calcDetail).toContain(sustVal.toFixed(2).replace('.', ','));
  });
});

test.describe('Calculator - Tax Selection', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
    await page.fill('#cost', '28815');
    await page.selectOption('#month', '3');
    await page.selectOption('#year', '2026');
    await page.click('button:has-text("Рассчитать")');
    await page.check('input[data-nzt-id="9.1"]');
    const subCheckboxes = page.locator('#nzt_9_1_subfunctions input[type="checkbox"]');
    await subCheckboxes.first().check();
  });

  test('tax section appears', async ({ page }) => {
    const taxSection = page.locator('#taxSection');
    await expect(taxSection).toBeVisible();
  });

  test('default is "без учёта налогов"', async ({ page }) => {
    const checked = await page.locator('input[name="taxType"]:checked').inputValue();
    expect(checked).toBe('none');
  });

  test('final price section appears', async ({ page }) => {
    const finalSection = page.locator('#finalPriceSection');
    await expect(finalSection).toBeVisible();
  });

  test('selecting НДС adds 20%', async ({ page }) => {
    // Get Цпредл value
    const cpredlText = await page.textContent('#cpredlValue');
    const cpredl = parseFloat(cpredlText.replace(/[^\d.,]/g, '').replace(',', '.'));

    // Select НДС
    await page.check('input[name="taxType"][value="nds"]');

    // НДС line should appear
    const ndsLine = page.locator('#ndsLine');
    await expect(ndsLine).toBeVisible();

    // Final price should be Цпредл * 1.2
    const finalText = await page.textContent('#finalPriceValue');
    const finalVal = parseFloat(finalText.replace(/[^\d.,]/g, '').replace(',', '.'));

    expect(finalVal).toBeCloseTo(cpredl * 1.2, 0);

    // Label should mention НДС
    const label = await page.textContent('#finalPriceLabel');
    expect(label).toContain('НДС');
  });

  test('selecting УСН does not add tax', async ({ page }) => {
    const cpredlText = await page.textContent('#cpredlValue');
    const cpredl = parseFloat(cpredlText.replace(/[^\d.,]/g, '').replace(',', '.'));

    await page.check('input[name="taxType"][value="usn"]');

    const finalText = await page.textContent('#finalPriceValue');
    const finalVal = parseFloat(finalText.replace(/[^\d.,]/g, '').replace(',', '.'));

    expect(finalVal).toBeCloseTo(cpredl, 0);

    // НДС line should be hidden
    const ndsLine = page.locator('#ndsLine');
    await expect(ndsLine).toBeHidden();

    const label = await page.textContent('#finalPriceLabel');
    expect(label).toContain('УСН');
  });

  test('"без налога" shows plain Цпредл', async ({ page }) => {
    const cpredlText = await page.textContent('#cpredlValue');
    const cpredl = parseFloat(cpredlText.replace(/[^\d.,]/g, '').replace(',', '.'));

    await page.check('input[name="taxType"][value="none"]');

    const finalText = await page.textContent('#finalPriceValue');
    const finalVal = parseFloat(finalText.replace(/[^\d.,]/g, '').replace(',', '.'));

    expect(finalVal).toBeCloseTo(cpredl, 0);
  });

  test('amount in words is displayed', async ({ page }) => {
    const words = await page.textContent('#finalPriceWords');
    expect(words.length).toBeGreaterThan(10);
    expect(words).toContain('белорусск');
    expect(words).toContain('рубл');
  });
});

test.describe('Calculator - Excel Export', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
    await page.fill('#cost', '28815');
    await page.selectOption('#month', '3');
    await page.selectOption('#year', '2026');
    await page.click('button:has-text("Рассчитать")');
    await page.check('input[data-nzt-id="9.1"]');
    const subCheckboxes = page.locator('#nzt_9_1_subfunctions input[type="checkbox"]');
    await subCheckboxes.first().check();
  });

  test('Excel export button appears', async ({ page }) => {
    const btn = page.locator('button:has-text("Экспорт в Excel")');
    await expect(btn).toBeVisible();
  });

  test('Excel export button hidden when no NZT selected', async ({ page }) => {
    // Uncheck all NZT
    const subCheckboxes = page.locator('#nzt_9_1_subfunctions input[type="checkbox"]');
    await subCheckboxes.first().uncheck();
    await page.uncheck('input[data-nzt-id="9.1"]');

    const btn = page.locator('#excelExportSection');
    await expect(btn).toBeHidden();
  });
});

test.describe('Calculator - numberToWordsRu', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test('converts simple number', async ({ page }) => {
    const result = await page.evaluate(() => numberToWordsRu(515.15));
    expect(result.toLowerCase()).toContain('пятьсот пятнадцать');
    expect(result).toContain('белорусск');
    expect(result).toContain('15 копеек');
  });

  test('converts thousands', async ({ page }) => {
    const result = await page.evaluate(() => numberToWordsRu(1234.56));
    expect(result).toContain('тысяч');
    expect(result).toContain('56 копеек');
  });

  test('converts millions', async ({ page }) => {
    const result = await page.evaluate(() => numberToWordsRu(2500000));
    expect(result).toContain('миллион');
  });

  test('converts billions', async ({ page }) => {
    const result = await page.evaluate(() => numberToWordsRu(1500000000));
    expect(result).toContain('миллиард');
  });

  test('handles zero', async ({ page }) => {
    const result = await page.evaluate(() => numberToWordsRu(0));
    expect(result).toContain('0');
    expect(result).toContain('рублей');
  });

  test('handles feminine form for thousands (одна тысяча)', async ({ page }) => {
    const result = await page.evaluate(() => numberToWordsRu(1000));
    expect(result.toLowerCase()).toContain('одна тысяча');
  });

  test('handles две тысячи', async ({ page }) => {
    const result = await page.evaluate(() => numberToWordsRu(2000));
    expect(result.toLowerCase()).toContain('две тысячи');
  });
});

test.describe('Calculator - parseFormatted', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test('parses Russian formatted number with comma', async ({ page }) => {
    const result = await page.evaluate(() => parseFormatted('3,99'));
    expect(result).toBeCloseTo(3.99);
  });

  test('parses number with spaces and comma', async ({ page }) => {
    const result = await page.evaluate(() => parseFormatted('1 355,67'));
    expect(result).toBeCloseTo(1355.67);
  });

  test('parses number with text around it', async ({ page }) => {
    const result = await page.evaluate(() => parseFormatted('Цпредл = 429,30 руб.'));
    expect(result).toBeCloseTo(429.30);
  });

  test('returns 0 for empty input', async ({ page }) => {
    const result = await page.evaluate(() => parseFormatted(''));
    expect(result).toBe(0);
  });

  test('returns 0 for null', async ({ page }) => {
    const result = await page.evaluate(() => parseFormatted(null));
    expect(result).toBe(0);
  });
});
