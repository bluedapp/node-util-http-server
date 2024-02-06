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
  // 当 context.path 与此项匹配时则启用过滤规则
  match?: RegExp,
  href?: boolean,
  // 此项可为 true，或者 include 和 exclude 只包含其中一项的对象
  header?: boolean | {
    include?: string[],
    exclude?: string[],
  }
  ip?: boolean,
  method?: boolean,
  requestBody?: boolean,
  // 此项为 true，则不对错误请求的 logBody 属性进行过滤
  exceptError?: boolean,
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
  logRule?: LogRule | LogRule[]
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
      let logFilename = null
      if (hasLogger) {
        logFilename = translatePath(mergedPath) || 'index'
      }

      const { method, request } = context
      const { href, header, ip } = request
      const {
        'x-request-id': requestId,
        'content-type': contentType,
      } = header

      const useJsonResponse = /^(application\/)?json$/i.test(contentType)

      const requestBody = method === 'GET' ? context.request.query : context.request.body
      const logBody: {
        href: string
        header: any
        ip: string
        method: string
        requestBody: any
        internalError?: string
      } = {
        href,
        header,
        ip,
        method,
        requestBody,
      }
      let errorLogBody = logBody
      let disableAccessLog = false
      let currentRule: LogRule = null
      try {
        if (hasLogRule) {
          if (Array.isArray(logRule)) {
            currentRule = logRule.find(r => Boolean(r.match && context.path.match(r.match)))
          } else if (logRule.match) {
            if (context.path.match(logRule.match)) {
              currentRule = logRule
            }
          } else {
            currentRule = logRule
          }
          disableAccessLog = currentRule && currentRule.disable
          if (currentRule && currentRule.exceptError) {
            errorLogBody = { ...logBody }
          }
          filterLogBody(logBody, currentRule)
        }
      } catch (e) {
        if (logFilename) {
          const logger = loggerClient.getLogger('middleware_log_rule')
          if (logger) logger.error(e)
        }
      }

      try {
        if (before) {
          await before(context)
        }
        await next()
        let data = context.body
        if (data) {
          if (!disableAccessLog && logFilename) {
            const logger = loggerClient.getLogger(logFilename)
            if (logger) logger.access(logBody)
          }
        } else {
          if (logFilename) {
            logFilename = 'status_404_not_found'
          }
          throw new NotFoundError()
        }

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
          if (statsd) statsd.timer(`.${method}.${context.status}${mergedPath}`, end - start)
        }
      } catch (e) {
        // only server side error send to exceptionReport
        if (hasExceptionReport && (!e.statusCode || Number(e.statusCode) === internalErrorCode)) {
          const exceptionReport = exceptionReportClient()
          if (exceptionReport) exceptionReport.captureException(e)
        }

        const end = Date.now()

        context.status = e.statusCode || internalErrorCode

        // 被调用方timeout sqlerr 等所有未被 catch 到的错误全部都是网络错误
        // 并且这种情况下，statusCode 和 errorCode 都是 500 ,e.name 是 DataRequestError
        // 详情见 https://github.com/bluedapp/node-util-client/blob/master/packages/http-client/src/index.ts#L206

        // 如果使用项目里面的 new ResponseErr 那么 e.name是 responseError
        // 如果使用项目里面的 new ServiceErr 那么 e.name 是 ServiceError
        // 如果是直接 new Err 那么 e.name 是 Error

        // a.b.c
        // name: 'TypeError',
        // message: "Cannot read property 'c' of undefined",

        // name: 'SequelizeDatabaseError',
        // message: "Table 'blued.XXX' doesn't exist",

        let errResMessage = ''
        const errName = e.name
        if (
          errName === 'DataRequestError'
          || errName === 'TypeError'
          || errName === 'SequelizeDatabaseError'
        ) {
          errResMessage = '网络错误'
        } else {
          errResMessage = e.message
        }

        const responseData: Record<string, any> = {
          code: e.errorCode || e.statusCode || internalErrorCode,
          message: errResMessage,
          request_id: requestId,
          request_time: start,
          response_time: end,
        }

        logBody.internalError = e.statusMessage || e.message || 'internal error'

        if (Object.prototype.hasOwnProperty.call(e, 'data')) {
          responseData.data = e.data
        }

        context.body = useJsonResponse ? responseData : JSON.stringify(responseData)

        if (hasPerformance) {
          const statsd = performanceClient()
          if (statsd) statsd.counter(`.${method}.${context.status}${mergedPath}/error`, 1)
        }
        if (logFilename) {
          const logger = loggerClient.getLogger(logFilename)
          if (logger) logger.error(e, errorLogBody)
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

function filterLogBody(logBody: Record<string, any>, logRule: LogRule) {
  if (logRule && !logRule.disable) {
    Object.entries(logRule).forEach(e => {
      const [k, v] = e
      if (['ip', 'href', 'method', 'header', 'requestBody'].includes(k)) {
        if (v === true) { delete logBody[k] }
      }
    })
    if (typeof logRule.header === 'object') {
      const header: Record<string, any> = {}
      if (Array.isArray(logRule.header.include)) {
        for (const k of logRule.header.include) {
          if (logBody.header[k]) {
            header[k] = logBody.header[k]
          }
        }
      } else if (Array.isArray(logRule.header.exclude)) {
        for (const [k, v] of Object.entries(logBody.header)) {
          if (!logRule.header.exclude.includes(k)) {
            header[k] = v
          }
        }
      }
      logBody.header = header
    }
  }
}

function translatePath(path: string) {
  return path.replace(/^\/|\/$/g, '').replace(/\//g, '-')
}

function mergeNumber(str: string) {
  return str.replace(/(^|\/)(\d+)(\/|$)/g, '$1NUM$3')
}
