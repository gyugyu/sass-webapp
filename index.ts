import express from 'express'
import path from 'path'
import redis from 'redis'
import sass from 'sass'

const redisClient = redis.createClient()
redisClient.set('foo', '0')

const app = express()

app.all('*', (req, res) => {
  const reqMap = new sass.types.Map(2);
  ['path'].forEach((key, i) => {
    reqMap.setKey(i, new sass.types.String(key))
    reqMap.setValue(i, new sass.types.String((req as any)[key]))
  })

  let resMap: sass.types.Map<sass.types.String, sass.types.String | sass.types.Number> | undefined = undefined

  sass.render({
    file: path.join(__dirname, 'index.scss'),
    functions: {
      request() {
        return reqMap
      },
      'response($res)'(r) {
        if (resMap) {
          throw new Error('response is already sent')
        }

        if (r instanceof sass.types.Map) {
          resMap = r
        }

        return new sass.types.Number(0)
      },
      'redis-get($key)'(k, done) {
        const key = (k as sass.types.String).getValue()
        redisClient.get(key, (err, value) => {
          if (!err) {
            (done as (value: sass.types.Number) => void)(new sass.types.Number(parseInt(value, 10)))
          }
        })
      },
      'redis-set($key, $value)'(k, v, done) {
        const key = (k as sass.types.String).getValue()
        const value = (v as sass.types.Number).getValue()
        redisClient.set(key, value.toString(), err => {
          if (!err) {
            (done as (value: sass.types.Number) => void)(new sass.types.Number(value))
          }
        })
      }
    }
  }, () => {
    let body = ''

    if (resMap) {
      for (let i = 0; i < resMap!.getLength(); i++) {
        const key = resMap!.getKey(i).getValue()
        const value = resMap!.getValue(i).getValue()

        if (key == 'status-code') {
          res.statusCode = value as number
        } else if (key == 'body') {
          body = value as string
        }
      }
    }

    res.send(body)
  })
})

app.listen(3000, () => {
  console.log('app start')
})
