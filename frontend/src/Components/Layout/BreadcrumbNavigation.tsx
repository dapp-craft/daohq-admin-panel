import { IBreadcrumbItem, breadcrumbStore } from "../../store/store";
import layout from "../../styles/modules/layout.module.scss";
import { v4 as uuidv4 } from "uuid";
import { Link } from "react-router-dom";
import { memo, useEffect } from "react";
import { breadcrumbSync } from "../../scripts/breadcrumbSync";

const BreadcrumbNavigation = () => {
  const { breadcrumbsParts, setBreadcrumbsParts } = breadcrumbStore();

  const getCurrentPath = (currentPart: IBreadcrumbItem): string => {
    const index = breadcrumbsParts.indexOf(currentPart);
    const currentParts = breadcrumbsParts.slice(0, index + 1);
    const path: string = currentParts.map((part) => part.path).join("");
    return path;
  };

  useEffect(() => {
    breadcrumbSync();
    window.addEventListener("popstate", () => breadcrumbSync());
    return () => window.removeEventListener("popstate", () => breadcrumbSync());
  }, []);

  return (
    <div className={layout.breadcrumbs}>
      {breadcrumbsParts.map((part, index) => (
        <div key={uuidv4()} className={layout.breadcrumbs_link_wrap}>
          <Link
            className={layout.breadcrumbs_link}
            to={getCurrentPath(part)}
            onClick={() =>
              setBreadcrumbsParts({
                newPart: part,
              })
            }
          >
            {part.name.replace(/_/g, " ")}
          </Link>
          {index !== breadcrumbsParts.length - 1 ||
          (breadcrumbsParts.length === 1 && part.path !== "/") ? (
            <span>{` \n> `}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default memo(BreadcrumbNavigation);
