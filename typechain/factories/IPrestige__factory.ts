/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer } from "ethers";
import { Provider } from "@ethersproject/providers";

import type { IPrestige } from "../IPrestige";

export class IPrestige__factory {
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IPrestige {
    return new Contract(address, _abi, signerOrProvider) as IPrestige;
  }
}

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_address",
        type: "address",
      },
      {
        indexed: false,
        internalType: "enum IPrestige.Status[2]",
        name: "_change",
        type: "uint8[2]",
      },
    ],
    name: "StatusChange",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_account",
        type: "address",
      },
      {
        internalType: "enum IPrestige.Status",
        name: "_new_status",
        type: "uint8",
      },
    ],
    name: "set_status",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "status",
    outputs: [
      {
        internalType: "uint256",
        name: "_start_block",
        type: "uint256",
      },
      {
        internalType: "enum IPrestige.Status",
        name: "_current_status",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
