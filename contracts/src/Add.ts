import { Field, SmartContract, state, State, method, UInt32 } from 'o1js';

/**
 * Basic Example
 * See https://docs.minaprotocol.com/zkapps for more info.
 *
 * The Add contract initializes the state variable 'num' to be a Field(1) value by default when deployed.
 * When the 'update' method is called, the Add contract adds Field(2) to its 'num' contract state.
 *
 * This file is safe to delete and replace with your own contract.
 */
export class Add extends SmartContract {
  @state(UInt32) num = State<UInt32>();

  init() {
    super.init();
    this.num.set(UInt32.from(1));
  }

  @method async update(xnum: UInt32) {
    const currentState = this.num.getAndRequireEquals();
    const newState = currentState.add(xnum);
    this.num.set(newState);
  }
}
