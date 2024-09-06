import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import {BlockListener, PrivateBroadcastor} from '@keep3r-network/keeper-scripting-utils';
import {request} from 'undici';
import dotenv from 'dotenv';
import {loadInitialSetup} from './shared/setup';
import type {Order} from './utils/types';
import {CHAIN_ID, FLASHBOTS_RPC, ORDER_API_URL, GAS_LIMIT, PRIORITY_FEE} from './utils/contants';

dotenv.config();

/* ==============================================================/*
		                      SETUP
/*============================================================== */

// pull environment variables
const {provider, txSigner} = loadInitialSetup();

const blockListener = new BlockListener(provider);
const job = getMainnetSdk(txSigner).orderJob;

const broadcastor = new PrivateBroadcastor(FLASHBOTS_RPC, PRIORITY_FEE, GAS_LIMIT, true, CHAIN_ID);

/* ==============================================================/*
		                   MAIN SCRIPT
/*============================================================== */

export async function run(): Promise<void> {
  // Create a subscription and start listening to upcoming blocks
  blockListener.stream(async (block) => {
    // Check if the job is paused
    const paused = await job.paused();

    // If it's paused, then return
    if (paused) {
      console.info('Job is paused. Returning...');
      return;
    }

    // Call the API to see if there's an order that needs to be executed
    const {statusCode, body} = await request(ORDER_API_URL);

    // Emit the logs according to the status code the API gave us. If the status code is not 200, return.
    switch (statusCode) {
      case 200:
        console.debug(`Got 200 OK from Validator.`);
        break;
      case 404:
        console.debug(`Error 404: There are no orders currently. Retrying in next block.`);
        return;
      default:
        console.debug(`Expected to get 200 OK from Validator but instead got ${statusCode}.`);
        return;
    }

    // If we get 200 as the status code, we parse the body of the response
    const {data} = await body.json();
    const {signs, external} = data[0] as Order;

    // Define variables whose values will depend on whether we need to send a external or internal order
    const functionToCall = 'externalSwap';

    // Try to work the job
    await broadcastor.tryToWork({
      jobContract: job,
      workMethod: functionToCall,
      workArguments: [signs, external],
      block,
    });
  });
}

(async () => {
  await run();
})();
