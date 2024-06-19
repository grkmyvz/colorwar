import { MerkleWitness, PublicKey, Struct, UInt64 } from "o1js";

export class Pixel extends Struct({
  id: UInt64,
  color: UInt64,
  painter: PublicKey,
  cost: UInt64,
  timestamp: UInt64,
}) {}

export class ColorWarMerkleWitness extends MerkleWitness(14) {}

export type PixelJSON = {
  id: string;
  color: string;
  painter: string;
  cost: string;
  timestamp: string;
};
