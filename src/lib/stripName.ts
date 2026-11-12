/** The strip card's accessible name. It has to hold the words printed on the card (the author, or "Audiobook"
 *  in the author's place, and the percent), or a voice-control user can't say what they see. */
export function stripName(book: { title: string; author: string; format: string; percent: number }): string {
  const who = book.format === 'audio' ? `${book.author ? `${book.author}, ` : ''}Audiobook` : book.author
  return `${book.title}${who ? ` by ${who}` : ''}, ${book.percent}%`
}
