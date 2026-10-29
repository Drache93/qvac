import { summary } from 'paparam'
import { DEVICE, flags } from '../../flags.js'
import { command } from '../command.js'
import { disable } from './disable/index.js'
import { enable } from './enable/index.js'
import { install } from './install/index.js'
import { list } from './list/index.js'

export const plugins = () =>
  command(
    'plugins',
    {},
    summary('List, install, enable or disable plugins'),
    ...flags(DEVICE),
    list(),
    install(),
    enable(),
    disable()
  )
