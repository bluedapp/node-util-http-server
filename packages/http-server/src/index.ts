import LoggerClient from '@blued-core/winston-logger'
import Cache from '@blued-core/cache'
import ExceptionReportClient from '@blued-core/exception-report-client'
import PerformanceClient from '@blued-core/performance-client'
import { NormalConf } from '@blued-core/normal-conf'
import { createServer as _baseCreateServer, HttpConfig } from '@blued-core/http-server-base'
import { MiddlewareConfig } from '@blued-core/http-server-base/dist/init-middleware'

export * from '@blued-core/http-server-base'

export const baseCreateServer = _baseCreateServer

export function createServer ({
  logPath,
  exceptionReportUrl,
  performanceConfig,
  isLocal,
  ...configs
}: MiddlewareConfig & HttpConfig & {
  logPath?: string,
  exceptionReportUrl?: string,
  performanceConfig?: {
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
    exceptionReportUrl,
    performanceConfig,
  })

  let exceptionReportClient: ExceptionReportClient | undefined
  if (exceptionReportUrl) {
  // 加载 raven
    exceptionReportClient = new ExceptionReportClient(normalConf, cache, isLocal)
  }

  let performanceClient: PerformanceClient | undefined

  if (performanceConfig) {
  // 加载 statsd
    performanceClient = new PerformanceClient(normalConf, cache, isLocal)
  }

  _baseCreateServer({
    ...configs,
    loggerClient,
    exceptionReportClient: exceptionReportClient ? () => exceptionReportClient.getClient('exceptionReportUrl') : undefined,
    performanceClient: performanceClient ? () => performanceClient.getClient('performanceConfig') : undefined,
  })
}