import { TokenWallet } from '.'
import { NodeLocalStore } from './storageAdapters/NodeLocalStore'
import { ChainInfo } from './utils/types'
const readline = require('readline-sync')

const supportedChains: ChainInfo[] = [
  {
    id: 100,
    symbol: 'XDAI',
    label: 'Gnosis',
    rpcUrl: 'https://rpc.ankr.com/gnosis'
  },
  {
    id: 5,
    symbol: 'ETH',
    label: 'Goerli Eth Testnet',
    rpcUrl: ''
  },
  {
    id: 1,
    symbol: 'ETH',
    label: 'Ethereum',
    rpcUrl: ''
  }
]

const store = new NodeLocalStore('./local_Wallet')
const wallet = new TokenWallet(store)

const main = async () => {
  if (wallet.isInitialized()) {
    const password = readline.question('Wallet password:')
    wallet.start(password)
  } else {
    const mnemonic = readline.question(
      'Input Mnemonic (leave blank to generate new):'
    )
    const password = readline.question('Enter a new password for this wallet:')
    console.log('initializing')
    wallet.initialize(supportedChains, password, mnemonic)
    console.log('done initializing')
  }

  while (true) await mainMenu()
}

const mainMenu = async () => {
  try {
    const address = await wallet.getAddress()
    const chain = await wallet.getCurrentChain()
    const bip44Path = await wallet.getBip44Path()

    console.log('')
    console.log(`Address: ${address}`)
    console.log(`Bip44 Path: ${bip44Path}`)
    console.log(`${chain?.symbol} Balance: ${await wallet.ethBalance()}`)
    console.log(`Chain: ${chain?.label}`)
    console.log(``)
    console.log(`1 - Send ${chain?.symbol}`)
    console.log(`2 - Send Erc20`)
    console.log(`3 - Show Mnemonic`)
    console.log(`4 - Switch Chain`)
    console.log(`5 - Add Chain`)
    console.log(`6 - Delete Wallet`)
    console.log(`7 - Edit bip44 Path`)
    console.log(`8 - exit`)

    const choice = readline.question(': ')

    if (choice === '1') {
      await sendEth()
    } else if (choice === '2') {
      await sendErc20()
    } else if (choice === '3') {
      console.log(wallet.mnemonic)
    } else if (choice === '4') {
      switchChain()
    } else if (choice === '5') {
      addChain()
    } else if (choice === '6') {
      wallet.wipe()
      console.log('Wallet deleted')
      process.exit()
    } else if (choice === '7') {
      editBip44Path()
    } else if (choice === '8') {
      process.exit()
    }
  } catch (e) {
    console.log(`Error: ${e}`)
    process.exit()
  }
}

const sendEth = async () => {
  const to = readline.question(`Destination Address: `)
  const value = readline.question(`amount: `)
  const tx = await wallet.ethTx({ to, value })
  console.log(`${JSON.stringify(tx, null, 2)}`)
  const choice = readline.question(`broadcast tx? y/n: `)
  if (choice !== 'y') throw new Error('transaction cancelled')
  const { txid, confirmPromise } = await wallet.signAndBroadcast(tx)
  console.log('txid: ', txid)
  const confirmResult = await confirmPromise
  if (!confirmResult.status) throw new Error('transaction failed')
  else console.log('success')
}

const sendErc20 = async () => {
  const tokenAddress = readline.question(`Token Address: `)
  const erc20Balance = await wallet.erc20Balance({ tokenAddress })
  console.log(`Balance: ${erc20Balance}`)
  const to = readline.question(`Destination Address:`)
  const value = readline.question(`amount: `)
  const tx = await wallet.erc20Tx({ to, value, tokenAddress })
  console.log(`${JSON.stringify(tx, null, 2)}`)
  const choice = readline.question(`broadcast tx? y/n: `)
  if (choice !== 'y') throw new Error('transaction cancelled')
  const { txid, confirmPromise } = await wallet.signAndBroadcast(tx)
  console.log('txid: ', txid)
  const confirmResult = await confirmPromise
  if (!confirmResult.status) throw new Error('transaction failed')
  else console.log('success')
}

const switchChain = () => {
  console.log('Available Chains:')
  console.log(`${JSON.stringify(wallet.getSupportedChains(), null, 2)}`)
  const newChainId = readline.question(`Chain Id: `)
  wallet.switchChain(parseInt(newChainId))
  console.log('Switched Chain')
}

const editBip44Path = () => {
  const newPath = readline.question(`New Path: `)
  wallet.setBip44Path(newPath)
  console.log('bip44 path set')
}

const addChain = () => {
  const id = readline.question(`Chain Id: `)
  const symbol = readline.question(`Symbol: `)
  const label = readline.question(`Label: `)
  const rpcUrl = readline.question(`Rpc Url: `)
  wallet.addChain({ id: parseInt(id), symbol, label, rpcUrl })
  wallet.switchChain(parseInt(id))
  console.log('Chain Added and Switched')
}

main()
