import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, NavLink } from "react-router-dom";
import ClientPicker from "./ClientPicker.jsx";

export default function NavBar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/signin");
  };

  const linkCls = ({ isActive }) => `px-2 py-1 ${isActive ? "font-semibold" : ""}`;

  return (
    <div className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl flex items-center justify-between p-4">
        <nav className="flex gap-4">
          <NavLink to="/roles" className={linkCls}>Roles</NavLink>
          <NavLink to="/candidates" className={linkCls}>Candidates</NavLink>
          <NavLink to="/account" className={linkCls}>Account</NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <ClientPicker />
          {user && (
            <button onClick={signOut} className="rounded-md px-3 py-1.5 border">Sign Out</button>
          )}
        </div>
      </div>
    </div>
  );
}
