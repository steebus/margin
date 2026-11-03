import { expect, test } from 'vitest'
import { parseDelimited, planAudible, readAudible } from './audible'

const TSV = [
  'asin\ttitle\tsubtitle\tauthors\tnarrators\truntime_length_min\tis_finished\tpercent_complete\tdate_added',
  'B01\tProject Hail Mary\t\tAndy Weir\tRay Porter\t970\tTrue\t100\t2021-05-04',
  'B02\tThe Will of the Many\tHierarchy, Book 1\tJames Islington\tEuan Morton\t1200\tFalse\t42.6\t2023-06-01',
  'B03\tDune\t\tFrank Herbert, Brian Herbert\tScott Brick\t1260\tFalse\t0\t2020-01-01',
  'B04\tA Free Book\t\tSomeone\tX\t60\tFalse\t0\t2019-01-01',
].join('\n')

test("audible-cli's export becomes books, whatever its format", () => {
  const books = readAudible(TSV)
  expect(books.map(b => [b.title, b.author, b.finished, b.percent])).toEqual([
    ['Project Hail Mary', 'Andy Weir', true, 100],
    ['The Will of the Many', 'James Islington', false, 43],
    ['Dune', 'Frank Herbert', false, 0],
    ['A Free Book', 'Someone', false, 0],
  ])
  expect(readAudible('asin,title,authors,is_finished,percent_complete\nB09,"Quiet, Please","Jo Bloggs",false,10')).toMatchObject([{ title: 'Quiet, Please', author: 'Jo Bloggs', percent: 10 }])
  expect(readAudible(JSON.stringify([{ asin: 'B1', title: 'Stoner', authors: [{ name: 'John Williams' }], is_finished: true }]))).toMatchObject([{ title: 'Stoner', author: 'John Williams', finished: true }])
  expect(readAudible('not an export')).toEqual([])
  expect(parseDelimited('a,b\n"one ""two""","x\ny"')).toEqual([{ a: 'one "two"', b: 'x\ny' }])
})

test('the plan only moves books forward, and sorts the rest into what to add', () => {
  const shelf = (title: string, author: string, status: string, percent: number) => ({ readId: title, title, author, status, percent })
  const plan = planAudible(readAudible(TSV), [
    shelf('Project Hail Mary', 'Andy Weir', 'reading', 60),
    shelf('The Will of the Many: Hierarchy', 'James Islington', 'reading', 50),
  ])
  expect(plan.finish.map(f => f.book.title)).toEqual(['Project Hail Mary'])
  expect(plan.progress).toEqual([])
  expect(plan.same).toBe(1)
  expect(plan.addUnstarted.map(a => a.title)).toEqual(['Dune', 'A Free Book'])

  const again = planAudible(readAudible(TSV), [shelf('The Will of the Many', 'James Islington', 'reading', 10), shelf('Project Hail Mary', 'Andy Weir', 'read', 100)])
  expect(again.progress.map(p => [p.book.title, p.audible.percent])).toEqual([['The Will of the Many', 43]])
  expect(again.finish).toEqual([])
})
