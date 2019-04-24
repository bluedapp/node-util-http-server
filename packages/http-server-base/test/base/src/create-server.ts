// import HttpServer from '@blued-core/http-server-base'
import LoggerClient from '@blued-core/winston-logger'
import Cache from '@blued-core/cache'
import RavenClient from '@blued-core/raven-client'
import StatsdClient from '@blued-core/statsd-client'
import { NormalConf } from '@blued-core/normal-conf'
import { createServer } from '../../../dist'

export function create ({
  port,
  logPath,
  ravenUrl,
  statsd,
  isLocal,
}: {
  port?: number,
  logPath?: string,
  ravenUrl?: string,
  statsd?: {
    conf: string,
    port: number,
    group: string,
    project: string,
  },
  isLocal?: boolean,
} = {}) {
  const cache = new Cache()
  // 加载 log
  const loggerClient = new LoggerClient(logPath, cache, isLocal)

  const normalConf = new NormalConf({
    raven: ravenUrl,
    statsd,
  })
  // 加载 raven
  const ravenClient = new RavenClient(normalConf, cache)
  ravenClient.isLocal = isLocal

  // 加载 statsd
  const statsdClient = new StatsdClient(normalConf, cache)
  statsdClient.isLocal = isLocal

  createServer({
    port,
    loggerClient,
    errorReportClient () {
      return ravenClient.getClient('raven')
    },
    performanceClient () {
      return statsdClient.getClient('statsd')
    },
  })
}