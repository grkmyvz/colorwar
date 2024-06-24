import { Field, PublicKey, UInt64, MerkleTree, Poseidon } from "o1js";
import { useEffect, useState } from "react";
import GradientBG from "../components/GradientBG.js";
import styles from "../styles/Home.module.css";
import customStyles from "../styles/Custom.module.css";
import "../workers/reactCOIServiceWorker";
import ZkappWorkerClient from "../workers/zkappWorkerClient";
import numToColorCode from "@/helpers/numToColorCode";
import colorList from "@/helpers/colorList";
import { PixelJSON } from "@/helpers/types";
import { ResData } from "./api/get-pixels.js";

let transactionFee = 0.1;
const ZKAPP_ADDRESS = "B62qr4sMJPCaKKQ7XLSXVvyhrMXz3njLxcdxVGxQ7v2LR89EWwEXnUF";

export default function Home() {
  const [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    rootHash: null as null | Field,
    pixels: [] as PixelJSON[],
    creatingTransaction: false,
  });

  const [displayText, setDisplayText] = useState("");
  const [transactionlink, setTransactionLink] = useState("");
  const [selectedPixel, setSelectedPixel] = useState<PixelJSON | null>(null);

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    async function timeout(seconds: number): Promise<void> {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, seconds * 1000);
      });
    }

    (async () => {
      if (!state.hasBeenSetup) {
        setDisplayText("Loading web worker...");
        console.log("Loading web worker...");
        const zkappWorkerClient = new ZkappWorkerClient();
        await timeout(5);

        setDisplayText("Done loading web worker");
        console.log("Done loading web worker");

        await zkappWorkerClient.setActiveInstanceToDevnet();

        const mina = (window as any).mina;

        if (mina == null) {
          setState({ ...state, hasWallet: false });
          return;
        }

        const publicKeyBase58: string = (await mina.requestAccounts())[0];
        const publicKey = PublicKey.fromBase58(publicKeyBase58);

        console.log(`Using key:${publicKey.toBase58()}`);
        setDisplayText(`Using key:${publicKey.toBase58()}`);

        setDisplayText("Checking if fee payer account exists...");
        console.log("Checking if fee payer account exists...");

        const res = await zkappWorkerClient.fetchAccount({
          publicKey: publicKey!,
        });
        const accountExists = res.error == null;

        await zkappWorkerClient.loadContract();

        console.log("Compiling zkApp...");
        setDisplayText("Compiling zkApp...");
        await zkappWorkerClient.compileContract();
        console.log("zkApp compiled");
        setDisplayText("zkApp compiled...");

        const zkappPublicKey = PublicKey.fromBase58(ZKAPP_ADDRESS);

        await zkappWorkerClient.initZkappInstance(zkappPublicKey);

        console.log("Getting zkApp state...");
        setDisplayText("Getting zkApp state...");
        await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey });
        const rootHash = await zkappWorkerClient.getRoot();
        console.log(`Current root in zkApp: ${JSON.stringify(rootHash)}`);

        console.log("Getting pixels...");
        setDisplayText("Getting pixels...");
        const pixelFetch = await fetch("/api/get-pixels", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const pixelRes: ResData = await pixelFetch.json();

        if (pixelRes.data === undefined) {
          throw new Error("No pixels found");
        }

        const events = await zkappWorkerClient.getEvents(0);

        console.log(events);

        setState({
          ...state,
          zkappWorkerClient,
          hasWallet: true,
          hasBeenSetup: true,
          publicKey,
          zkappPublicKey,
          accountExists,
          rootHash,
          pixels: pixelRes.data,
        });

        console.log("Setup done");
        setDisplayText("");
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (;;) {
          setDisplayText("Checking if fee payer account exists...");
          console.log("Checking if fee payer account exists...");
          const res = await state.zkappWorkerClient!.fetchAccount({
            publicKey: state.publicKey!,
          });
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  const onPixelClick = (pixel: PixelJSON) => {
    setSelectedPixel(pixel);
  };

  const onCloseModal = () => {
    setSelectedPixel(null);
  };

  const onChangeSelectedPixelColor = (color: number) => async () => {
    if (!selectedPixel) {
      return;
    }
    const newPixel = {
      ...selectedPixel,
      color: color.toString(),
    };

    setSelectedPixel(newPixel);
  };

  const onChangePixelColor = async () => {
    if (!selectedPixel) {
      return;
    }
    setState({ ...state, creatingTransaction: true });
    try {
      setDisplayText("Creating a transaction...");
      console.log("Creating a transaction...");

      await state.zkappWorkerClient!.fetchAccount({
        publicKey: state.publicKey!,
      });

      await state.zkappWorkerClient!.updatePixelTransaction(
        state.publicKey!.toBase58(),
        state.pixels,
        state.pixels[Number(selectedPixel.id)],
        selectedPixel.color
      );

      setDisplayText("Creating proof...");
      console.log("Creating proof...");

      await state.zkappWorkerClient!.proveUpdateTransaction();

      console.log("Requesting send transaction...");
      setDisplayText("Requesting send transaction...");
      const transactionJSON =
        await state.zkappWorkerClient!.getTransactionJSON();

      setDisplayText("Getting transaction JSON...");
      console.log("Getting transaction JSON...");
      const { hash } = await (window as any).mina.sendTransaction({
        transaction: transactionJSON,
        feePayer: {
          fee: transactionFee,
          memo: "",
        },
      });

      const transactionLink = `https://minascan.io/devnet/tx/${hash}`;
      console.log(`View transaction at ${transactionLink}`);

      setTransactionLink(transactionLink);
      setDisplayText(transactionLink);
    } catch (e) {
      console.error(e);
    } finally {
      setState({ ...state, creatingTransaction: false });
    }
  };

  const handleGenesisRoot = async () => {
    setState({ ...state, creatingTransaction: true });
    try {
      setDisplayText("Creating a transaction...");
      console.log("Creating a transaction...");

      await state.zkappWorkerClient!.fetchAccount({
        publicKey: state.publicKey!,
      });

      await state.zkappWorkerClient!.updateGenesisRootTransaction(
        state.publicKey!.toBase58(),
        state.pixels
      );

      setDisplayText("Creating proof...");
      console.log("Creating proof...");
      await state.zkappWorkerClient!.proveUpdateTransaction();

      console.log("Requesting send transaction...");
      setDisplayText("Requesting send transaction...");
      const transactionJSON =
        await state.zkappWorkerClient!.getTransactionJSON();

      setDisplayText("Getting transaction JSON...");
      console.log("Getting transaction JSON...");
      const { hash } = await (window as any).mina.sendTransaction({
        transaction: transactionJSON,
        feePayer: {
          fee: transactionFee,
          memo: "",
        },
      });

      const transactionLink = `https://minascan.io/devnet/tx/${hash}`;
      console.log(`View transaction at ${transactionLink}`);

      setTransactionLink(transactionLink);
      setDisplayText(transactionLink);
    } catch (e) {
      console.error(e);
    } finally {
      setState({ ...state, creatingTransaction: false });
    }
  };

  const getMerkleRoot = async () => {
    console.log("Getting zkApp root state...");
    setDisplayText("Getting zkApp root state...");

    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.zkappPublicKey!,
    });
    const rootHash = await state.zkappWorkerClient!.getRoot();
    setState({ ...state, rootHash });
    console.log(`Root state in zkApp: ${rootHash.toString()}`);
    setDisplayText("");
  };
  // -------------------------------------------------------
  // Create UI elements

  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = "https://www.aurowallet.com/";
    const auroLinkElem = (
      <a href={auroLink} target="_blank" rel="noreferrer">
        Install Auro wallet here
      </a>
    );
    hasWallet = <div>Could not find a wallet. {auroLinkElem}</div>;
  }

  const stepDisplay = transactionlink ? (
    <a
      href={transactionlink}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "underline" }}
    >
      View transaction
    </a>
  ) : (
    displayText
  );

  let setup = (
    <div
      className={styles.start}
      style={{ fontWeight: "bold", fontSize: "1.5rem", paddingBottom: "5rem" }}
    >
      {stepDisplay}
      {hasWallet}
    </div>
  );

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink =
      "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
    accountDoesNotExist = (
      <div>
        <span style={{ paddingRight: "1rem" }}>Account does not exist.</span>
        <a href={faucetLink} target="_blank" rel="noreferrer">
          Visit the faucet to fund this fee payer account
        </a>
      </div>
    );
  }

  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = (
      <div style={{ justifyContent: "center", alignItems: "center" }}>
        <div className={styles.center} style={{ padding: 5 }}>
          <button onClick={handleGenesisRoot}>Set Genesis Root</button>
          zkApp Merkle Root: {state.rootHash!.toString()}{" "}
          <button onClick={getMerkleRoot}>Refresh Root</button>
        </div>
      </div>
    );
  }

  let canvas;
  let modalContent;
  if (state.pixels.length > 0) {
    canvas = (
      <div
        style={{
          width: "640px",
          height: "672px",
          backgroundColor: "black",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {state.pixels.map((pixel) => {
            return (
              <div key={pixel.id} className={customStyles.tooltip}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor: `${numToColorCode(Number(pixel.color))}`,
                    margin: "2px",
                  }}
                  onClick={() => onPixelClick(pixel)}
                ></div>
                <span className={customStyles.tooltiptext}>
                  <p>Pixel ID: {pixel.id}</p>
                  <p>
                    Painter: {pixel.painter.slice(0, 6)} -{" "}
                    {pixel.painter.slice(-6)}
                  </p>
                  <p>Cost: {pixel.cost}</p>
                  <p>Timestamp: {pixel.blockLength}</p>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );

    modalContent = (
      <div id="myModal" className={customStyles.modal}>
        <div className={customStyles.modalcontent}>
          <span className={customStyles.close} onClick={onCloseModal}>
            &times;
          </span>
          <h1>Pixel # {selectedPixel?.id}</h1>
          <p>Painter: {selectedPixel?.painter}</p>
          <p>Timestamp: {selectedPixel?.blockLength}</p>
          <hr />
          <h3
            style={{
              textAlign: "center",
            }}
          >
            Change Color
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {colorList.map((color) => {
              return (
                <div
                  key={color.code}
                  style={{
                    width: `${
                      Number(selectedPixel?.color) === color.code
                        ? "24px"
                        : "18px"
                    }`,
                    height: `${
                      Number(selectedPixel?.color) === color.code
                        ? "24px"
                        : "18px"
                    }`,
                    backgroundColor: color.color,
                    margin: "2px",
                    border: "1px solid black",
                    cursor: "pointer",
                  }}
                  onClick={onChangeSelectedPixelColor(color.code)}
                ></div>
              );
            })}
          </div>
          <button
            className={styles.card}
            style={{
              backgroundColor: numToColorCode(Number(selectedPixel?.color)),
              cursor: "pointer",
              width: "94%",
            }}
            onClick={onChangePixelColor}
          >
            Change Color ({Number(selectedPixel?.cost) / 10 ** 9} MINA)
          </button>
        </div>
      </div>
    );
  }

  return (
    <GradientBG>
      <div className={styles.main} style={{ padding: 0 }}>
        <div className={styles.center} style={{ padding: 0 }}>
          {setup}
          {accountDoesNotExist}
          {mainContent}
          {canvas}
          {selectedPixel && modalContent}
        </div>
      </div>
    </GradientBG>
  );
}
