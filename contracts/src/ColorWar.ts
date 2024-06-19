import {
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Field,
  Poseidon,
  AccountUpdate,
  UInt64,
  Provable,
  Struct,
  MerkleWitness,
} from 'o1js';

export class ColorWarMerkleWitness extends MerkleWitness(14) {}

export class Pixel extends Struct({
  id: UInt64,
  color: UInt64,
  painter: PublicKey,
  cost: UInt64,
  timestamp: UInt64,
}) {}

export class ColorWar extends SmartContract {
  @state(PublicKey) owner = State<PublicKey>();
  @state(Field) root = State<Field>();

  events = {
    changedPixel: Pixel,
  };

  init() {
    super.init();
    const ownerPublicKey = this.sender.getAndRequireSignature();
    this.owner.set(ownerPublicKey);
    this.root.set(Field.from(0));
  }

  @method async setGenesisRoot(genesisRoot: Field): Promise<void> {
    const sender = this.sender.getAndRequireSignature();
    sender.assertEquals(this.owner.getAndRequireEquals());

    this.root.getAndRequireEquals().assertEquals(Field.from(0));
    this.root.set(genesisRoot);
  }

  @method async occupyPixel(
    pixel: Pixel,
    newColor: UInt64,
    path: ColorWarMerkleWitness
  ): Promise<void> {
    const sender = this.sender.getAndRequireSignature();
    const senderUpdate = AccountUpdate.createSigned(sender);

    const merkleRoot = this.root.getAndRequireEquals();
    path
      .calculateRoot(Poseidon.hash(Pixel.toFields(pixel)))
      .assertEquals(merkleRoot);

    const ts = this.network.timestamp.getAndRequireEquals();
    const condition = pixel.timestamp.lessThan(ts.add(UInt64.from(86400))); // true. if this true, then the pixel cost is 100000000(0.1 mina). if false, then the pixel cost is 2x the current cost

    const newCost = Provable.if(
      condition,
      UInt64,
      UInt64.from(100000000),
      pixel.cost.mul(UInt64.from(2))
    );
    senderUpdate.send({ to: this.address, amount: UInt64.from(newCost) });

    const newPixel = new Pixel({
      id: pixel.id,
      color: newColor,
      painter: sender,
      cost: newCost,
      timestamp: ts,
    });

    const newMerkleRoot = path.calculateRoot(
      Poseidon.hash(Pixel.toFields(newPixel))
    );

    this.root.set(newMerkleRoot);

    this.emitEvent('changedPixel', newPixel);
  }

  @method async withdraw(amount: UInt64): Promise<void> {
    const sender = this.sender.getAndRequireSignature();
    sender.assertEquals(this.owner.getAndRequireEquals());

    this.send({ to: sender, amount });
  }
}
