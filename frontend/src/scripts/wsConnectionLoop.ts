import { IBookingItem } from "../Components/Booking/BookingStartPanel";
import { backendUrl } from "../main";
import {
  IBookedSlotStateItem,
  IBookingStateItem,
  liveBookingsWsStore,
  locationsSchemaStore,
} from "../store/store";

interface IUpdateWsMessage {
  booking: number;
  slot: number;
  content_index: number;
  is_paused: boolean | number | null;
}

export const startConnectionLoop = async (
  endpoint: string,
  token?: string,
  booking?: IBookingItem
) => {
  const reconnectionStartDelay = 300;
  const reconnectionDelayStep = 300;
  const maxReconnectionDelay = 1500;

  let reconnectDelay = reconnectionStartDelay;
  let url: string = `${backendUrl.replace(
    /^(https?|http):\/\//,
    "wss://"
  )}${endpoint}`;
  if (token) {
    url = url.concat(`?token=${token}`);
  }

  while (true) {
    let socket: WebSocket;

    try {
      socket = new WebSocket(url);
    } catch (error: unknown) {
      console.error(`websocket fatal "${endpoint}"`, error);
      break;
    }

    try {
      socket.onopen = function () {
        console.log(`websocket opened "${endpoint}"`);
        reconnectDelay = reconnectionStartDelay;
        if (socket && booking) createNewConnectionState(socket, booking);
      };

      socket.onmessage = function (event) {
        if (event.data) {
          const wsMessage: unknown = JSON.parse(event.data);
          if (
            wsMessage &&
            typeof wsMessage === "object" &&
            "type" in wsMessage &&
            wsMessage.type === "init_booking_states"
          ) {
            if (
              "data" in wsMessage &&
              Array.isArray(wsMessage.data) &&
              wsMessage.data.length
            ) {
              updateConnectionState(wsMessage.data as IUpdateWsMessage[]);
            }
          }
        }
      };

      const closeResult = await new Promise<CloseEvent>((res, rej) => {
        socket.onclose = res;
        socket.onerror = rej;
      });

      console.log(`websocket event onclose "${endpoint}" :>> `, closeResult);
    } catch (error: unknown) {
      console.error(`websocket exception "${endpoint}" :>>`, error);
      reconnectDelay = Math.max(
        maxReconnectionDelay,
        reconnectDelay + reconnectionDelayStep
      );
    }

    console.log(`websocket reconnecting to "${endpoint}"`);
    await new Promise<void>((res) => setTimeout(res, reconnectDelay));
  }
};

const createNewConnectionState = (socket: WebSocket, booking: IBookingItem) => {
  const locationsSchema = locationsSchemaStore.getState().locationsSchema;
  const setBookingStates = liveBookingsWsStore.getState().setBookingStates;
  const bookingStates = liveBookingsWsStore.getState().bookingStates;
  if (locationsSchema) {
    const bookedSlots: IBookedSlotStateItem[] = [];

    for (const locationType in locationsSchema) {
      if (locationsSchema[locationType].locations) {
        const bookedLocation = locationsSchema[locationType].locations!.find(
          (locInSchemaItem) => locInSchemaItem.id === booking.location
        );
        if (bookedLocation && bookedLocation.slots) {
          bookedLocation.slots.forEach((slotItem) =>
            bookedSlots.push({
              slotId: slotItem.id,
              contentIndex: 0,
              isPaused: false,
            })
          );
        }
      }
    }
    setBookingStates([
      ...bookingStates,
      { booking, bookingSocket: socket, bookedSlots },
    ]);
  }
};

const updateConnectionState = (wsMessage: IUpdateWsMessage[]) => {
  const setBookingStates = liveBookingsWsStore.getState().setBookingStates;
  const bookingStates = liveBookingsWsStore.getState().bookingStates;
  const bookingStatesCopy: IBookingStateItem[] = [...bookingStates];
  wsMessage.forEach((changedSlot) => {
    const stateToUpdate = bookingStates.find(
      (prevStateVal) => +prevStateVal.booking.id === +changedSlot.booking
    );
    if (stateToUpdate) {
      const stateIndex = bookingStates.indexOf(stateToUpdate);
      const prevSlotVal = bookingStates[stateIndex].bookedSlots.find(
        (bookedSlotItem) => +bookedSlotItem.slotId === +changedSlot.slot
      );
      if (prevSlotVal) {
        const slotItemIndex =
          bookingStates[stateIndex].bookedSlots.indexOf(prevSlotVal);

        bookingStates[stateIndex].bookedSlots[slotItemIndex].contentIndex =
          changedSlot.content_index;
        bookingStates[stateIndex].bookedSlots[slotItemIndex].isPaused =
          changedSlot.is_paused;

        setBookingStates(bookingStatesCopy);
      }
    }
  });
};
