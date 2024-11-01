type QueryParams = { [key: string]: string | number | boolean };

class URLSearchParams {
  private params: QueryParams = {};

  constructor(params: QueryParams = {}) {
    this.params = params;
  }

  toString() {
    return Object.entries(this.params)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
  }

  public getParams(): object {
    return this.params;
  }

  public append(key: string, value: string) {
    Object.assign(this.params, { [key]: value });
  }
}

const parseLocationIdentifier = (id: string) => {
  const [coordinates, realm, network, catalyst] = id.split(":");
  let x: number = 0;
  let y: number = 0;
  if (coordinates.length >= 2) {
    const splitCoords = coordinates.split(",");
    x = Number(splitCoords[0]);
    y = Number(splitCoords[1]);
  }
  return {
    coordinates: { x, y },
    realm,
    network,
    catalyst,
  };
};

export const buildUrlToScene = (
  id: string,
  locationId?: string,
  slotId?: string
) => {
  const data = parseLocationIdentifier(id);
  const baseUrl = `https://decentraland.org/play/`;
  const params = new URLSearchParams();
  if (data.realm) params.append("realm", data.realm);
  if (data.coordinates)
    params.append("position", `${data.coordinates.x}%2C${data.coordinates.y}`);
  if (data.network) params.append("NETWORK", data.network);
  if (data.catalyst) params.append("CATALYST", data.catalyst);
  if (locationId && slotId) {
    params.append("teleport_to", `${locationId}${slotId}`);
  }
  return baseUrl + "?" + params.toString();
};
