import { test, expect } from '@playwright/test'

test('studio renders, arrangement edits undo, and exports carry actual geometry', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Element library' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Pause rotation', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play rotation', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/studio-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Select Circle shape', exact: true }).click()
  await page.getByRole('button', { name: 'Slot A1: empty', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Slot A1: circle, 0 degrees', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Rotate selected element', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Slot A1: circle, 90 degrees', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Slot A1: circle, 0 degrees', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Slot A2: empty', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Slot A2: circle, 0 degrees', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Set element color to Mint', exact: true }).click()
  await page.getByRole('button', { name: 'Export cut plan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your cut sheets' })).toBeVisible()
  await expect(page.locator('.cut-sheet-svg svg')).toBeVisible()
  await page.screenshot({ path: 'test-results/cut-plan.png', fullPage: true })
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toMatch(/\.svg$/)
  const stream = await download.createReadStream()
  let text = ''
  for await (const chunk of stream!) text += chunk.toString()
  expect(text).toContain('width="600mm"')
  expect(text).toContain('<path')
  expect(text).not.toContain('<text')
  const width = page.getByRole('spinbutton', { name: 'Width mm', exact: true })
  await width.fill('200')
  await width.press('Tab')
  await expect(page.getByRole('heading', { name: 'Let’s adjust the fit.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download SVG', exact: true })).toBeDisabled()
  await width.fill('600')
  await width.press('Tab')
  await expect(page.locator('.cut-sheet-svg svg')).toBeVisible()
  expect(errors.filter((e) => !e.includes('fonts.googleapis') && !e.includes('ERR_CERT'))).toEqual(
    [],
  )
})

test('mobile workspace stays within viewport and project survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Pause rotation', exact: true }).click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Select Triangle shape', exact: true }).click()
  await page.getByRole('button', { name: 'Slot A1: empty', exact: true }).click()
  await expect(page.getByText('Saved locally', { exact: true })).toBeAttached()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBeTruthy()
  await page.screenshot({ path: 'test-results/studio-mobile.png', fullPage: true })
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Slot A1: triangle, 0 degrees', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Export cut plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Download SVG', exact: true })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBeTruthy()
})

test('studio and cut-plan controls meet automated accessibility checks', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 })
  const studio = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  await page.getByRole('button', { name: 'Export cut plan', exact: true }).click()
  const cut = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const violations = [...studio.violations, ...cut.violations].map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
  }))
  expect(violations).toEqual([])
})
