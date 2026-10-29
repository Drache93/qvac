import { arg, summary } from 'paparam'
import { DEVICE, flags } from '../../../flags.js'
import { command } from '../../command.js'

export const disable = () =>
  command(
    'disable',
    {
      where: 'launcher',
      run: (...a: Parameters<(typeof import('../plugins.js'))['runDisable']>) =>
        import('../plugins.js').then((m) => m.runDisable(...a))
    },
    summary('Turn a plugin off; its options stay'),
    arg('<name>', 'The plugin to turn off'),
    ...flags(DEVICE)
  )
