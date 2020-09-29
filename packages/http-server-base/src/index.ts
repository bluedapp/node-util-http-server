import 'reflect-metadata'
import path from 'path'
import Koa from 'koa'
import { createKoaServer } from 'routing-controllers'
import serve from 'koa-static'
import initMiddleware, { MiddlewareConfig, MiddlewareDirver } from './init-middleware'

export * from 'routing-controllers'

export interface HttpConfig {
  // 服务的端口号
  port?: number
  // 是否为本地开发环境
  isLocal?: boolean
  // 静态资源路径
  distPath?: string
  // controllers 路径
  controllersPath?: string | string[]
  // controllers 文件后缀
  controllerPattern?: string | string[]
  // 自定义的中间件
  middlewareRegsiter?: (app: Koa) => void
  // 服务启动成功后的回调
  success?: () => void
  // 自定义的异常信息覆盖
  erroOverriding?: Record<string, {
    name: string,
    statusCode: number,
    errorCode: number
  }>
}

const defaultPort = 8000
const defaultControllersPath = [path.join(path.dirname(process.mainModule.filename), 'controller')]
const defaultControllerPattern = '.js,.ts'
const defaultErroOverriding = {
  ParamRequiredError: {
    message: 'missing fields',
    name: 'RequiredError',
    statusCode: 403,
    errorCode: 403,
  },
}

export function createServer ({
  distPath,
  middlewareRegsiter,
  success,
  before,
  after,
  logRule,
  loggerClient,
  exceptionReportClient,
  performanceClient,
  port = defaultPort,
  controllersPath = defaultControllersPath,
  controllerPattern = defaultControllerPattern,
  erroOverriding = defaultErroOverriding,
}: HttpConfig & MiddlewareConfig & MiddlewareDirver = {
  port: defaultPort,
  controllersPath: defaultControllersPath,
  controllerPattern: defaultControllerPattern,
  erroOverriding: defaultErroOverriding,
}) {
  initMiddleware({
    before,
    after,
    logRule,
    loggerClient,
    exceptionReportClient,
    performanceClient,
  })

  let filePattern = controllerPattern

  // build controllers match pattern
  if (Array.isArray(filePattern)) {
    filePattern = filePattern.map(fp => {
      if (fp.startsWith('.')) return fp
      else return `.${fp}`
    }).join(',')
  }

  if (!Array.isArray(controllersPath)) {
    controllersPath = [controllersPath]
  }

  const app: Koa = createKoaServer({
    controllers: controllersPath.map(root => path.join(root, `**/*{${filePattern}}`)),
    errorOverridingMap: erroOverriding,
  })

  if (distPath) {
    app.use(serve(distPath))
  }

  if (middlewareRegsiter) {
    middlewareRegsiter(app)
  }

  app.listen(port, success)

  return app
}