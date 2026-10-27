import { arg, summary } from 'paparam'
import { DEVICE, flags } from '../../flags.js'
import { command } from '../command.js'
const operation = (name: string, description: string) =>
  command(
    name,
    {
      where: 'launcher',
      run: (...args: Parameters<(typeof import('./provider.js'))['runProvider']>) =>
        import('./provider.js').then((module) => module.runProvider(...args))
    },
    summary(description),
    arg('<file>', 'A release pin JSON file, or staged directory for publish'),
    ...flags(DEVICE)
  )
export const provider = () =>
  command(
    'provider',
    {},
    summary('Prepare immutable optional Python and QuickJS runtimes'),
    operation('prepare', 'Download a trusted provider pin into this device’s offline cache'),
    operation('publish', 'Publish a locally built provider into this device’s offline cache')
  )
