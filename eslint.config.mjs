import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Destructuring a field solely to discard it (e.g. `const { id: _, ...rest } = x`)
      // is an intentional, readable way to omit a key — don't flag the `_`.
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
  },
  // The admin assistant (src/lib/assistant) is read-only on site data: it must not
  // be able to even import what changes the portfolio, sends mail or touches
  // uploaded files. Reads reach it through injected dependencies (see tools.ts).
  {
    files: ["src/lib/assistant/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/actions/*"], message: "The assistant must not import Server Actions: they write site data." },
            { group: ["@/lib/portfolio-data"], message: "Site data reaches the assistant through the injected dependencies only." },
            { group: ["@/lib/mailer", "@/lib/mail-safe", "@/lib/email-*", "@/lib/push", "@/lib/blob-upload", "@/lib/upload", "@/lib/backup*", "nodemailer", "web-push", "@vercel/blob"], message: "The assistant must not send messages or touch stored files." },
            { group: ["next/cache"], message: "The assistant must not invalidate or refresh site caches." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
