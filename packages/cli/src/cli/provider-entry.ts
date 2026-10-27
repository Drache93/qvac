import process from 'bare-process'
import { providerOperation } from '../lib/runtime/provider-operation.js'
try {
  console.log(JSON.stringify(await providerOperation(Bare.argv.slice(2))))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
