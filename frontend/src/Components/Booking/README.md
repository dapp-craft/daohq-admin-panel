## Booking

In the **Booking tab**, all event bookings are displayed. Here, users can create new events, edit existing ones, and delete their own events. Within a created event, users can configure it by adding the necessary content that will be displayed on the screens during the room booking.

Components:

- **BookingStartPanel** component is responsible for fetching information about the current events and rendering their up-to-date status. It includes a list of BookingItem components.
  It also implements event search functionality and renders the full list of events.

- **BookingEditItem** component (and all its child components) handles booking new events and editing previously created ones. It contains a form for creating a new booking.

- **LocationsMenu** component fetches data about available locations and their features. Upon the initial load of the component, the **getLocationsSchema()** function is executed. This function constructs the locations schema and saves (or updates) it in local storage. Based on this data, the start menu is generated and rendered at the /booking path. Additionally, the **LocationsMenu component is reused** to create the left bar menu, which is positioned on the left side of the screen on all other routes.
