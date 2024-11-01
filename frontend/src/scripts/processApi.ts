import { currentAuthDataStore } from "../store/store";

export interface MyFetchProps extends RequestInit {
  url: string;
  isWithoutAuth?: boolean;
}

const processApi = async (props: MyFetchProps) => {
  const { method, url, headers, body, credentials, isWithoutAuth } = props;
  const currentAuthToken =
    currentAuthDataStore.getState().currentAuthData.token;
  const authTokenLocStor = localStorage.getItem("dao_hq_auth_token");
  const myHeaders = new Headers();
  if (headers && typeof headers === "object" && Object.keys(headers).length) {
    for (const key in headers) {
      myHeaders.append(key, headers[key as keyof object]);
    }
  }
  const authToken = currentAuthToken || authTokenLocStor;
  if (!isWithoutAuth && authToken) {
    myHeaders.append(
      "Authorization",
      authToken ? `Bearer ${authToken}` : "wrong auth token"
    );
  }
  const getCurrentRequestInit = (): RequestInit => {
    const init: RequestInit = {
      method: method ? method : "GET",
    };
    init.headers = myHeaders;
    if (body) init.body = body;
    if (credentials) init.credentials = credentials;
    return init;
  };

  const fetchData = async () => {
    const result: {
      result: unknown;
      error: { statusCode: number | null; description: string | null };
    } = {
      result: undefined,
      error: { statusCode: null, description: null },
    };
    const response = await fetch(url, getCurrentRequestInit());
    const contentType = response.headers.get("content-type");
    const isJSON =
      contentType && contentType.indexOf("application/json") !== -1;
    const isText = contentType && contentType.indexOf("text/plain") !== -1;
    if (response.ok) {
      result.result = isJSON ? await response.json() : response;
      return result;
    } else {
      let textMessage: object | string | null = null;
      if (isJSON) {
        const tempMsg: object = await response.json();
        if (typeof tempMsg === "object" && "detail" in tempMsg) {
          if (typeof tempMsg.detail === "string") textMessage = tempMsg.detail;
          if (
            Array.isArray(tempMsg.detail) &&
            tempMsg.detail.length &&
            "msg" in tempMsg.detail[0] &&
            typeof tempMsg.detail[0].msg === "string"
          ) {
            textMessage = tempMsg.detail[0].msg as string;
          }
        }
      }
      if (isText) textMessage = await response.text();
      if (response.status === 401) {
        window.location.href = `/auth?navigate_to=${window.location.pathname}`;
      }
      result.error.statusCode = response.status;
      result.error.description = textMessage
        ? textMessage
        : "Something went wrong";
      return result;
    }
  };
  return await fetchData();
};

export default processApi;
