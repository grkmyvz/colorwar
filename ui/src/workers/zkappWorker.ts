import {
  Field,
  MerkleTree,
  Mina,
  Poseidon,
  PublicKey,
  UInt32,
  UInt64,
  fetchAccount,
} from "o1js";

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { ColorWar } from "../../../contracts/src/ColorWar";
import { ColorWarMerkleWitness, Pixel, PixelJSON } from "@/helpers/types";

const state = {
  ColorWar: null as null | typeof ColorWar,
  zkapp: null as null | ColorWar,
  transaction: null as null | Transaction,
};

// ---------------------------------------------------------------------------------------

const functions = {
  setActiveInstanceToDevnet: async (args: {}) => {
    const Network = Mina.Network("http://127.0.0.1:8080/graphql");
    console.log("Devnet network instance configured.");
    Mina.setActiveInstance(Network);
  },
  loadContract: async (args: {}) => {
    const { ColorWar } = await import(
      "../../../contracts/build/src/ColorWar.js"
    );
    state.ColorWar = ColorWar;
  },
  compileContract: async (args: {}) => {
    await state.ColorWar!.compile();
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.ColorWar!(publicKey);
  },
  // getNum: async (args: {}) => {
  //   const currentNum = await state.zkapp!.num.get();
  //   return JSON.stringify(currentNum.toJSON());
  // },
  getRoot: async (args: {}) => {
    const root = await state.zkapp!.root.get();
    return JSON.stringify(root.toJSON());
  },
  updatePixelTransaction: async (args: {
    feePayerAddress: string;
    pixels: PixelJSON[];
    pixel: PixelJSON;
    newColor: string;
  }) => {
    await fetchAccount({ publicKey: args.feePayerAddress });
    const feePayer = PublicKey.fromBase58(args.feePayerAddress);
    const argPixel = new Pixel({
      id: UInt64.from(args.pixel.id),
      color: UInt64.from(args.pixel.color),
      painter: PublicKey.fromBase58(args.pixel.painter),
      cost: UInt64.from(args.pixel.cost),
      timestamp: UInt64.from(args.pixel.timestamp),
    });
    const argColor = UInt64.from(args.newColor);

    let tree = new MerkleTree(14);
    for (let i = 0; i < args.pixels.length; i++) {
      const p = new Pixel({
        id: UInt64.from(args.pixels[i].id),
        color: UInt64.from(args.pixels[i].color),
        painter: PublicKey.fromBase58(args.pixels[i].painter),
        cost: UInt64.from(args.pixels[i].cost),
        timestamp: UInt64.from(args.pixels[i].timestamp),
      });
      tree.setLeaf(BigInt(i), Poseidon.hash(Pixel.toFields(p)));
    }

    const w = tree.getWitness(BigInt(args.pixel.id));
    const witness = new ColorWarMerkleWitness(w);

    const transaction = await Mina.transaction(
      { sender: feePayer },
      async () => {
        await state.zkapp!.occupyPixel(argPixel, argColor, witness);
      }
    );
    state.transaction = transaction;
  },
  updateGenesisRootTransaction: async (args: {
    feePayerAddress: string;
    newRoot: string;
  }) => {
    await fetchAccount({ publicKey: args.feePayerAddress });
    const feePayer = PublicKey.fromBase58(args.feePayerAddress);
    const transaction = await Mina.transaction(
      { sender: feePayer },
      async () => {
        await state.zkapp!.setGenesisRoot(Field.from(args.newRoot));
      }
    );
    state.transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    try {
      console.log("hey");
      await state.transaction!.prove();
      console.log("ho");
    } catch (error) {
      console.error(error);
    }
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};

if (typeof window !== "undefined") {
  addEventListener(
    "message",
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}

console.log("Web Worker Successfully Initialized.");
