// Private compatibility boundary for the former js-yaml 4 default schema.
// Built against retained miniyaml sources; public miniyaml remains YAML Core.
import { load } from '@miniyaml/load.ts'
import { CORE_SCHEMA } from '@miniyaml/schema.ts'
import { NOT_RESOLVED } from '@miniyaml/tag.ts'
import { intCoreTag } from '@miniyaml/tag/scalar/int_core.ts'
import { floatCoreTag } from '@miniyaml/tag/scalar/float_core.ts'
import { timestampTag } from '@miniyaml/tag/scalar/timestamp.ts'
import { mergeTag } from '@miniyaml/tag/scalar/merge.ts'
import { binaryTag } from '@miniyaml/tag/scalar/binary.ts'
import { omapTag } from '@miniyaml/tag/sequence/omap.ts'
import { pairsTag } from '@miniyaml/tag/sequence/pairs.ts'
import { legacyMapTag } from '@miniyaml/tag/mapping/legacy_map.ts'
import { resolveTimestamp } from './timestamp.mjs'

const schema = CORE_SCHEMA.withTags(
  {
    ...intCoreTag,
    resolve(source) {
      const result = intCoreTag.resolve(source, true, intCoreTag.tagName)
      // v4 treats decimal -0 as integer zero, but preserves signed radix zero.
      return /^[-+]?0$/.test(source) ? 0 : result
    }
  },
  {
    ...floatCoreTag,
    resolve(source) {
      // v4 only accepts a leading decimal point without a sign.
      return /^[+-]\.[0-9]/.test(source)
        ? NOT_RESOLVED
        : floatCoreTag.resolve(source, true, floatCoreTag.tagName)
    }
  },
  { ...timestampTag, resolve: resolveTimestamp },
  mergeTag,
  binaryTag,
  omapTag,
  pairsTag,
  legacyMapTag,
  {
    ...legacyMapTag,
    tagName: 'tag:yaml.org,2002:set',
    addPair(container, key, value) {
      return value === null
        ? legacyMapTag.addPair(container, key, value)
        : 'cannot resolve a set item'
    }
  }
)

export function parse(source) {
  return load(source, { schema })
}
