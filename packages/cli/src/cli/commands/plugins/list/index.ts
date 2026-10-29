import { summary } from 'paparam'
import { DEVICE, flags } from '../../../flags.js'
import { command } from '../../command.js'

export const list = () =>
  command(
    'list',
    {
      where: 'launcher',
      run: (...a: Parameters<(typeof import('../plugins.js'))['runList']>) =>
        import('../plugins.js').then((m) => m.runList(...a))
    },
    summary('Installed plugins and whether each is enabled'),
    ...flags(DEVICE)
  )
