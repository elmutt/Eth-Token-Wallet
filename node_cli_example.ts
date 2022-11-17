import { TokenWallet } from '.'
import { NodeLocalStore } from './storageAdapters/NodeLocalStore'
import { ChainInfo } from './utils/types'
const readline = require('readline-sync')

const supportedChains: ChainInfo[] = [
  {
    id: 1,
    symbol: 'ETH',
    label: 'Ethereum',
    rpcUrl: ''
  },
  {
    id: 5,
    symbol: 'ETH',
    label: 'Goerli Eth Testnet',
    rpcUrl: ''
  }
]

const store = new NodeLocalStore('./local_Wallet')
const wallet = new TokenWallet(store, supportedChains)

const main = async () => {

    if(wallet.isInitialized()) {
        const password = readline.question(
            'Wallet password:'
          )
        wallet.start(password)
    } else {
        const mnemonic = readline.question(
            'Input Mnemonic (leave blank to generate new):'
          )
        const password = readline.question(
        'Enter a new password for this wallet:'
        )
        wallet.initialize(password, mnemonic)
    }

  while(true) await mainMenu()

}

const mainMenu = async () => {
    try {
        const address = await wallet.getAddress()
        const chain = await wallet.getCurrentChain()
    
        console.log(`Address: ${address}`)
        console.log(`${chain?.symbol} Balance: ${await wallet.ethBalance()}`)
        console.log(`Chain: ${chain?.label}`)
        console.log(``)
        console.log(`1 - Send ${chain?.symbol}`)
        console.log(`2 - Send Erc20`)
        console.log(`3 - Show Mnemonic`)
        console.log(`4 - Switch Chain`)
        console.log(`5 - Delete Wallet`)
        console.log(`6 - Quit`)
    
        const choice = readline.question(':')
    
        if(choice === '1') {
            await sendEth()
        } else if(choice === '2') {
            await sendErc20()
        } else if (choice === '3') {
            console.log(wallet.mnemonic)
        } else if (choice === '4') {
            switchChain()
        } else if (choice === '5') {
            wallet.wipe()
            console.log('Wallet deleted')
            process.exit()

        } else if (choice === '6') {
            process.exit()
        }   
    } catch(e) {
        console.log('Error: ', e)
    }
}

const sendEth = async () => {
    const to = readline.question(`Destination Address:`)
    const value = readline.question(`amount:`)
    const ethTx = await wallet.ethTx({to, value})
    const txid = await wallet.signAndBroadcast(ethTx, () => 0)
    console.log('txid: ', txid)
}

const sendErc20 = async () => {
    const tokenAddress = readline.question(`Token Address:`)
    const erc20Balance = await wallet.erc20Balance({ tokenAddress })
    console.log(`Balance: ${erc20Balance}`)
    const to = readline.question(`Destination Address:`)
    const value = readline.question(`amount:`)
    const erc20Tx = await wallet.erc20Tx({to, value, tokenAddress})
    const txid = await wallet.signAndBroadcast(erc20Tx, () => 0)
    console.log('txid: ', txid)
}

const switchChain = () => {
    const newChainId = readline.question(`Enter Chain Id:`)
    wallet.switchChain(parseInt(newChainId))        
}

main()

