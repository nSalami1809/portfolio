// JSON.stringify doesn't escape `<`, so a CMS field containing `</script>`
// (or `<!--`) inside JSON-LD would break out of the tag it's embedded in.
// Inputs here are admin-authored today, but escaping costs nothing and
// removes the injection surface entirely regardless of who fills the fields.
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}
