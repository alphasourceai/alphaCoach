import { supabase } from '../lib/supabaseClient';

export default function SignOutButton() {
  async function onClick(e) {
    e.preventDefault();
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign('/signin');
    }
  }

  return (
    <button className="ghost-btn" onClick={onClick}>
      Sign out
    </button>
  );
}
