import { FormEvent, useEffect, useRef, useState } from "react";
import processApi from "../../scripts/processApi";
import users_style from "../../styles/modules/users.module.scss";
import { isAddress } from "ethers";
import { errorHandler } from "../../scripts/errorHandler";
import { backendUrl } from "../../main";

enum Roles {
  SuperAmin = "superadmin",
  Admin = "admin",
  User = "",
}

type User = {
  address: string;
  role: Roles;
};

function findByAddress(address: string, users: User[]) {
  const lowerCaseAddress = address.toLowerCase();
  for (const u of users)
    if (u.address.toLowerCase() == lowerCaseAddress) return u;

  return undefined;
}

function isValidAddress(address: string) {
  return address && isAddress(address);
}

export default function Users() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchResult, setSearchResult] = useState<User[]>([]);
  const [dataToSearch, setDataToSearch] = useState<string>("");
  const [roleConfirmation, setRoleConfirmation] = useState<User>({
    role: Roles.User,
    address: "",
  });

  const handleChangeRole = async (
    ev: FormEvent<HTMLSelectElement>
  ): Promise<void> => {
    const userId: string | undefined = ev.currentTarget.dataset.user;
    const role: Roles = ev.currentTarget.value as Roles;
    if (userId) {
      setRoleConfirmation({ role, address: userId });
      dialog.current?.showModal();
    } else {
      console.error(`user not specified`);
    }
  };

  const getUsersData = async (): Promise<void> => {
    try {
      const res = await processApi({ url: `${backendUrl}/users` });
      if (res.result && Array.isArray(res.result)) {
        setUsers(res.result);
      }
      if (res.error.statusCode || res.error.description) {
        errorHandler(
          "Can't get users data!",
          res.error,
          () => (window.location.href = "/")
        );
      }
    } catch (error) {
      errorHandler(
        "Can't get users data!",
        { description: error },
        () => (window.location.href = "/")
      );
    }
  };

  const handleItemSearch = (ev: React.ChangeEvent<HTMLInputElement>): void => {
    setDataToSearch(ev.target.value);
  };

  const updateRoleInDb = async (): Promise<void> => {
    let method: string | null = null;
    if (roleConfirmation.role === Roles.Admin) method = "POST";
    if (roleConfirmation.role === Roles.User) method = "DELETE";
    if (method) {
      try {
        const res = await processApi({
          url: `${backendUrl}/admins/${roleConfirmation.address}`,
          method,
        });
        if (res.error.statusCode || res.error.description) {
          cancelConfirmation();
          errorHandler("Failed to process user role!", res.error);
        }
      } catch (error) {
        cancelConfirmation();
        errorHandler("Failed to process user role!", { description: error });
      }
    }

    const user = findByAddress(roleConfirmation.address, users);
    if (user) {
      user.role = roleConfirmation.role;
      setUsers([...users]);
    } else {
      const newUser = {
        role: roleConfirmation.role,
        address: roleConfirmation.address,
      };
      setUsers([...users, newUser]);
    }

    dialog.current?.close();
    setRoleConfirmation({ role: Roles.User, address: "" });
  };

  const cancelConfirmation = (): void => {
    dialog.current?.close();
    setRoleConfirmation({ role: Roles.User, address: "" });
  };

  useEffect(() => {
    getUsersData();
  }, []);

  useEffect(() => {
    if (dataToSearch) {
      const lowercaseSearch = dataToSearch.toLowerCase();
      const addressFilter = (u: User) =>
        u.address.toLowerCase().includes(lowercaseSearch);
      const filteredUsers = users.filter(addressFilter);
      if (filteredUsers.length == 0 && isValidAddress(dataToSearch)) {
        const tempUser = {
          address: dataToSearch,
          role: Roles.User,
          temp: true,
        };
        filteredUsers.push(tempUser);
      }
      setSearchResult(filteredUsers);
    } else {
      setSearchResult([]);
    }
  }, [dataToSearch, users.length]);

  return (
    <div className={users_style.users_container}>
      <p>
        Grant or revoke admin privileges by assigning roles to users
        accordingly.
      </p>
      <label
        className={users_style.users_search_input_label}
        htmlFor="users-search-input"
      >
        User <code>ETH</code> wallet (existing or new)
      </label>
      <div className={users_style.users_search_panel}>
        <div className={users_style.users_search_input_wrap}>
          <img
            className={users_style.users_search_icon}
            src="/icons/search.svg"
            alt="search_icon"
          />
          <input
            id="users-search-input"
            className={users_style.users_search_input}
            type="text"
            value={dataToSearch}
            onChange={handleItemSearch}
            placeholder="0x0000000000000000000000000000000000000000"
          />
        </div>
        {/* <button
          className="users-search-button"
        // onClick={handleItemSearch}
        >
          SEARCH
        </button> */}
      </div>
      <div className={users_style.user_list} id="user-list">
        {users.length > 0 && (!dataToSearch.length || searchResult.length) ? (
          <>
            <table>
              <thead>
                <tr className={users_style.user_list_header}>
                  <th>User Wallet</th>
                  <th>User Role</th>
                </tr>
              </thead>

              <tbody>
                {(searchResult.length > 0 ? searchResult : users).map(
                  (user) => (
                    <tr key={user.address} className={users_style.item}>
                      <td className={users_style.wallet}>
                        <code>{user.address}</code>
                      </td>
                      <td>
                        {user.role === Roles.SuperAmin ? (
                          <select
                            className={users_style.select_role}
                            name="role"
                            data-user={user.address}
                            value={user.role}
                            disabled={true}
                          >
                            <option value={Roles.SuperAmin}>Super Admin</option>
                          </select>
                        ) : (
                          <select
                            className={users_style.select_role}
                            name="role"
                            data-user={user.address}
                            value={user.role}
                            onChange={handleChangeRole}
                          >
                            <option value={Roles.User}>User</option>
                            <option value={Roles.Admin}>Admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </>
        ) : dataToSearch ? (
          <p>
            <i>
              Invalid <code>ETH</code> wallet.
            </i>
          </p>
        ) : (
          <p>
            <i>
              No Users. Enter valid <code>ETH</code> wallet to grant{" "}
              <b>admin</b>.
            </i>
          </p>
        )}
      </div>

      <dialog ref={dialog} className={users_style.confirm_modal}>
        <p>
          You are about to{" "}
          <b>{roleConfirmation.role == Roles.Admin ? "grant" : "revoke"}</b>{" "}
          user <b>admin role</b>
        </p>
        <p>
          <code>{roleConfirmation.address}</code>
        </p>
        <p>Are you sure?</p>
        <div className={users_style.confirm_modal_buttons}>
          <button
            className={users_style.confirm_modal_buttons_confirm}
            onClick={updateRoleInDb}
            type="submit"
          >
            Yes
          </button>
          <button
            className={users_style.confirm_modal_buttons_cancel}
            onClick={cancelConfirmation}
            type="reset"
          >
            No
          </button>
        </div>
      </dialog>
    </div>
  );
}
