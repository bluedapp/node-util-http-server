// import HttpServer from '@blued-core/http-server-base'
import path from 'path'
import LoggerClient from '@blued-core/winston-logger'
import Cache from '@blued-core/cache'
// import RavenClient from '@blued-core/raven-client'
import StatsdClient from '@blued-core/statsd-client'
import { NormalConf } from '@blued-core/normal-conf'
// import { createServer } from '@blued-core/http-server-base'
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
  // const ravenClient = new RavenClient(normalConf, cache, isLocal)

  // 加载 statsd
  const statsdClient = new StatsdClient(normalConf, cache, isLocal)

  createServer({
    port,
    loggerClient,
    controllersPath: path.join(__dirname, 'controllers'),
    logRule: [{
      disable: false,
      match: /test1/,
      href: false,
      ip: true,
      header: true,
      exceptError: true,
    }, {
      disable: false,
      match: /^\/test2/,
      header: {
        include: ['host'],
      },
    }, {
      disable: false,
      match: /^\/test3/,
      header: {
        exclude: ['host'],
      },
    }, {
      disable: true,
      match: /^\/test4/,
    }],
    // errorReportClient () {
    //   return ravenClient.getClient('raven')
    // },
    performanceClient () {
      return statsdClient.getClient('statsd')
    },
  })

  // createServer({
  //   port,
  //   loggerClient,
  //   controllersPath: path.join(__dirname, 'controllers'),
  //   logRule: {
  //     disable: true,
  //   },
  //   // errorReportClient () {
  //   //   return ravenClient.getClient('raven')
  //   // },
  //   performanceClient () {
  //     return statsdClient.getClient('statsd')
  //   },
  // })
}