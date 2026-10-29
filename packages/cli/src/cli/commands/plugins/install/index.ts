import { arg, summary } from 'paparam'
import { DEVICE, flags } from '../../../flags.js'
import { command } from '../../command.js'

export const install = () =>
  command(
    'install',
    {
      where: 'launcher',
      run: (...a: Parameters<(typeof import('../plugins.js'))['runInstall']>) =>
        import('../plugins.js').then((m) => m.runInstall(...a))
    },
    summary('Add a plugin from a git URL or hyper:// drive; it stays off until enabled'),
    arg('<source>', 'A git URL, or hyper://<key>'),
    arg('[name]', 'The folder name (default: the repo name; required for hyper://)'),
    ...flags(DEVICE)
  )
