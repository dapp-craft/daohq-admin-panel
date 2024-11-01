import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import form_styles from "../../styles/modules/bookingForm.module.scss";
import loaders from "../../styles/modules/loaders.module.scss";
import processApi from "../../scripts/processApi";
import { backendUrl } from "../../main";
import {
  bookingPaginationStore,
  breadcrumbStore,
  selectedBookingStore,
  selectedLocationStore,
  selectedSlotStore,
  TEXT_REGEX,
} from "../../store/store";
import { IBookingItem } from "./BookingStartPanel";
import { useNavigate, useParams } from "react-router-dom";
import { getBookingListData } from "../../scripts/getBookingListData";
import { errorHandler } from "../../scripts/errorHandler";

interface INewBooking {
  eventName?: string;
  description?: string;
  date?: string;
  startDate?: number;
  startTime?: string;
}

interface IBodyPatch {
  title: string | undefined;
  description: string | undefined;
}

interface IBodyPost extends IBodyPatch {
  start_date: number;
  duration: number;
  event_date: number;
  location: string | null;
}

interface ITimePoint {
  value: string;
  timestamp: number;
  isTimeBooked: boolean;
  isMarkAsBooked?: boolean;
}

interface ITimeBlock {
  currentDay: ITimePoint[];
  nextDay: ITimePoint[];
  nextDayDate: string;
}

interface IFormValidItem {
  status: boolean;
  elemRef: React.MutableRefObject<null | HTMLElement>;
}

interface IFormValidation {
  name: IFormValidItem;
  description: IFormValidItem;
  time: IFormValidItem;
}

export const BookingEditItem = ({ isEdit }: { isEdit: boolean }) => {
  const date = new Date();
  const timeStep: number = 30 * 60000;
  const maxTitleLength = 150;
  const maxDescriptionLength = 700;
  const [newBookingData, setNewBookingData] = useState<INewBooking>({
    eventName: undefined,
    description: undefined,
    date: date.toISOString().split("T")[0],
    startDate: undefined,
    startTime: undefined,
  });
  const [selectedTimestamps, setSelectedTimestamps] = useState<number[]>([]);
  const [timePoints, setTimePoints] = useState<ITimeBlock>({
    currentDay: [],
    nextDay: [],
    nextDayDate: "",
  });
  const { setBreadcrumbsParts } = breadcrumbStore();
  const params = useParams();
  const navigate = useNavigate();
  const { selectedBooking, setSelectedBooking } = selectedBookingStore();
  const { selectedLocation } = selectedLocationStore();
  const { selectedSlot, setSelectedSlot } = selectedSlotStore();
  const { bookingPagination } = bookingPaginationStore();
  const [inputImageFile, setInputImageFile] = useState<File | null>(null);
  const [posterImgSrc, setPosterImgSrc] = useState<string | null>(null);
  const [_, setTimeErrorMsg] = useState<boolean>(false);
  const [isLoaderVisible, setIsLoaderVisible] = useState<boolean>(false);
  const nameElemRef = useRef(null);
  const descriptionElemRef = useRef(null);
  const timeElemRef = useRef(null);
  const [formValidation, setFormValidation] = useState<IFormValidation>({
    name: { status: true, elemRef: nameElemRef },
    description: { status: true, elemRef: descriptionElemRef },
    time: { status: true, elemRef: timeElemRef },
  });

  const getTimeBlocks = async (): Promise<void> => {
    const currentDayData: ITimePoint[] = [];
    const nextDayData: ITimePoint[] = [];
    const currentTimestamp = new Date().getTime();
    let stringStartDateVal: string = "";

    const getBookedDates = async (url: string) => {
      try {
        const res = await processApi({ url });
        if (res.result && Array.isArray(res.result) && res.result.length) {
          return res.result as IBookingItem[];
        }
        if (res.error.statusCode || res.error.description) {
          errorHandler(
            "Can't get dates of existing bookings!",
            res.error,
            () => {
              navigate(-1);
              window.history.replaceState({}, window.location.href);
            }
          );
        }
      } catch (error) {
        errorHandler(
          "Can't get dates of existing bookings!",
          { description: error },
          () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          }
        );
      }
    };

    if (isEdit && selectedBooking?.start_date) {
      const temDate = new Date(selectedBooking.start_date);
      const stringDate = temDate.toISOString();
      stringStartDateVal = stringDate.split("T")[0];
    } else {
      stringStartDateVal = `${newBookingData.date}`;
    }
    const startDate = new Date(stringStartDateVal);
    let time: number = startDate.getTime();
    let startHours: number = 12;
    let startMinutes: number = 0;
    let bookedPoints: IBookingItem[] = [];

    const bookedDatesData = await getBookedDates(
      `${backendUrl}/locations/${
        selectedLocation || params.locationId
      }/bookings?from_date=${time}&to_date=${time + 48 * 60 * 60000}`
    );

    if (bookedDatesData) bookedPoints = bookedDatesData;

    for (let i = 0; i < 96; i++) {
      if (startHours === 13) startHours = 1;
      let isTimeBooked: boolean = false;
      isTimeBooked =
        bookedPoints.some(
          (point) =>
            time >= +point.start_date &&
            time < +point.start_date + +point.duration
        ) ||
        currentTimestamp >= time ||
        isEdit;
      let timePeriod: string = "am";
      if ((i >= 24 && i < 48) || i >= 72) timePeriod = "pm";
      const currentItem: ITimePoint = {
        timestamp: time,
        value: `${startHours >= 10 ? startHours : `0${startHours}`}:${
          startMinutes >= 10 ? startMinutes : `0${startMinutes}`
        } ${timePeriod}`,
        isTimeBooked,
      };

      if (isEdit && selectedBooking) {
        let { duration, start_date } = selectedBooking;
        const durationPoints: number[] = [+start_date];

        while (duration > 0) {
          durationPoints.push(+start_date + duration);
          duration = duration - timeStep;
        }
        const maxTimePoint = Math.max.apply(null, durationPoints);
        const index: number = durationPoints.indexOf(maxTimePoint);
        durationPoints.splice(index, 1);
        if (durationPoints.some((durPoint) => durPoint === time)) {
          currentItem.isMarkAsBooked = true;
        }
      }

      if (i < 48) {
        currentDayData.push(currentItem);
      } else {
        nextDayData.push(currentItem);
      }

      if (!(i % 2)) {
        startMinutes = 30;
      } else {
        startHours += 1;
        startMinutes = 0;
      }
      time += timeStep;
    }
    startDate.setTime(time - 24 * 60 * 60000 - timeStep);
    setTimePoints({
      currentDay: currentDayData,
      nextDay: nextDayData,
      nextDayDate: startDate.toDateString(),
    });
  };

  const getPosterImageSrc = () => {
    let src: string | null = null;
    if (inputImageFile) src = URL.createObjectURL(inputImageFile);
    if (selectedBooking?.preview && !inputImageFile) {
      src = selectedBooking.preview;
    }
    setPosterImgSrc(src);
  };

  // const getStartDateOptions = () => {
  //   let currentDateTime: Date | null = null;
  //   let nextDateTime: Date | null = null;
  //   const values: { text: string; timestamp: number }[] = [];
  //   if (selectedTimestamps.length) {
  //     const minSelected = Math.min.apply(null, selectedTimestamps);
  //     const maxSelected = Math.max.apply(null, selectedTimestamps);
  //     const minSelectedDateTime = new Date(minSelected)
  //       .toISOString()
  //       .split("T");
  //     const maxSelectedDateTime = new Date(maxSelected)
  //       .toISOString()
  //       .split("T");
  //     currentDateTime = new Date(minSelectedDateTime[0]);
  //     nextDateTime = new Date(maxSelectedDateTime[0]);
  //   }
  //   if (isEdit && selectedBooking) {
  //     const selectedDateTime = new Date(selectedBooking.start_date)
  //       .toISOString()
  //       .split("T");
  //     currentDateTime = new Date(selectedDateTime[0]);
  //   }
  //   if (currentDateTime) {
  //     values.push({
  //       text: currentDateTime.toISOString().split("T")[0],
  //       timestamp: currentDateTime.getTime(),
  //     });
  //   }
  //   if (nextDateTime && nextDateTime.getTime() !== currentDateTime?.getTime()) {
  //     values.push({
  //       text: nextDateTime.toISOString().split("T")[0],
  //       timestamp: nextDateTime.getTime(),
  //     });
  //   }
  //   return values;
  // };

  const checkTime = (time: string) => {
    if (newBookingData.startDate) {
      const minVal = Math.min.apply(null, selectedTimestamps);
      const maxVal = Math.max.apply(null, selectedTimestamps) + timeStep;
      const splitSelectedTime = time.split(":");
      const selectedTimeMsec =
        newBookingData.startDate +
        (+splitSelectedTime[0] * 60 + +splitSelectedTime[1]) * 60000;
      return selectedTimeMsec >= minVal && selectedTimeMsec <= maxVal;
    }
  };

  const handleFormInputChange = (
    ev: React.FormEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const value = ev.currentTarget.value;
    const id = ev.currentTarget.id;

    setNewBookingData((prev) => {
      const minVal = new Date(newBookingData.date!).getTime();
      const minSelectedVal: number = Math.min.apply(null, selectedTimestamps);
      const handleSelectedValDate = new Date(+value);
      const minSelectedValDate = new Date(minSelectedVal);
      if (id === "input_event_name") {
        if (
          checkInputDataValid(value, TEXT_REGEX, maxTitleLength) ||
          value.length === 0
        ) {
          if (!formValidation.name.status) {
            setFormValidation((prev) => {
              return { ...prev, name: { status: true, elemRef: nameElemRef } };
            });
          }
          return { ...prev, eventName: value };
        } else {
          setFormValidation((prev) => {
            return { ...prev, name: { status: false, elemRef: nameElemRef } };
          });
        }
      }
      if (id === "input_event_description")
        if (
          checkInputDataValid(value, TEXT_REGEX, maxDescriptionLength) ||
          value.length === 0
        ) {
          if (!formValidation.description.status) {
            setFormValidation((prev) => {
              return {
                ...prev,
                description: { status: true, elemRef: descriptionElemRef },
              };
            });
          }
          return { ...prev, description: value };
        } else {
          setFormValidation((prev) => {
            return {
              ...prev,
              description: { status: false, elemRef: descriptionElemRef },
            };
          });
        }

      if (id === "input_event_date") return { ...prev, date: value };
      if (id === "select_event_start_date") {
        return {
          ...prev,
          startDate: +value,
          startTime:
            handleSelectedValDate.getTime() !== minVal
              ? handleSelectedValDate.toISOString().split("T")[1].slice(0, 5)
              : minSelectedValDate.toISOString().split("T")[1].slice(0, 5),
        };
      }
      if (id === "input_event_start_time") {
        if (checkTime(value)) {
          return { ...prev, startTime: value };
        } else {
          setTimeErrorMsg(true);
          setTimeout(() => setTimeErrorMsg(false), 5000);
          return { ...prev };
        }
      }
      return prev;
    });
  };

  const checkInputDataValid = (
    value: string | undefined,
    rule: RegExp,
    maxLength: number
  ): boolean => {
    if (value) {
      return rule.test(value) && value.length <= maxLength;
    } else {
      return false;
    }
  };

  const checkNameValid = (): boolean => {
    return (
      checkInputDataValid(
        newBookingData.eventName,
        TEXT_REGEX,
        maxTitleLength
      ) ||
      (newBookingData.eventName !== undefined &&
        newBookingData.eventName.length > 0)
    );
  };

  const checkDescriptionValid = (): boolean => {
    return (
      checkInputDataValid(
        newBookingData.description,
        TEXT_REGEX,
        maxDescriptionLength
      ) ||
      (newBookingData.description !== undefined &&
        newBookingData.description.length > 0)
    );
  };

  const checkTimeValid = (timestamps: number[]): boolean => {
    return timestamps.length > 0;
  };

  const updateValidationState = (): IFormValidation => {
    const newValidState: IFormValidation = {
      name: { status: checkNameValid(), elemRef: nameElemRef },
      description: {
        status: checkDescriptionValid(),
        elemRef: descriptionElemRef,
      },
      time: {
        status: checkTimeValid(selectedTimestamps),
        elemRef: timeElemRef,
      },
    };
    setFormValidation(newValidState);
    return newValidState;
  };

  const checkAllInputsValidRules = (): boolean => {
    return (
      checkNameValid() &&
      checkDescriptionValid() &&
      (checkTimeValid(selectedTimestamps) || isEdit)
    );
  };

  const saveBooking = async (): Promise<number | null> => {
    let addedBookingId: number | null = null;
    const maxVal: number = Math.max.apply(null, selectedTimestamps);
    const minVal: number = Math.min.apply(null, selectedTimestamps);
    //const splitTime: string[] = newBookingData.startTime!.split(":");
    //const eventTime: number = (+splitTime[0] * 60 + +splitTime[1]) * 60000;
    //const eventDate: number = newBookingData.startDate! + eventTime;

    let url: string = `${backendUrl}/bookings`;
    const bodyPost: IBodyPost = {
      title: newBookingData.eventName?.trim(),
      start_date: minVal,
      duration: maxVal - minVal + timeStep,
      event_date: minVal,
      description: newBookingData.description?.trim(),
      location: selectedLocation,
    };

    const bodyPatch: IBodyPatch = {
      title: newBookingData.eventName?.trim(),
      description: newBookingData.description?.trim(),
    };

    const bookingProcessing = async (
      url: string,
      body: IBodyPost | IBodyPatch
    ) => {
      try {
        const res = await processApi({
          url,
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
        });
        if (
          res.result &&
          typeof res.result === "object" &&
          "id" in res.result
        ) {
          return res.result;
        }
        if (res.error.statusCode || res.error.description) {
          errorHandler("Booking processing failed!", res.error, () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          });
        }
      } catch (error) {
        errorHandler(
          "Booking processing failed!",
          { description: error },
          () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          }
        );
      }
    };

    const posterProcessing = async (url: string, body: FormData) => {
      try {
        const res = await processApi({
          url,
          method: "PATCH",
          body,
        });
        if (res.error.statusCode || res.error.description) {
          errorHandler("Failed to process booking poster!", res.error, () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          });
        }
      } catch (error) {
        errorHandler(
          "Failed to process booking poster!",
          { description: error },
          () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          }
        );
      }
    };

    if (isEdit && selectedBooking) {
      url = `${backendUrl}/bookings/${selectedBooking.id}`;
    } else if (isEdit && !selectedBooking) {
      throw new Error("Missing selectedBooking value for edit booking");
    }

    const addedBooking = await bookingProcessing(
      url,
      isEdit ? bodyPatch : bodyPost
    );
    if (addedBooking) {
      if (typeof addedBooking.id === "number") addedBookingId = addedBooking.id;
      setSelectedBooking(addedBooking as IBookingItem);
    }

    if (addedBooking && inputImageFile) {
      const formData = new FormData();
      formData.append("preview", inputImageFile);
      await posterProcessing(
        `${backendUrl}/bookings/${(addedBooking as IBookingItem).id}/poster`,
        formData
      );
    }

    setSelectedTimestamps([]);
    forceUpdateBookingsData();

    return addedBookingId;
  };

  const forceUpdateBookingsData = () => {
    const locationId: string | undefined =
      selectedLocation || params.locationId;
    if (locationId) {
      getBookingListData("active", locationId, bookingPagination.activeTake);
    }
  };

  const handleNewBookingSubmit = async (
    ev: React.FormEvent<HTMLFormElement>
  ) => {
    ev.preventDefault();
    const newValidState = updateValidationState();
    if (checkAllInputsValidRules()) {
      setIsLoaderVisible(true);
      const bookingId: number | null = await saveBooking();
      if (selectedSlot.content?.length) {
        setSelectedSlot({
          slotInfo: selectedSlot.slotInfo,
          content: [],
        });
      }
      if (bookingId) {
        setBreadcrumbsParts({
          newPart: { name: "content", path: "/slots", level: 3 },
        });
        setIsLoaderVisible(false);
        navigate(`/booking/${selectedLocation}/edit/${bookingId}`, {
          replace: true,
        });
        navigate(`/booking/${selectedLocation}/edit/${bookingId}/slots`);
      }
    } else {
      for (const fieldName in newValidState) {
        const currentField: IFormValidItem =
          newValidState[fieldName as keyof typeof newValidState];
        if (!currentField.status) {
          const elem = currentField.elemRef.current?.getBoundingClientRect();
          if (elem) {
            const top = elem.top + window.scrollY - 64;
            window.scrollTo({
              top,
              left: 0,
              behavior: "smooth",
            });
          }
          return;
        }
      }
    }
  };

  const handleTimePointClick = (ev: React.FormEvent<HTMLDivElement>) => {
    if (isEdit) return;
    const timestamp = Number(ev.currentTarget.dataset.timestamp);
    const isTimeBooked = ev.currentTarget.dataset.is_time_booked === "true";
    setSelectedTimestamps((prev) => {
      const duplicate = prev.find((prevTime) => prevTime === timestamp);
      const newVal: number[] = [...prev];
      const maxVal = Math.max.apply(null, newVal);
      const minVal = Math.min.apply(null, newVal);
      if (!duplicate) {
        if (
          !isTimeBooked &&
          (timestamp === minVal - timeStep ||
            timestamp === maxVal + timeStep ||
            !selectedTimestamps.length)
        ) {
          newVal.push(timestamp);
        }
      } else if (timestamp === maxVal || timestamp === minVal) {
        const index: number = prev.indexOf(duplicate);
        newVal.splice(index, 1);
      }
      setFormValidation((prev) => {
        return {
          ...prev,
          time: { status: checkTimeValid(newVal), elemRef: timeElemRef },
        };
      });
      return newVal;
    });
  };

  const handleFileInputChanger = (ev: React.FormEvent<HTMLInputElement>) => {
    const file = ev.currentTarget.files ? ev.currentTarget.files[0] : null;
    setInputImageFile(file);
  };

  const getSelectedBookingData = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/bookings/${params.bookingId}`,
      });
      if (res.result && typeof res.result === "object" && "id" in res.result) {
        setSelectedBooking(res.result as IBookingItem);
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get data for selected booking!", res.error, () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        });
      }
    } catch (error) {
      errorHandler(
        "Can't get data for selected booking!",
        { description: error },
        () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        }
      );
    }
  };

  const checkTimeItemUiSibling = (timePoint: ITimePoint): boolean => {
    if (timePoint.isTimeBooked || timePoint.isMarkAsBooked) return false;
    if (selectedTimestamps.length <= 0) return true;

    const currentTimestamp: number = timePoint.timestamp;
    const maxTimestamp: number =
      Math.max.apply(null, selectedTimestamps) + timeStep;
    const minTimestamp: number =
      Math.min.apply(null, selectedTimestamps) - timeStep;

    if (currentTimestamp < minTimestamp || currentTimestamp > maxTimestamp) {
      return false;
    } else {
      return true;
    }
  };

  useEffect(() => {
    if (!selectedBooking && isEdit) getSelectedBookingData();
    if (selectedBooking && !isEdit) setSelectedBooking(null);
    if (isEdit && selectedTimestamps.length) setSelectedTimestamps([]);
  }, []);

  useEffect(() => {
    getTimeBlocks();
  }, [newBookingData.date, selectedBooking]);

  useEffect(() => {
    if (isEdit && selectedBooking) {
      const eventDate = new Date(selectedBooking.event_date);
      const startDate = new Date(selectedBooking.start_date);
      setNewBookingData({
        date: eventDate.toISOString().split("T")[0],
        startDate: selectedBooking.start_date,
        startTime: startDate.toISOString().split("T")[1].slice(0, 5),
        eventName: selectedBooking.title,
        description: selectedBooking.description,
      });
    }
  }, [selectedBooking]);

  useEffect(() => {
    getPosterImageSrc();
  }, [inputImageFile, selectedBooking?.preview]);

  useEffect(() => {
    if (selectedTimestamps.length) {
      const minVal = Math.min.apply(null, selectedTimestamps);
      const minValDateTime = new Date(minVal);
      const startDate = new Date(minValDateTime.toISOString().split("T")[0]);
      setNewBookingData((prev) => {
        return {
          ...prev,
          startDate: startDate.getTime(),
          startTime: minValDateTime.toISOString().split("T")[1].slice(0, 5),
        };
      });
    } else if (!isEdit) {
      setNewBookingData((prev) => {
        return {
          ...prev,
          startDate: undefined,
          startTime: "",
        };
      });
    }
  }, [selectedTimestamps.length]);

  return (
    <div className={form_styles.form_container}>
      <form
        className={form_styles.form_submission}
        onSubmit={handleNewBookingSubmit}
      >
        <div className={form_styles.form_buttons_wrap}>
          <div>
            <div className={form_styles.form_pre_label_wrap}>
              <p className={form_styles.form_input_event_label_text}>Poster</p>
              <p className={form_styles.form_input_event_label_hint}>
                Click to upload new image. Max size - 1Mb. Aspect ratio - 16:9.
              </p>
            </div>
            <label className={form_styles.form_input_add_img_label}>
              {posterImgSrc ? (
                <ImgPosterPrev posterImgSrc={posterImgSrc} />
              ) : (
                <>
                  <span>+</span>
                  <span>Add Image</span>
                </>
              )}
              <input
                className={form_styles.form_input_add_img}
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleFileInputChanger}
              />
            </label>
          </div>
          {isEdit && (
            <div className={form_styles.form_buttons_edit_wrap}>
              <div>
                <button type="submit" className={form_styles.form_edit_link}>
                  SETUP CONTENT
                </button>
              </div>
            </div>
          )}
        </div>
        <div
          className={form_styles.form_input_event_name_wrap}
          ref={nameElemRef}
        >
          <label
            className={form_styles.form_input_event_input_label}
            htmlFor="input_event_name"
          >
            <p className={form_styles.form_input_event_label_text}>
              Event Name
            </p>
            <p className={form_styles.form_input_event_label_hint}>
              Enter a unique title for your event
            </p>
          </label>
          <div className={form_styles.form_input_event_name_valid_rules_wrap}>
            {!formValidation.name.status ? (
              <p className={form_styles.form_input_event_name_valid_rules}>
                {`You can only use the following characters (a-z, 0-9) without special symbols. Max length - 150 characters`}
              </p>
            ) : null}
            <p className={form_styles.form_input_event_name_length_counter}>{`${
              newBookingData.eventName ? newBookingData.eventName.length : 0
            }/150`}</p>
          </div>
          <input
            className={`${form_styles.form_input_event_name} ${
              !formValidation.name.status
                ? form_styles.form_input_validation_error
                : ""
            }`}
            id="input_event_name"
            type="text"
            value={newBookingData.eventName || ""}
            onChange={handleFormInputChange}
            onBlur={() =>
              setFormValidation((prev) => {
                return {
                  ...prev,
                  name: { status: checkNameValid(), elemRef: nameElemRef },
                };
              })
            }
            placeholder="Name"
          />
        </div>
        <div
          className={form_styles.form_input_event_description_wrap}
          ref={descriptionElemRef}
        >
          <label
            className={form_styles.form_input_event_input_label}
            htmlFor="input_event_description"
          >
            <p className={form_styles.form_input_event_label_text}>
              Description
            </p>
            <p className={form_styles.form_input_event_label_hint}>
              Enter the details of your personal event
            </p>
          </label>
          <div className={form_styles.form_input_event_name_valid_rules_wrap}>
            {!formValidation.description.status ? (
              <p className={form_styles.form_input_event_name_valid_rules}>
                {`You can only use the following characters (a-z, 0-9) without special symbols. Max length - 700 characters`}
              </p>
            ) : null}
            <p className={form_styles.form_input_event_name_length_counter}>{`${
              newBookingData.description ? newBookingData.description.length : 0
            }/700`}</p>
          </div>
          <textarea
            className={`${form_styles.form_input_event_description} ${
              !formValidation.description.status
                ? form_styles.form_input_validation_error
                : ""
            }`}
            id="input_event_description"
            value={newBookingData.description || ""}
            onChange={handleFormInputChange}
            onBlur={() =>
              setFormValidation((prev) => {
                return {
                  ...prev,
                  description: {
                    status: checkDescriptionValid(),
                    elemRef: descriptionElemRef,
                  },
                };
              })
            }
            rows={6}
            placeholder="Description"
          />
        </div>
        <div className={form_styles.form_input_event_date_wrap}>
          <label
            className={form_styles.form_input_event_input_label}
            htmlFor="input_event_date"
          >
            <p className={form_styles.form_input_event_label_text}>
              Date (UTC+0)
            </p>
            <p className={form_styles.form_input_event_label_hint}>
              Not editable once booked.
            </p>
          </label>
          <input
            className={form_styles.form_input_event_date}
            id="input_event_date"
            value={newBookingData.date}
            onChange={handleFormInputChange}
            onFocus={updateValidationState}
            onBlur={updateValidationState}
            type="date"
            placeholder="enter date"
            disabled={isEdit}
            required
          />
        </div>
        <div
          className={form_styles.form_input_event_time_wrap}
          ref={timeElemRef}
        >
          <label className={form_styles.form_input_event_input_label}>
            <p className={form_styles.form_input_event_label_text}>
              Time (UTC+0)
            </p>
            <p className={form_styles.form_input_event_label_hint}>
              Select available slots from list. Selected slots must go in order.
              Each slot is 30 minutes long. Not editable once booked.
            </p>
          </label>
          <div
            className={`${form_styles.form_input_event_time_block_wrap} ${
              !formValidation.time.status
                ? form_styles.form_input_event_time_block_valid_error
                : ""
            } ${
              isEdit ? form_styles.form_input_event_time_block_disabled : ""
            }`}
          >
            <div className={form_styles.form_input_event_time_block}>
              {timePoints.currentDay.map((time) => (
                <div
                  key={uuidv4()}
                  className={`${form_styles.form_input_event_time_block_item} ${
                    time.isTimeBooked && !time.isMarkAsBooked
                      ? form_styles.form_input_event_time_block_item_past
                      : ""
                  } ${
                    selectedTimestamps.some(
                      (selTime) => selTime === time.timestamp
                    ) || time.isMarkAsBooked
                      ? form_styles.form_input_event_time_block_item_active
                      : ""
                  } ${
                    checkTimeItemUiSibling(time)
                      ? form_styles.form_input_event_time_block_item_sibling
                      : ""
                  }`}
                  onClick={handleTimePointClick}
                  data-timestamp={time.timestamp}
                  data-is_time_booked={time.isTimeBooked}
                >
                  <span>{time.value}</span>
                </div>
              ))}
            </div>
            <p className={form_styles.form_input_event_time_block_next_day}>
              {timePoints.nextDayDate}
            </p>
            <div className={form_styles.form_input_event_time_block}>
              {timePoints.nextDay.map((time) => (
                <div
                  key={uuidv4()}
                  className={`${form_styles.form_input_event_time_block_item} ${
                    time.isTimeBooked && !time.isMarkAsBooked
                      ? form_styles.form_input_event_time_block_item_past
                      : ""
                  } ${
                    selectedTimestamps.some(
                      (selTime) => selTime === time.timestamp
                    ) || time.isMarkAsBooked
                      ? form_styles.form_input_event_time_block_item_active
                      : ""
                  } ${
                    checkTimeItemUiSibling(time)
                      ? form_styles.form_input_event_time_block_item_sibling
                      : ""
                  }`}
                  onClick={handleTimePointClick}
                  data-timestamp={time.timestamp}
                  data-is_time_booked={time.isTimeBooked}
                >
                  <span>{time.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* <div className={form_styles.form_input_event_start_date_wrap}>
          <div className={form_styles.form_input_event_start_date_time_wrap}>
            <label
              className={form_styles.form_input_event_start_date_label}
              htmlFor="select_event_start_date"
            >
              Event Start Date
            </label>
            <p className={form_styles.form_input_event_post_label}>
              Pick the start date of your event
            </p>
            <select
              className={form_styles.form_input_event_start_date}
              id="select_event_start_date"
              onChange={handleFormInputChange}
              value={newBookingData.startDate}
              disabled={isEdit}
            >
              {(function () {
                const options = getStartDateOptions();
                if (options.length) {
                  return options.map((value) => (
                    <option key={uuidv4()} value={value.timestamp}>
                      {value.text}
                    </option>
                  ));
                } else {
                  return (
                    <option key={uuidv4()} value={""}>
                      select time point
                    </option>
                  );
                }
              })()}
            </select>
          </div>
          <div className={form_styles.form_input_event_start_date_time_wrap}>
            <label
              className={form_styles.form_input_event_start_date_label}
              htmlFor="input_event_start_time"
            >
              Event Start Time
            </label>
            {timeErrorMsg ? (
              <span className={form_styles.form_input_event_start_date_time_error}>
                Error! You must set the time only within the selected time range
              </span>
            ) : null}
            <p className={form_styles.form_input_event_post_label}>
              Pick the start time of your event
            </p>
            <input
              className={form_styles.form_input_event_start_date}
              id="input_event_start_time"
              type="time"
              value={newBookingData.startTime || ""}
              onChange={handleFormInputChange}
              placeholder="enter start time"
              disabled={isEdit}
            />
          </div>
        </div> */}
        <div className={form_styles.form_submit_button_wrap}>
          <button className={form_styles.form_submit_button} type="submit">
            SAVE
          </button>
        </div>
      </form>
      {isLoaderVisible ? (
        <div
          className={`${loaders.add_content_loader_wrap} ${loaders.add_content_loader_wrap__new_booking}`}
        >
          <div className={loaders.loader_ring} />
        </div>
      ) : null}
    </div>
  );
};

const ImgPosterPrev = (props: { posterImgSrc: string }) => {
  const [isImgLoaded, setIsImgLoaded] = useState<boolean>(false);
  return (
    <>
      <div
        className={`${loaders.img_loader} ${
          loaders.img_loader_event_poster_booking_form
        } ${
          isImgLoaded ? loaders.img_hidden_state : loaders.img_visible_state
        }`}
      >
        <img src="/icons/image.svg" alt="loader_img_icon" />
      </div>
      <img
        className={`${form_styles.form_input_add_img_temporary_poster} ${
          isImgLoaded ? loaders.img_visible_state : loaders.img_hidden_state
        }`}
        src={props.posterImgSrc}
        onLoad={() => setIsImgLoaded(true)}
      />
    </>
  );
};
