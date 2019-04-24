基于 `routing-controller` 的简易封装，抽出了一些复用的逻辑。  

```bash
npm i @blued-core/http-server-base
```

## 使用方式

```typescript
import { createServer } from '@blued-core/http-server-base'

// 最简易的用法
createServer()
```

## 提供的参数

option|type|default|desc
:--|:--|:--|:--
port|`number`|`8000`|设置服务的端口号
isLocal|`boolean`|false|是否为本地开发环境，部分插件本地环境下会有额外的操作
distPath|`string`|-|静态资源路径
controllersPath|`string|string[]`|项目根目录下的`controllers`文件夹|设置路由文件存储的位置
controllerPattern|`string|string[]`|`['.ts', '.js']`|设置路由文件匹配的后缀
middlewareRegsiter|`Function`|-|自定义的中间件注册方式，会传递`Koa`实例到回调中
success|`Function`|-|服务启动成功后的回调
errorOverriding|`Object`|`ParamRequiredError`|自定义的异常对象覆盖
loggerClient|`Client`|-|日志插件
errorReportClient|`() => Client`|-|异常监控插件
performanceClient|`() => Client`|-|性能监控插件
before|Function|-|前置的全局中间件处理
after|Function|-|后置的全局中间件处理

### errorOverriding 结构描述

用于覆盖部分`routing-controllers`的自定义`Error`类型。  

```typescript
// key 为匹配异常类型对应的 name 所需
ParamRequiredError: {
  // 用于返回值的输出
  message: "missing field",
  // 用于设置覆盖后的异常类型
  name: "RequiredError",
  // 用于设置 http response status code
  statusCode: 403,
  // 用于在 JSON 类型的数据返回值中设置 code
  errorCode: 403,
}
```

### loggerClient

logger 使用的是符合 `@blued-core/logger-intl` 约束的子类实现。  
默认提供了一个 `@blued-core/winston-logger`，也可以选择自行实现。  

```typescript
import { createServer } from '@blued-core/http-server-base'
import LoggerClient from '@blued-core/winston-logger'
import Cache from '@blued-core/cache'

const cache = new Cache()
// 加载 log
const loggerClient = new LoggerClient(logPath, cache, isLocal)

createServer({
  loggerClient,
})
```

### errorReportClient

用于错误监控时添加数据上报，使用的为符合 `@blued-core/raven-client#RavenClientBuilder` 的结构。  
默认提供了一个`@blued-core/raven-client`， 也可以自行实现 `@blued-core/client` 子类。  

```typescript
import { createServer } from '@blued-core/http-server-base'
import { NormalConf } from '@blued-core/normal-conf'
import RavenClient from '@blued-core/raven-client'
import Cache from '@blued-core/cache'

const cache = new Cache()

const normalConf = new NormalConf({
  raven: 'XXX',
})
// 加载 raven
const ravenClient = new RavenClient(normalConf, cache)
ravenClient.isLocal = isLocal

createServer({
  errorReportClient () {
    return ravenClient.getClient('raven')
  },
})
```

### performanceClient

用于性能监控时添加数据上报，使用的为符合 `@blued-core/statsd-client#StatsdClientBuilder` 的结构。  
默认提供了一个`@blued-core/statsd-client`， 也可以自行实现 `@blued-core/client` 子类。  

```typescript
import { createServer } from '@blued-core/http-server-base'
import { NormalConf } from '@blued-core/normal-conf'
import StatsdClient from '@blued-core/statsd-client'
import Cache from '@blued-core/cache'

const cache = new Cache()

const normalConf = new NormalConf({
  statsd: {
    // statsd 上报 IP
    conf: '0.0.0.0',
    // statsd 上报 IP 对应的端口
    port: 1234,
    // 项目归属分组
    group: 'demo-group',
    // 项目名
    project: 'demo-project',
  },
})

const statsdClient = new StatsdClient(normalConf, cache)
statsdClient.isLocal = isLocal

createServer({
  performanceClient () {
    return statsdClient.getClient('statsd')
  },
})
```
