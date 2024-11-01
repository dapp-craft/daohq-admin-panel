import { useEffect, useState } from "react";
import { backendUrl } from "../../main";
import processApi from "../../scripts/processApi";
import {
  bookingContentLimitStore,
  selectedBookingStore,
  selectedLocationStore,
} from "../../store/store";
import loaders from "../../styles/modules/loaders.module.scss";
import content_form_styles from "../../styles/modules/contentForm.module.scss";
import slot_styles from "../../styles/modules/slot.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import { errorHandler } from "../../scripts/errorHandler";
import { getBookingContentLimit } from "../../scripts/getBookingContentLimit";

export const MusicAddForm = (props: { isScene: boolean }) => {
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isLoaderVisible, setIsLoaderVisible] = useState<boolean>(false);
  const { selectedLocation } = selectedLocationStore();
  const { selectedBooking } = selectedBookingStore();
  const { limit } = bookingContentLimitStore();
  const [formValidation, setFormValidation] = useState<{
    musicFile: boolean;
  }>({ musicFile: true });
  const params = useParams();
  const navigate = useNavigate();

  const handleContentFileChange = (ev: React.FormEvent<HTMLInputElement>) => {
    const file = ev.currentTarget.files ? ev.currentTarget.files[0] : null;
    setFormValidation({ musicFile: checkFileValid(file) });
    setMusicFile(file);
  };

  const addMusic = async () => {
    const isFileValid = checkFileValid(musicFile);
    setFormValidation({ musicFile: isFileValid });
    if (isFileValid) {
      setIsLoaderVisible(true);
      const formData = new FormData();
      if (musicFile) formData.append("file", musicFile);

      let url: string = `${backendUrl}/music-content?file_name=${
        musicFile?.name ? musicFile.name : "file without name"
      }&location=${selectedLocation || params.locationId}`;
      if (!props.isScene) {
        url = url.concat(`&booking=${selectedBooking?.id || params.bookingId}`);
      }

      try {
        const res = await processApi({
          url,
          method: "POST",
          body: formData,
        });
        if (res.error.statusCode || res.error.description) {
          errorHandler(
            "Failed to adding music content data!",
            res.error,
            () => {
              navigate(-1);
              window.history.replaceState({}, window.location.href);
            }
          );
        }
      } catch (error) {
        errorHandler(
          "Failed to adding music content data!",
          { description: error },
          () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          }
        );
      }

      setIsLoaderVisible(false);
      navigate(-1);
    }
  };

  const checkFileValid = (file: File | null): boolean => Boolean(file);

  useEffect(() => {
    const bookingId = selectedBooking?.id || params.bookingId;
    if (bookingId) getBookingContentLimit("music", bookingId);
  }, []);

  return (
    <div className={content_form_styles.form_music_add_content_form_wrap}>
      <div className={slot_styles.slot_title_wrap}>
        <p className={slot_styles.slot_title}>
          Music adding form in{" "}
          <span className={slot_styles.slot_title_brown}>
            {(selectedLocation || params.locationId)?.replace(/_/g, " ")}{" "}
          </span>
          location
        </p>
        <div
          className={`${slot_styles.slot_add_content_controls_wrap} ${slot_styles.slot_add_content_controls_wrap__form}`}
        >
          <button
            className={content_form_styles.form_save_button}
            onClick={addMusic}
          >
            SAVE
          </button>
          {limit.music.content_count !== null && limit.music.limit !== null ? (
            <div
              className={`${slot_styles.slot_list_limit_wrap} ${slot_styles.slot_list_limit_wrap__music}`}
            >
              <p className={slot_styles.slot_list_limit_label}>Music limit</p>
              <p
                className={slot_styles.slot_list_limit}
              >{`${limit.music.content_count}/${limit.music.limit}`}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className={content_form_styles.form_music_add_content_block_wrap}>
        <div
          className={`${content_form_styles.form_input_wrap} ${content_form_styles.form_input_wrap__file}`}
        >
          <label
            htmlFor="booking_add_content_file"
            className={`${content_form_styles.form_label__file} ${content_form_styles.form_music_add_content_label_wrap}`}
            onClick={() => setMusicFile(null)}
          >
            <span>Select your music *.mp3 file</span>
            <div
              className={content_form_styles.form_music_add_content_browse_wrap}
            >
              <span className={content_form_styles.form_fake_input}>
                BROWSE
              </span>
              <input
                className={`${content_form_styles.form_input} ${content_form_styles.form_input__file}`}
                onChange={handleContentFileChange}
                accept={".mp3"}
                id="booking_add_content_file"
                name="booking_content_file"
                type="file"
              />
              <span>Max size: 10Mb</span>
            </div>
          </label>
        </div>
        {!formValidation.musicFile ? (
          <p className={content_form_styles.form_music_add_content_valid_error}>
            No file selected. You must select a file.
          </p>
        ) : null}
        {musicFile ? (
          <div
            className={`${content_form_styles.form_music_item_audio_res_wrap} ${content_form_styles.form_music_item_audio_res_wrap__add_form}`}
          >
            <audio controls>
              <source src={URL.createObjectURL(musicFile)} type="audio/mpeg" />
            </audio>
            <span>{musicFile.name}</span>
          </div>
        ) : null}
      </div>
      {isLoaderVisible ? (
        <div className={loaders.add_content_loader_wrap}>
          <div className={loaders.loader_ring} />
        </div>
      ) : null}
    </div>
  );
};
