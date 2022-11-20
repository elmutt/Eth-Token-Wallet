import {
  createCipheriv,
  randomBytes,
  createDecipheriv,
  scryptSync
} from 'crypto-browserify'

const algorithm = 'aes-256-ctr'
const salt = '23sdfwa34vaerrtaertvsrde43tqsdgf'

export const encrypt = (text, password) => {
  const secretKey = scryptSync(password, salt, 32)
  const iv = randomBytes(16)
  const cipher = createCipheriv(algorithm, secretKey, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return JSON.stringify({
    iv: iv.toString('hex'),
    content: encrypted.toString('hex')
  })
}

export const decrypt = (encryptedString, password) => {
  const encryptedObject = JSON.parse(encryptedString)
  const secretKey = scryptSync(password, salt, 32)
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
