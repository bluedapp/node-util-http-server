import { create } from './create-server'

const port = 12306

// full feature
create({
  port,
  logPath: './logs',
  ravenUrl: 'https://22b8257369274ebb9ea10553df5f04f9@sentry.blued.cn/32',
  statsd: {
    conf: '10.42.107.41',
    port: 8125,
    group: 'live',
    project: 'test-http-server',
  },
  isLocal: true,
})

console.log('server running at:', port)
// // normal
// createServer({
//   port: 12307,
// })

// // with log
// createServer({
//   port: 12308,
//   logPath: './logs',
// })

// // with raven
// createServer({
//   port: 12309,
//   ravenUrl: 'https://22b8257369274ebb9ea10553df5f04f9@sentry.blued.cn/32',
// })

// // with statsd
// createServer({
//   port: 12310,
//   statsd: {
//     conf: '10.42.107.41',
//     port: 8125,
//     group: 'live',
//     project: 'test-http-server',
//   },
// })

/**
 * TODO1: 拆分出 base 并上传
 * TODO2: 拆分出 封装后 的版本，并上传
 * TODO3: 找项目试用 client 及 conf
 * TODO4: 将其写入脚手架
 */
