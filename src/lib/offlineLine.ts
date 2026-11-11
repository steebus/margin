/** The quiet line about the connection: nothing when online with nothing waiting (SPEC 4; backlog U7). */
export function offlineLine(online: boolean, waiting: number): string | null {
  const notes = waiting === 1 ? '1 note or place' : `${waiting} notes and places`
  if (!online) return waiting > 0 ? `Offline: showing your last visit. ${notes} waiting to send.` : 'Offline: showing your last visit.'
  return waiting > 0 ? `${notes} waiting to send.` : null
}
