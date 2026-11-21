/** Daily participant user_id for a seat — how the table maps video tiles to seats. Shared by server + client. */
export const seatUserId = (seat: number) => `seat-${seat}`;
