/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
  Contract,
  ContractTransaction,
  Overrides,
  CallOverrides,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";
import { TypedEventFilter, TypedEvent, TypedListener } from "./commons";

interface IPrestigeInterface extends ethers.utils.Interface {
  functions: {
    "set_status(address,uint8)": FunctionFragment;
    "status(address)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "set_status",
    values: [string, BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "status", values: [string]): string;

  decodeFunctionResult(functionFragment: "set_status", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "status", data: BytesLike): Result;

  events: {
    "StatusChange(address,uint8[2])": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "StatusChange"): EventFragment;
}

export class IPrestige extends Contract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  listeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter?: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): Array<TypedListener<EventArgsArray, EventArgsObject>>;
  off<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  on<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  once<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeListener<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeAllListeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): this;

  listeners(eventName?: string): Array<Listener>;
  off(eventName: string, listener: Listener): this;
  on(eventName: string, listener: Listener): this;
  once(eventName: string, listener: Listener): this;
  removeListener(eventName: string, listener: Listener): this;
  removeAllListeners(eventName?: string): this;

  queryFilter<EventArgsArray extends Array<any>, EventArgsObject>(
    event: TypedEventFilter<EventArgsArray, EventArgsObject>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEvent<EventArgsArray & EventArgsObject>>>;

  interface: IPrestigeInterface;

  functions: {
    set_status(
      _account: string,
      _new_status: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    "set_status(address,uint8)"(
      _account: string,
      _new_status: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    status(
      account: string,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, number] & { _start_block: BigNumber; _current_status: number }
    >;

    "status(address)"(
      account: string,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, number] & { _start_block: BigNumber; _current_status: number }
    >;
  };

  set_status(
    _account: string,
    _new_status: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  "set_status(address,uint8)"(
    _account: string,
    _new_status: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  status(
    account: string,
    overrides?: CallOverrides
  ): Promise<
    [BigNumber, number] & { _start_block: BigNumber; _current_status: number }
  >;

  "status(address)"(
    account: string,
    overrides?: CallOverrides
  ): Promise<
    [BigNumber, number] & { _start_block: BigNumber; _current_status: number }
  >;

  callStatic: {
    set_status(
      _account: string,
      _new_status: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    "set_status(address,uint8)"(
      _account: string,
      _new_status: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    status(
      account: string,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, number] & { _start_block: BigNumber; _current_status: number }
    >;

    "status(address)"(
      account: string,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, number] & { _start_block: BigNumber; _current_status: number }
    >;
  };

  filters: {
    StatusChange(
      _address: null,
      _change: null
    ): TypedEventFilter<
      [string, [number, number]],
      { _address: string; _change: [number, number] }
    >;
  };

  estimateGas: {
    set_status(
      _account: string,
      _new_status: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    "set_status(address,uint8)"(
      _account: string,
      _new_status: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    status(account: string, overrides?: CallOverrides): Promise<BigNumber>;

    "status(address)"(
      account: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    set_status(
      _account: string,
      _new_status: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    "set_status(address,uint8)"(
      _account: string,
      _new_status: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    status(
      account: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    "status(address)"(
      account: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
