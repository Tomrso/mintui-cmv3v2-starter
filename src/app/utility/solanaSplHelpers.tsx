
import { Connection, TokenAmount, clusterApiUrl, PublicKey,  } from '@solana/web3.js';


export const getMango = async (owner: any) => {
    const connection = new Connection(`https://${process.env.NEXT_PUBLIC_RPC_URL}`, "confirmed")
    let mango
    let tokenAccount
    const tokenAccountInfo = await connection.getTokenAccountsByOwner(owner, {mint: new PublicKey("8ZKGnRpnM1BVN9SGBuJaXSf1cHwQ2fWUvPpXWoMWT31C"), programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")})
    if (tokenAccountInfo.value.length > 0) {
        tokenAccount = tokenAccountInfo.value[0].pubkey.toString()
        const accountInfo = await connection.getTokenAccountBalance(new PublicKey(tokenAccount))
        mango = accountInfo.value.uiAmount
    } else mango = 0
    // console.log(tokenAccount)
    // console.log(mango)
    return mango
}

export const checkMango = async (wallet: any) => {
    let mango = await getMango(wallet.publicKey)
    console.log(mango)
    if (mango && mango >= 500) {
      return true
    } else {
      return false
    }
  }
