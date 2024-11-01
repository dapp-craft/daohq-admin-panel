import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const Dashboard = () => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (pathname === '/') {
            navigate('/booking', { replace: true })
        }
    })
    return (
        <></>
    );
};
