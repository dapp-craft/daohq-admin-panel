import { memo, useEffect, useRef, useState } from "react";
import {
  locationsSchemaStore,
  selectedLocationStore,
  userRoleStore,
} from "../../store/store";
import { useParams } from "react-router-dom";
import processApi from "../../scripts/processApi";
import { backendUrl } from "../../main";
import { getLocationsSchema } from "../../scripts/getLocationsSchema";
import loaders from "../../styles/modules/loaders.module.scss";
import banner_styles from "../../styles/modules/banner.module.scss";
import { errorHandler } from "../../scripts/errorHandler";

const LocationPreview = () => {
  const [locationPreviewImgUrl, setLocationPreviewImgUrl] =
    useState<string>("/images/banner.png");
  const [locationPreviewFile, setLocationPreviewFile] = useState<File | null>(
    null
  );
  const { userRole } = userRoleStore();
  const { selectedLocation } = selectedLocationStore();
  const [isLoaderVisible, setIsLoaderVisible] = useState<boolean>(false);
  const { locationsSchema, setLocationsSchema } = locationsSchemaStore();
  const params = useParams();
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChanger = (ev: React.FormEvent<HTMLInputElement>) => {
    const file = ev.currentTarget.files ? ev.currentTarget.files[0] : null;
    setLocationPreviewFile(file);
  };

  const getPreviewLocationImgUrl = () => {
    let url: string | null = null;
    if (locationPreviewFile) {
      url = URL.createObjectURL(locationPreviewFile);
    } else {
      for (const key in locationsSchema) {
        const currentLocations = locationsSchema[key].locations;
        if (currentLocations) {
          currentLocations.forEach((loc) => {
            if (loc.id === selectedLocation && loc.locationPreview) {
              url = loc.locationPreview;
            }
            return;
          });
        }
      }
    }
    if (url) {
      setIsLoaderVisible(true);
      setLocationPreviewImgUrl(url);
    } else {
      setLocationPreviewImgUrl("/images/banner.png");
    }
  };

  const handleLocPreviewImgChange = async () => {
    if (locationPreviewFile) {
      setIsLoaderVisible(true);
      const formData = new FormData();
      formData.append("preview", locationPreviewFile);

      try {
        const res = await processApi({
          url: `${backendUrl}/locations/${
            selectedLocation || params.locationId
          }/preview`,
          method: "PATCH",
          body: formData,
        });
        if (res.error.statusCode || res.error.description) {
          errorHandler("Can't get location preview image!", res.error);
        }
      } catch (error) {
        errorHandler("Can't get location preview image!", {
          description: error,
        });
      }

      setLocationPreviewFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await getLocationsSchema(false);
      getPreviewLocationImgUrl();
      setIsLoaderVisible(false);
    }
  };

  const handleOnLoadImg = () => {
    setIsLoaderVisible(false);
  };

  useEffect(() => {
    if (imgRef.current && !imgRef.current.complete) setIsLoaderVisible(true);
  }, []);

  useEffect(() => {
    if (!locationsSchema) {
      const locationsSchemaLocStor = localStorage.getItem(
        "dao_hq_locationsSchema"
      );
      if (locationsSchemaLocStor) {
        setLocationsSchema(JSON.parse(locationsSchemaLocStor));
      }
    }
    if (selectedLocation && locationsSchema) getPreviewLocationImgUrl();
  }, [selectedLocation]);

  useEffect(() => {
    getPreviewLocationImgUrl();
  }, [locationPreviewFile]);

  return (
    <div className={banner_styles.banner_wrap}>
      <img
        className={banner_styles.banner_img}
        src={locationPreviewImgUrl}
        alt="banner_img"
        onLoad={handleOnLoadImg}
        ref={imgRef}
      />
      {userRole === "admin" || userRole === "superadmin" ? (
        <>
          <input
            ref={inputRef}
            onChange={handleFileInputChanger}
            className={banner_styles.banner_input}
            type="file"
            accept="image/png, image/jpeg"
          />
          {locationPreviewFile ? (
            <button
              className={banner_styles.banner_accept_btn}
              onClick={handleLocPreviewImgChange}
            >
              <img src="/icons/ok_icon.svg" alt="ok_btn_icon" />
            </button>
          ) : null}
        </>
      ) : null}
      {isLoaderVisible ? (
        <div className={loaders.location_preview_loader_wrap}>
          <div className={loaders.loader_ring} />
        </div>
      ) : null}
    </div>
  );
};

export default memo(LocationPreview);
