/* eslint-disable import/no-extraneous-dependencies */
import { expect } from 'chai'
import { createServer } from '../../src/index'

describe('normal', () => {
  it(`function`, done => {
    expect(createServer).to.be.a('function')
    done()
  })
})
