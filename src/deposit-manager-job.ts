import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import {BlockListener, PrivateBroadcastor} from '@keep3r-network/keeper-scripting-utils';
import dotenv from 'dotenv';
import {loadInitialSetup} from './shared/setup';
import {CHAIN_ID, FLASHBOTS_RPC, GAS_LIMIT, PRIORITY_FEE} from './utils/contants';

dotenv.config();

/* ==============================================================/*
		                      SETUP
/*============================================================== */

// pull environment variables
const {provider, txSigner} = loadInitialSetup();

const blockListener = new BlockListener(provider);
const job = getMainnetSdk(txSigner).depositManagerJob;

const broadcastor = new PrivateBroadcastor(FLASHBOTS_RPC, PRIORITY_FEE, GAS_LIMIT, true, CHAIN_ID);

/* ==============================================================/*
		                   MAIN SCRIPT
/*============================================================== */

export async function run(): Promise<void> {
  // Create a subscription and start listening to upcoming blocks
  blockListener.stream(async (block) => {
    // Check if job is workable
    const canUpdate = await job.canUpdateDeposits();

    if (!canUpdate) {
      console.log('Deposits are not updateable at this time. Retrying in next block.');
      return;
    }

    // Try to work the job
    await broadcastor.tryToWork({
      jobContract: job,
      workMethod: 'updateDeposits',
      workArguments: [],
      block,
    });
  });
}

(async () => {
  await run();
})();
