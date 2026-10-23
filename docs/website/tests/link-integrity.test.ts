import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateLinks,
  extractInternalLinks,
  contentPathsOfLink,
} from '../scripts/lib/link-validator'
import {
  getCurrentLine,
  getDocumentedSoftware,
  isCurrentLineFolder,
} from '../src/lib/versions'

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEBSITE_DIR = path.resolve(TESTS_DIR, '..')
const DOCS_BASE = path.join(WEBSITE_DIR, 'content', 'docs')

// ---------------------------------------------------------------------------
// Unit tests for link extraction
// ---------------------------------------------------------------------------

describe('extractInternalLinks', () => {
  it('extracts href links', () => {
    expect(extractInternalLinks('see <a href="/sdk/quickstart">here</a>'))
      .toEqual(['/sdk/quickstart'])
  })

  it('extracts markdown links', () => {
    expect(extractInternalLinks('see [Errors](/reference/api/errors) for details'))
      .toEqual(['/reference/api/errors'])
  })

  it('strips hash fragments', () => {
    expect(extractInternalLinks('see [type](/reference/api/completion#completionparams)'))
      .toEqual(['/reference/api/completion'])
  })

  it('ignores pure hash links', () => {
    expect(extractInternalLinks('see [type](#completionparams)'))
      .toEqual([])
  })

  it('ignores links inside an MDX comment', () => {
    const content = [
      '[live](/sdk/quickstart)',
      '{/* <Card href="/sdk/kotlin-sdk" /> and [parked](/sdk/kotlin-sdk) */}',
    ].join('\n')
    expect(extractInternalLinks(content)).toEqual(['/sdk/quickstart'])
  })

  it('ignores links inside a multi-line MDX comment', () => {
    const content = [
      '{/*',
      '  Waiting on a release.',
      '  <Card href="/sdk/kotlin-sdk" title="Kotlin SDK" />',
      '*/}',
      '[live](/sdk/quickstart)',
    ].join('\n')
    expect(extractInternalLinks(content)).toEqual(['/sdk/quickstart'])
  })

  it('deduplicates links', () => {
    const content = '[a](/foo) and [b](/foo) and [c](/bar)'
    const links = extractInternalLinks(content)
    expect(links).toContain('/foo')
    expect(links).toContain('/bar')
    expect(links.filter((l) => l === '/foo')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// A link into a versioned collection names no line, so where it resolves
// depends on the page carrying it. These cover that resolution directly,
// since the tree only exercises the paths its content happens to link.
// ---------------------------------------------------------------------------

describe('contentPathsOfLink', () => {
  // Read from the manifest rather than written out: a cut moves the group, and
  // a test naming it would have to be edited by every cut.
  const sdkGroup = getCurrentLine(getDocumentedSoftware('/sdk')!)!.folder

  // A plain line comes from the manifest for the same reason: the oldest lines
  // are retired as newer ones are cut, so a test naming one would break on the
  // retirement rather than on the behaviour it covers.
  const sdkLine = getDocumentedSoftware('/sdk')!.versions.find(
    (entry) => !isCurrentLineFolder(entry.folder),
  )!.folder

  it("resolves a same-collection link in the reader's own line", () => {
    expect(contentPathsOfLink('/sdk/quickstart', `sdk/${sdkLine}/index.mdx`)[0])
      .toBe(`sdk/${sdkLine}/quickstart`)
  })

  it('resolves a link from the current line inside the group', () => {
    expect(contentPathsOfLink('/sdk/quickstart', `sdk/${sdkGroup}/index.mdx`)[0])
      .toBe(`sdk/${sdkGroup}/quickstart`)
  })

  it('resolves a link arriving from another collection in the current line', () => {
    expect(contentPathsOfLink('/sdk/quickstart', 'ecosystem/index.mdx')[0])
      .toBe(`sdk/${sdkGroup}/quickstart`)
  })

  it('leaves a link that names its version alone', () => {
    expect(contentPathsOfLink(`/sdk/${sdkLine}/quickstart`, 'ecosystem/index.mdx'))
      .toEqual([`sdk/${sdkLine}/quickstart`])
  })

  it('leaves a link to an unversioned collection alone', () => {
    expect(contentPathsOfLink('/ecosystem/addons', `sdk/${sdkLine}/index.mdx`))
      .toEqual(['ecosystem/addons'])
  })

  it('points a link at a page missing from the line, so the check fails', () => {
    const [inLine] = contentPathsOfLink('/sdk/nowhere', `sdk/${sdkLine}/index.mdx`)
    expect(inLine).toBe(`sdk/${sdkLine}/nowhere`)
    expect(fs.existsSync(path.join(DOCS_BASE, `${inLine}.mdx`))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Integration test: validate every internal link in the docs tree.
// ---------------------------------------------------------------------------

describe('docs link integrity', () => {
  it('has no broken internal links', async () => {
    const broken = await validateLinks(DOCS_BASE, DOCS_BASE)
    if (broken.length > 0) {
      const details = broken
        .map((b) => `  ${b.source} → ${b.target}`)
        .join('\n')
      expect.fail(`Found ${broken.length} broken link(s):\n${details}`)
    }
  })

  // The tree-wide check accepts a link that resolves at the collection's
  // literal path, for a collection not yet cut into lines. The SDK has been
  // cut, so its links get the stricter reading: each one must exist inside
  // the line of the page carrying it, with no fallback.
  it('resolves every SDK link inside its own line', () => {
    const lines = (getDocumentedSoftware('/sdk')?.versions ?? []).map(
      (version) => version.folder,
    )
    const offenders: string[] = []

    for (const line of lines) {
      const root = path.join(DOCS_BASE, 'sdk', line)
      for (const file of walk(root)) {
        const source = path.relative(DOCS_BASE, file).replaceAll('\\', '/')
        const links = extractInternalLinks(fs.readFileSync(file, 'utf-8'))

        for (const link of links.filter((l) => l.startsWith('/sdk'))) {
          const [inLine] = contentPathsOfLink(link, source)
          const lineRoot = `sdk/${line}`
          if (inLine !== lineRoot && !inLine.startsWith(`${lineRoot}/`)) {
            offenders.push(`${source} → ${link} left the line`)
            continue
          }
          const found = ['.mdx', '.md', '/index.mdx', '/index.md'].some((end) =>
            fs.existsSync(path.join(DOCS_BASE, inLine + end)),
          )
          if (!found) offenders.push(`${source} → ${link} (${inLine})`)
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return /\.mdx?$/.test(entry.name) ? [full] : []
  })
}
