import { useEffect, useRef, useState } from "react";
import {
  resourceToEditStore,
  locationsSchemaStore,
  selectedBookingStore,
  selectedLocationStore,
  selectedSlotStore,
  TEXT_REGEX,
  URL_REGEX,
  bookingContentLimitStore,
  streamingInfoModalStore,
} from "../../store/store";
import slot_styles from "../../styles/modules/slot.module.scss";
import booking_form_styles from "../../styles/modules/bookingForm.module.scss";
import content_form_styles from "../../styles/modules/contentForm.module.scss";
import {
  ILocationSchemaItem,
  ILocationsSchema,
} from "../Booking/LocationsMenu";
import { useNavigate, useParams } from "react-router-dom";
import { backendUrl, contentFormTypesEnum } from "../../main";
import processApi, { MyFetchProps } from "../../scripts/processApi";
import { IContentItem, SCREEN_FORMATS } from "./SlotItem";
import { IBookingItem } from "../Booking/BookingStartPanel";
import loaders from "../../styles/modules/loaders.module.scss";
import { errorHandler } from "../../scripts/errorHandler";
import { getBookingContentLimit } from "../../scripts/getBookingContentLimit";

export function findLocation(
  locationId: string | null,
  schema: ILocationsSchema | null
) {
  if (!locationId || !schema) return null;

  for (const locationType in schema)
    if (schema[locationType].locations)
      for (const location of schema[locationType].locations!)
        if ((location as ILocationSchemaItem).id === locationId)
          return location;

  return null;
}

export const AddContentForm = ({
  formType,
  isEdit,
  isScene,
}: {
  formType: contentFormTypesEnum;
  isEdit: boolean;
  isScene?: boolean;
}) => {
  const maxDescriptionLength = 250;
  const { locationsSchema, setLocationsSchema } = locationsSchemaStore();
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [videoPrevFile, setVideoPrevFile] = useState<File | null>(null);
  const [addContentInputs, setAddContentInputs] = useState<{
    reference: string | undefined;
    description: string | undefined;
  }>({ reference: undefined, description: undefined });
  const [contentInputTempSrc, setContentInputTempSrc] = useState<string>("");
  const [isLoaderVisible, setIsLoaderVisible] = useState<boolean>(false);
  const [formValidation, setFormValidation] = useState<{
    description: boolean;
    reference: boolean;
    contentFile: boolean;
  }>({ description: true, reference: true, contentFile: true });
  const { selectedLocation, setSelectedLocation } = selectedLocationStore();
  const [world, setWorld] = useState<string | undefined>();
  const { selectedSlot, setSelectedSlot } = selectedSlotStore();
  const params = useParams();
  const { selectedBooking, setSelectedBooking } = selectedBookingStore();
  const { resourceToEdit, setResourceToEdit } = resourceToEditStore();
  const { limit } = bookingContentLimitStore();
  const imgFileContentRef = useRef<HTMLInputElement>(null);
  const imgFileVideoPrevRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const getSlotInfo = (schema: ILocationsSchema, currentSlot: number) => {
    const currentLocation = findLocation(selectedLocation, schema);

    if (currentLocation && currentLocation.slots) {
      const slotData = currentLocation.slots.find(
        (slot) => slot.id === currentSlot
      );
      if (slotData) {
        setSelectedSlot({
          slotInfo: {
            id: slotData.id,
            name: slotData.name.toString(),
            supportsStreaming: slotData.supportsStreaming,
            format: slotData.format,
            trigger: slotData.trigger,
          },
          content: selectedSlot.content,
        });
        if (currentLocation.scene) {
          const splitSceneData = currentLocation.scene.split(":");
          if (splitSceneData.length >= 2 && splitSceneData[1].length) {
            setWorld(splitSceneData[1]);
          }
        }
      }
    }
  };

  const handleAddFormSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (checkAllInputsValidRules()) {
      setIsLoaderVisible(true);
      let url: string | null = null;
      const formData = new FormData();

      const contentDataProcessing = async (fetchProps: MyFetchProps) => {
        try {
          const res = await processApi(fetchProps);
          if (res.error.statusCode || res.error.description) {
            errorHandler("Failed to process content!", res.error, () => {
              navigate(-1);
              window.history.replaceState({}, window.location.href);
            });
          }
        } catch (error) {
          errorHandler(
            "Failed to process content!",
            { description: error },
            () => {
              navigate(-1);
              window.history.replaceState({}, window.location.href);
            }
          );
        }
      };

      if (!isEdit) {
        if (formType === "image") {
          url = `${backendUrl}/image-content?file_name=${addContentInputs.description?.trim()}&slot=${
            selectedSlot.slotInfo.id
          }`;
        } else {
          url = `${backendUrl}/video-content?file_name=${addContentInputs.description?.trim()}&slot=${
            selectedSlot.slotInfo.id
          }&video_url=${addContentInputs.reference?.trim()}`;
        }
        if (!isScene) url = url.concat(`&booking=${selectedBooking?.id}`);
        if (formType === "image" && contentFile) {
          formData.append("file", contentFile);
        } else if (videoPrevFile) {
          formData.append("preview", videoPrevFile);
        }
        const fetchProps: MyFetchProps = {
          url,
          method: "POST",
        };
        if (formData.has("preview") || formData.has("file")) {
          fetchProps.body = formData;
        }
        await contentDataProcessing(fetchProps);
        setIsLoaderVisible(false);
      } else {
        if (videoPrevFile) {
          url = `${backendUrl}/video-content/${resourceToEdit.id}/preview`;
          formData.append("preview", videoPrevFile);
          await contentDataProcessing({
            url,
            method: "PATCH",
            body: formData,
          });
          setIsLoaderVisible(false);
        }
      }
      navigateAfterAdding();
    }
  };

  const navigateAfterAdding = () => {
    navigate(-1);
  };

  const handleTextInputsChange = (ev: React.FormEvent<HTMLInputElement>) => {
    const value = ev.currentTarget.value;
    const id = ev.currentTarget.id;
    setAddContentInputs((prev) => {
      if (id === "add_content_ref") {
        setFormValidation((prev) => {
          return { ...prev, reference: checkInputDataValid(value, URL_REGEX) };
        });
        return { ...prev, reference: value };
      }
      if (id === "add_content_description") {
        const isDataValid: boolean =
          checkInputDataValid(value, TEXT_REGEX, maxDescriptionLength) ||
          value.length === 0;
        setFormValidation((prev) => {
          return {
            ...prev,
            description: isDataValid,
          };
        });
        if (isDataValid) return { ...prev, description: value };
      }
      return prev;
    });
  };

  const handleVideoPrevFileChange = (ev: React.FormEvent<HTMLInputElement>) => {
    const file = ev.currentTarget.files ? ev.currentTarget.files[0] : null;
    setVideoPrevFile(file);
    setFormValidation((prev) => {
      return { ...prev, contentFile: checkFileValid(contentFile) };
    });
  };

  const handleContentFileChange = (ev: React.FormEvent<HTMLInputElement>) => {
    const file = ev.currentTarget.files ? ev.currentTarget.files[0] : null;
    setFormValidation((prev) => {
      return { ...prev, contentFile: checkFileValid(file) };
    });
    setContentFile(file);
  };

  const saveStreamingResource = async () => {
    setIsLoaderVisible(true);
    let url: string = `${backendUrl}/streaming-content?slot=${
      selectedSlot.slotInfo.id || params.slotId
    }`;
    if (!isScene) {
      url = url.concat(`&booking=${selectedBooking?.id || params.bookingId}`);
    }

    try {
      const res = await processApi({
        url,
        method: "POST",
      });
      if (res.error.statusCode || res.error.description) {
        errorHandler("Failed to adding streaming content!", res.error, () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        });
      }
    } catch (error) {
      errorHandler(
        "Failed to adding streaming content!",
        { description: error },
        () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        }
      );
    }

    setIsLoaderVisible(false);
    navigateAfterAdding();
  };

  const resetContentFileState = () => {
    setContentFile(null);
    if (imgFileContentRef.current) imgFileContentRef.current.value = "";
  };

  const getResourceToEditData = async () => {
    let url: string = `${backendUrl}/content?slot_id=${params.slotId}&location_id=${params.locationId}&resource_id=${params.resourceId}`;
    if (params.bookingId) url = url.concat(`&booking_id=${params.bookingId}`);

    try {
      const res = await processApi({ url });
      if (
        res.result &&
        Array.isArray(res.result) &&
        res.result.length &&
        typeof res.result[0] === "object" &&
        "content_id" in res.result[0]
      ) {
        const { resource_id, name, s3_urn, preview } = res
          .result[0] as IContentItem;
        setResourceToEdit({ id: resource_id, name, s3_urn, preview });
      }

      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get resource to edit data!", res.error, () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        });
      }
    } catch (error) {
      errorHandler(
        "Can't get resource to edit data!",
        { description: error },
        () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        }
      );
    }
  };

  const getBookingItemData = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/bookings/${params.bookingId}`,
      });
      if (res.result && typeof res.result === "object" && "id" in res.result) {
        setSelectedBooking(res.result as IBookingItem);
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get booking item data!", res.error, () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        });
      }
    } catch (error) {
      errorHandler(
        "Can't get booking item data!",
        { description: error },
        () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        }
      );
    }
  };

  const checkInputDataValid = (
    value: string | undefined,
    rule: RegExp,
    maxLength?: number
  ): boolean => {
    if (value) {
      if (maxLength) {
        return rule.test(value) && value.length <= maxLength;
      } else {
        return rule.test(value);
      }
    } else {
      return false;
    }
  };

  const checkDescriptionValid = () => {
    return (
      checkInputDataValid(
        addContentInputs.description,
        TEXT_REGEX,
        maxDescriptionLength
      ) ||
      (addContentInputs.description !== undefined &&
        addContentInputs.description.length > 0)
    );
  };

  const checkReferenceValid = () => {
    return (
      checkInputDataValid(addContentInputs.reference, URL_REGEX) &&
      addContentInputs.reference !== undefined &&
      addContentInputs.reference.length > 0
    );
  };

  const checkFileValid = (file: File | null) => {
    return Boolean(file);
  };

  const checkAllInputsValidRules = (): boolean => {
    setFormValidation({
      description: checkDescriptionValid(),
      reference: checkReferenceValid(),
      contentFile: checkFileValid(contentFile),
    });
    if (formType === "image")
      return checkDescriptionValid() && checkFileValid(contentFile);
    if (formType === "video")
      return checkDescriptionValid() && checkReferenceValid();
    if (formType === "streaming") return true;
    return false;
  };

  const getImgPreviewStyle = () => {
    switch (selectedSlot.slotInfo.format) {
      case SCREEN_FORMATS.STANDARD_WIDE:
        return content_form_styles.form_preview_img_cont_standard_wide;

      case SCREEN_FORMATS.STANDARD_NARROW:
        return content_form_styles.form_preview_img_cont_standard_narrow;

      case SCREEN_FORMATS.RECTANGULAR:
        return content_form_styles.form_preview_img_cont_rectangular;

      case SCREEN_FORMATS.RECTANGULAR_NARROW:
        return content_form_styles.form_preview_img_cont_rectangular_narrow;

      case SCREEN_FORMATS.ULTRA_WIDE:
        return content_form_styles.form_preview_img_cont_ultra_wide;

      default:
        return content_form_styles.form_preview_img_cont_standard_wide;
    }
  };

  useEffect(() => {
    const bookingId = selectedBooking?.id || params.bookingId;
    if (params.slotId && params.locationId) {
      if (!resourceToEdit.id && params.resourceId) getResourceToEditData();
      if (!selectedBooking && params.bookingId) getBookingItemData();
    }
    if (!locationsSchema) {
      const locationsSchemaLocStor = localStorage.getItem(
        "dao_hq_locationsSchema"
      );
      if (!locationsSchema && locationsSchemaLocStor) {
        setLocationsSchema(JSON.parse(locationsSchemaLocStor));
      }
    }
    if (!selectedLocation && params.locationId)
      setSelectedLocation(params.locationId);
    if (bookingId) getBookingContentLimit("slot", bookingId);
  }, []);

  useEffect(() => {
    if (params.slotId && locationsSchema) {
      getSlotInfo(locationsSchema, +params.slotId);
    }
  }, [locationsSchema]);

  useEffect(() => {
    if (isEdit && resourceToEdit.s3_urn && resourceToEdit.name) {
      setAddContentInputs({
        reference: resourceToEdit.s3_urn,
        description: resourceToEdit.name,
      });
    }
  }, [resourceToEdit.id]);

  useEffect(() => {
    if (contentFile) {
      setContentInputTempSrc(URL.createObjectURL(contentFile));
    } else if (videoPrevFile) {
      setContentInputTempSrc(URL.createObjectURL(videoPrevFile));
    } else if (resourceToEdit.preview && isEdit) {
      setContentInputTempSrc(resourceToEdit.preview);
    } else {
      setContentInputTempSrc("");
    }
  }, [contentFile, videoPrevFile, resourceToEdit]);

  return (
    <div className={content_form_styles.form_wrap}>
      <div className={content_form_styles.form_form_wrap}>
        {formType === "streaming" ? (
          <div>
            <div
              className={`${content_form_styles.form_title_wrap} ${content_form_styles.form_title_wrap__form}`}
            >
              <p className={content_form_styles.form_title}>
                {selectedSlot.slotInfo.name}
              </p>
              <div
                className={`${slot_styles.slot_add_content_controls_wrap} ${slot_styles.slot_add_content_controls_wrap__form}`}
              >
                <button
                  onClick={saveStreamingResource}
                  className={content_form_styles.form_save_button}
                >
                  SAVE
                </button>
                {limit.slotContent.content_count !== null &&
                limit.slotContent.limit !== null ? (
                  <div
                    className={`${slot_styles.slot_list_limit_wrap} ${slot_styles.slot_list_limit_wrap__slot}`}
                  >
                    <p className={slot_styles.slot_list_limit_label}>
                      Images limit
                    </p>
                    <p
                      className={slot_styles.slot_list_limit}
                    >{`${limit.slotContent.content_count}/${limit.slotContent.limit}`}</p>
                  </div>
                ) : null}
              </div>
            </div>
            <StreamingInfo worldName={world} />
          </div>
        ) : (
          <form
            className={content_form_styles.form_form}
            onSubmit={handleAddFormSubmit}
          >
            <div
              className={`${content_form_styles.form_title_wrap} ${content_form_styles.form_title_wrap__form}`}
            >
              <p className={content_form_styles.form_title}>
                {selectedSlot.slotInfo.name}
              </p>
              <div
                className={`${slot_styles.slot_add_content_controls_wrap} ${slot_styles.slot_add_content_controls_wrap__form}`}
              >
                <button
                  type="submit"
                  className={content_form_styles.form_save_button}
                >
                  SAVE
                </button>
                {limit.slotContent.content_count !== null &&
                limit.slotContent.limit !== null ? (
                  <div
                    className={`${slot_styles.slot_list_limit_wrap} ${slot_styles.slot_list_limit_wrap__slot}`}
                  >
                    <p className={slot_styles.slot_list_limit_label}>
                      Images limit
                    </p>
                    <p
                      className={slot_styles.slot_list_limit}
                    >{`${limit.slotContent.content_count}/${limit.slotContent.limit}`}</p>
                  </div>
                ) : null}
              </div>
            </div>
            {formType === "video" ? (
              <div className={content_form_styles.form_input_wrap}>
                <label
                  htmlFor="add_content_ref"
                  className={content_form_styles.form_label}
                >
                  Reference
                </label>
                <div className={content_form_styles.form_input_container}>
                  {!formValidation.reference ? (
                    <p
                      className={
                        booking_form_styles.form_input_event_name_valid_rules
                      }
                    >
                      Invalid reference format
                    </p>
                  ) : null}
                  <input
                    className={`${content_form_styles.form_input} ${
                      !formValidation.reference
                        ? content_form_styles.form_input_valid_error
                        : ""
                    }`}
                    id="add_content_ref"
                    name="content_ref"
                    value={addContentInputs.reference || ""}
                    onChange={handleTextInputsChange}
                    type="text"
                    disabled={isEdit}
                    onBlur={() => {
                      setFormValidation((prev) => {
                        return { ...prev, reference: checkReferenceValid() };
                      });
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div className={content_form_styles.form_input_wrap}>
              <label
                htmlFor="add_content_description"
                className={content_form_styles.form_label}
              >
                Description
              </label>
              <div className={content_form_styles.form_input_container}>
                <div
                  className={
                    booking_form_styles.form_input_event_name_valid_rules_wrap
                  }
                >
                  {!formValidation.description ? (
                    <p
                      className={
                        booking_form_styles.form_input_event_name_valid_rules
                      }
                    >
                      {`You can only use the following characters (a-z, 0-9) without special symbols. Max length - 250 characters`}
                    </p>
                  ) : null}
                  <p
                    className={content_form_styles.form_input_length_counter}
                  >{`${
                    addContentInputs.description
                      ? addContentInputs.description.length
                      : 0
                  }/250`}</p>
                </div>
                <input
                  className={`${content_form_styles.form_input} ${
                    !formValidation.description
                      ? content_form_styles.form_input_valid_error
                      : ""
                  }`}
                  id="add_content_description"
                  name="content_description"
                  onChange={handleTextInputsChange}
                  value={addContentInputs.description || ""}
                  type="text"
                  disabled={isEdit}
                  onBlur={() => {
                    setFormValidation((prev) => {
                      return { ...prev, description: checkDescriptionValid() };
                    });
                  }}
                />
              </div>
            </div>
            {formType === "image" ? (
              <div
                className={`${content_form_styles.form_input_wrap} ${content_form_styles.form_input_wrap__file}`}
              >
                <label
                  htmlFor="add_content_file"
                  className={content_form_styles.form_label__file}
                  onClick={resetContentFileState}
                >
                  <span>Add {formType === "image" ? "picture" : "video"}</span>
                  <span className={content_form_styles.form_fake_input}>
                    BROWSE
                  </span>
                  <input
                    className={`${content_form_styles.form_input} ${content_form_styles.form_input__file}`}
                    onChange={handleContentFileChange}
                    accept={
                      formType === "image"
                        ? "image/png, image/jpeg"
                        : "video/mp4"
                    }
                    id="add_content_file"
                    name="content_file"
                    type="file"
                    disabled={isEdit}
                    ref={imgFileContentRef}
                  />
                  <span>
                    Max size - 1Mb
                    <br />
                    Aspect ratio - {selectedSlot.slotInfo.format}
                  </span>
                </label>
                <div>
                  {!formValidation.contentFile ? (
                    <p
                      className={
                        booking_form_styles.form_input_event_name_valid_rules
                      }
                    >
                      No file selected. You must select a file.
                    </p>
                  ) : (
                    ""
                  )}
                  <div
                    onClick={() => imgFileContentRef.current?.click()}
                    className={`${
                      content_form_styles.form_preview_img_cont
                    } ${getImgPreviewStyle()} ${
                      !formValidation.contentFile
                        ? content_form_styles.form_input_valid_error
                        : ""
                    }`}
                  >
                    {contentInputTempSrc.length ? (
                      <img
                        className={content_form_styles.form_preview}
                        src={contentInputTempSrc}
                        alt="preview_img"
                      />
                    ) : (
                      <PreviewSkeleton />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`${content_form_styles.form_input_wrap} ${content_form_styles.form_input_wrap__file}`}
              >
                <label
                  htmlFor="add_video_prev_file"
                  className={content_form_styles.form_label__file}
                >
                  <span>Preview img</span>
                  <span className={content_form_styles.form_fake_input}>
                    BROWSE
                  </span>
                  <input
                    className={`${content_form_styles.form_input} ${content_form_styles.form_input__file}`}
                    onChange={handleVideoPrevFileChange}
                    accept="image/png, image/jpeg"
                    id="add_video_prev_file"
                    name="video_prev_file"
                    type="file"
                    ref={imgFileVideoPrevRef}
                  />
                  <span>
                    Max size - 1Mb
                    <br />
                    Aspect ratio - {selectedSlot.slotInfo.format}
                  </span>
                </label>
                <div
                  className={`${
                    content_form_styles.form_preview_img_cont
                  } ${getImgPreviewStyle()}`}
                  onClick={() => imgFileVideoPrevRef.current?.click()}
                >
                  {contentInputTempSrc.length ? (
                    <img
                      className={content_form_styles.form_preview}
                      src={contentInputTempSrc}
                      alt="preview_img"
                    />
                  ) : (
                    <PreviewSkeleton />
                  )}
                </div>
              </div>
            )}
          </form>
        )}
      </div>
      {isLoaderVisible ? (
        <div className={loaders.add_content_loader_wrap}>
          <div className={loaders.loader_ring} />
        </div>
      ) : null}
    </div>
  );
};

const PreviewSkeleton = () => (
  <div className={content_form_styles.form_preview_svg_wrap}>
    <svg
      width="100px"
      height="100px"
      viewBox="0 0 70.865 70.865"
      enableBackground="new 0 0 70.865 70.865"
      version="1.1"
      xmlSpace="preserve"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      fill="#dddce0"
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <g>
          <polygon
            fill="#FFFFFF"
            points=" 34.033,41.546 18.565,29.495 6.38,38.364 6.38,13.888 64.485,13.888 64.485,52.296 43.565,32.013 "
            stroke="#dddce0"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            strokeWidth="3"
          />
          <polygon
            fill="#FFFFFF"
            points=" 18.565,29.495 34.033,41.546 43.565,32.013 64.485,52.296 64.485,56.978 6.38,56.978 6.38,38.364 "
            stroke="#dddce0"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            strokeWidth="3"
          />
          <circle
            cx="32.696"
            cy="24.177"
            fill="#FFFFFF"
            r="4.047"
            stroke="#dddce0"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            strokeWidth="3"
          />
        </g>
      </g>
    </svg>
  </div>
);

export const StreamingInfo = (props: { worldName: string | undefined }) => {
  const { worldName } = props;
  const [copySuccess, setCopySuccess] = useState<string>("");
  const { isShowInfoModal, setIsShowInfoModal } = streamingInfoModalStore();
  const copyToClipboard = (ev: React.MouseEvent<HTMLElement>) => {
    if (ev.currentTarget.textContent) {
      navigator.clipboard.writeText(ev.currentTarget.textContent);
      setCopySuccess("Copied!");
    }
  };

  const handleWindowClick = (event: MouseEvent) => {
    const getDataset = (elem: HTMLElement): string | null => {
      const clickOnModal = elem.dataset.streaming_info_modal;
      if (clickOnModal) {
        return clickOnModal;
      } else {
        const parentElem = elem.parentElement;
        if (parentElem) {
          return getDataset(parentElem);
        } else return null;
      }
    };
    if (event.target) {
      const clickOnModal = getDataset(event.target as HTMLElement);
      if (isShowInfoModal && clickOnModal !== "streaming_info_modal") {
        setIsShowInfoModal(false);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, []);

  return (
    <div className={content_form_styles.form_streaming_content_wrap}>
      <p className={content_form_styles.form_streaming_paragraph}>
        Streaming via Decentraland Cast is an exclusive feature reserved for
        world owners and individuals who possess deployment rights.
      </p>
      <ol className={content_form_styles.form_streaming_list_container}>
        <li>
          Visit{" "}
          <a
            href="https://cast.decentraland.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Decentraland Cast
          </a>
        </li>
        <li>Select Your World: Log in and select the world to stream to.</li>
      </ol>

      <p className={content_form_styles.form_streaming_paragraph}>
        <code
          className={content_form_styles.form_streaming_list_container_world}
          onClick={copyToClipboard}
        >
          {worldName}
        </code>
        {copySuccess ? (
          <span
            className={
              content_form_styles.form_streaming_list_container_world_copied
            }
          >
            {copySuccess}
          </span>
        ) : null}
      </p>

      <ol
        className={content_form_styles.form_streaming_list_container}
        start={3}
      >
        <li>
          Join the Session: Once the world is selected, a session will be
          joined.
        </li>
      </ol>
      <ol
        className={content_form_styles.form_streaming_list_container}
        start={4}
      >
        <li>
          Share Screen or Camera Footage: If authorized, users have the option
          to either activate their cameras or share their screens directly
          within the app.
          <span
            className={content_form_styles.form_streaming_list_container_note}
          >
            <strong>📔 Note</strong>: If you intend to stream a video along with
            its audio, it’s advisable to utilize Google Chrome or a browser
            built on the Chrome engine. These browsers offer the functionality
            to easily share both video and audio directly from a browser tab.
          </span>
        </li>
      </ol>
      <ol
        className={content_form_styles.form_streaming_list_container}
        start={5}
      >
        <li>
          Flawless Integration: Decentraland Cast’s integration with the world
          ensures uninterrupted communication, allowing users to effortlessly
          send, receive, and listen to chat and voice messages.
        </li>
      </ol>
    </div>
  );
};
