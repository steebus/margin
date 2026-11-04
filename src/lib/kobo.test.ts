import { expect, test } from 'vitest'
import { koboBookmarklet, planKobo, readKoboFragment } from './kobo'

const ID = '72d6536c-353d-4406-8dfe-f58f2ed16f3f'
const shelf = (title: string, status: string, percent: number) => ({ readId: title, title, author: 'An Author', status, percent })

test('Kobo only moves books forward, links what it can, and skips what was never bought', () => {
  const plan = planKobo([
    { koboId: ID, title: 'Ahead', author: 'An Author', statusText: '33% read' },
    { koboId: null, title: 'Done', author: 'An Author', statusText: 'Finished' },
    { koboId: null, title: 'Behind', author: 'An Author', statusText: '5% read' },
    { koboId: null, title: 'Already read', author: 'An Author', statusText: '10% read' },
    { koboId: null, title: 'New one', author: 'Someone', statusText: 'Unread' },
    { koboId: null, title: 'Sample', author: 'Someone', statusText: 'Buy Now $15.99' },
  ], [shelf('Ahead', 'reading', 10), shelf('Done', 'reading', 90), shelf('Behind', 'reading', 50), shelf('Already read', 'read', 100)])
  expect(plan.link.map(l => [l.book.title, l.koboId])).toEqual([['Ahead', ID]])
  expect(plan.progress.map(p => [p.book.title, p.percent])).toEqual([['Ahead', 33]])
  expect(plan.finish.map(b => b.title)).toEqual(['Done'])
  expect(plan.add.map(a => [a.kobo.title, a.status])).toEqual([['New one', 'tbr']])
  expect(plan.skipped).toBe(1)
})

test('the fragment the bookmarklet sends is read back, and anything else is refused', () => {
  const sent = [{ koboId: ID, title: 'A', author: 'B', statusText: 'Finished' }, { koboId: 'nope', title: 'C', author: 'D', statusText: '' }]
  expect(readKoboFragment('#' + encodeURIComponent(JSON.stringify(sent)))).toEqual([sent[0], { ...sent[1], koboId: null }])
  expect(readKoboFragment('#nonsense')).toBeNull()
  expect(koboBookmarklet('https://margin.example')).toContain("location.href='https://margin.example/settings/integrations/kobo#'")
  // It must parse as a script once the javascript: prefix is gone.
  expect(() => new Function(koboBookmarklet('https://m').slice('javascript:'.length))).not.toThrow()
})
