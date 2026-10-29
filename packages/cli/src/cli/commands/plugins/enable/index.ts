import { arg, summary } from 'paparam'
import { DEVICE, flags } from '../../../flags.js'
import { command } from '../../command.js'

export const enable = () =>
  command(
    'enable',
    {
      where: 'launcher',
      run: (...a: Parameters<(typeof import('../plugins.js'))['runEnable']>) =>
        import('../plugins.js').then((m) => m.runEnable(...a))
    },
    summary('Turn an installed plugin, or a catalog one, on'),
    arg('<name>', 'An installed plugin or a catalog id'),
    ...flags(DEVICE)
  )
