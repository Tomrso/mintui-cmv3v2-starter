'use client';

import Image from 'next/image'
import styles from './page.module.css'
import { Merriweather, Merriweather_Sans } from 'next/font/google';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { LedgerWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  base58PublicKey,
  generateSigner,
  Option,
  PublicKey,
  publicKey,
  SolAmount,
  Some,
  some,
  transactionBuilder,
  Umi,
  unwrapSome
} from "@metaplex-foundation/umi";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-essentials';
import { mplTokenMetadata, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import {
  mplCandyMachine,
  fetchCandyMachine,
  mintV2,
  safeFetchCandyGuard,
  DefaultGuardSetMintArgs,
  DefaultGuardSet,
  SolPayment,
  CandyMachine,
  CandyGuard,
  MintLimitArgs,
  safeFetchMintCounterFromSeeds,
  MintLimit,
  GuardSet
} from "@metaplex-foundation/mpl-candy-machine";
import { Connection, TokenAmount, clusterApiUrl } from '@solana/web3.js';
import { checkMango } from './utility/solanaSplHelpers';
import { mintLimitChecker } from './utility/umiFunctions';

//fonts
const merriweather = Merriweather({ weight: "700", subsets: ["latin"] })
const merriweatherSans = Merriweather_Sans({ weight: "400", subsets: ["latin"] })

export default function Home() {

  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = `https://${process.env.NEXT_PUBLIC_RPC_URL}`;

  const wallets = useMemo(
    () => [
      new LedgerWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  const WalletMultiButtonDynamic = dynamic(
    async () =>
      (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
    { ssr: false }
  );

  // set up umi
  let umi: Umi = createUmi(endpoint)
    .use(mplTokenMetadata())
    .use(mplCandyMachine());

  // state
  const [loading, setLoading] = useState(true);
  const [mintCreated, setMintCreated] = useState<PublicKey | null>(null);
  const [mintMsg, setMintMsg] = useState<string>();
  const [cmv3v2, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<any>();
  const [countTotal, setCountTotal] = useState<number>(0);
  const [countRemaining, setCountRemaining] = useState<number>(0);
  const [countMinted, setCountMinted] = useState<number>(0);
  const [mintDisabled, setMintDisabled] = useState<boolean>(false)

  // check availablilty of candy machine
  const retrieveAvailability = async () => {
    const cmId = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID;
    if (!cmId) {
      setMintMsg("No candy machine ID found. Add environment variable.");
      return;
    }
    const candyMachine: CandyMachine = await fetchCandyMachine(umi, publicKey(cmId));
    setCandyMachine(candyMachine);

    // Get counts in machine
    setCountTotal(candyMachine.itemsLoaded);
    setCountMinted(Number(candyMachine.itemsRedeemed));
    const remaining = candyMachine.itemsLoaded - Number(candyMachine.itemsRedeemed)
    setCountRemaining(remaining);

    //fetch guards and set state
    const candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
    if (candyGuard) {
      setCandyGuard(candyGuard);
    }

    //disable if no NFTs left
    if (remaining <= 0) {
      setMintMsg("Sorry, No NFTs Left!")
      setMintDisabled(true)
    } else {
      setMintMsg(undefined)
      setMintDisabled(false)
    }

    //cm and page are loaded so button can now work
    setLoading(false)
  };

  useEffect(() => {
    retrieveAvailability();
  }, [mintCreated]);

  // Inner Mint component to handle showing the Mint button and preemptively checks guards so
  // that we don't get confusing a failed transaction
  const Mint = () => {
    const wallet = useWallet();
    umi = umi.use(walletAdapterIdentity(wallet));

    //ensure a wallet is connected
    if (!wallet.connected) {
      return <p>Please connect your wallet.</p>;
    }
    
    // Checks mango balance
    checkMango(wallet)

    //Checks that candyguard conditions are met and sets message if they're not
    const mintBtnHandler = async () => {
      if (!cmv3v2 || !candyGuard) {
        setMintMsg("There was an error fetching the candy machine. Try refreshing your browser window.");
        return;
      }
      if (await mintLimitChecker(umi, cmv3v2, candyGuard)) {
        setMintMsg(undefined)
      } else {
        setMintMsg("Mint Limit Reached, 1 Per Wallet")
        return
      }
      if (await checkMango(wallet)) {
        setMintMsg(undefined)
      } else {
        setMintMsg("Not Enough Mango")
        return
      }
      if (countRemaining <= 0) {
        setMintMsg("Sorry, No More Left!")
        return
      }
      setLoading(true);;

      //The candyMachine transaction
      try {
        const candyMachine = cmv3v2;
        const nftSigner = generateSigner(umi);
        const mintArgs: Partial<DefaultGuardSetMintArgs> = {};

        mintArgs.mintLimit = candyGuard.guards.mintLimit
        mintArgs.tokenPayment = candyGuard.guards.tokenPayment

        const tx = transactionBuilder()
          .add(setComputeUnitLimit(umi, { units: 600_000 }))
          .add(mintV2(umi, {
            candyMachine: candyMachine.publicKey,
            collectionMint: candyMachine.collectionMint,
            collectionUpdateAuthority: candyMachine.authority,
            nftMint: nftSigner,
            candyGuard: candyGuard?.publicKey,
            mintArgs: mintArgs,
            tokenStandard: TokenStandard.ProgrammableNonFungible
          }))

          //send transaction
        const { signature } = await tx.sendAndConfirm(umi, {
          confirm: { commitment: "finalized" }, send: {
            skipPreflight: true,
          },
        });

        setMintCreated(nftSigner.publicKey);
        setMintMsg("Mint was successful!");

      } catch (err: any) {
        console.error(err);
        setMintMsg(err.message);
      } finally {
        setLoading(false);
      }
    };

    //Shows token address for NFT
    if (mintCreated) {
      return (
        <a className={styles.success} target="_blank" rel="noreferrer"
          href={`https://solscan.io/token/${base58PublicKey(mintCreated)}`}>
          <p>Enjoy Your Prize!</p>
          <p className="mintAddress">
            <code>{base58PublicKey(mintCreated)}</code>
          </p>
        </a>
      );
    }

    return (
      <>
        <button onClick={mintBtnHandler} className={styles.mintBtn} disabled={loading || mintDisabled}>
          <>
            <span style={{ fontWeight: "bold", fontSize: "20px" }} className={merriweatherSans.className}>
              MINT
            </span>
            <span style={{ fontWeight: "100", fontSize: "14px" }}>
              (250 MANGO)
            </span>
          </>
        </button>
        {loading && (<div className={styles.loadingDots}>. . .</div>)}
      </>
    );
  }; // </Mint>

  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <main className={styles.main}>
          <WalletMultiButtonDynamic />
          <div className={styles.headings}>
            <h1 className={merriweather.className} style={{ padding: "20px", fontSize: "40px" }}>The Riddler Mask</h1>
            <p className={merriweatherSans.className}>Congratulations brave FAPE. You have solved the puzzle and found the riddler mask. <br></br>Try it on and see what other mysteries you can solve......</p>
          </div>
          <Image className={styles.logo} src="/riddlerMask.png" alt="Preview of NFTs" width={300} height={300} priority />

          <div className={styles.countsContainer}>
            <div className={merriweatherSans.className}>Masks Minted: {countMinted - 1} / {countTotal - 1}</div>
            <div className={styles.progress}>
              <div className={styles.progressInner} style={{ width: `${countMinted -1 }%` }}>
              </div>
            </div>

          </div>
          <Mint />
          {mintMsg && (
            <div className={styles.mintMsg}>
              <button className={styles.mintMsgClose} onClick={() => { setMintMsg(undefined); }}>&times;</button>
              <span>{mintMsg}</span>
            </div>)}
        </main>
      </WalletModalProvider>
    </WalletProvider>
  )
}

