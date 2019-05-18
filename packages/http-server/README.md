基于 `routing-controller` 的简易封装，抽出了一些复用的逻辑。  

```bash
npx install-peerdeps @blued-core/http-server
```

### 使用方式

```typescript
import { createServer } from '@blued-core/http-server'

createServer({
  logPath: './log',
  ravenUrl: 'sentry.xxx.com',
  statsd: {
    host: '0.0.0.1',
    port: 12345,
    group: 'test',
    project: 'test-project'
  },
  port: 1234
})

// 具体的 router 实现

import { JsonController, Get } from '@blued-core/http-server'

@JsonController('/test')
export default class {
  @Get('/patha')
  get () {
    return 'Hello World'
  }
}

// curl http://127.0.0.1:1234/test/patha
```

> 如果请求 Header 携带 Content-Type: application/json 则会主动拼接参数，类似  
> { code: 200, data: 'Hello World' }  

主要文档基于：[http-server-base](https://www.npmjs.com/package/@blued-core/http-server-base)  

### 额外提供的参数

option|type|default|desc
:--|:--|:--|:--
logPath|`string`|-|设置 log 输出的路径
ravenUrl|`string`|-|设置 raven 上报的路径
statsd|`Object`|-|设置 statsd 上报的配置

#### statsd 具体配置

option|type|desc
:--|:--|:--
host|string|配置的 IP
port|number|端口号
group|string|上报数据所属分组
project|string|上报数据所属项目