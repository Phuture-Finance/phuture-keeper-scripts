import type {providers, Wallet} from 'ethers';

export * from './ordering';

export type InitialSetup = {
  provider: providers.WebSocketProvider;
  txSigner: Wallet;
};
