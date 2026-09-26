import { jsonLdScript } from '@/lib/json-ld'

// One structured-data block, escaped (see lib/json-ld.ts). Server component:
// the JSON-LD lands in the HTML crawlers read, not in a client bundle.
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
}
