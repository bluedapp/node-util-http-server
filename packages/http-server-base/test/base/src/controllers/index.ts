// import { JsonController, Get, QueryParam } from '@blued-core/http-server-base'
import { JsonController, Get, QueryParam } from '../../../../dist'
import { ResponseError, ServiceError } from '../util/custom-error'

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
    throw new Error('some unknown error')
  }

  @Get('service-error')
  serverError() {
    throw new ServiceError(40000, 'some service err')
  }

  @Get('response-error')
  responseError() {
    throw new ResponseError('some response err', 403, 40000, { other: 1 }, [1, 2, 3])
  }
}
