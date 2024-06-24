import {
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

import { ColorWar } from "../../../contracts/build/src/ColorWar.js";
import { PixelJSON } from "@/helpers/types";
import {
  ColorWarMerkleWitness,
  Pixel,
} from "../../../contracts/build/src/ColorWar.js";

const state = {
  ColorWar: null as null | typeof ColorWar,
  zkapp: null as null | ColorWar,
  transaction: null as null | Transaction,
};

// ---------------------------------------------------------------------------------------

const functions = {
  setActiveInstanceToDevnet: async (args: {}) => {
    // Archive network: https://api.minascan.io/archive/devnet/v1/graphql
    // Devnet network: https://api.minascan.io/node/devnet/v1/graphql
    const Network = Mina.Network({
      mina: "https://api.minascan.io/node/devnet/v1/graphql",
      archive: "https://api.minascan.io/archive/devnet/v1/graphql",
    });
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
      blockLength: UInt32.from(args.pixel.blockLength),
    });

    const argColor = UInt64.from(args.newColor);

    let tree = new MerkleTree(11);
    for (let i = 0; i < args.pixels.length; i++) {
      const p = new Pixel({
        id: UInt64.from(args.pixels[i].id),
        color: UInt64.from(args.pixels[i].color),
        painter: PublicKey.fromBase58(args.pixels[i].painter),
        cost: UInt64.from(args.pixels[i].cost),
        blockLength: UInt32.from(args.pixels[i].blockLength),
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
    console.log(JSON.stringify(argPixel), JSON.stringify(argColor));
  },
  updateGenesisRootTransaction: async (args: {
    feePayerAddress: string;
    pixels: PixelJSON[];
  }) => {
    await fetchAccount({ publicKey: args.feePayerAddress });
    const feePayer = PublicKey.fromBase58(args.feePayerAddress);

    let tree = new MerkleTree(11);
    for (let i = 0; i < args.pixels.length; i++) {
      const p = new Pixel({
        id: UInt64.from(args.pixels[i].id),
        color: UInt64.from(args.pixels[i].color),
        painter: PublicKey.fromBase58(args.pixels[i].painter),
        cost: UInt64.from(args.pixels[i].cost),
        blockLength: UInt32.from(args.pixels[i].blockLength),
      });
      tree.setLeaf(BigInt(i), p.hash());
    }

    const genesisRoot = tree.getRoot();

    const transaction = await Mina.transaction(
      { sender: feePayer },
      async () => {
        await state.zkapp!.setGenesisRoot(genesisRoot);
      }
    );
    state.transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
  getEvents: async (args: { blockLength: number }) => {
    const events = await state.zkapp?.fetchEvents(
      UInt32.from(args.blockLength)
    );
    return events;
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
