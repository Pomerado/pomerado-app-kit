// Copies the stylesheet next to the compiled code, since tsc only emits .js and .d.ts.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
copyFileSync("src/styles.css", "dist/styles.css");
