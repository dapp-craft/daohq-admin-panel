## Scripts

This directory contains functions that are used for fetching or processing data, which are utilized across various components at different levels of nesting:

- **breadcrumbSync**:
  It synchronizes the state of the navigation panel. The function can be called from any component at any stage.

- **buildUrlToScene**:
  The function fetches data about the details of the deployed scene and constructs the current URL that can be used to access the scene.

- **checkUserRole**:
  The function checks the user's role based on the Web3 wallet.

- **errorHandler**:
  A universal function that handles errors throughout the entire project. It displays a modal window on top of all other windows. It accepts an error message, a status code, and a callback that will be executed when the OK button is clicked.

- **getBookingContentLimit**:
  A function that retrieves and updates the limits for the selected booking. The limits are set on the number of files that a user can upload to the server. The limit is calculated for each booking individually.

- **getBookingListData**:
  The function fetches data about previously created bookings and saves them in storage.

- **getLocationsSchema**:
  The function fetches data about locations available for booking, processes the features of each slot, constructs the current location schema, and saves this data in local storage.

- **hashCode**:
  A function that generates a short hash from any given string. It is used as a key when rendering lists.

- **processApi**:
  The function is designed to simplify working with the API. It accepts arguments specifying the details of each request and returns the result. The result is either parsed data or an error, including its code and description.

- **startConnectionLoop**:
  The function establishes a WebSocket connection and reconnects in case the connection drops. The endpoint for the connection is passed as an argument. Additionally, the connection can include an authorization JWT. To update the state of a live booking, booking data also needs to be passed as an argument.
