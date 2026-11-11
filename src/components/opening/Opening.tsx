/** The loading line: "Opening your desk" in the typewriter face, its dots typed one at a time. Waits a beat before
 *  it shows, so a quick answer never flashes it. */
export function Opening({ what }: { what: string }) {
  return (
    <p className="opening" role="status">
      {`Opening ${what}`}<span className="opening-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
    </p>
  )
}
