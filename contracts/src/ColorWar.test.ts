import {
  AccountUpdate,
  Field,
  MerkleTree,
  Mina,
  Poseidon,
  PrivateKey,
  PublicKey,
  UInt32,
  UInt64,
} from 'o1js';
import { ColorWar, ColorWarMerkleWitness, Pixel } from './ColorWar';

let proofsEnabled = false;

describe('ColorWar', () => {
  let deployerAccount: Mina.TestPublicKey,
    deployerKey: PrivateKey,
    senderAccount: Mina.TestPublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: ColorWar;

  let pixels: Pixel[];
  let tree: MerkleTree;

  beforeAll(async () => {
    if (proofsEnabled) await ColorWar.compile();
  });

  beforeEach(async () => {
    const Local = await Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    [deployerAccount, senderAccount] = Local.testAccounts;
    deployerKey = deployerAccount.key;
    senderKey = senderAccount.key;

    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new ColorWar(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, async () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      await zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  function createGenesisData() {
    const pixelArray = [];
    for (let i = 0; i < 1000; i++) {
      const pixel = new Pixel({
        id: UInt64.from(i),
        color: UInt64.from(87),
        painter: PublicKey.empty(),
        cost: UInt64.from(100000000),
        timestamp: UInt64.from(0),
      });
      pixelArray.push(pixel);
    }
    return pixelArray;
  }

  async function setGenesisRoot(genesisRoot: Field) {
    const txn = await Mina.transaction(deployerAccount, async () => {
      await zkApp.setGenesisRoot(genesisRoot);
    });
    await txn.prove();
    await txn.sign([deployerKey]).send();
  }

  async function initializeRoot() {
    pixels = createGenesisData();
    tree = new MerkleTree(14);
    for (let i = 0; i < pixels.length; i++) {
      tree.setLeaf(BigInt(i), Poseidon.hash(Pixel.toFields(pixels[i])));
    }
  }

  it('generates and deploys the `ColorWar` smart contract', async () => {
    await localDeploy();
    const root = zkApp.root.get();
    expect(root).toEqual(Field.from(0));
  });

  it('correctly updates the root state on the `ColorWar` smart contract', async () => {
    await localDeploy();
    await initializeRoot();

    const genesisRoot = tree.getRoot();

    await setGenesisRoot(genesisRoot);

    const updatedRoot = zkApp.root.getAndRequireEquals();
    expect(updatedRoot).toEqual(genesisRoot);
  });

  it('correctly occupies a pixel on the `ColorWar` smart contract', async () => {
    await localDeploy();
    await initializeRoot();

    const genesisRoot = tree.getRoot();

    await setGenesisRoot(genesisRoot);

    const w = tree.getWitness(BigInt(1));
    const witness = new ColorWarMerkleWitness(w);

    const pixel = pixels[1];

    const txn = await Mina.transaction(senderAccount, async () => {
      await zkApp.occupyPixel(pixel, UInt64.from(66), witness);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    // TODO: How to use events with types?
    const events = await zkApp.fetchEvents(UInt32.from(0));
    const pdata = JSON.stringify(events[0].event.data);
    const pdat = JSON.parse(pdata) as Pixel;

    const newPixel = new Pixel({
      id: pixel.id,
      color: UInt64.from(pdat.color),
      painter: PublicKey.fromBase58(pdat.painter.toString()),
      cost: UInt64.from(pdat.cost),
      timestamp: UInt64.from(pdat.timestamp),
    });

    tree.setLeaf(BigInt(1), Poseidon.hash(Pixel.toFields(newPixel)));

    expect(zkApp.root.getAndRequireEquals()).toEqual(tree.getRoot());
  });
});
