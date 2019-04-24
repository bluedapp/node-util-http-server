export class NotFoundError extends Error {
  constructor (
    public message: string = 'Not Found',
    public statusCode: number = 404,
    public errorCode: number = 404
  ) {
    super(message)
  }
}