import { Link, useNavigate, useParams } from "react-router-dom";
import {
  breadcrumbStore,
  locationsSchemaStore,
  selectedDiscordBoardStore,
} from "../../store/store";
import loaders from "../../styles/modules/loaders.module.scss";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState } from "react";
import { IDiscordBoard } from "../Booking/LocationsMenu";
import scene from "../../styles/modules/scene.module.scss";
import slot_styles from "../../styles/modules/slot.module.scss";
import processApi from "../../scripts/processApi";
import { backendUrl } from "../../main";
import { breadcrumbSync } from "../../scripts/breadcrumbSync";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { errorHandler } from "../../scripts/errorHandler";

interface IFullBoardInfo extends IDiscordBoard {
  images: IBoardImage[];
}

interface IBoardImage {
  message_link: string;
  guild: string | number;
  channel: string;
  s3_urn: string;
  screen_id: string;
}

export const DiscordScreenItem = () => {
  const [fullBoardInfo, setFullBoardInfo] = useState<IFullBoardInfo | null>(
    null
  );
  const { selectedDiscordBoard, setSelectedDiscordBoard } =
    selectedDiscordBoardStore();
  const { setBreadcrumbsParts } = breadcrumbStore();
  const params = useParams();
  const { locationsSchema } = locationsSchemaStore();
  const navigate = useNavigate();

  const getDiscordBoardInfo = (): IDiscordBoard | undefined => {
    for (const locType in locationsSchema) {
      const locations = locationsSchema[locType]?.locations;
      if (locations) {
        for (const location of locations) {
          const selectedBoardInfo = location.discord_screens?.find(
            (b) => b.id === selectedDiscordBoard
          );

          if (selectedBoardInfo) return selectedBoardInfo;
        }
      }
    }

    return undefined;
  };

  const getDiscordImages = async (
    discordId: string
  ): Promise<IBoardImage[] | undefined> => {
    try {
      const res = await processApi({
        url: `${backendUrl}/discord/screens/${discordId}/images`,
      });
      if (res.result && Array.isArray(res.result) && res.result.length) {
        return res.result as IBoardImage[];
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler("Can't get discord images data!", res.error, () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        });
      }
    } catch (error) {
      errorHandler(
        "Can't get discord images data!",
        { description: error },
        () => {
          navigate(-1);
          window.history.replaceState({}, window.location.href);
        }
      );
    }
  };

  const getFullBoardInfo = async () => {
    let fullBoardInfo: IFullBoardInfo | null = null;
    const boardInfo = getDiscordBoardInfo();
    if (boardInfo) {
      fullBoardInfo = {
        ...boardInfo,
        images: (await getDiscordImages(boardInfo.id)) || [],
      };
      setFullBoardInfo(fullBoardInfo);
    }
  };

  useEffect(() => {
    if (!selectedDiscordBoard) {
      if (params.discordId) {
        setSelectedDiscordBoard(params.discordId);
      }
    }
    breadcrumbSync();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (locationsSchema) getFullBoardInfo();
  }, [selectedDiscordBoard, locationsSchema]);

  return (
    <div className={scene.discord_board_content_wrap}>
      {fullBoardInfo ? (
        <>
          <p className={scene.discord_board_item_title}>
            {fullBoardInfo.description}
          </p>
          <div className={scene.discord_board_item_info_wrap}>
            <div className={scene.discord_board_item_text_wrap}>
              <p className={scene.discord_board_item_text}>
                Channel:{" "}
                {fullBoardInfo.channel
                  ? fullBoardInfo.channel
                  : "no channel is connected"}
              </p>
              <p className={scene.discord_board_item_text}>
                Guild Id:{" "}
                {fullBoardInfo.guild
                  ? fullBoardInfo.guild
                  : "no guild is connected"}
              </p>
            </div>
            <div className={slot_styles.slot_list_item_button_wrap}>
              <Link
                to={"edit_channel"}
                className={`${slot_styles.slot_list_item_edit_link} ${slot_styles.slot_list_item_edit_link__discord}`}
                onClick={() =>
                  setBreadcrumbsParts({
                    newPart: {
                      level: 5,
                      path: `/edit_channel`,
                      name: "Connect Discord",
                    },
                  })
                }
              >
                CONNECT DISCORD CHANNEL
              </Link>
            </div>
          </div>
          {fullBoardInfo.images.length ? (
            fullBoardInfo.images.map((imageItem) => (
              <div
                key={uuidv4()}
                className={scene.discord_board_item_grid_wrap}
              >
                <DiscordItem
                  imageItem={imageItem}
                  getFullBoardInfo={getFullBoardInfo}
                />
              </div>
            ))
          ) : (
            <p className={slot_styles.slot_list_empty_msg}>
              There are no images at this discord board
            </p>
          )}
        </>
      ) : null}
    </div>
  );
};

const DiscordItem = (props: {
  imageItem: IBoardImage;
  getFullBoardInfo: () => Promise<void>;
}) => {
  const { imageItem, getFullBoardInfo } = props;
  const [isDelConfirmModal, setIsDelConfirmModal] = useState<boolean>(false);
  const [discordMsgLinkToDel, setDiscordMsgLinkToDel] = useState<string | null>(
    null
  );

  const switchConfirmContentDel = (msgLinkToDel: string) => {
    setDiscordMsgLinkToDel(msgLinkToDel);
    setIsDelConfirmModal((prev) => !prev);
  };

  const handleDiscordItemDel = async () => {
    try {
      const res = await processApi({
        url: `${backendUrl}/discord/images?message_link=${discordMsgLinkToDel}`,
        method: "DELETE",
      });
      if (res.error.statusCode || res.error.description) {
        errorHandler("Failed to delete the selected discord item!", res.error);
      }
    } catch (error) {
      errorHandler("Failed to delete the selected discord item!", {
        description: error,
      });
    }
    setIsDelConfirmModal((prev) => !prev);
    getFullBoardInfo();
  };

  return (
    <>
      <div className={scene.discord_board_item_preview_wrap}>
        <DiscordPreviewImage url={imageItem.s3_urn} />
      </div>
      <div className={scene.discord_board_item_link_wrap}>
        <a
          target="_blank"
          rel="noopener noreferrer"
          className={scene.discord_board_item_link}
          href={imageItem.message_link}
        >
          {imageItem.message_link}
        </a>
      </div>
      <div
        data-modal_btn_prefix={`discord_${imageItem.message_link}_del`}
        className={scene.discord_board_item_button_wrap}
      >
        <button
          data-modal_btn_prefix={`discord_${imageItem.message_link}_del`}
          onClick={() => switchConfirmContentDel(imageItem.message_link)}
          className={scene.discord_board_item_button}
        >
          <img
            data-modal_btn_prefix={`discord_${imageItem.message_link}_del`}
            src="/icons/basket.svg"
            alt="discord_delete_icon"
          />
        </button>
      </div>
      {isDelConfirmModal ? (
        <ConfirmActionModal
          actionMsg="Do you confirm the deletion of this discord item"
          yesActionEvent={handleDiscordItemDel}
          noActionEvent={() => setIsDelConfirmModal((prev) => !prev)}
          modalPrefix={`discord_${imageItem.message_link}_del`}
        />
      ) : null}
    </>
  );
};

const DiscordPreviewImage = (props: { url: string }) => {
  const [isImgLoaded, setIsImgLoaded] = useState<boolean>(false);
  return (
    <>
      <div
        className={`${loaders.img_loader} ${
          loaders.img_loader_discord_preview
        } ${
          isImgLoaded ? loaders.img_hidden_state : loaders.img_visible_state
        }`}
      >
        <img src="/icons/image.svg" alt="loader_img_icon" />
      </div>
      <img
        className={`${scene.discord_board_item_preview} ${
          isImgLoaded ? loaders.img_visible_state : loaders.img_hidden_state
        }`}
        src={props.url ? props.url : "/icons/image.svg"}
        alt="discord_preview_img"
        onLoad={() => setIsImgLoaded(true)}
      />
    </>
  );
};
