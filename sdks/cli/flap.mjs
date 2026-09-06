#!/usr/bin/env node
/** Thin Flap CLI: flap send | flap domains */
import { Flap } from "../typescript/index.js";

const [, , cmd, ...rest] = process.argv;
const key = process.env.FLAP_API_KEY;
if (!key) {
  console.error("Set FLAP_API_KEY");
  process.exit(1);
}
const client = new Flap(key);
if (cmd === "domains") {
  console.log(JSON.stringify(await client.domains(), null, 2));
} else if (cmd === "send") {
  const body = JSON.parse(rest[0] || "{}");
  console.log(JSON.stringify(await client.send(body), null, 2));
} else {
  console.log("Usage: flap domains | flap send JSON");
  process.exit(1);
}
