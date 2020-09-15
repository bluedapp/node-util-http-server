import { Readable } from 'stream'
import { KoaMiddlewareInterface, Middleware } from 'routing-controllers'
import { Context } from 'koa'
import { LoggerIntl } from '@blued-core/logger-intl'
import { ExceptionReportClientInstance, PerformanceClientInstance } from '@blued-core/client-intl'
import { NotFoundError } from './errors'

type ExceptionReportBuilder = () => ExceptionReportClientInstance
type PerformanceClientBuilder = () => PerformanceClientInstance

export interface LogRule {
  // 当此选项为 true 时，则关闭 HTTP 请求日志
  disable?: boolean,
  href?: boolean,
  // 此项可为 true，或者 include 和 exclude 只包含其中一项的对象
  header?: boolean | {
    include?: string[],
    exclude?: string[],
  }
  ip?: boolean,
  method?: boolean,
  requestBody?: boolean,
}

export interface MiddlewareDirver {
  // 日志服务的驱动
  loggerClient?: LoggerIntl,
  // 异常监控处理的驱动
  exceptionReportClient?: ExceptionReportBuilder,
  // 性能监控的驱动
  performanceClient?: PerformanceClientBuilder,
}

export interface MiddlewareConfig {
  // 一个前置的中间件处理
  before?: (ctx: Context) => Promise<any>
  // 一个后置的中间件处理
  after?: (ctx: Context) => Promise<any>
  // 定义针对请求信息的日志规则
  logRule?: LogRule
}

const emptyTypes: any[] = [undefined, null, 0, false, '']
const successCode = 200
const internalErrorCode = 500

export default ({
  before,
  after,
  logRule,
  loggerClient,
  performanceClient,
  exceptionReportClient,
}: MiddlewareConfig & MiddlewareDirver) => {
  const hasLogger = !emptyTypes.includes(loggerClient)
  const hasLogRule = !emptyTypes.includes(logRule)
  const hasPerformance = !emptyTypes.includes(performanceClient)
  const hasExceptionReport = !emptyTypes.includes(exceptionReportClient)

  @Middleware({ type: 'before' })
  class ResponseHandler implements KoaMiddlewareInterface {
    async use(context: Context, next: Function) {
      const start = Date.now()
      const mergedPath = mergeNumber(context.path)
      let logger = null

      if (hasLogger) {
        // 添加默认 index 的操作
        logger = loggerClient.getLogger(translatePath(mergedPath) || 'index')
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
        if (hasLogRule && !logRule.disable) {
          if (logRule.href) delete logBody.href
          if (logRule.ip) delete logBody.ip
          if (logRule.method) delete logBody.method
          if (logRule.requestBody) delete logBody.requestBody

          if (logRule.header === true) {
            delete logBody.header
          } else if (logRule.header) {
            const tmpHeader: Record<string, any> = {}
            if (Array.isArray(logRule.header.include)) {
              for (const k of logRule.header.include) {
                if (header[k]) {
                  tmpHeader[k] = header[k]
                }
              }
            } else if (Array.isArray(logRule.header.exclude)) {
              for (const [k, v] of Object.entries(header)) {
                if (!logRule.header.exclude.includes(k)) {
                  tmpHeader[k] = v
                }
              }
            }
            logBody.header = tmpHeader
          }
        }
        if (logger && (!hasLogRule || !logRule.disable)) {
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

        // 如果是一个可读流，则直接返回，不做处理
        if (data instanceof Readable) {
          context.body = data
        } else if (!useJsonResponse) {
          // 如果 Content-Type 不是 json，并且 data 返回值类型也不是 object 类型
          // 则认为是普通文本，不进行处理
          if (typeof data === 'object') {
            context.body = {
              code: successCode,
              request_id: requestId,
              request_time: start,
              response_time: end,
              ...data,
            }
          } else {
            context.body = data
          }
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
          statsd.timer(mergedPath, end - start)
        }
      } catch (e) {
        // only server side error send to exceptionReport
        if (hasExceptionReport && (!e.statusCode || Number(e.statusCode) === internalErrorCode)) {
          const exceptionReport = exceptionReportClient()
          exceptionReport.captureException(e)
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
          statsd.counter(`${mergedPath}/error`, 1)
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

function mergeNumber (str: string) {
  return str.replace(/(^|\/)(\d+)(\/|$)/g, '$1NUM$3')
}
