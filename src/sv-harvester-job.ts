import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import {BlockListener, PrivateBroadcastor} from '@keep3r-network/keeper-scripting-utils';
import dotenv from 'dotenv';
import {loadInitialSetup} from './shared/setup';
import {CHAIN_ID, FLASHBOTS_RPC, GAS_LIMIT, PRIORITY_FEE, USV_ADDRESS} from './utils/contants';

dotenv.config();

/* ==============================================================/*
		                      SETUP
/*============================================================== */

// pull environment variables
const {provider, txSigner} = loadInitialSetup();

const blockListener = new BlockListener(provider);
const job = getMainnetSdk(txSigner).harvestingJob;

const broadcastor = new PrivateBroadcastor(FLASHBOTS_RPC, PRIORITY_FEE, GAS_LIMIT, true, CHAIN_ID);

/* ==============================================================/*
		                   MAIN SCRIPT
/*============================================================== */

export async function run(): Promise<void> {
  // Create a subscription and start listening to upcoming blocks
  blockListener.stream(async (block) => {
    // Check if job is paused
    const paused = await job.paused();

    // If it's paused, then return
    if (paused) {
      console.info('Job is paused. Returning...');
      return;
    }

    // Check if account settlement is required
    const isAccountSettlementRequired = await job.isAccountSettlementRequired(USV_ADDRESS);

    // If it is, then we will send a transaction to the job to settle the account
    if (isAccountSettlementRequired) {
      console.info('Account settlement is required!');
      await broadcastor.tryToWork({
        jobContract: job,
        workMethod: 'settleAccount',
        workArguments: [USV_ADDRESS],
        block,
      });
    } else {
      // If it's not, then we will send a transaction to the job to harvest
      await broadcastor.tryToWork({
        jobContract: job,
        workMethod: 'harvest',
        workArguments: [USV_ADDRESS],
        block,
      });
    }
  });
}

(async () => {
  await run();
})();
