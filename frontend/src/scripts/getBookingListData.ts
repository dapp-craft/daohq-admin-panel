import { IBookingItem } from "../Components/Booking/BookingStartPanel";
import { backendUrl } from "../main";
import { activeBookingsStore, inactiveBookingsStore } from "../store/store";
import { errorHandler } from "./errorHandler";
import processApi from "./processApi";

export const getBookingListData = async (
  bookingsTarget: "active" | "inactive",
  locationId: string,
  take: number
): Promise<IBookingItem[] | undefined> => {
  const setInactiveBookings =
    inactiveBookingsStore.getState().setInactiveBookings;
  const setActiveBookings = activeBookingsStore.getState().setActiveBookings;

  const getBookingData = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/bookings/${locationId}/${bookingsTarget}?take=${take}`,
      });
      if (res.result && Array.isArray(res.result)) {
        return res.result;
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler(
          "Failed to get bookings data!",
          res.error,
          () => (window.location.href = "/")
        );
      }
    } catch (error) {
      errorHandler(
        "Failed to get bookings data!",
        {
          description: error,
        },
        () => (window.location.href = "/")
      );
    }
  };

  const bookingsData = await getBookingData();

  if (bookingsData) {
    if (bookingsTarget === "active") {
      setActiveBookings(bookingsData);
    } else if (bookingsTarget === "inactive") {
      setInactiveBookings(bookingsData);
    }
    return bookingsData as IBookingItem[];
  }
};
