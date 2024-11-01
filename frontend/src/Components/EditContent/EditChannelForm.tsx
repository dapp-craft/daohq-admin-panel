import { useEffect, useState } from "react";
import {
  locationsSchemaStore,
  selectedDiscordBoardStore,
  selectedLocationStore,
} from "../../store/store";
import scene from "../../styles/modules/scene.module.scss";
import booking_form_styles from "../../styles/modules/bookingForm.module.scss";
import content_form_styles from "../../styles/modules/contentForm.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import processApi, { MyFetchProps } from "../../scripts/processApi";
import { backendUrl } from "../../main";
import { getLocationsSchema } from "../../scripts/getLocationsSchema";
import { errorHandler } from "../../scripts/errorHandler";

export const EditChannelForm = () => {
  const maxChanelIdLength = 120;
  const [discordBoardName, setDiscordBoardName] = useState<string | null>(null);
  const [formValidation, setFormValidation] = useState<{
    chanelId: boolean;
    GUID: boolean;
  }>({
    chanelId: true,
    GUID: true,
  });
  const [editChannelInputsVal, setEditChannelInputsVal] = useState<{
    channelId: string;
    GUID: string;
  }>({ channelId: "", GUID: "" });
  const { locationsSchema } = locationsSchemaStore();
  const { selectedDiscordBoard } = selectedDiscordBoardStore();
  const { selectedLocation } = selectedLocationStore();
  const navigate = useNavigate();
  const params = useParams();

  const getDiscordBoardName = () => {
    const discordBoardId = selectedDiscordBoard || params.discordId;
    for (const locType in locationsSchema) {
      if ("locations" in locationsSchema[locType]) {
        const locGroup = locationsSchema[locType].locations;
        if (locGroup) {
          locGroup.forEach(async (locItem) => {
            if (locItem.discord_screens) {
              const selectedBoardInfo = locItem.discord_screens.find(
                (discordBoard) => discordBoard.id === discordBoardId
              );
              if (selectedBoardInfo)
                setDiscordBoardName(selectedBoardInfo.description);
            }
          });
        }
      }
    }
  };

  const checkInputDataValid = (
    value: string | undefined,
    maxLength: number,
    rule?: RegExp
  ): boolean => {
    if (value) {
      if (rule) {
        return rule.test(value) && value.length <= maxLength;
      } else {
        return value.length <= maxLength;
      }
    } else {
      return false;
    }
  };

  const checkChanelId = (): boolean => {
    return checkInputDataValid(
      editChannelInputsVal.channelId,
      maxChanelIdLength
    );
  };

  const checkGUID = (guidVal: string): boolean => {
    return guidVal.length > 0;
  };

  const checkAllInputs = () => {
    setFormValidation({
      chanelId: checkChanelId(),
      GUID: checkGUID(editChannelInputsVal.GUID),
    });
    return checkChanelId() && checkGUID(editChannelInputsVal.GUID);
  };

  const handleFormSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (checkAllInputs()) {
      const discordBoardId = selectedDiscordBoard || params.discordId;
      const locationId = selectedLocation || params.locationId;
      const fetchProps: MyFetchProps = {
        url: `${backendUrl}/discord/screens/${discordBoardId}`,
        method: "PUT",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          guild: editChannelInputsVal.GUID.trim(),
          channel: editChannelInputsVal.channelId.trim(),
        }),
      };

      try {
        const res = await processApi(fetchProps);
        if (res.error.statusCode || res.error.description) {
          errorHandler(
            "Failed to process discord chanel data!",
            res.error,
            () => {
              navigate(-1);
              window.history.replaceState({}, window.location.href);
            }
          );
        }
      } catch (error) {
        errorHandler(
          "Failed to process discord chanel data!",
          { description: error },
          () => {
            navigate(-1);
            window.history.replaceState({}, window.location.href);
          }
        );
      }

      await getLocationsSchema(false);
      navigate(`/scene/${locationId}/discord/${discordBoardId}`);
    }
  };

  const handleTextInputsChange = (ev: React.FormEvent<HTMLInputElement>) => {
    const value = ev.currentTarget.value;
    const id = ev.currentTarget.id;
    setEditChannelInputsVal((prev) => {
      if (id === "scene_edit_channel_chanel_id") {
        const isChanelIdValid =
          checkInputDataValid(value, maxChanelIdLength) || value.length === 0;
        setFormValidation((prev) => {
          return { ...prev, chanelId: isChanelIdValid };
        });
        if (isChanelIdValid) return { ...prev, channelId: value };
      }
      if (id === "scene_edit_channel_GUID") {
        setFormValidation((prev) => {
          return { ...prev, GUID: value.length > 0 };
        });
        return { ...prev, GUID: value };
      }
      return prev;
    });
  };

  useEffect(() => {
    if (locationsSchema) getDiscordBoardName();
  }, [locationsSchema]);

  return (
    <div className={scene.edit_discord_channel}>
      <form onSubmit={handleFormSubmit}>
        <div className={content_form_styles.form_title_wrap}>
          <p className={scene.edit_discord_channel_title}>
            {discordBoardName
              ? discordBoardName
              : "This discord board has no name"}
          </p>
          <button
            type="submit"
            className={content_form_styles.form_save_button}
          >
            SAVE
          </button>
        </div>
        <div className={scene.edit_discord_channel_inputs_wrap}>
          <div
            className={`${content_form_styles.form_input_wrap} ${content_form_styles.form_input_wrap__discord}`}
          >
            <label
              htmlFor="scene_edit_channel_chanel_id"
              className={content_form_styles.form_label}
            >
              Channel Name
            </label>
            <div className={content_form_styles.form_input_container}>
              <div
                className={
                  booking_form_styles.form_input_event_name_valid_rules_wrap
                }
              >
                {!formValidation.chanelId ? (
                  <p
                    className={
                      booking_form_styles.form_input_event_name_valid_rules
                    }
                  >
                    {`You can only use the following characters (a-z, 0-9) without special symbols. Max length - 120 characters`}
                  </p>
                ) : null}
                <p
                  className={content_form_styles.form_input_length_counter}
                >{`${
                  editChannelInputsVal.channelId
                    ? editChannelInputsVal.channelId.length
                    : 0
                }/120`}</p>
              </div>
              <input
                className={`${content_form_styles.form_input} ${
                  !formValidation.chanelId
                    ? content_form_styles.form_input_valid_error
                    : ""
                }`}
                id="scene_edit_channel_chanel_id"
                name="scene_new_chanel_id"
                onChange={handleTextInputsChange}
                value={editChannelInputsVal.channelId}
                type="text"
                onBlur={() => {
                  setFormValidation((prev) => {
                    return { ...prev, chanelId: checkChanelId() };
                  });
                }}
              />
            </div>
          </div>
          <div
            className={`${content_form_styles.form_input_wrap} ${content_form_styles.form_input_wrap__discord}`}
          >
            <label
              htmlFor="scene_edit_channel_GUID"
              className={content_form_styles.form_label}
            >
              <a
                href="https://discord.com/developers/docs/resources/guild"
                target="_blank"
              >
                Guild Id
              </a>
            </label>
            <div className={content_form_styles.form_input_container}>
              {!formValidation.GUID ? (
                <p
                  className={
                    booking_form_styles.form_input_event_name_valid_rules
                  }
                >
                  You must enter the GUID of the channel.
                </p>
              ) : null}
              <input
                className={`${content_form_styles.form_input} ${
                  !formValidation.GUID
                    ? content_form_styles.form_input_valid_error
                    : ""
                }`}
                id="scene_edit_channel_GUID"
                name="scene_new_GUID"
                onChange={handleTextInputsChange}
                value={editChannelInputsVal.GUID}
                type="text"
                onBlur={() => {
                  setFormValidation((prev) => {
                    return {
                      ...prev,
                      GUID: checkGUID(editChannelInputsVal.GUID),
                    };
                  });
                }}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
