import { KoaMiddlewareInterface, Middleware } from 'routing-controllers'

import { Context } from 'koa'
import { LoggerIntl } from '@blued-core/logger-intl'
import { ErrorReportClientInstance, PerformanceClientInstance } from '@blued-core/client-intl'
import { NotFoundError } from './errors'

type ErrorReportBuilder = () => ErrorReportClientInstance
type PerformanceClientBuilder = () => PerformanceClientInstance

export interface MiddlewareDirver {
  // 日志服务的驱动
  loggerClient?: LoggerIntl,
  // 异常监控处理的驱动
  errorReportClient?: ErrorReportBuilder,
  // 性能监控的驱动
  performanceClient?: PerformanceClientBuilder,
}

export interface MiddlewareConfig {
  // 一个前置的中间件处理
  before?: (ctx: Context) => Promise<any>
  // 一个后置的中间件处理
  after?: (ctx: Context) => Promise<any>
}

const emptyTypes: any[] = [undefined, null, 0, false, '']
const successCode = 200
const internalErrorCode = 500

export default ({
  before,
  after,
  loggerClient,
  performanceClient,
  errorReportClient,
}: MiddlewareConfig & MiddlewareDirver) => {
  const hasLogger = !emptyTypes.includes(loggerClient)
  const hasPerformance = !emptyTypes.includes(performanceClient)
  const hasErrorReport = !emptyTypes.includes(errorReportClient)

  @Middleware({ type: 'before' })
  class ResponseHandler implements KoaMiddlewareInterface {
    async use(context: Context, next: Function) {
      const start = Date.now()
      let logger = null

      if (hasLogger) {
        logger = loggerClient.getLogger(translatePath(context.path))
      }

      const { method, request } = context
      const { href, header, ip } = request
      const {
        'x-request-id': requestId,
        'content-type': contentType,
      } = header

      const useJsonResponse = /^(application\/)?json$/i.test(contentType)

      const isGetRequest = method === 'GET'
      const requestBody = isGetRequest ? context.request.query : context.request.body
      const logBody = {
        href,
        header,
        ip,
        method,
        requestBody,
      }
      try {
        // POST 输出 body
        if (logger) {
          logger.access(logBody)
        }
        if (before) {
          await before(context)
        }
        await next()

        let data = context.body

        if (!data) throw new NotFoundError()

        // 命中则进行异常处理
        if (data && data.name && data.name.endsWith('Error')) throw data

        context.status = successCode
        const end = Date.now()

        // 如果 Content-Type 不是 json，并且 data 返回值类型也不是 object 类型
        // 则认为是普通文本，不进行处理
        if (!useJsonResponse && typeof data !== 'object') {
          context.body = data
        } else {
          if (typeof data !== 'object') {
            data = {
              data,
            }
          }

          const responseData = {
            code: successCode,
            request_id: requestId,
            request_time: start,
            response_time: end,
            ...data,
          }

          context.body = responseData
        }

        if (hasPerformance) {
          const statsd = performanceClient()
          statsd.timer(context.path, end - start)
        }
      } catch (e) {
        // only server side error send to raven
        if (hasErrorReport && (!e.statusCode || Number(e.statusCode) === internalErrorCode)) {
          const raven = errorReportClient()
          raven.captureException(e)
        }

        const end = Date.now()

        context.status = e.statusCode || internalErrorCode
        const responseData = {
          code: e.errorCode || e.statusCode || internalErrorCode,
          message: e.statusMessage || e.message || 'internal error',
          request_id: requestId,
          request_time: start,
          response_time: end,
        }

        context.body = useJsonResponse ? responseData : JSON.stringify(responseData)

        if (hasPerformance) {
          const statsd = performanceClient()
          statsd.counter(`${context.path}/error`, 1)
        }

        if (hasLogger) {
          logger.error(e, logBody)
        }
      } finally {
        if (after) {
          await after(context)
        }
      }
    }
  }

  return ResponseHandler as any
}

function translatePath (path: string) {
  return path.replace(/^\/|\/$/g, '').replace(/\//g, '-')
}