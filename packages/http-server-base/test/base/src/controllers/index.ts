// import { JsonController, Get, QueryParam } from '@blued-core/http-server-base'
import { JsonController, Get, QueryParam } from '../../../../dist'

@JsonController('/')
export default class {
  @Get()
  index (
    @QueryParam('uid', { required: true }) uid: number
  ) {
    return `uid: ${uid}`
  }

  @Get('error')
  error() {
    throw new Error('error')
  }
}