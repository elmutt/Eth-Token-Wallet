import {
  createCipheriv,
  randomBytes,
  createDecipheriv,
  scryptSync
} from 'crypto'

const algorithm = 'aes-256-ctr'
const salt = '23sdfwa34vaerrtaertvsrde43tqsdgf'

export const encrypt = (text, password) => {
  const secretKey = scryptSync(password, salt, 32)
  const iv = randomBytes(16)
  const cipher = createCipheriv(algorithm, secretKey, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return {
    iv: iv.toString('hex'),
    content: encrypted.toString('hex')
  }
}

export const decrypt = (encrypted, password) => {
  const secretKey = scryptSync(password, salt, 32)
  const decipher = createDecipheriv(
    algorithm,
    secretKey,
    Buffer.from(encrypted.iv, 'hex')
  )
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.content, 'hex')),
    decipher.final()
  ])
  return decrypted.toString()
}
