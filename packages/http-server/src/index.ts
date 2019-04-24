import LoggerClient from '@blued-core/winston-logger'
import Cache from '@blued-core/cache'
import RavenClient from '@blued-core/raven-client'
import StatsdClient from '@blued-core/statsd-client'
import { NormalConf } from '@blued-core/normal-conf'
import { createServer as _baseCreateServer, HttpConfig } from '@blued-core/http-server-base'
import { MiddlewareConfig } from '@blued-core/http-server-base/dist/init-middleware'

export * from '@blued-core/http-server-base'

export const baseCreateServer = _baseCreateServer

export function createServer ({
  logPath,
  ravenUrl,
  statsd,
  isLocal,
  ...configs
}: MiddlewareConfig & HttpConfig & {
  logPath?: string,
  ravenUrl?: string,
  statsd?: {
    host: string,
    port: number,
    group: string,
    project: string,
  },
} = { }) {
  const cache = new Cache()

  let loggerClient: LoggerClient | undefined
  if (logPath) {
  // 加载 log
    loggerClient = new LoggerClient(logPath, cache, isLocal)
  }

  const normalConf = new NormalConf({
    raven: ravenUrl,
    statsd,
  })

  let ravenClient: RavenClient | undefined
  if (ravenUrl) {
  // 加载 raven
    ravenClient = new RavenClient(normalConf, cache, isLocal)
  }

  let statsdClient: StatsdClient | undefined

  if (statsd) {
  // 加载 statsd
    statsdClient = new StatsdClient(normalConf, cache, isLocal)
  }

  _baseCreateServer({
    ...configs,
    loggerClient,
    errorReportClient: ravenClient ? () => ravenClient.getClient('raven') : undefined,
    performanceClient: statsdClient ? () => statsdClient.getClient('statsd') : undefined,
  })
}