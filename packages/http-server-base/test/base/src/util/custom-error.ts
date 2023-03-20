export class ResponseError extends Error {
  constructor (public message: string = '', public statusCode = 403, public errorCode = 403, public extra = {}, public data: any[] = []) {
    super(message)
  }
}

export class ErrorCode extends Error {
  constructor (public code: number | string) {
    super()
  }
}

export class ServiceError extends Error {
  constructor (public code: number, public message: string = '') {
    super(message)
  }
}
