import { randomInt } from "crypto";

// Ticket references are read aloud and typed in at the event entrance, so the
// alphabet omits characters that are easily confused (0/O, 1/I/L, U/V).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ";
const LENGTH = 8;

export function generateReference() {
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

// Accepts what a person might type: lower case, missing dash, stray spaces.
export function normaliseReference(input: string) {
  const cleaned = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (cleaned.length !== LENGTH) return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}
