import {
  createCipheriv,
  randomBytes,
  createDecipheriv,
  pbkdf2
} from 'crypto-browserify'

const algorithm = 'aes-256-ctr'
const salt = '23sdfwa34vaerrtaertvsrde43tqsdgf'

export const encrypt = async (text, password) => {

  const secretKey = await new Promise( (resolve, reject) =>  {
    pbkdf2(password, salt, 100000, 32,
      'sha512', (err, derivedKey) => {
        if(err) return reject(err)
        else return resolve(derivedKey)
       })
  }) as Buffer

  const iv = randomBytes(16)
  const cipher = createCipheriv(algorithm, secretKey, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return JSON.stringify({
    iv: iv.toString('hex'),
    content: encrypted.toString('hex')
  })
}

export const decrypt = async (encryptedString, password) => {
  const encryptedObject = JSON.parse(encryptedString)
  const secretKey = await new Promise( (resolve, reject) =>  {
    pbkdf2(password, salt, 100000, 32,
      'sha512', (err, derivedKey) => {
        if(err) return reject(err)
        else return resolve(derivedKey)
       })
  }) as Buffer
  const decipher = createDecipheriv(
    algorithm,
    secretKey,
    Buffer.from(encryptedObject.iv, 'hex')
  )
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedObject.content, 'hex')),
    decipher.final()
  ])
  return decrypted.toString()
}
