
import { Connection, TokenAmount, clusterApiUrl, PublicKey,  } from '@solana/web3.js';


export const getMango = async (owner: any) => {
const connection = new Connection(`https://${process.env.NEXT_PUBLIC_RPC_URL}`, "confirmed")
let mango
try {
    const tokenAccountInfo = await connection.getTokenAccountsByOwner(owner, {mint: new PublicKey("8ZKGnRpnM1BVN9SGBuJaXSf1cHwQ2fWUvPpXWoMWT31C"), programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")})
    const tokenAccount = tokenAccountInfo.value[0].pubkey.toString()
    // console.log(tokenAccount)
    const accountInfo = await connection.getTokenAccountBalance(new PublicKey(tokenAccount))
    mango = accountInfo.value.uiAmount
} catch {
    mango = 0
}
    // console.log(mango)
    return mango
}
