import { query as pgQuery } from "@/lib/db/postgres";

export function toLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export { pgQuery as query };
