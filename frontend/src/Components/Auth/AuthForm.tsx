import { useEffect, useState } from "react";
import {
  createWeb3Modal,
  defaultConfig,
  useWeb3Modal,
  useWeb3ModalProvider,
  useWeb3ModalAccount,
} from "@web3modal/ethers/react";
import auth from "../../styles/modules/auth.module.scss";
import { BrowserProvider, Eip1193Provider } from "ethers";
import processApi from "../../scripts/processApi";
import { currentAuthDataStore, userRoleStore } from "../../store/store";
import { useNavigate, useSearchParams } from "react-router-dom";
import { checkUserRole } from "../../scripts/checkUserRole";
import { backendUrl } from "../../main";
import { errorHandler } from "../../scripts/errorHandler";

const AuthForm = () => {
  const projectId = "d1febdb339a32ce9b4d523e9a727e257";
  const mainnet = {
    chainId: 1,
    name: "Ethereum",
    currency: "ETH",
    explorerUrl: "https://etherscan.io",
    rpcUrl: "https://cloudflare-eth.com",
  };
  const metadata = {
    name: "My Website",
    description: "My Website description",
    url: "https://mywebsite.com",
    icons: ["https://avatars.mywebsite.com/"],
  };
  const ethersConfig = defaultConfig({
    metadata,
    enableEIP6963: true,
    enableInjected: true,
    enableCoinbase: true,
    rpcUrl: "...",
    defaultChainId: 1,
  });
  createWeb3Modal({
    ethersConfig,
    chains: [mainnet],
    projectId,
    enableAnalytics: true,
  });

  const [authData, setAuthData] = useState<{
    address: `0x${string}` | undefined;
    payload: string | undefined;
    signature: string | undefined;
  }>({
    address: undefined,
    payload: undefined,
    signature: undefined,
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { open } = useWeb3Modal();
  const { address: wb3ModalAddress, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const { setCurrentAuthData } = currentAuthDataStore();
  const { setUserRole } = userRoleStore();
  const locStorTokenKey: string = "dao_hq_auth_token";
  const authTokenLocStor = localStorage.getItem(locStorTokenKey);

  const connectWallet = async () => {
    await open();
  };

  const signAuthMessage = async (): Promise<{
    message: string;
    signature: string;
  }> => {
    const ethersProvider = new BrowserProvider(
      walletProvider as Eip1193Provider
    );
    const signer = await ethersProvider.getSigner();
    const message = createPayloadToSign();
    const signature = await signer.signMessage(message);
    setAuthData({
      address: wb3ModalAddress,
      signature,
      payload: message,
    });
    return { message, signature };
  };

  const createPayloadToSign = (): string => {
    const date = new Date();
    date.setTime(date.getTime() + 5 * 24 * 60 * 60 * 1000);
    return `DAO HQ Login \nExpiration: ${date.toISOString()} \nAddress: ${
      authData.address
    }`;
  };

  const getAuthToken = async (argSignature: string, argPayload: string) => {
    const getTokenData = async () => {
      try {
        const res = await processApi({
          url: `${backendUrl}/auth?signature=${
            authData.signature || argSignature
          }`,
          method: "POST",
          body: argPayload,
        });
        if (res.result && typeof res.result === "string") {
          return res.result;
        }
        if (res.error.statusCode || res.error.description) {
          errorHandler("Authorization failed!", res.error);
        }
      } catch (error) {
        errorHandler("Authorization failed!", {
          description: error,
        });
      }
    };
    const jwtToken = await getTokenData();
    if (jwtToken) {
      localStorage.setItem(locStorTokenKey, jwtToken);
      if (wb3ModalAddress) {
        localStorage.setItem("dao_hq_user_address", wb3ModalAddress);
        const role = await checkUserRole(wb3ModalAddress);
        setUserRole(role);
        setCurrentAuthData({
          address: wb3ModalAddress ? wb3ModalAddress : null,
          token: jwtToken,
        });
        const navigateUrl = searchParams.get("navigate_to");
        if (navigateUrl) {
          navigate(navigateUrl);
        } else {
          navigate("/booking");
        }
      } else {
        throw new Error("Current user's address is empty!");
      }
    }
  };

  const handleSignIn = async () => {
    const { signature, message } = await signAuthMessage();
    getAuthToken(signature, message);
  };

  useEffect(() => {
    if (!authTokenLocStor || !authTokenLocStor.length) {
      localStorage.setItem(locStorTokenKey, "");
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      setAuthData({
        address: wb3ModalAddress,
        payload: undefined,
        signature: undefined,
      });
    }
    if (!isConnected) {
      setAuthData({
        address: undefined,
        payload: undefined,
        signature: undefined,
      });
    }
  }, [wb3ModalAddress]);

  return (
    <>
      <button
        className={`${auth.button} ${
          !authData.address ? auth.button__focus : ""
        }`}
        onClick={connectWallet}
      >
        Connect Wallet
      </button>
      <p className={auth.separator} style={{ width: "7em", margin: "0" }}>
        then
      </p>
      <button
        className={`${auth.button} ${
          authData.address ? auth.button__focus : ""
        }`}
        onClick={handleSignIn}
        disabled={!authData.address}
      >
        Sign-in
      </button>
      <p style={{ width: "100%", margin: "0 0 0.3em 0" }}>using your wallet</p>
      <div style={{ minHeight: "1.396em" }}>
        {authData.address ? (
          <code className={auth.address}>{authData.address}</code>
        ) : null}
      </div>
      <p
        className={auth.separator}
        style={{ marginTop: "2em", margin: "3.8em 0 0 0" }}
      >
        Powered by
      </p>
      <section className={auth.ref}>
        <a href="https://www.infura.io/">
          <svg
            fill="none"
            height="24"
            viewBox="0 0 142 24"
            width="142"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              clipRule="evenodd"
              d="M1.17398 0.000854492V3.65309L9.89805 2.75404H13.118V8.66552L7.69596 10.3239L0.349609 12.0954L1.44047 15.6662L8.48016 12.9605L13.118 11.5432V21.2466H9.89805L1.17398 20.347V23.9993H27.8152V20.347L19.0912 21.2466H15.8712V11.5432L20.4859 12.9531L27.5493 15.6662L28.6396 12.0954L21.3131 10.329L15.8712 8.66552V2.75404H19.0912L27.8152 3.65309V0.000854492H1.17398Z"
              fill="#FF5833"
              fillRule="evenodd"
            ></path>
            <path
              clipRule="evenodd"
              d="M136.964 12.9813L134.894 7.25978H134.393L132.325 12.9813H136.964ZM141.648 19.8169H139.437L137.704 15.0273H131.586L129.855 19.8169H127.645L133.386 4H135.906L141.648 19.8169Z"
              fill="#FEFEFE"
              fillRule="evenodd"
            ></path>
            <path
              clipRule="evenodd"
              d="M117.868 11.8882C119.46 11.8882 121.358 11.3859 121.358 8.99563C121.358 6.46178 119.172 6.08387 117.868 6.08387H113.2V11.8882H117.868ZM119.63 13.7756L123.332 19.8036H120.797L117.245 13.9907H113.2V19.8036H111.098V4H117.868C121.731 4 123.46 6.50929 123.46 8.99563C123.46 12.5602 120.627 13.5413 119.63 13.7756Z"
              fill="#FEFEFE"
              fillRule="evenodd"
            ></path>
            <path
              clipRule="evenodd"
              d="M103.715 13.8007C103.715 13.9704 103.668 17.954 99.6503 17.954C95.9106 17.954 95.5941 14.7738 95.5861 13.8007V4H93.4824V13.8007C93.4824 16.6601 95.0982 20 99.6503 20C104.202 20 105.818 16.6601 105.818 13.8007V4H103.715V13.8007Z"
              fill="#FEFEFE"
              fillRule="evenodd"
            ></path>
            <path
              clipRule="evenodd"
              d="M89.2974 4V6.10309H79.0387V10.2436H88.1503V12.3216H79.0387V19.8036H76.9355V4H89.2974Z"
              fill="#FEFEFE"
              fillRule="evenodd"
            ></path>
            <path
              clipRule="evenodd"
              d="M68.3238 4V16.5598H67.8647L60.4419 4H57.7207V19.8036H59.8238V7.64143H60.2829L67.3688 19.8036H70.4269V4H68.3238Z"
              fill="#FEFEFE"
              fillRule="evenodd"
            ></path>
            <path
              clipRule="evenodd"
              d="M40.6387 4V5.95096H45.3093V17.8531H40.6387V19.8036H52.0825V17.8531H47.4124V5.95096H52.0825V4H40.6387Z"
              fill="#FEFEFE"
              fillRule="evenodd"
            ></path>
          </svg>
        </a>
      </section>
    </>
  );
};

export default AuthForm;
