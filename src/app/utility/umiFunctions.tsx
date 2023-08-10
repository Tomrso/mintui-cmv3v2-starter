import { safeFetchMintCounterFromSeeds, MintLimit, CandyMachine, GuardSet } from "@metaplex-foundation/mpl-candy-machine";
import { Umi, Some } from "@metaplex-foundation/umi";

//Checks how many NFTs a user has minted
export const mintLimitChecker = async (
    umi: Umi,
    candyMachine: CandyMachine,
    guard: {
      label: string;
      guards: GuardSet;
  }
  ) => {
    const mintLimit = guard.guards.mintLimit as Some<MintLimit>;
  
    //not minted yet
    try {
      const mintCounter = await safeFetchMintCounterFromSeeds(umi, {
        id: mintLimit.value.id,
        user: umi.identity.publicKey,
        candyMachine: candyMachine.publicKey,
        candyGuard: candyMachine.mintAuthority,
      });
  
      if (mintCounter && mintCounter.count >= mintLimit.value.limit) {
        return false;
      }
  
      return true;
    } catch (error) {
      console.error(`mintLimitChecker: ${error}`);
      return false;
    }
  };