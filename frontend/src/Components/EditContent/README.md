## Content magement

Components:

- **AddContentForm** component is a versatile component used for adding or editing content in the selected location. It is utilized for adding and editing content for events (Booking tab) as well as for adding and editing default content (Scene tab). It supports two types of content: images and videos.

- **MusicAddForm** component is used to add background music to the scene. It is used for both default settings and for configuring music during booking.

- **EditChannelForm** component is used to edit the connection data of a channel to the Discord screen on the scene. It is only used in the Scene tab.

- In addition to the components mentioned above, there are several others responsible for fetching data about the current content and displaying each type in the rendered list. The **SlotsList** component is used to show the entire list of uploaded content. It uses the following child components: **SlotItem** (for images and videos), **DiscordScreenItem** (for Discord screens on the scene), and **MusicLocationItem** (for music).

- **ConfirmActionModal** component is a versatile component used in all cases when a type of content needs to be deleted. It is a modal window that provides two action choices.
