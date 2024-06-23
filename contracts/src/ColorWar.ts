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
  UInt32,
} from 'o1js';

export class ColorWarMerkleWitness extends MerkleWitness(11) {}

export class Pixel extends Struct({
  id: UInt64,
  color: UInt64,
  painter: PublicKey,
  cost: UInt64,
  blockLength: UInt32,
}) {
  hash(): Field {
    return Poseidon.hash(Pixel.toFields(this));
  }

  toFields(): Field[] {
    return [
      Field.from(this.id.toString()),
      Field.from(this.color.toString()),
      ...this.painter.toFields(),
      Field.from(this.cost.toString()),
      Field.from(this.blockLength.toString()),
    ];
  }

  toString(): string {
    return JSON.stringify({
      id: this.id.toString(),
      color: this.color.toString(),
      painter: this.painter.toBase58(),
      cost: this.cost.toString(),
      timestamp: this.blockLength.toString(),
    });
  }

  changePixel(
    newColor: UInt64,
    painter: PublicKey,
    cost: UInt64,
    blockLength: UInt32
  ): Pixel {
    return new Pixel({
      id: this.id,
      color: newColor,
      painter: painter,
      cost: cost,
      blockLength: blockLength,
    });
  }
}

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
    // const sender = this.sender.getAndRequireSignature();
    // sender.assertEquals(this.owner.getAndRequireEquals());

    // this.root.getAndRequireEquals().assertEquals(Field.from(0));
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

    path.calculateRoot(pixel.hash()).assertEquals(merkleRoot);

    const bl = this.network.blockchainLength.getAndRequireEquals();

    const condition = pixel.blockLength.lessThan(bl.add(UInt32.from(10))); // true. if this true, then the pixel cost is 100000000(0.1 mina). if false, then the pixel cost is 2x the current cost

    const newCost = Provable.if(
      condition,
      UInt64,
      UInt64.from(100000000),
      pixel.cost.mul(UInt64.from(2))
    );

    senderUpdate.send({ to: this.address, amount: UInt64.from(newCost) });

    const newPixel = pixel.changePixel(newColor, sender, newCost, bl);

    const newMerkleRoot = path.calculateRoot(newPixel.hash());

    this.root.set(newMerkleRoot);

    this.emitEvent('changedPixel', newPixel);
  }

  @method async withdraw(amount: UInt64): Promise<void> {
    const sender = this.sender.getAndRequireSignature();
    sender.assertEquals(this.owner.getAndRequireEquals());

    this.send({ to: sender, amount });
  }
}
