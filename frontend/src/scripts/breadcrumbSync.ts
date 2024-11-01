import { ILocationsSchema } from "../Components/Booking/LocationsMenu";
import { IBreadcrumbItem, breadcrumbStore } from "../store/store";

export const breadcrumbSync = () => {
  const setBreadcrumbsParts = breadcrumbStore.getState().setBreadcrumbsParts;
  const fullPath: string = window.location.pathname.slice(1);
  const splitFullPath: string[] = fullPath.split("/");
  let firstPageName: string | null = null;
  if (splitFullPath.length >= 1) {
    firstPageName = splitFullPath[0];
  }
  splitFullPath.forEach((pathItem, index) => {
    let isItemSet: boolean = true;
    const breadcrumbItem: IBreadcrumbItem = {
      name: pathItem,
      path: `/${pathItem}`,
      level: index,
    };
    if (firstPageName === "booking") {
      if (index === 2 && pathItem === "edit") {
        breadcrumbItem.name = `${pathItem} ${splitFullPath[index + 1]}`;
        breadcrumbItem.path = `/${pathItem}/${splitFullPath[index + 1]}`;
      } else if (index === 2 && pathItem === "create") {
        breadcrumbItem.name = pathItem;
      }
      if (index > 2) breadcrumbItem.level = index - 1;
      if (index === 3 && splitFullPath[index - 1] === "edit") {
        isItemSet = false;
      }
      if (index === 4) {
        breadcrumbItem.name = "content";
      }
      if (index === 5) {
        const slotName = getSlotName(+pathItem);
        if (slotName) breadcrumbItem.name = slotName;
      }
      if (index === 6 && pathItem === "add_img") {
        breadcrumbItem.name = "add img";
      }
      if (index === 6 && pathItem === "add_video") {
        breadcrumbItem.name = "add video";
      }
      if (index === 6 && pathItem === "add_music") {
        breadcrumbItem.name = "add music";
      }
      if (index === 6 && pathItem === "edit_video") {
        breadcrumbItem.name = "edit video";
        breadcrumbItem.path = `/${pathItem}/${splitFullPath[index + 1]}`;
      }
      if (index === 7 && splitFullPath[index - 1] === "edit_video") {
        isItemSet = false;
      }
    }
    if (firstPageName === "scene") {
      if (index === 2) {
        if (pathItem === "discord") {
          isItemSet = false;
          return;
        }
        const slotName = getSlotName(+pathItem);
        if (slotName) breadcrumbItem.name = slotName;
      }
      if (index === 3 && splitFullPath[index - 1] === "discord") {
        breadcrumbItem.path = `/discord/${pathItem}`;
      }
      if (index === 3 && pathItem === "add_video") {
        breadcrumbItem.name = "add video";
      }
      if (index === 3 && pathItem === "add_img") {
        breadcrumbItem.name = "add image";
      }
      if (index === 3 && pathItem === "edit_video") {
        breadcrumbItem.name = "edit video";
        breadcrumbItem.path = `/${pathItem}/${splitFullPath[index + 1]}`;
      }
      if (index === 3 && pathItem === "add_music") {
        breadcrumbItem.name = "add music";
      }
      if (index === 4 && splitFullPath[index - 1] === "edit_video") {
        isItemSet = false;
      }
      if (index === 4 && pathItem === "edit_channel") {
        breadcrumbItem.name = "connect discord";
      }
    }
    if (isItemSet) setBreadcrumbsParts({ newPart: breadcrumbItem });
  });
};

const getSlotName = (slotId: number): string | null => {
  const schemaLocStor = localStorage.getItem("dao_hq_locationsSchema");
  let slotName: string | null = null;
  let schema: ILocationsSchema = {};
  if (schemaLocStor) schema = JSON.parse(schemaLocStor);
  if (Object.keys(schema).length) {
    for (const key in schema) {
      if ("locations" in schema[key] && Array.isArray(schema[key].locations)) {
        schema[key].locations?.forEach((item) => {
          if (item.slots) {
            item.slots.forEach((slot) => {
              if (slot.id === slotId) slotName = slot.name.toString();
            });
          }
        });
      }
    }
  }
  return slotName;
};
