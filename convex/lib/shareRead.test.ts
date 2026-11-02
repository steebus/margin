import { expect, test } from 'vitest'
import { instagramCaption, parseMentions, sameBook, titlesFrom } from './shareRead'

const embed = `<div class="Caption"><a class="CaptionUsername" href="x">bookish.jo</a><br/>Three I loved:<br/>Piranesi &amp; Stoner<br/><br/><br/>&#x2764; more<div class="CaptionComments">x</div></div>`

test('the account and words come off an embed page, and a page without them says so', () => {
  expect(instagramCaption(embed)).toEqual({ account: 'bookish.jo', caption: 'Three I loved:\nPiranesi & Stoner\n\n❤ more' })
  expect(instagramCaption('<html>an app shell</html>')).toEqual({ account: null, caption: null })
})

test('named books come out of the reply, and rubbish becomes nothing', () => {
  expect(parseMentions('{"books":[{"title":" Stoner ","author":"John Williams","confidence":0.9},{"title":"","confidence":1},{"title":"Piranesi"}]}')).toEqual([
    { title: 'Stoner', author: 'John Williams', confidence: 0.9 },
    { title: 'Piranesi', author: null, confidence: 0.5 },
  ])
  expect(parseMentions('sorry')).toEqual([])
  expect(parseMentions('{"books":"none"}')).toEqual([])
})

test('a search result only counts as the named book if the title really is it', () => {
  expect(sameBook('The Overstory', 'Overstory')).toBe(true)
  expect(sameBook('Homo Deus', 'Homo Deus: A Brief History of Tomorrow')).toBe(true)
  expect(sameBook("Piranési", 'Piranesi')).toBe(true)
  expect(sameBook('Stoner', 'Stonehenge')).toBe(false)
  expect(sameBook('', 'Stoner')).toBe(false)
})

test('typed titles lose their list marks and repeats', () => {
  expect(titlesFrom('1. Stoner\n- Piranesi\n\n  Stoner\n')).toEqual(['Stoner', 'Piranesi'])
})
